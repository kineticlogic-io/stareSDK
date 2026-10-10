import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode, RefObject } from 'react'
import { createPortal } from 'react-dom'
import { BANNER_HEIGHT_PX } from './ClassificationBanner.js'

/**
 * Popover — an anchored floating panel (0.2.12, for OpenStare's shared-components sweep,
 * kineticlogic-io/OpenStare#340): kebab menus, picker dropdowns, small option panels.
 *
 * - **Anchored** to an element (`anchorRef`) or a viewport point (`point`), computed once when it
 *   opens (a menu, not a hover tooltip). It opens below the anchor and flips above when the
 *   estimated height would overflow the viewport; the flipped case is pinned by its bottom edge,
 *   so the flip is exact whatever the rendered height. It is clamped horizontally inside the
 *   viewport (`align` picks the anchor's start or end edge).
 * - **Portaled** to `document.body` and `position: fixed`, so a scrolling or `overflow: hidden`
 *   ancestor never clips it.
 * - **Never under the classification banners:** its max height is the room between the anchor and
 *   the banner on the side it opens (`BANNER_HEIGHT_PX`), and it scrolls when taller.
 * - **Closes** on Escape, on a pointer press outside it and outside its anchor (the anchor toggles
 *   itself), and — `closeOnScroll` — when something the anchor sits in scrolls (it moved away;
 *   scrolling the popover's own content does not close it). A press inside an overlay marked
 *   `data-portal-overlay` (a confirm dialog the popover opened) does not close it, and neither
 *   does a press inside anything its own children portal elsewhere (a colour picker's panel —
 *   React events from a portal still bubble through the popover; since 0.2.14).
 * - **Placed by its real width:** once rendered, its measured width is clamped inside the
 *   viewport, so content wider than `minWidth` never runs off the right edge, and an
 *   `align="end"` popover's right edge meets the anchor's (since 0.2.14).
 * - **Focus** moves to the first focusable element inside when it opens (`autoFocus`) and returns
 *   to the anchor when it closes, if focus was inside it.
 * - Layering: `zIndex` 4500 by default — above in-page controls, below the stareSDK `Modal`
 *   (5000) and far below the classification banner (9999).
 */
export interface PopoverProps {
  /** Whether the popover is shown. */
  open: boolean
  /** Called when it should close (Escape, outside press, anchor scroll). */
  onClose: () => void
  /** The element it hangs from. Exactly one of `anchorRef` / `point` is used. */
  anchorRef?: RefObject<HTMLElement | null>
  /** A viewport point to hang it from instead of an element (e.g. a map click). */
  point?: { x: number; y: number }
  /** Accessible name. */
  ariaLabel: string
  /** `menu` for a list of actions, `dialog` (default) for a panel of controls. */
  role?: 'menu' | 'dialog'
  /** Which anchor edge it lines up with horizontally. Default `start` (left edges). */
  align?: 'start' | 'end'
  /** Gap between the anchor and the popover, in px. Default 2. */
  gap?: number
  /** Minimum width in px (also used for the horizontal clamp). Default 168. */
  minWidth?: number
  /** Maximum width in px. */
  maxWidth?: number
  /** A height cap in px (since 0.2.13). The popover is never taller than the room to the banner
   *  either way; this only lowers that limit. */
  maxHeight?: number
  /** Estimated height in px — used only to decide whether to open above. Default 240. */
  estimatedHeight?: number
  /** Close when something the anchor sits in scrolls. Default true. */
  closeOnScroll?: boolean
  /** Move focus into the popover when it opens. Default true. */
  autoFocus?: boolean
  /** Default 4500 (above in-page controls, below Modal). */
  zIndex?: number
  /** Extra panel style (merged last — padding, width…). */
  style?: CSSProperties
  className?: string
  children: ReactNode
}

/** Room kept clear of the viewport edges, in px. */
const MARGIN = 8

interface Placement {
  top?: number
  bottom?: number
  left: number
  maxHeight: number
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Where a popover of `minWidth` × `estimatedHeight` goes for an anchor `rect` (pure — tested). */
export function placePopover(
  rect: { top: number; bottom: number; left: number; right: number },
  viewport: { width: number; height: number },
  opts: { align: 'start' | 'end'; gap: number; minWidth: number; estimatedHeight: number },
): Placement {
  const clear = BANNER_HEIGHT_PX + MARGIN
  const wantLeft = opts.align === 'end' ? rect.right - opts.minWidth : rect.left
  const left = Math.max(MARGIN, Math.min(wantLeft, viewport.width - opts.minWidth - MARGIN))
  const overflowsBottom = rect.bottom + opts.gap + opts.estimatedHeight > viewport.height - MARGIN
  const roomAbove = rect.top - opts.gap - clear
  const roomBelow = viewport.height - rect.bottom - opts.gap - clear
  // Flip above only when it would overflow below AND there is more room above.
  if (overflowsBottom && roomAbove > roomBelow) {
    return { bottom: viewport.height - rect.top + opts.gap, left, maxHeight: Math.max(0, roomAbove) }
  }
  return { top: rect.bottom + opts.gap, left, maxHeight: Math.max(0, roomBelow) }
}

export function Popover({
  open,
  onClose,
  anchorRef,
  point,
  ariaLabel,
  role = 'dialog',
  align = 'start',
  gap = 2,
  minWidth = 168,
  maxWidth,
  maxHeight,
  estimatedHeight = 240,
  closeOnScroll = true,
  autoFocus = true,
  zIndex = 4500,
  style,
  className,
  children,
}: PopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [placement, setPlacement] = useState<Placement | null>(null)
  // Set by the panel's React mousedown handler, which also sees presses inside portals its
  // children open (React bubbles those through the component tree); read and cleared by the
  // document listener, which runs after React's root listener for the same event.
  const pressInsideRef = useRef(false)
  // The anchor's rect when it opened — the measured-width pass below lines `align="end"` up with it.
  const anchorRectRef = useRef<{ left: number; right: number } | null>(null)
  // The latest onClose, so the listeners below stay attached for the whole open period.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  // Place once per open (computed from the anchor's rect before paint).
  useLayoutEffect(() => {
    if (!open) {
      setPlacement(null)
      return
    }
    const el = anchorRef?.current
    const rect = el
      ? el.getBoundingClientRect()
      : point
        ? { top: point.y, bottom: point.y, left: point.x, right: point.x }
        : null
    if (!rect) return
    anchorRectRef.current = rect
    setPlacement(
      placePopover(rect, { width: window.innerWidth, height: window.innerHeight }, { align, gap, minWidth, estimatedHeight }),
    )
    // Placed once per open: the anchor/point at that moment decides (a menu, not a tooltip).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Once rendered, place by its real width (the first placement only knew `minWidth`): an
  // `align="end"` popover's right edge meets the anchor's, and either way it stays on screen.
  useLayoutEffect(() => {
    const panel = panelRef.current
    const rect = anchorRectRef.current
    if (!open || !placement || !panel || !rect) return
    const width = panel.getBoundingClientRect().width
    const want = align === 'end' ? rect.right - width : placement.left
    const left = Math.max(MARGIN, Math.min(want, window.innerWidth - width - MARGIN))
    if (left !== placement.left) setPlacement({ ...placement, left })
  }, [open, placement, align])

  // Close on Escape, outside press, and anchor scroll.
  useEffect(() => {
    if (!open) return
    const anchor = anchorRef?.current ?? null
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
      }
    }
    function onPointerDown(e: PointerEvent | MouseEvent) {
      const pressedInside = pressInsideRef.current
      pressInsideRef.current = false
      const target = e.target as Node | null
      if (!target) return
      if (pressedInside || panelRef.current?.contains(target)) return
      if (anchor?.contains(target)) return
      const el = target instanceof Element ? target : target.parentElement
      if (el?.closest?.('[data-portal-overlay]')) return
      onCloseRef.current()
    }
    function onScroll(e: Event) {
      if (!anchor || !(e.target instanceof Node)) return
      if (panelRef.current?.contains(e.target)) return
      if (e.target.contains(anchor)) onCloseRef.current()
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onPointerDown)
    if (closeOnScroll) document.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('scroll', onScroll, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, closeOnScroll])

  // Focus in on open; back to the anchor on close (only if focus was inside).
  useEffect(() => {
    if (!open || !placement) return
    const panel = panelRef.current
    const anchor = anchorRef?.current ?? null
    if (autoFocus) panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus()
    return () => {
      const active = document.activeElement
      const focusWasInside = !active || active === document.body || (panel?.contains(active) ?? false)
      if (focusWasInside && anchor && anchor.isConnected) anchor.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, placement === null])

  if (!open || !placement || typeof document === 'undefined') return null

  return createPortal(
    <div
      ref={panelRef}
      onMouseDown={() => {
        pressInsideRef.current = true
      }}
      role={role}
      aria-label={ariaLabel}
      aria-orientation={role === 'menu' ? 'vertical' : undefined}
      className={className ? `ui-popover ${className}` : 'ui-popover'}
      style={{
        position: 'fixed',
        top: placement.top,
        bottom: placement.bottom,
        left: placement.left,
        maxHeight: maxHeight != null ? Math.min(maxHeight, placement.maxHeight) : placement.maxHeight,
        overflowY: 'auto',
        overflowX: 'hidden',
        zIndex,
        minWidth,
        maxWidth,
        background: 'var(--color-glass-bg)',
        border: '1px solid var(--color-glass-border)',
        borderRadius: 4,
        boxShadow: 'var(--shadow-standard)',
        fontFamily: 'var(--font-sans)',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {children}
    </div>,
    document.body,
  )
}
