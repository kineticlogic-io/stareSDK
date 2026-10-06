/**
 * Modal — the standard app modal. Use this for every modal/dialog; do not
 * hand-roll fixed-inset overlays.
 *
 * Guarantees:
 *  - ALWAYS portaled to <body>, so it escapes any parent stacking context
 *    (a modal rendered deep in a docked panel still covers the whole screen).
 *  - Greys the screen behind it (backdrop).
 *  - Sits above every in-page control at z-index 5000 — above the TimeSlider
 *    picker (z-4000) — while staying BELOW the ClassificationBanner (z-9999),
 *    which must remain visible at all times.
 *  - Body scrolls vertically when content is taller than the viewport.
 *  - Esc key and backdrop click close. Compositor-safe fade/lift (framer-motion).
 *  - Resizable via the bottom-right corner grip (default on; opt out with
 *    resizable={false}). On first resize the dialog pins to its current
 *    viewport position so the dragged corner tracks the cursor 1:1.
 *
 * The parent controls mount (render <Modal> only when open).
 */

import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { TbChevronDownRight, TbX } from 'react-icons/tb'
import { Button } from './Button.js'

export interface ModalProps {
  onClose: () => void
  /** Title bar text (rendered uppercased by the design system). */
  title: string
  children: ReactNode
  /** Content width — px number (default 520) or any CSS width string (e.g. '70vw').
   *  Caps at the viewport width via maxWidth. */
  width?: number | string
  /** Optional controls rendered in the title bar, left of the close button. */
  titleActions?: ReactNode
  /** Corner resize grip (default true). Set false for small fixed dialogs. */
  resizable?: boolean
}

const MIN_W = 320
const MIN_H = 180
const VIEWPORT_MARGIN = 16

/** Open modals, oldest first. Escape closes only the topmost, so a modal opened from another
 *  (e.g. Classify over a workspace editor) never takes its parent down with it. */
const openModals: object[] = []

export function Modal({ onClose, title, children, width = 520, titleActions, resizable = true }: ModalProps) {
  const [token] = useState(() => ({}))
  useEffect(() => {
    openModals.push(token)
    return () => {
      const i = openModals.lastIndexOf(token)
      if (i >= 0) openModals.splice(i, 1)
    }
  }, [token])
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && openModals[openModals.length - 1] === token) onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose, token])

  const dialogRef = useRef<HTMLDivElement | null>(null)
  // null until the first resize — the dialog stays flex-centered with natural
  // height. After a resize it is pinned (position:fixed at the captured rect)
  // with an explicit width/height so the corner follows the pointer exactly.
  const [box, setBox] = useState<{ left: number; top: number; w: number; h: number } | null>(null)

  const onGripPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const dialog = dialogRef.current
    if (!dialog) return
    e.preventDefault()
    e.stopPropagation()
    const rect = dialog.getBoundingClientRect()
    const startX = e.clientX
    const startY = e.clientY
    const start = { left: rect.left, top: rect.top, w: rect.width, h: rect.height }
    setBox(start)

    const onMove = (ev: PointerEvent) => {
      const maxW = window.innerWidth - start.left - VIEWPORT_MARGIN
      const maxH = window.innerHeight - start.top - VIEWPORT_MARGIN
      const w = Math.min(Math.max(start.w + (ev.clientX - startX), MIN_W), Math.max(MIN_W, maxW))
      const h = Math.min(Math.max(start.h + (ev.clientY - startY), MIN_H), Math.max(MIN_H, maxH))
      setBox({ ...start, w, h })
    }
    const onUp = () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  return createPortal(
    <AnimatePresence>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        // Marker consumed by ui/ContextMenu's outside-click handler (91-12,
        // WR-10): a portaled overlay opened as a RESULT of an interaction
        // that began inside a context menu must not be treated as an
        // outside click, or the menu unmounts itself the instant its own
        // confirm dialog opens on top of it.
        data-portal-overlay=""
        style={{
          position: 'fixed',
          inset: 0,
          // eslint-disable-next-line no-restricted-syntax -- universal dimming overlay scrim, not chrome — do not theme (89-UI-SPEC.md Component Contract §6, D-15 allowlist explicitly names this line)
          background: 'rgba(0,0,0,0.6)',
          // Above the TimeSlider picker (z-4000); below the ClassificationBanner (z-9999).
          zIndex: 5000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--space-lg)',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={e => { if (e.target === e.currentTarget) onClose() }}
      >
        <motion.div
          ref={dialogRef}
          style={{
            ...(box
              ? {
                  position: 'fixed' as const,
                  left: box.left,
                  top: box.top,
                  width: box.w,
                  height: box.h,
                  margin: 0,
                }
              : { width }),
            maxWidth: 'calc(100vw - 32px)',
            maxHeight: 'calc(100vh - 96px)',
            background: 'var(--color-glass-bg)',
            border: '1px solid var(--color-glass-border)',
            borderRadius: 8,
            fontFamily: 'var(--font-sans)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.15 }}
          onClick={e => e.stopPropagation()}
        >
          {/* Title bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-xs)',
              padding: 'var(--space-md) var(--space-lg)',
              borderBottom: '1px solid var(--color-glass-border)',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                flex: 1,
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--color-accent)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {title}
            </div>
            {titleActions}
            <Button size="xs" variant="ghost" icon={<TbX />} aria-label="Close modal" title="Close" onClick={onClose} />
          </div>

          {/* Scrollable body */}
          <div
            style={{
              padding: 'var(--space-lg)',
              overflowY: 'auto',
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-md)',
            }}
          >
            {children}
          </div>

          {/* Corner resize grip */}
          {resizable && (
            <div
              role="separator"
              aria-label="Resize modal"
              onPointerDown={onGripPointerDown}
              style={{
                position: 'absolute',
                right: 2,
                bottom: 2,
                width: 18,
                height: 18,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'nwse-resize',
                color: 'var(--color-text-secondary)',
                opacity: 0.7,
                touchAction: 'none',
                userSelect: 'none',
              }}
            >
              <TbChevronDownRight size={14} />
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}
