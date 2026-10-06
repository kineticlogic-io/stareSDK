import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

/**
 * ContextMenu — shared presentational shell for right-click menus.
 *
 * Provides: fixed-position placement with viewport edge-flip math, the App.tsx
 * left-dock offset correction, glass design tokens, an optional uppercase
 * section header, and close-on-Escape / close-on-outside-click. Purely
 * presentational — callers own their own menu-item content and click
 * semantics; compose items with {@link ContextMenuItem}.
 *
 * Extracted (Phase 91, operator direction) from a since-retired command-dispatch
 * menu so a second right-click menu would not hand-roll a second copy of this
 * shell — CLAUDE.md's shared `ui/*` HARD RULE.
 */
export interface ContextMenuProps {
  /** Viewport-relative click x (e.g. `MouseEvent.clientX`). */
  x: number
  /** Viewport-relative click y (e.g. `MouseEvent.clientY`). */
  y: number
  onClose: () => void
  /** Accessible name for the `role="menu"` container. */
  ariaLabel: string
  /** Optional uppercase section header rendered above the items. */
  header?: ReactNode
  children: ReactNode
  /** Estimated menu width, used only for the viewport edge-flip math. Default 240. */
  width?: number
  /** Estimated menu height, used only for the viewport edge-flip math. Default 300. */
  estimatedHeight?: number
}

export function ContextMenu({
  x,
  y,
  onClose,
  ariaLabel,
  header,
  children,
  width = 240,
  estimatedHeight = 300,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on Escape or outside click
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    function onMouseDown(e: MouseEvent) {
      if (menuRef.current && menuRef.current.contains(e.target as Node)) return
      // 91-12 (WR-10): a click that begins inside the menu can open a portaled
      // overlay (ui/Modal confirm dialog) as its direct result. That overlay's
      // backdrop covers the whole viewport, so the NEXT mousedown target is the
      // overlay itself, outside menuRef — without this exemption the menu would
      // unmount itself the instant its own confirm dialog opens. The target may
      // be a text node, so resolve to the nearest Element before calling
      // closest(), and don't throw if a target has no closest() at all.
      const targetEl = e.target instanceof Element ? e.target : (e.target as Node | null)?.parentElement ?? null
      if (targetEl?.closest?.('[data-portal-overlay]')) return
      onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onMouseDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onMouseDown)
    }
  }, [onClose])

  // Viewport edge flip — keep menu inside window
  const vpW = window.innerWidth
  const vpH = window.innerHeight
  const left = x + width > vpW ? x - width : x
  const top = y + estimatedHeight > vpH ? y - estimatedHeight : y

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={ariaLabel}
      style={{
        position: 'fixed',
        // Rendered inside App.tsx's collapse container (transform: translateZ(0)),
        // whose left edge is inset by --dock-left-width when a left panel docks.
        // The edge-flip math above stays viewport-based; only the final left is offset.
        left: `calc(${left}px - var(--dock-left-width, 0px))`,
        top,
        // A context menu is an IN-PAGE control (CLAUDE.md's layering contract):
        // below ui/Modal (5000), far below the ClassificationBanner (9999). With
        // the WR-10 outside-click fix above, the menu now stays mounted while a
        // confirm dialog it opened is open — at 9999 it would render ON TOP of
        // that dialog instead of behind it.
        zIndex: 4900,
        minWidth: width,
        background: 'var(--color-glass-bg)',
        border: '1px solid var(--color-glass-border)',
        borderRadius: 4,
        fontFamily: 'var(--font-sans)',
        padding: 'var(--space-xs) 0',
        opacity: 1,
      }}
    >
      {header != null && (
        <div
          style={{
            padding: '4px 12px 6px',
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--color-text-secondary)',
            borderBottom: '1px solid var(--color-glass-border)',
            marginBottom: 2,
          }}
        >
          {header}
        </div>
      )}
      {children}
    </div>
  )
}

export interface ContextMenuItemProps {
  onClick: () => void
  ariaLabel?: string
  disabled?: boolean
  /** Renders content in `var(--color-destructive)` with a matching hover accent, for a destructive action. */
  danger?: boolean
  children: ReactNode
}

/** A single `role="menuitem"` row for {@link ContextMenu}. */
export function ContextMenuItem({ onClick, ariaLabel, disabled = false, danger = false, children }: ContextMenuItemProps) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      style={{
        display: 'block',
        width: '100%',
        padding: '8px 12px',
        background: 'transparent',
        border: 'none',
        borderLeft: '2px solid transparent',
        textAlign: 'left',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'var(--font-sans)',
        fontSize: 12,
        color: danger ? 'var(--color-destructive)' : 'var(--color-text-primary)',
        opacity: disabled ? 0.6 : 1,
        minHeight: 36,
        position: 'relative',
      }}
      onMouseEnter={e => {
        if (disabled) return
        const el = e.currentTarget
        el.style.background = 'var(--brand-subtle)'
        el.style.borderLeftColor = danger ? 'var(--color-destructive)' : 'var(--color-accent)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget
        el.style.background = 'transparent'
        el.style.borderLeftColor = 'transparent'
      }}
    >
      {children}
    </button>
  )
}
