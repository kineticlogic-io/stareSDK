import type { CSSProperties, ReactNode } from 'react'

/**
 * EmptyState — the centered message a list, grid or panel shows when it has nothing to show
 * (0.2.25, for OpenStare's LEDGER content-management overhaul, kineticlogic-io/OpenStare#383–#388).
 *
 * Quiet by design (DESIGN-CONTRACT §7, "say what is missing and what to do, in one line"): an
 * optional icon in `--text-muted`, the `title` in `--color-text-secondary`, an optional
 * `description` in `--text-muted`, and an optional `action` slot for the one thing to do next
 * (the caller passes a `Button`). No illustration, no fill, no border — it sits on whatever
 * surface holds it. All copy comes from the caller.
 *
 * `size="sm"` is the compact variant for a panel or drawer; `md` (default) for a page-level list.
 */
export interface EmptyStateProps {
  /** Optional leading glyph (a react-icons/tb icon); sized and muted by the component. */
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  /** The next step, e.g. `<Button variant="secondary">Upload</Button>`. */
  action?: ReactNode
  size?: 'sm' | 'md'
  style?: CSSProperties
}

const SIZE = {
  sm: { pad: 'var(--space-lg) var(--space-md)', icon: 24, title: 12, text: 11, gap: 'var(--space-xs)' },
  md: { pad: 'var(--space-2xl) var(--space-lg)', icon: 32, title: 14, text: 12, gap: 'var(--space-sm)' },
} as const

export function EmptyState({ icon, title, description, action, size = 'md', style }: EmptyStateProps) {
  const s = SIZE[size]
  return (
    <div
      className="ui-empty-state"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: s.gap,
        padding: s.pad,
        textAlign: 'center',
        fontFamily: 'var(--font-sans)',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {icon != null && (
        <span aria-hidden style={{ display: 'inline-flex', fontSize: s.icon, color: 'var(--text-muted)', marginBottom: 2 }}>
          {icon}
        </span>
      )}
      <div style={{ fontSize: s.title, fontWeight: 500, lineHeight: 1.4, color: 'var(--color-text-secondary)' }}>{title}</div>
      {description != null && (
        <div style={{ fontSize: s.text, lineHeight: 1.5, color: 'var(--text-muted)', maxWidth: 420 }}>{description}</div>
      )}
      {action != null && <div style={{ marginTop: 'var(--space-sm)', display: 'inline-flex' }}>{action}</div>}
    </div>
  )
}
