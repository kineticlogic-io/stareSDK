import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * PageHeader — the page's top bar (stareSDK, operator-approved 2026-09-25).
 *
 * The same bar as `openstare/src/components/ui/PageHeader.tsx`: glass background, bottom border,
 * `--page-header-height` tall, a three-column grid (`minmax(0, 1fr) auto minmax(0, 1fr)`) whose
 * centre track stays centred against the full header width, and the uppercase accent title.
 *
 * Portable version: OpenStare's header portals into its app shell's `#page-header-portal` slot and
 * hard-wires the home button, clock badges, assistant button and user chip. Here the bar renders
 * in place (put it first in a full-height column) and those pieces are slots, so a standalone app
 * shows only what it has. Pass nothing you do not have: an empty slot renders nothing.
 *
 * Sets `document.title` to `<title> — <appName>` (or `appName` alone), so the browser tab and the
 * header can never disagree. One `PageHeader` per page.
 */
export interface PageHeaderProps {
  /** Page or app title; rendered uppercase in the accent colour and truncated before anything else. */
  title?: string
  /** App name used in `document.title`. */
  appName?: string
  /** Before the title (OpenStare puts its home button here). */
  leading?: ReactNode
  /** After the title, left-aligned (status badges, a site code). */
  children?: ReactNode
  /** Centre track (OpenStare puts clock badges here). */
  center?: ReactNode
  /** Right-aligned controls (OpenStare: assistant button and user chip). Never truncated. */
  actions?: ReactNode
  /**
   * Render the bar into this element instead of in place (#31) — for an app shell that keeps the
   * header full width while page content narrows beside docked panels. The header's footprint is
   * still reserved in place by an empty spacer. `null` means the target is not mounted yet: only
   * the spacer renders. Omit it to render the bar in place.
   */
  portalTarget?: HTMLElement | null
}

export function PageHeader({ title, appName, leading, children, center, actions, portalTarget }: PageHeaderProps) {
  useEffect(() => {
    const parts = [title, appName].filter(Boolean)
    if (parts.length > 0) document.title = parts.join(' — ')
  }, [title, appName])

  const bar = (
    <header
      style={{
        flexShrink: 0,
        width: '100%',
        height: 'var(--page-header-height, 48px)',
        marginTop: 'var(--banner-height, 0px)',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
        alignItems: 'center',
        columnGap: 'var(--space-md)',
        padding: '0 var(--space-lg)',
        background: 'var(--color-glass-bg)',
        borderBottom: '1px solid var(--color-glass-border)',
        fontFamily: 'var(--font-sans)',
        boxSizing: 'border-box',
        pointerEvents: 'auto',
      }}
    >
      <div style={{ justifySelf: 'start', minWidth: 0, display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
        {leading}
        {title && (
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--color-accent)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
            }}
          >
            {title}
          </span>
        )}
        {children && <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>{children}</div>}
      </div>
      <div style={{ justifySelf: 'center' }}>{center}</div>
      <div style={{ justifySelf: 'end', minWidth: 0, display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
        {actions}
      </div>
    </header>
  )

  if (portalTarget === undefined) return bar

  return (
    <>
      {/* In-flow spacer: reserves the header's footprint in the page. */}
      <div
        style={{
          flexShrink: 0,
          marginTop: 'var(--banner-height, 0px)',
          height: 'var(--page-header-height, 48px)',
        }}
      />
      {portalTarget && createPortal(bar, portalTarget)}
    </>
  )
}
