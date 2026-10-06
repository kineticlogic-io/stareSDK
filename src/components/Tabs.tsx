import type { CSSProperties, KeyboardEvent, ReactNode } from 'react'
import { useId, useRef } from 'react'

/**
 * Tabs — shared tab bar (stareSDK, operator-approved 2026-09-25).
 *
 * Implements the WAI-ARIA tabs pattern with automatic activation: Left/Right (and Home/End)
 * move between enabled tabs and select them; the selected tab is the only one in the tab order.
 * The component renders the bar only; the caller renders the active panel inside `<TabPanel>`,
 * which carries the matching `role="tabpanel"` / `aria-labelledby` wiring.
 *
 * Typography follows OpenStare's tab convention (AdminPage, ArticleEditor): uppercase labels,
 * `0.08em` letter-spacing; the selected tab is `--color-accent` at weight 600 with a 2px accent
 * underline, the rest `--color-text-secondary` at weight 400. The underline is a `box-shadow`
 * inset (no layout shift, no animated geometry).
 *
 * Two variants:
 * - `bar` — a page's primary navigation directly under `PageHeader`: the AdminPage tab bar
 *   (40px, glass background, bottom border, `--space-lg` side padding, 12px labels).
 * - `inline` (default) — tabs inside a panel or drawer: compact, no background.
 *
 * `count` is a quiet tally of what a view holds; `badge` is a notification bubble asking the
 * user to look (a filled `--color-accent` pill, 16px high, tabular digits, capped at `99+`).
 */

export interface TabItem {
  id: string
  label: string
  /** Optional leading icon (a react-icons/tb glyph); sized by the component. */
  icon?: ReactNode
  /** Optional trailing count, shown muted (e.g. rows in that view). */
  count?: number
  /**
   * Optional notification bubble: something in that view waits for the user (e.g. pending
   * reviews). A filled accent pill after the label; hidden when 0 or unset, capped at `99+`.
   */
  badge?: number
  /** Screen-reader wording for the bubble, e.g. `"3 pending"`; defaults to `"<n> new"`. */
  badgeLabel?: string
  disabled?: boolean
}

export interface TabsProps {
  tabs: TabItem[]
  value: string
  onChange: (id: string) => void
  'aria-label': string
  size?: 'sm' | 'md'
  /** `bar` for page navigation under the header; `inline` (default) inside panels. */
  variant?: 'inline' | 'bar'
  style?: CSSProperties
  /** Used to link tabs to panels; defaults to a generated id. Pass the same to `<TabPanel>`. */
  idPrefix?: string
}

const SIZE = {
  sm: { height: 28, fontSize: 11, padX: 10, icon: 13 },
  md: { height: 32, fontSize: 12, padX: 12, icon: 14 },
} as const

/** Element ids shared by `Tabs` and `TabPanel`. */
export function tabIds(prefix: string, id: string) {
  return { tab: `${prefix}-tab-${id}`, panel: `${prefix}-panel-${id}` }
}

export function Tabs({
  tabs,
  value,
  onChange,
  'aria-label': ariaLabel,
  size = 'md',
  variant = 'inline',
  style,
  idPrefix,
}: TabsProps) {
  const generated = useId()
  const prefix = idPrefix ?? generated
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})
  const bar = variant === 'bar'
  const s = bar ? { height: 40, fontSize: 12, padX: 16, icon: 14 } : SIZE[size]

  const move = (e: KeyboardEvent<HTMLDivElement>) => {
    const enabled = tabs.filter((t) => !t.disabled)
    const i = enabled.findIndex((t) => t.id === value)
    let next: TabItem | undefined
    if (e.key === 'ArrowRight') next = enabled[(i + 1) % enabled.length]
    else if (e.key === 'ArrowLeft') next = enabled[(i - 1 + enabled.length) % enabled.length]
    else if (e.key === 'Home') next = enabled[0]
    else if (e.key === 'End') next = enabled[enabled.length - 1]
    if (!next) return
    e.preventDefault()
    onChange(next.id)
    refs.current[next.id]?.focus()
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={move}
      style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 2,
        flexShrink: 0,
        height: s.height,
        borderBottom: '1px solid var(--color-glass-border)',
        ...(bar ? { background: 'var(--color-glass-bg)', padding: '0 var(--space-lg)' } : {}),
        ...style,
      }}
    >
      {tabs.map((t) => {
        const selected = t.id === value
        const ids = tabIds(prefix, t.id)
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[t.id] = el
            }}
            id={ids.tab}
            type="button"
            role="tab"
            className="ui-tabs__tab"
            aria-selected={selected}
            aria-controls={ids.panel}
            tabIndex={selected ? 0 : -1}
            disabled={t.disabled}
            onClick={() => onChange(t.id)}
            style={{
              boxSizing: 'border-box',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: `0 ${s.padX}px`,
              fontFamily: 'var(--font-sans)',
              fontSize: s.fontSize,
              fontWeight: selected ? 600 : 400,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: selected ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              boxShadow: selected ? 'inset 0 -2px 0 var(--color-accent)' : 'none',
              cursor: t.disabled ? 'not-allowed' : 'pointer',
              opacity: t.disabled ? 0.4 : 1,
              transition: 'color 0.12s ease',
              whiteSpace: 'nowrap',
            }}
          >
            {t.icon && (
              <span aria-hidden style={{ display: 'inline-flex', fontSize: s.icon }}>
                {t.icon}
              </span>
            )}
            {t.label}
            {t.count !== undefined && (
              <span style={{ fontWeight: 500, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                {t.count}
              </span>
            )}
            {t.badge !== undefined && t.badge > 0 && (
              <span
                className="ui-tabs__badge"
                aria-label={t.badgeLabel ?? `${t.badge} new`}
                title={t.badgeLabel ?? `${t.badge} new`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxSizing: 'border-box',
                  minWidth: 16,
                  height: 16,
                  padding: '0 5px',
                  borderRadius: 8,
                  background: 'var(--color-accent)',
                  color: 'var(--color-bg-primary)',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 0,
                  lineHeight: 1,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {t.badge > 99 ? '99+' : t.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export interface TabPanelProps {
  /** The tab this panel belongs to. */
  id: string
  /** Same prefix passed to `<Tabs idPrefix>`. */
  idPrefix: string
  children: ReactNode
  style?: CSSProperties
}

/** Panel for the active tab; render only the active one. */
export function TabPanel({ id, idPrefix, children, style }: TabPanelProps) {
  const ids = tabIds(idPrefix, id)
  return (
    <div role="tabpanel" id={ids.panel} aria-labelledby={ids.tab} tabIndex={0} style={{ outline: 'none', ...style }}>
      {children}
    </div>
  )
}
