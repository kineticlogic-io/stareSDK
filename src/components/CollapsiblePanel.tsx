import { useState } from 'react'
import { TbChevronUp, TbChevronDown } from 'react-icons/tb'
import type { CSSProperties, ReactNode } from 'react'
import { readPanelState } from './CollapsiblePanel.helpers.js'

interface Props {
  title: string
  badge?: string
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** When set, the open/closed state is persisted to localStorage under this key (uncontrolled mode only). */
  persistKey?: string
  /**
   * Controls in the title row, right-aligned before the badge (a table's compact search, a
   * filter). Shown only while the panel is open; clicks and keys inside never toggle it.
   */
  actions?: ReactNode
  /**
   * Controls directly after the title, left-aligned (a table's compact search). Same rules as
   * `actions`: shown only while open, and never toggle the panel.
   */
  titleActions?: ReactNode
  style?: CSSProperties
  children: ReactNode
}

/** Controls in the title row: clicks and keys stay inside and never toggle the panel. */
function HeaderSlot({ children }: { children: ReactNode }) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      // Negative margin: a 28-32px control fits the 40px row without growing it, so panels
      // with and without controls line up side by side.
      style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', margin: '-4px 0', cursor: 'auto', userSelect: 'auto' }}
    >
      {children}
    </div>
  )
}

export function CollapsiblePanel({ title, badge, defaultOpen = true, open: openProp, onOpenChange, persistKey, actions, titleActions, style, children }: Props) {
  const [internalOpen, setInternalOpen] = useState(() =>
    persistKey ? readPanelState(persistKey, defaultOpen) : defaultOpen
  )
  const isControlled = openProp !== undefined
  const open = isControlled ? openProp : internalOpen

  function toggle() {
    if (isControlled) {
      onOpenChange?.(!open)
    } else {
      setInternalOpen(v => {
        const next = !v
        if (persistKey) {
          try { localStorage.setItem(persistKey, String(next)) } catch { /* ignore */ }
        }
        return next
      })
    }
  }

  return (
    <div style={{
      background: 'var(--color-glass-bg)',
      border: '1px solid var(--color-glass-border)',
      borderRadius: 8,
      overflow: 'hidden',
      fontFamily: 'var(--font-sans)',
      display: 'flex',
      flexDirection: 'column',
      ...style,
    }}>
      {/* The whole row toggles on click; the title is the keyboard and screen-reader control. */}
      <div
        onClick={toggle}
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-sm)',
          padding: 'var(--space-sm) var(--space-md)',
          borderBottom: open ? '1px solid var(--color-glass-border)' : 'none',
          minHeight: 40,
          boxSizing: 'border-box',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <span
          role="button"
          tabIndex={0}
          aria-expanded={open}
          aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              toggle()
            }
          }}
          style={{
            flex: '0 1 auto',
            minWidth: 0,
            textAlign: 'left',
            color: 'var(--color-accent)',
            fontFamily: 'var(--font-sans)',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            outlineOffset: 2,
          }}
        >
          {title}
        </span>
        {open && titleActions && <HeaderSlot>{titleActions}</HeaderSlot>}
        {/* Empty space in the row still toggles the panel. */}
        <span style={{ flex: 1 }} />
        {open && actions && <HeaderSlot>{actions}</HeaderSlot>}
        {badge && (
          <span style={{
            fontSize: 10,
            fontWeight: 400,
            letterSpacing: '0.06em',
            color: 'var(--color-text-secondary)',
            background: 'var(--brand-subtle)',
            // eslint-disable-next-line no-restricted-syntax -- matches chromeTheme.ts brandSubtle's established convention: brand-green wash literals keep the SAME dark-accent RGB (15,175,115) in both themes, only alpha varies — theme-invariant by design, not a miss
            border: '1px solid rgba(15,175,115,0.30)',
            borderRadius: 3,
            padding: '2px 6px',
          }}>
            {badge}
          </span>
        )}
        {/* Chevron is decorative — the row toggles. */}
        <span aria-hidden style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--color-text-secondary)', opacity: 0.6, fontSize: 16 }}>
          {open ? <TbChevronUp /> : <TbChevronDown />}
        </span>
      </div>
      {open && (
        <div style={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
      )}
    </div>
  )
}
