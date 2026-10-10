import { createContext, useContext, useEffect, useRef } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'

/**
 * ContextMenu — shared presentational shell for right-click menus.
 *
 * Provides: fixed-position placement with viewport edge-flip math, the App.tsx
 * left-dock offset correction, glass design tokens, an optional uppercase
 * section header, close-on-Escape / close-on-outside-click, and keyboard navigation. Purely
 * presentational — callers own their own menu-item content and click
 * semantics; compose items with {@link ContextMenuItem}.
 *
 * Extracted (Phase 91, operator direction) from a since-retired command-dispatch
 * menu so a second right-click menu would not hand-roll a second copy of this
 * shell — CLAUDE.md's shared `ui/*` HARD RULE.
 *
 * Keyboard (0.2.11, for OpenStare's attribute-table row menu, kineticlogic-io/OpenStare#318):
 * the first enabled item takes focus when the menu opens; ArrowDown/ArrowUp move between enabled
 * items (wrapping), Home/End jump to the first/last; Enter or Space activates the focused item;
 * Escape and Tab close the menu. When the menu closes while focus is in it (or nowhere), focus
 * returns to the element that had it when the menu opened — never when an item has moved focus
 * elsewhere on purpose (e.g. into a dialog it opened). Disabled items are skipped.
 *
 * Size (0.2.16, kineticlogic-io/OpenStare map right-click menu): `size="sm"` is the compact menu
 * — 10px text, tight rows, as wide as its content — for a map's one-line menus. `md` (default) is
 * the roomier menu with 36px rows.
 */
export type ContextMenuSize = 'md' | 'sm'

/** The menu's size, read by its {@link ContextMenuItem}s. */
const ContextMenuSizeContext = createContext<ContextMenuSize>('md')

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
  /** `sm` is the compact menu (10px text, tight rows, as wide as its content). Default `md`. 0.2.16+ */
  size?: ContextMenuSize
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
  size = 'md',
}: ContextMenuProps) {
  const sm = size === 'sm'
  const menuRef = useRef<HTMLDivElement>(null)

  // Focus the first enabled item on open; give focus back to the opener on close.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const menu = menuRef.current
    enabledItems(menu)[0]?.focus()
    return () => {
      const active = document.activeElement
      const focusWasInMenu = !active || active === document.body || (menu?.contains(active) ?? false)
      if (focusWasInMenu && opener && opener.isConnected) opener.focus()
    }
  }, [])

  // Close on Escape or outside click
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' || (e.key === 'Tab' && menuRef.current?.contains(document.activeElement))) {
        if (e.key === 'Tab') e.preventDefault()
        onClose()
      }
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

  const onMenuKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = enabledItems(menuRef.current)
    if (items.length === 0) return
    const at = items.indexOf(document.activeElement as HTMLElement)
    let next: HTMLElement | undefined
    if (e.key === 'ArrowDown') next = items[(at + 1) % items.length]
    else if (e.key === 'ArrowUp') next = items[(at - 1 + items.length) % items.length]
    else if (e.key === 'Home') next = items[0]
    else if (e.key === 'End') next = items[items.length - 1]
    else if ((e.key === 'Enter' || e.key === ' ') && at >= 0) {
      e.preventDefault()
      items[at].click()
      return
    }
    if (next) {
      e.preventDefault()
      next.focus()
    }
  }

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={ariaLabel}
      aria-orientation="vertical"
      onKeyDown={onMenuKeyDown}
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
        // A compact menu is as wide as its content; `width` then only feeds the edge flip.
        minWidth: sm ? 'max-content' : width,
        background: 'var(--color-glass-bg)',
        border: '1px solid var(--color-glass-border)',
        borderRadius: 4,
        fontFamily: 'var(--font-sans)',
        padding: sm ? '3px 0' : 'var(--space-xs) 0',
        opacity: 1,
      }}
    >
      {header != null && (
        <div
          style={{
            padding: sm ? '3px 10px 4px' : '4px 12px 6px',
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
      <ContextMenuSizeContext.Provider value={size}>{children}</ContextMenuSizeContext.Provider>
    </div>
  )
}

/** The menu's enabled `role="menuitem"` elements, in order. */
function enabledItems(menu: HTMLElement | null): HTMLElement[] {
  if (!menu) return []
  return Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]')).filter(
    (el) => !(el as HTMLButtonElement).disabled && el.getAttribute('aria-disabled') !== 'true',
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
  const sm = useContext(ContextMenuSizeContext) === 'sm'
  const highlight = (el: HTMLButtonElement, on: boolean) => {
    if (disabled && on) return
    el.style.background = on ? 'var(--brand-subtle)' : 'transparent'
    el.style.borderLeftColor = on ? (danger ? 'var(--color-destructive)' : 'var(--color-accent)') : 'transparent'
  }
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      style={{
        display: 'block',
        width: '100%',
        padding: sm ? '3px 10px' : '8px 12px',
        background: 'transparent',
        border: 'none',
        borderLeft: '2px solid transparent',
        textAlign: 'left',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'var(--font-sans)',
        fontSize: sm ? 10 : 12,
        whiteSpace: sm ? 'nowrap' : undefined,
        color: danger ? 'var(--color-destructive)' : 'var(--color-text-primary)',
        opacity: disabled ? 0.6 : 1,
        minHeight: sm ? undefined : 36,
        position: 'relative',
        outline: 'none',
      }}
      // Hover and keyboard focus look the same (focus outline replaced by the accent rail).
      onMouseEnter={e => highlight(e.currentTarget, true)}
      onMouseLeave={e => highlight(e.currentTarget, false)}
      onFocus={e => highlight(e.currentTarget, true)}
      onBlur={e => highlight(e.currentTarget, false)}
    >
      {children}
    </button>
  )
}
