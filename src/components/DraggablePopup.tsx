/**
 * DraggablePopup — shared draggable floating-popup shell for the frontend.
 *
 * Built on the existing useDraggable hook (drag-from-header + localStorage
 * position persistence). Renders the ⠿ Braille grip char top-left of its header
 * so every draggable panel has a consistent, discoverable drag affordance.
 *
 * Map-safe: the shell is PORTALED to document.body, OUTSIDE the Leaflet map's
 * DOM subtree — so native mouse/pointer/click/wheel events on the popup never
 * bubble to the map's drag handler or deck.gl's picking (the map can't be
 * dragged, and features behind the popup can't be selected, through it). React
 * synthetic events still work: React portals preserve the React tree, so events
 * bubble to the React root regardless of DOM position, and `position:fixed`
 * keeps viewport-anchored placement unchanged by the new DOM parent. The native
 * wheel/dblclick stopPropagation below is kept as defense-in-depth (harmless on
 * body; stopPropagation only, never preventDefault, so popup overflow still
 * scrolls natively).
 *
 * Resizable: bottom-right corner grip (default on; opt out with
 * resizable={false}). While resized, the shell forces a column-flex layout
 * with an internally scrolling body so content never overflows the box.
 *
 * Callers (TrackResultsList, ToolsPanel, FeatureAttributePopup) override container/
 * header styling to preserve their exact look while sharing the drag logic.
 */

import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { TbChevronDownRight } from 'react-icons/tb'
import { useDraggable, type DragPos } from '../internal/useDraggable.js'

export interface DraggablePopupProps {
  /** localStorage key — passed straight to useDraggable. */
  storageKey: string
  /** Default position, used only when no valid localStorage value exists. */
  getDefaultPos: () => DragPos
  /** Title rendered next to the grip (omit when caller renders its own title node). */
  title?: React.ReactNode
  /** Content rendered BETWEEN the grip and the title region (e.g. a back button). */
  headerLeft?: React.ReactNode
  /** Right-aligned controls/close; wrapped so a click never starts a drag. */
  headerRight?: React.ReactNode
  /** Body content. */
  children: React.ReactNode
  /** Container width. Default 320. */
  width?: number
  /** Stacking order. Default 4000. */
  zIndex?: number
  /** Merged LAST onto the container (background/backdropFilter/maxHeight/boxShadow/overflow). */
  containerStyle?: React.CSSProperties
  /** Merged onto the header (e.g. padding overrides). */
  headerStyle?: React.CSSProperties
  /** Optional wrapper style for children. */
  bodyStyle?: React.CSSProperties
  /**
   * Content pinned below the (scrolling) body — use for a control that must stay visible
   * regardless of body scroll (e.g. a multi-hit candidate stepper). Omitted → the rendered
   * output is byte-identical to today (no empty wrapper div).
   */
  footer?: React.ReactNode
  /** Merged onto the footer wrapper div. Ignored when `footer` is omitted. */
  footerStyle?: React.CSSProperties
  /** Forwarded to the container div. */
  containerRef?: React.Ref<HTMLDivElement>
  /** Corner resize grip (default true). Set false for fixed-size popups. */
  resizable?: boolean
}

const MIN_W = 240
const MIN_H = 140
const VIEWPORT_MARGIN = 12

/**
 * Apply a caller-forwarded `containerRef` prop (function or object ref) to the
 * portaled container element. Module-level (both the ref and the element are
 * plain parameters, not a closure capturing the component's own props) so the
 * `.current` write isn't flagged as mutating a component prop
 * (react-hooks/immutability) — matches the pattern established in
 * SketchToolbar.tsx/ImagerySpatialFilter.tsx (87-28).
 */
function applyContainerRef(containerRef: DraggablePopupProps['containerRef'], el: HTMLDivElement | null) {
  if (typeof containerRef === 'function') containerRef(el)
  else if (containerRef && typeof containerRef === 'object') {
    ;(containerRef as React.MutableRefObject<HTMLDivElement | null>).current = el
  }
}

/** Read a persisted resize size for `storageKey`, clamped to sane bounds. */
function loadPersistedSize(storageKey: string): { w: number; h: number } | null {
  try {
    const raw = localStorage.getItem(`${storageKey}:size`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { w?: unknown; h?: unknown }
    if (typeof parsed?.w !== 'number' || typeof parsed?.h !== 'number') return null
    const maxW = typeof window !== 'undefined' ? window.innerWidth - VIEWPORT_MARGIN : parsed.w
    const maxH = typeof window !== 'undefined' ? window.innerHeight - VIEWPORT_MARGIN : parsed.h
    return {
      w: Math.min(Math.max(parsed.w, MIN_W), Math.max(MIN_W, maxW)),
      h: Math.min(Math.max(parsed.h, MIN_H), Math.max(MIN_H, maxH)),
    }
  } catch {
    return null
  }
}

export function DraggablePopup({
  storageKey,
  getDefaultPos,
  title,
  headerLeft,
  headerRight,
  children,
  width = 320,
  zIndex = 4000,
  containerStyle,
  headerStyle,
  bodyStyle,
  footer,
  footerStyle,
  containerRef,
  resizable = true,
}: DraggablePopupProps) {
  const { pos, dragHandleProps } = useDraggable(storageKey, getDefaultPos)
  const localRef = useRef<HTMLDivElement | null>(null)
  // Explicit size once the user has resized; null = natural (caller-styled) sizing. Seeded from
  // localStorage so a resize persists across mounts/reloads (keyed off `storageKey`, same as the
  // drag position — a separate `:size` entry).
  const [size, setSize] = useState<{ w: number; h: number } | null>(() => loadPersistedSize(storageKey))

  const setRefs = (el: HTMLDivElement | null) => {
    localRef.current = el
    applyContainerRef(containerRef, el)
  }

  // Native event isolation from the underlying Leaflet map (see header comment).
  // stopPropagation only — never preventDefault — so the popup's own overflow
  // regions still scroll natively. Do NOT extend this to pointer/mouse events:
  // native stopPropagation on this root would kill React's synthetic events for
  // everything inside the popup (React listens at the app root).
  useEffect(() => {
    const el = localRef.current
    if (!el) return
    const stop = (e: Event) => e.stopPropagation()
    el.addEventListener('wheel', stop)
    el.addEventListener('dblclick', stop)
    return () => {
      el.removeEventListener('wheel', stop)
      el.removeEventListener('dblclick', stop)
    }
  }, [])

  const onGripPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = localRef.current
    if (!el) return
    e.preventDefault()
    e.stopPropagation()
    const rect = el.getBoundingClientRect()
    const startX = e.clientX
    const startY = e.clientY
    const start = { w: rect.width, h: rect.height }

    const onMove = (ev: PointerEvent) => {
      const maxW = window.innerWidth - rect.left - VIEWPORT_MARGIN
      const maxH = window.innerHeight - rect.top - VIEWPORT_MARGIN
      setSize({
        w: Math.min(Math.max(start.w + (ev.clientX - startX), MIN_W), Math.max(MIN_W, maxW)),
        h: Math.min(Math.max(start.h + (ev.clientY - startY), MIN_H), Math.max(MIN_H, maxH)),
      })
    }
    const onUp = () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      // Persist the final size (functional read → latest, not the pointerdown-stale closure).
      setSize(s => {
        if (s) {
          try {
            localStorage.setItem(`${storageKey}:size`, JSON.stringify(s))
          } catch {
            /* storage full / disabled — resize still applies for this session */
          }
        }
        return s
      })
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  // While explicitly sized, force a column-flex box with internal body scroll —
  // this wins over containerStyle so resize behaves for every caller.
  const sizedContainer: React.CSSProperties = size
    ? {
        width: size.w,
        height: size.h,
        maxWidth: 'none',
        maxHeight: 'none',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }
    : {}
  const sizedBody: React.CSSProperties = size
    ? { flex: 1, minHeight: 0, overflowY: 'auto' }
    : {}

  return createPortal(
    <div
      ref={setRefs}
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width,
        zIndex,
        pointerEvents: 'auto',
        background: 'var(--color-glass-bg)',
        border: '1px solid var(--color-glass-border)',
        borderRadius: 8,
        fontFamily: 'var(--font-mono)',
        ...containerStyle,
        ...sizedContainer,
      }}
    >
      <div
        {...dragHandleProps}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 8px',
          borderBottom: '1px solid var(--color-glass-border)',
          background: 'var(--surface-layer-2)',
          flexShrink: 0,
          ...dragHandleProps.style,
          ...headerStyle,
        }}
      >
        <span style={{ color: 'var(--color-text-secondary)', fontSize: 12, flexShrink: 0 }}>⠿</span>
        {headerLeft}
        {title != null && (
          <span style={{ color: 'var(--color-accent)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: 11 }}>
            {title}
          </span>
        )}
        {headerRight != null && <span style={{ flex: 1 }} />}
        {headerRight != null && (
          <div onPointerDown={e => e.stopPropagation()}>{headerRight}</div>
        )}
      </div>
      {bodyStyle || size
        ? <div style={{ ...bodyStyle, ...sizedBody }}>{children}</div>
        : children}
      {footer != null && (
        <div style={{ flexShrink: 0, ...footerStyle }} onPointerDown={e => e.stopPropagation()}>
          {footer}
        </div>
      )}
      {resizable && (
        <div
          role="separator"
          aria-label="Resize popup"
          onPointerDown={onGripPointerDown}
          style={{
            position: 'absolute',
            right: 1,
            bottom: 1,
            width: 16,
            height: 16,
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
          <TbChevronDownRight size={12} />
        </div>
      )}
    </div>,
    document.body,
  )
}
