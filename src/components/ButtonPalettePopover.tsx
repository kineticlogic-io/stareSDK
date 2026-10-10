import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode, Ref, RefObject, SyntheticEvent } from 'react'
import { BANNER_HEIGHT_PX } from './ClassificationBanner.js'

/**
 * ButtonPalettePopover — the flyout a `ButtonPalette` button opens beside its toolbar (0.2.15, for
 * OpenStare's map and VANTAGE toolbars, kineticlogic-io/OpenStare#340). Separate from `Popover`
 * (menus and pickers hung below a control) on purpose: a toolbar flyout opens to the SIDE of a
 * vertical palette (or above/below a horizontal one), may stay open while the user works on the
 * map, and lives inside the toolbar rather than in a portal.
 *
 * - **In place, not portaled:** it renders the trigger and the panel inside one
 *   `position: relative` wrapper, the panel absolutely positioned against it. So it moves with
 *   the toolbar (a docked panel resizing the map never strands it), keeps the theme of the area
 *   it sits in (a stage pinned to the dark theme stays dark), and works under transformed
 *   ancestors.
 * - **Side:** `right` (default — a left-docked vertical palette), `left` (a right-docked one),
 *   `bottom`/`top` (a horizontal palette). It flips to the opposite side when the panel would not
 *   fit and there is room there.
 * - **Aligned** to the trigger along the other axis (`align`: start / center / end; `alignTo` lines
 *   it up with another element instead, such as the whole palette), then shifted
 *   to stay on screen, clear of the classification banners (`BANNER_HEIGHT_PX`) and inside any
 *   ancestor that clips its overflow (`paletteBounds`); content taller than that room scrolls
 *   inside it (only then — otherwise nothing is clipped).
 * - **Closing:** Escape and a press outside the trigger and panel call `onClose`, each optional —
 *   `closeOnOutsideClick={false}` keeps a drawing flyout open while the user clicks the map. A
 *   press inside something its children portal elsewhere (a colour picker's panel) or inside a
 *   `data-portal-overlay` counts as inside.
 * - **Focus:** `autoFocus` moves focus to the first control when it opens; when it closes while
 *   focus is inside it (Escape, or a control inside closing it), focus returns to the trigger.
 * - **Pointer isolation** (`isolatePointer`, off by default): pointer events inside the panel stop
 *   there, for a flyout over a canvas or stage that listens above it (mouse events still
 *   propagate, so outside-press listeners — a colour picker's — keep working).
 * - Glass surface matching `ButtonPalette` (`surface={false}` when the content is itself a
 *   surfaced palette); a short compositor-safe entrance (opacity + transform).
 */
export type PaletteSide = 'right' | 'left' | 'top' | 'bottom'

export interface ButtonPalettePopoverProps {
  /** Whether the flyout is shown. */
  open: boolean
  /** Called when it should close (Escape, outside press). */
  onClose: () => void
  /** The palette button that opens it, rendered in place. */
  trigger: ReactNode
  /** Accessible name of the flyout. */
  ariaLabel: string
  /** Which side of the trigger it opens on. Default `right`. */
  side?: PaletteSide
  /** How it lines up with the trigger along the other axis. Default `start`. */
  align?: 'start' | 'center' | 'end'
  /**
   * Line the flyout up with this element instead of the trigger (along the axis `align` works
   * on) — e.g. the whole palette, so a flyout from a lower button still starts at the palette's
   * top edge. The side it opens on is still decided from the trigger.
   */
  alignTo?: RefObject<HTMLElement | null>
  /** Gap between the trigger and the flyout, in px. Default 8. */
  gap?: number
  /** Optional heading at the top of the flyout (uppercase, accent — the map toolbars' flyout header). */
  title?: ReactNode
  /** Width of the flyout (px or CSS length). Default: fits its content. */
  width?: number | string
  /** Draw the glass surface. Default true; false when the content is a surfaced palette. */
  surface?: boolean
  /** Close on a press outside the trigger and the flyout. Default true. */
  closeOnOutsideClick?: boolean
  /** Close on Escape. Default true. */
  closeOnEscape?: boolean
  /** Move focus into the flyout when it opens. Default false (a tool flyout keeps focus where it is). */
  autoFocus?: boolean
  /** `dialog` (default) for a panel of controls, `menu` for a list of actions, `group` for a tool palette. */
  role?: 'dialog' | 'menu' | 'group'
  /** Stop pointer events inside the flyout from reaching what is underneath. Default false. */
  isolatePointer?: boolean
  /** Default 4500 (above in-page controls, below the stareSDK Modal and the banners). */
  zIndex?: number
  /** The flyout panel's element, for a caller that measures it. */
  panelRef?: Ref<HTMLDivElement>
  /** Extra style for the flyout panel (merged last). */
  style?: CSSProperties
  children: ReactNode
}

/** Room kept clear of the viewport edges, in px. */
const MARGIN = 8

export interface PalettePlacement {
  side: PaletteSide
  /** Offset of the panel's top (side right/left) or left (side top/bottom) from the trigger's. */
  offset: number
  /** The most height (side right/left) or width (top/bottom) the panel may take before scrolling. */
  max: number
}

const OPPOSITE: Record<PaletteSide, PaletteSide> = { right: 'left', left: 'right', top: 'bottom', bottom: 'top' }

/** A box in viewport px. */
export interface PaletteBounds {
  top: number
  bottom: number
  left: number
  right: number
}

/**
 * The room a flyout may use: the viewport less the classification banners, cut down to every
 * ancestor of `el` that clips its overflow (an `overflow: hidden` layout row would otherwise hide
 * the part of the flyout outside it), with a small margin.
 */
export function paletteBounds(el: Element): PaletteBounds {
  const b = {
    top: BANNER_HEIGHT_PX + MARGIN,
    bottom: window.innerHeight - BANNER_HEIGHT_PX - MARGIN,
    left: MARGIN,
    right: window.innerWidth - MARGIN,
  }
  for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
    const cs = getComputedStyle(node)
    if (!/hidden|auto|scroll|clip/.test(`${cs.overflow} ${cs.overflowX} ${cs.overflowY}`)) continue
    const r = node.getBoundingClientRect()
    // A clipping ancestor with no size yet (not laid out) says nothing useful.
    if (r.width === 0 || r.height === 0) continue
    b.top = Math.max(b.top, r.top + MARGIN)
    b.bottom = Math.min(b.bottom, r.bottom - MARGIN)
    b.left = Math.max(b.left, r.left + MARGIN)
    b.right = Math.min(b.right, r.right - MARGIN)
  }
  return b
}

/** Where a `panel`-sized flyout goes beside a trigger at `rect`, inside `bounds` (pure — tested). */
export function placePalettePopover(
  rect: { top: number; bottom: number; left: number; right: number },
  panel: { width: number; height: number },
  bounds: PaletteBounds,
  opts: {
    side: PaletteSide
    align: 'start' | 'center' | 'end'
    gap: number
    /** Line up with this box instead of the trigger (along the other axis). */
    alignRect?: { top: number; bottom: number; left: number; right: number }
  },
): PalettePlacement {
  const fits = (s: PaletteSide) => {
    switch (s) {
      case 'right':
        return rect.right + opts.gap + panel.width <= bounds.right
      case 'left':
        return rect.left - opts.gap - panel.width >= bounds.left
      case 'bottom':
        return rect.bottom + opts.gap + panel.height <= bounds.bottom
      case 'top':
        return rect.top - opts.gap - panel.height >= bounds.top
    }
  }
  const side = !fits(opts.side) && fits(OPPOSITE[opts.side]) ? OPPOSITE[opts.side] : opts.side
  const vertical = side === 'right' || side === 'left'
  // Along the other axis: the trigger's start, centre or end, then kept inside the bounds.
  const triggerStart = vertical ? rect.top : rect.left
  const a = opts.alignRect ?? rect
  const alignStart = vertical ? a.top : a.left
  const alignSize = vertical ? a.bottom - a.top : a.right - a.left
  const panelSize = vertical ? panel.height : panel.width
  const lo = vertical ? bounds.top : bounds.left
  const hi = vertical ? bounds.bottom : bounds.right
  const want =
    opts.align === 'end'
      ? alignStart + alignSize - panelSize
      : opts.align === 'center'
        ? alignStart + (alignSize - panelSize) / 2
        : alignStart
  const start = Math.max(lo, Math.min(want, hi - panelSize))
  return { side, offset: start - triggerStart, max: Math.max(0, hi - lo) }
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

const stop = (e: SyntheticEvent) => e.stopPropagation()

export function ButtonPalettePopover({
  open,
  onClose,
  trigger,
  ariaLabel,
  side = 'right',
  align = 'start',
  alignTo,
  gap = 8,
  title,
  width,
  surface = true,
  closeOnOutsideClick = true,
  closeOnEscape = true,
  autoFocus = false,
  role = 'dialog',
  isolatePointer = false,
  zIndex = 4500,
  panelRef: panelRefProp,
  style,
  children,
}: ButtonPalettePopoverProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [placement, setPlacement] = useState<PalettePlacement | null>(null)
  const [entered, setEntered] = useState(false)
  // Only a flyout taller (wider) than its room scrolls — an overflow on every flyout would clip
  // anything its content positions outside it.
  const [scrolls, setScrolls] = useState(false)
  const pressInsideRef = useRef(false)
  // Whether focus is inside the flyout — read when it closes, to give focus back to the trigger.
  const focusInsideRef = useRef(false)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  // Measure and place (again on viewport resize). The first pass renders it invisible.
  useLayoutEffect(() => {
    if (!open) {
      setPlacement(null)
      setEntered(false)
      return
    }
    function place() {
      const wrap = wrapRef.current
      const panel = panelRef.current
      if (!wrap || !panel) return
      const r = panel.getBoundingClientRect()
      // Its natural size, not the size a previous placement capped it to.
      const natural = { width: Math.max(r.width, panel.scrollWidth), height: Math.max(r.height, panel.scrollHeight) }
      const next = placePalettePopover(wrap.getBoundingClientRect(), natural, paletteBounds(wrap), {
        side,
        align,
        gap,
        alignRect: alignTo?.current?.getBoundingClientRect(),
      })
      const vertical = next.side === 'right' || next.side === 'left'
      setScrolls((vertical ? panel.scrollHeight : panel.scrollWidth) > next.max)
      setPlacement(prev =>
        prev && prev.side === next.side && prev.offset === next.offset && prev.max === next.max ? prev : next,
      )
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [open, side, align, gap, alignTo])

  // Entrance once placed (opacity + transform only).
  useEffect(() => {
    if (!open || !placement || entered) return
    const raf = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(raf)
  }, [open, placement, entered])

  // Escape and outside press.
  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (!closeOnEscape || e.key !== 'Escape') return
      onCloseRef.current()
    }
    function onMouseDown(e: MouseEvent) {
      const pressedInside = pressInsideRef.current
      pressInsideRef.current = false
      if (!closeOnOutsideClick) return
      const target = e.target as Node | null
      if (!target || pressedInside || wrapRef.current?.contains(target)) return
      const el = target instanceof Element ? target : target.parentElement
      if (el?.closest?.('[data-portal-overlay]')) return
      onCloseRef.current()
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onMouseDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onMouseDown)
    }
  }, [open, closeOnEscape, closeOnOutsideClick])

  // Focus back to the trigger when it closes with focus inside (the panel is gone by now, so
  // focus would otherwise fall to the page).
  const wasOpenRef = useRef(open)
  useLayoutEffect(() => {
    if (wasOpenRef.current && !open && focusInsideRef.current) {
      focusInsideRef.current = false
      wrapRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus()
    }
    wasOpenRef.current = open
  }, [open])

  // Focus in once placed, when asked.
  useEffect(() => {
    if (open && placement && autoFocus) panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus()
    // Only when it first becomes visible.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, placement === null])

  const vertical = (placement?.side ?? side) === 'right' || (placement?.side ?? side) === 'left'
  const currentSide = placement?.side ?? side
  const away = `calc(100% + ${gap}px)`
  const offsetPx = placement?.offset ?? 0
  // A short slide from the trigger's side (compositor-safe).
  const slide = currentSide === 'right' ? 'translateX(-4px)' : currentSide === 'left' ? 'translateX(4px)' : currentSide === 'bottom' ? 'translateY(-4px)' : 'translateY(4px)'

  const panelStyle: CSSProperties = {
    position: 'absolute',
    ...(currentSide === 'right' ? { left: away } : currentSide === 'left' ? { right: away } : currentSide === 'bottom' ? { top: away } : { bottom: away }),
    ...(vertical ? { top: offsetPx } : { left: offsetPx }),
    ...(vertical ? { maxHeight: placement?.max } : { maxWidth: placement?.max }),
    overflowY: scrolls && vertical ? 'auto' : undefined,
    overflowX: scrolls && !vertical ? 'auto' : undefined,
    width,
    zIndex,
    pointerEvents: 'auto',
    boxSizing: 'border-box',
    fontFamily: 'var(--font-sans)',
    ...(surface
      ? {
          background: 'var(--color-glass-bg)',
          border: '1px solid var(--color-glass-border)',
          borderRadius: 6,
          padding: 'var(--space-xs)',
        }
      : null),
    visibility: placement ? 'visible' : 'hidden',
    opacity: entered ? 1 : 0,
    transform: entered ? 'none' : slide,
    transition: 'opacity 150ms ease-out, transform 150ms ease-out',
    ...style,
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-flex' }}>
      {trigger}
      {open && (
        <div
          ref={el => {
            panelRef.current = el
            if (typeof panelRefProp === 'function') panelRefProp(el)
            else if (panelRefProp) panelRefProp.current = el
          }}
          role={role}
          aria-label={ariaLabel}
          aria-orientation={role === 'menu' ? 'vertical' : undefined}
          className="ui-palette-popover"
          data-side={currentSide}
          onMouseDown={() => {
            pressInsideRef.current = true
          }}
          onFocus={() => {
            focusInsideRef.current = true
          }}
          onBlur={e => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) focusInsideRef.current = false
          }}
          onPointerDown={isolatePointer ? stop : undefined}
          onPointerMove={isolatePointer ? stop : undefined}
          onPointerUp={isolatePointer ? stop : undefined}
          onPointerCancel={isolatePointer ? stop : undefined}
          onDoubleClick={isolatePointer ? stop : undefined}
          onContextMenu={isolatePointer ? stop : undefined}
          onWheel={isolatePointer ? stop : undefined}
          style={panelStyle}
        >
          {title != null && (
            <div
              style={{
                padding: 'var(--space-xs) var(--space-sm)',
                marginBottom: 'var(--space-xs)',
                borderBottom: '1px solid var(--color-glass-border)',
                color: 'var(--color-accent)',
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              {title}
            </div>
          )}
          {children}
        </div>
      )}
    </div>
  )
}
