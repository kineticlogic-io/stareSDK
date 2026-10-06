/**
 * SideNav — reusable slide-in side panel that docks to either the LEFT or RIGHT edge.
 *
 * Default: right-dock (backward-compatible — omitting `side` preserves today's exact
 * right-dock behavior for every existing consumer).
 *
 * With `side="left"` the panel:
 *   - is anchored at left:0 and slides in from the left,
 *   - has its resize handle on its RIGHT (inner) edge,
 *   - uses borderRight + positive-x box-shadow,
 *   - stacks inward with other left-side panels via DockContext.
 *
 * Features common to both sides:
 *   - Portaled to <body> (escapes any transform stacking context in App).
 *   - Spans from just below the page header to the bottom.
 *   - Slides in/out via translateX (compositor-safe; no width/left/right animation).
 *   - Registers with DockContext so panels STACK side-by-side without overlap.
 *   - Drag-to-resize from the inner edge; width persisted to localStorage.
 *
 * `dockRegister` (Phase 123, UI-SPEC §0b, D-26): default `true` preserves today's exact
 * behavior — every open panel registers with `DockContext` and therefore contributes to
 * `--dock-left-width`/`--dock-right-width`, which `App.tsx`'s global collapse container reads to
 * shrink the routed content area. Passing `dockRegister={false}` skips registration entirely
 * (the effect calls `setPanel(id, null)` unconditionally, regardless of `open`), so the panel
 * becomes a visually-open, non-layout-affecting OVERLAY — `open` still drives its own
 * `translateX`/`pointer-events` exactly as today, it just never reserves page width. This is what
 * lets ORACLE's sidebar re-open as a floating overlay below D-26's breakpoint instead of squeezing
 * an already-narrow message column. `ChatPanel`, `GisLayerSideNav`, `ToolsPanel`, `StyleEditor`,
 * `TacticalSymbolBuilder`, `ImageryPanel`, and `LedgerPage`'s detail panel all pass nothing and are
 * fully unaffected.
 */

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useDock } from '../context/useDock.js'
import { useTheme } from '../theme/useTheme.js'
import { themeFor } from '../styles/chromeTheme.js'
import { writeSideNavOpen } from './sideNavStorage.js'

export interface SideNavProps {
  open: boolean
  /** Which edge to dock on. Default 'right' (existing behavior unchanged). */
  side?: 'left' | 'right'
  /** Initial / fallback width in px. Default 380 (matches the AI assistant). */
  width?: number
  /** Dock order — lower = closer to that side's own edge. Default 10 (assistant is 0). */
  order?: number
  zIndex?: number
  ariaLabel?: string
  /** localStorage key for the user-resized width. Omit to disable persistence. */
  storageKey?: string
  /** Resize clamps (px). Defaults 280–720. */
  minWidth?: number
  maxWidth?: number
  /**
   * When `false`, skips `DockContext` registration entirely so this panel does not reserve
   * `--dock-left-width`/`--dock-right-width` — see the module doc above (Phase 123, D-26).
   * Default `true` (today's exact behavior).
   */
  dockRegister?: boolean
  children: ReactNode
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), Math.max(lo, hi))
}

/**
 * Extracts just the `rgba(...)` color component out of a `ChromeTheme.shadowDeep` string
 * (e.g. `'0 12px 32px rgba(0, 0, 0, 0.45)'` -> `'rgba(0, 0, 0, 0.45)'`).
 *
 * The drawer's box-shadow is directional (`6px`/`-6px` x-offset, sliding out from the docked
 * edge) so `--shadow-deep` itself (a non-directional `0 12px 32px ...` elevation shadow) is not
 * a drop-in replacement — its OFFSET/BLUR don't match this drawer's geometry. Reusing only its
 * COLOR component keeps the drawer's own directional geometry while still tinting the shadow
 * per-theme from `chromeTheme.ts`'s single source of truth (D-11) instead of hardcoding a second
 * copy of the tint here — a flat opaque-black wash (unthemed) is exactly the "grey smudge on a
 * light page" D-03 names as the reason shadows are themed at all.
 */
function shadowTintFrom(shadow: string): string {
  const match = /rgba\([^)]+\)/.exec(shadow)
  return match ? match[0] : shadow
}

export function SideNav({
  open,
  side = 'right',
  width = 380,
  order = 10,
  zIndex = 1001,
  ariaLabel,
  storageKey,
  minWidth = 280,
  maxWidth = 720,
  dockRegister = true,
  children,
}: SideNavProps) {
  const id = useId()
  const { setPanel, offsetFor } = useDock()
  const { theme } = useTheme()
  const shadowTint = shadowTintFrom(themeFor(theme).shadowDeep)

  const isLeft = side === 'left'

  // Persisted, user-resizable width.
  const [w, setW] = useState<number>(() => {
    if (storageKey) {
      try {
        const raw = localStorage.getItem(storageKey)
        const n = raw ? parseInt(raw, 10) : NaN
        if (!Number.isNaN(n)) return clamp(n, minWidth, maxWidth)
      } catch { /* ignore */ }
    }
    return clamp(width, minWidth, maxWidth)
  })

  // Register while open so the dock can size the page-collapse vars + stack offsets.
  // Re-registers on resize so the page reflows live as the user drags.
  useEffect(() => {
    setPanel(id, dockRegister && open ? { width: w, order, side } : null)
    return () => setPanel(id, null)
  }, [id, open, w, order, side, setPanel, dockRegister])

  // Persist open/closed once, here, for every instance that supplies a storageKey (D-18 —
  // implemented once in the shared component, not opt-in per caller). A call site without a
  // storageKey continues to get no persistence, consistent with width persistence being opt-in
  // by storageKey presence today. `open` stays a fully controlled prop — this effect only mirrors
  // its value to localStorage, it never owns or seeds local state.
  useEffect(() => {
    writeSideNavOpen(storageKey, open)
  }, [open, storageKey])

  const offset = offsetFor(id)

  // --- Drag-to-resize ---
  // Right panel: resize handle on LEFT (inner) edge; right edge stays fixed.
  // Left panel:  resize handle on RIGHT (inner) edge; left edge stays fixed at offset.
  const draggingRef = useRef(false)
  const rightEdgeRef = useRef(0) // right panel only: viewport px of the panel's right edge

  const onHandleDown = useCallback((e: React.PointerEvent) => {
    draggingRef.current = true
    if (!isLeft) {
      // The panel's right edge in viewport px stays fixed while resizing.
      rightEdgeRef.current = window.innerWidth - offset
    }
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId) } catch { /* noop */ }
    e.preventDefault()
  }, [isLeft, offset])

  const onHandleMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return
    if (isLeft) {
      // Left panel: left edge is fixed at `offset` px from left of viewport.
      setW(clamp(e.clientX - offset, minWidth, maxWidth))
    } else {
      // Right panel: right edge is fixed; width = rightEdge - pointerX.
      setW(clamp(rightEdgeRef.current - e.clientX, minWidth, maxWidth))
    }
  }, [isLeft, offset, minWidth, maxWidth])

  const onHandleUp = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return
    draggingRef.current = false
    try { (e.currentTarget as Element).releasePointerCapture(e.pointerId) } catch { /* noop */ }
    setW(cur => {
      if (storageKey) { try { localStorage.setItem(storageKey, String(cur)) } catch { /* ignore */ } }
      return cur
    })
  }, [storageKey])

  // Left panel: open = translateX(+offset) to shift inward past other left panels;
  //             closed = translateX(-100%) to hide off the left edge.
  // Right panel (unchanged): open = translateX(-offset); closed = translateX(100%).
  const transformOpen  = isLeft ? `translateX(${offset}px)`  : `translateX(-${offset}px)`
  const transformClosed = isLeft ? 'translateX(-100%)'        : 'translateX(100%)'

  return createPortal(
    <aside
      aria-label={ariaLabel}
      aria-hidden={!open}
      style={{
        position: 'fixed',
        top: 'calc(var(--banner-height, 0px) + var(--page-header-height, 48px))',
        // Anchor to the correct edge; only one of left/right is set.
        ...(isLeft ? { left: 0 } : { right: 0 }),
        // Sit above the bottom classification bar when the banner is enabled,
        // plus an optional per-page offset (--sidenav-bottom-offset). /atlas sets
        // this to its full-width TimeSlider height so EVERY docked panel ends above
        // the timeline; unset (0px) everywhere else — existing behavior unchanged.
        bottom: 'calc(var(--banner-height, 0px) + var(--sidenav-bottom-offset, 0px))',
        width: w,
        transform: open ? transformOpen : transformClosed,
        transition: 'transform 0.25s ease',
        zIndex,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-glass-bg)',
        // Mirror border and shadow for each side.
        ...(isLeft
          ? {
              borderRight: '1px solid var(--color-glass-border)',
              boxShadow: `6px 0 20px ${shadowTint}`,
            }
          : {
              borderLeft: '1px solid var(--color-glass-border)',
              boxShadow: `-6px 0 20px ${shadowTint}`,
            }),
        pointerEvents: open ? 'auto' : 'none',
        fontFamily: 'var(--font-mono)',
      }}
    >
      {/* Resize handle — inner edge (right for left panel; left for right panel). */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panel"
        onPointerDown={onHandleDown}
        onPointerMove={onHandleMove}
        onPointerUp={onHandleUp}
        style={{
          position: 'absolute',
          // Place handle on the inner edge.
          ...(isLeft ? { right: 0 } : { left: 0 }),
          top: 0,
          bottom: 0,
          width: 6,
          cursor: 'ew-resize',
          touchAction: 'none',
          zIndex: 1,
          // faint accent on hover; transparent otherwise
          ...(isLeft
            ? { borderRight: '2px solid transparent' }
            : { borderLeft: '2px solid transparent' }),
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLElement
          if (isLeft) {
            el.style.borderRight = '2px solid var(--color-accent)'
          } else {
            el.style.borderLeft = '2px solid var(--color-accent)'
          }
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLElement
          if (!draggingRef.current) {
            if (isLeft) {
              el.style.borderRight = '2px solid transparent'
            } else {
              el.style.borderLeft = '2px solid transparent'
            }
          }
        }}
      />
      {children}
    </aside>,
    document.body,
  )
}
