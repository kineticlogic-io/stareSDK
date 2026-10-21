import type { CSSProperties, ReactNode } from 'react'
import { TbArrowBadgeRight } from 'react-icons/tb'
import { navigationClickHandler } from '../internal/navigationLink.js'

/**
 * Breadcrumbs — where the current page sits in the app, as a trail of links back to its logical
 * parents (0.2.26, operator-approved for OpenStare's page header, where the first crumb, Home,
 * replaces `HomeButton`).
 *
 * - Every item but the last is a real `<a href>` (so Ctrl/⌘-click opens a new tab); a plain click
 *   is handed to the item's `onNavigate`, or the trail's, for client-side routing — the SDK never
 *   depends on a router. An item before the last without `href` is plain text.
 * - The last item is the current page: plain text with `aria-current="page"`.
 * - Separators are `TbArrowBadgeRight`, hidden from assistive technology; the trail is a
 *   `<nav aria-label="Breadcrumb">` around an ordered list.
 * - `icon` leads an item's label; with `hideLabel` only the icon shows and the label becomes its
 *   accessible name and tooltip (Home as a house icon).
 * - Every label but the last truncates past `maxItemWidth` with an ellipsis, the full label in a
 *   tooltip. The last keeps more room (it names the page) but still truncates rather than wrap.
 *
 * Data comes in through props only; design tokens only, so it follows the dark and light themes.
 */
export interface BreadcrumbItem {
  label: string
  /** Where the crumb goes. Ignored on the last item (the current page). */
  href?: string
  /** A leading icon (a react-icons/tb glyph). */
  icon?: ReactNode
  /** Show only the icon; the label is its accessible name and tooltip. Needs `icon`. */
  hideLabel?: boolean
  /** Client-side navigation for this crumb's plain click (overrides the trail's). */
  onNavigate?: (href: string) => void
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[]
  /** Client-side navigation for a plain click on any crumb (e.g. react-router's `navigate`). */
  onNavigate?: (href: string) => void
  /** The nav landmark's name (default "Breadcrumb"). */
  ariaLabel?: string
  /** Widest a crumb before the last may be before it truncates, in px (default 200). */
  maxItemWidth?: number
  style?: CSSProperties
}

const ellipsis: CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  minWidth: 0,
}

export function Breadcrumbs({ items, onNavigate, ariaLabel = 'Breadcrumb', maxItemWidth = 200, style }: BreadcrumbsProps) {
  if (items.length === 0) return null
  return (
    <nav aria-label={ariaLabel} className="ui-breadcrumbs" style={{ minWidth: 0, ...style }}>
      <ol
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-xs)',
          margin: 0,
          padding: 0,
          listStyle: 'none',
          minWidth: 0,
          fontFamily: 'var(--font-sans)',
        }}
      >
        {items.map((item, i) => {
          const last = i === items.length - 1
          const iconOnly = item.hideLabel === true && item.icon != null
          const content = (
            <>
              {item.icon != null && (
                <span aria-hidden style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, fontSize: 16 }}>
                  {item.icon}
                </span>
              )}
              {!iconOnly && <span className="ui-breadcrumbs__label" style={ellipsis}>{item.label}</span>}
            </>
          )
          const box: CSSProperties = {
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            minWidth: 0,
            maxWidth: last ? 'min(480px, 100%)' : maxItemWidth,
            fontSize: last ? 14 : 13,
            fontWeight: last ? 600 : 500,
            letterSpacing: last ? '0.04em' : '0.02em',
            color: last ? 'var(--color-accent)' : 'var(--color-text-secondary)',
            textDecoration: 'none',
            borderRadius: 'var(--radius-sm)',
          }
          let node: ReactNode
          if (last) {
            node = (
              <span aria-current="page" aria-label={iconOnly ? item.label : undefined} title={item.label} style={box}>
                {content}
              </span>
            )
          } else if (item.href != null) {
            node = (
              <a
                href={item.href}
                className="ui-breadcrumbs__link"
                aria-label={iconOnly ? item.label : undefined}
                title={item.label}
                onClick={navigationClickHandler(item.href, item.onNavigate ?? onNavigate)}
                style={box}
              >
                {content}
              </a>
            )
          } else {
            node = (
              <span aria-label={iconOnly ? item.label : undefined} title={item.label} style={box}>
                {content}
              </span>
            )
          }
          return (
            <li
              key={`${i}:${item.label}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-xs)', minWidth: 0, flexShrink: last ? 1 : 2 }}
            >
              {node}
              {!last && (
                <TbArrowBadgeRight
                  aria-hidden
                  data-separator=""
                  size={14}
                  style={{ flexShrink: 0, color: 'var(--text-muted)' }}
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
