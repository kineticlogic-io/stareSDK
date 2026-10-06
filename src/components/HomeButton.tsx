import { TbArrowLeft } from 'react-icons/tb'
import { navigationClickHandler } from '../internal/navigationLink'

/**
 * Header "Home" link. Renders a real link so Ctrl/⌘-click opens a new tab; pass `onNavigate` to
 * route a plain click through the app's router instead of a full page load (#31).
 */
export interface HomeButtonProps {
  /** Where "Home" goes. Default `/`. */
  href?: string
  /** Client-side navigation for a plain click (e.g. react-router's `navigate`). */
  onNavigate?: (href: string) => void
}

export function HomeButton({ href = '/', onNavigate }: HomeButtonProps) {
  return (
    <a
      href={href}
      onClick={navigationClickHandler(href, onNavigate)}
      style={{
        pointerEvents: 'auto',
        fontFamily: 'var(--font-sans)',
        fontSize: 12,
        fontWeight: 400,
        letterSpacing: '0.08em',
        textTransform: 'uppercase' as const,
        color: 'var(--color-accent)',
        background: 'var(--color-glass-bg)',
        border: '1px solid var(--color-glass-border)',
        borderRadius: 4,
        padding: 'var(--space-xs) var(--space-sm)',
        textDecoration: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      <TbArrowLeft size={14} /> Home
    </a>
  )
}
