/**
 * Toast — the standard app toast/notification system. Use this for any
 * "fire and forget" async outcome that the operator must not miss (upload
 * results, background job completion/failure, sync errors).
 *
 * Root-cause context (64-17): a 1.5 GB layer ingest failed ~100s after the
 * upload UI reported "done." The backend correctly persisted the error and
 * broadcast a terminal `ingest_status: 'failed'` event, but the only surface
 * was a passive badge in a side panel the operator wasn't looking at — the
 * failure was effectively invisible. This component exists so async outcomes
 * get an unmissable, dismissible, portaled notification instead of a silent
 * row-level badge.
 *
 * Guarantees:
 *  - ALWAYS portaled to <body> (mirrors ui/Modal's portal discipline) — a
 *    toast raised from deep in a docked panel still floats above the page.
 *  - Sits at z-index 5500 — above ui/Modal (z-5000) so an outcome toast is
 *    never hidden behind an open dialog — while staying BELOW the
 *    ClassificationBanner (z-9999), which must remain visible at all times.
 *  - `error` toasts NEVER auto-dismiss — they persist until the operator
 *    explicitly dismisses them. `success`/`info`/`warning` auto-dismiss on a
 *    timer (pausable on hover/focus) so routine confirmations don't pile up.
 *  - Dismissible via a close button (TbX) or Escape while focused.
 *  - Accessible: error toasts use role="alert"/aria-live="assertive";
 *    success/info/warning use role="status"/aria-live="polite".
 *  - Compositor-safe animation only (transform + opacity); respects
 *    prefers-reduced-motion (framer-motion `useReducedMotion`).
 *  - Long messages wrap and scroll gracefully — never clipped, never a
 *    layout blowout.
 *  - `dedupeKey` collapses repeat calls (e.g. a duplicate WS delivery of the
 *    same terminal event) into a single toast instead of stacking a copy.
 *
 * Also the canonical app confirm() dialog (64-19 consolidation — supersedes
 * the old hand-rolled `context/ToastContext` confirm overlay, which duplicated
 * `ui/Modal`'s portal/backdrop/z-index/Esc-to-close behavior instead of reusing
 * it, per CLAUDE.md's "one component per pattern" rule). `useToast().confirm`
 * renders through `ui/Modal` so every dialog in the app shares one z-index
 * scheme, one backdrop, one Esc/close behavior.
 *
 * Usage:
 *   const { toast, confirm } = useToast()
 *   toast({ variant: 'error', title: 'Layer ingest failed', message: '...' })
 *   if (await confirm('Delete this layer?')) { ... }
 *
 * The provider must be mounted once per app/route root — do NOT mount it
 * per-component. `<ToastProvider>` renders its children unchanged and adds
 * the portaled viewport (+ any open confirm dialog) as siblings.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { TbX, TbAlertCircle, TbAlertTriangle, TbCircleCheck, TbInfoCircle } from 'react-icons/tb'
import { Button } from './Button.js'
import { Modal } from './Modal.js'
import { ToastCtx } from './useToast.js'

export type ToastVariant = 'error' | 'success' | 'info' | 'warning'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastOptions {
  variant: ToastVariant
  /** Optional bold lead-in (e.g. "Layer ingest failed"). */
  title?: string
  /** Body text. Long/multi-sentence messages wrap and scroll — never clipped. */
  message: string
  /**
   * Auto-dismiss delay in ms. Ignored for `variant: 'error'` — error toasts
   * never auto-dismiss. Defaults: success/info 5000ms, warning 7000ms.
   */
  duration?: number
  /** Optional single action button rendered next to the dismiss control. */
  action?: ToastAction
  /**
   * When a toast with the same `dedupeKey` is already showing, the existing
   * toast's content + timer are refreshed instead of stacking a duplicate.
   * Use this for events that may be delivered more than once (e.g. WS
   * reconnect resync of a terminal status).
   */
  dedupeKey?: string
}

interface ToastRecord extends ToastOptions {
  id: string
  /** Bumped whenever a dedupe-matched call refreshes this record — drives
   *  the auto-dismiss timer's reset without needing a fresh `id`/re-mount. */
  renewedAt: number
}

export interface ConfirmOptions {
  /** Modal title bar text (default "Confirm"). */
  title?: string
  /** Confirm button label (default "Confirm"). */
  confirmLabel?: string
  /** Cancel button label (default "Cancel"). */
  cancelLabel?: string
}

interface ConfirmRecord extends ConfirmOptions {
  id: number
  message: string
  resolve: (value: boolean) => void
}

// Above ui/Modal (z-5000) so an outcome toast is never masked by an open
// dialog; below the ClassificationBanner (z-9999), which is always visible.
const TOAST_Z_INDEX = 5500

// Cap the visible stack so a burst of events can't fill the screen.
const MAX_VISIBLE = 5

const DEFAULT_DURATION: Record<ToastVariant, number> = {
  error: Infinity, // never auto-dismiss — a missed failure must persist
  success: 5000,
  info: 5000,
  warning: 7000,
}

const VARIANT_COLOR: Record<ToastVariant, string> = {
  error: 'var(--color-destructive)',
  success: 'var(--status-success)',
  info: 'var(--status-info)',
  warning: 'var(--status-warning)',
}

function VariantIcon({ variant }: { variant: ToastVariant }) {
  const size = 16
  if (variant === 'error') return <TbAlertCircle size={size} />
  if (variant === 'success') return <TbCircleCheck size={size} />
  if (variant === 'warning') return <TbAlertTriangle size={size} />
  return <TbInfoCircle size={size} />
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([])
  const idRef = useRef(0)

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // ── Confirm dialog (FIFO queue — at most one Modal open at a time) ─────
  const confirmIdRef = useRef(0)
  const [confirmQueue, setConfirmQueue] = useState<ConfirmRecord[]>([])

  const confirm = useCallback((message: string, options?: ConfirmOptions) => {
    return new Promise<boolean>(resolve => {
      const id = ++confirmIdRef.current
      setConfirmQueue(prev => [...prev, { ...options, id, message, resolve }])
    })
  }, [])

  const resolveConfirm = useCallback((value: boolean) => {
    setConfirmQueue(prev => {
      if (prev.length === 0) return prev
      prev[0].resolve(value)
      return prev.slice(1)
    })
  }, [])

  const toast = useCallback((options: ToastOptions) => {
    const newId = `toast-${++idRef.current}`
    let resultId = newId
    setToasts(prev => {
      if (options.dedupeKey) {
        const idx = prev.findIndex(t => t.dedupeKey === options.dedupeKey)
        if (idx !== -1) {
          resultId = prev[idx].id
          const next = [...prev]
          next[idx] = { ...options, id: prev[idx].id, renewedAt: Date.now() }
          return next
        }
      }
      resultId = newId
      let next = [...prev, { ...options, id: newId, renewedAt: Date.now() }]
      if (next.length > MAX_VISIBLE) {
        // Evict the oldest non-error toast first so a missed-failure alert
        // isn't silently dropped by overflow. If every visible toast is an
        // error, evict the oldest one — an unbounded stack is not "sane".
        const evictIdx = next.findIndex(t => t.variant !== 'error')
        next = next.filter((_, i) => i !== (evictIdx !== -1 ? evictIdx : 0))
      }
      return next
    })
    return resultId
  }, [])

  return (
    <ToastCtx.Provider value={{ toast, dismiss, confirm }}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
      {confirmQueue.length > 0 && (
        <ConfirmDialog record={confirmQueue[0]} onResolve={resolveConfirm} />
      )}
    </ToastCtx.Provider>
  )
}

function ConfirmDialog({ record, onResolve }: { record: ConfirmRecord; onResolve: (value: boolean) => void }) {
  return (
    <Modal title={record.title ?? 'Confirm'} onClose={() => onResolve(false)} width={380} resizable={false}>
      <div style={{ fontSize: 13, color: 'var(--color-text-primary)', lineHeight: 1.5 }}>
        {record.message}
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end' }}>
        <Button variant="secondary" size="sm" onClick={() => onResolve(false)}>
          {record.cancelLabel ?? 'Cancel'}
        </Button>
        <Button variant="primary" size="sm" onClick={() => onResolve(true)}>
          {record.confirmLabel ?? 'Confirm'}
        </Button>
      </div>
    </Modal>
  )
}

function ToastViewport({ toasts, onDismiss }: { toasts: ToastRecord[]; onDismiss: (id: string) => void }) {
  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 'calc(var(--banner-height, 0px) + var(--page-header-height, 48px) + var(--space-md))',
        right: 'var(--space-lg)',
        zIndex: TOAST_Z_INDEX,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-sm)',
        width: 'min(400px, calc(100vw - 2 * var(--space-lg)))',
        pointerEvents: 'none',
      }}
    >
      <AnimatePresence initial={false}>
        {toasts.map(t => (
          <ToastItem key={t.id} record={t} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  )
}

function ToastItem({ record, onDismiss }: { record: ToastRecord; onDismiss: (id: string) => void }) {
  const reduceMotion = useReducedMotion()
  const isError = record.variant === 'error'
  const duration = record.duration ?? DEFAULT_DURATION[record.variant]
  const autoDismiss = !isError && Number.isFinite(duration)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const remainingRef = useRef(duration)
  const startedAtRef = useRef(Date.now())

  const clear = useCallback(() => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // (Re)start the auto-dismiss timer whenever this toast is created, or a
  // dedupe-matched call refreshes it (renewedAt bump) — never for errors.
  useEffect(() => {
    if (!autoDismiss) return
    remainingRef.current = duration
    startedAtRef.current = Date.now()
    clear()
    timerRef.current = setTimeout(() => onDismiss(record.id), duration)
    return clear
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record.id, record.renewedAt, duration, autoDismiss])

  const pause = () => {
    if (!autoDismiss || timerRef.current == null) return
    clear()
    remainingRef.current -= Date.now() - startedAtRef.current
  }

  const resume = () => {
    if (!autoDismiss || timerRef.current != null) return
    startedAtRef.current = Date.now()
    timerRef.current = setTimeout(() => onDismiss(record.id), Math.max(remainingRef.current, 0))
  }

  const color = VARIANT_COLOR[record.variant]
  const motionProps = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.12 } }
    : {
        initial: { opacity: 0, x: 24 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: 24 },
        transition: { duration: 0.18, ease: 'easeOut' as const },
      }

  return (
    <motion.div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      tabIndex={0}
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
      onKeyDown={e => { if (e.key === 'Escape') onDismiss(record.id) }}
      {...motionProps}
      style={{
        pointerEvents: 'auto',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--space-sm)',
        background: 'var(--color-glass-bg)',
        border: '1px solid var(--color-glass-border)',
        borderLeft: `3px solid ${color}`,
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-sm) var(--space-md)',
        fontFamily: 'var(--font-sans)',
        boxShadow: 'var(--shadow-deep)',
        boxSizing: 'border-box',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', color, flexShrink: 0, marginTop: 1 }}>
        <VariantIcon variant={record.variant} />
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        {record.title && (
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              marginBottom: 2,
            }}
          >
            {record.title}
          </div>
        )}
        <div
          style={{
            fontSize: 12,
            lineHeight: 1.45,
            color: 'var(--color-text-secondary)',
            wordBreak: 'break-word',
            overflowY: 'auto',
            maxHeight: 200,
          }}
        >
          {record.message}
        </div>
        {record.action && (
          <div style={{ marginTop: 'var(--space-xs)' }}>
            <Button size="sm" variant="secondary" onClick={record.action.onClick}>
              {record.action.label}
            </Button>
          </div>
        )}
      </div>

      <Button
        size="xs"
        variant="ghost"
        icon={<TbX />}
        aria-label="Dismiss notification"
        title="Dismiss"
        onClick={() => onDismiss(record.id)}
        style={{ flexShrink: 0 }}
      />
    </motion.div>
  )
}
