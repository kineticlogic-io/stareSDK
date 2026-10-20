import type { ReactNode } from 'react'
import { useId, useState } from 'react'
import { motion } from 'framer-motion'
import { navigationClickHandler } from '../internal/navigationLink.js'
import { Tooltip } from './Tooltip.js'

/**
 * Landing-page app card (#31): icon, uppercase label, optional description, 180 × 160 glass tile
 * with a hover lift. A disabled card is shown dimmed with no link; its reason (`disabledTooltip`) shows
 * in a {@link Tooltip} while the card is hovered (following the pointer) or keyboard-focused (below
 * the card), and the card points at it with `aria-describedby` (0.2.23 — before, a native `title`).
 *
 * Renders a real link, so Ctrl/⌘-click opens a new tab; pass `onNavigate` to route a plain click
 * through the app's router. Which apps a user may see is the host app's concern (OpenStare's
 * `CardDock`), not this component's.
 */
export interface AppCardProps {
  label: string
  icon: ReactNode
  /** The app's route. */
  href: string
  description?: string
  disabled?: boolean
  /** Why the card is disabled — shown in a stareSDK `Tooltip` on hover or focus, and as the card's
   *  accessible label. */
  disabledTooltip?: string
  /** Client-side navigation for a plain click (e.g. react-router's `navigate`). */
  onNavigate?: (href: string) => void
}

export function AppCard({ label, icon, href, description, disabled, disabledTooltip, onNavigate }: AppCardProps) {
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null)
  const tipId = useId()
  const explains = Boolean(disabled && disabledTooltip)
  const inner = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1.1 }}>{icon}</div>
      <div style={{
        fontSize: 14,
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase' as const,
        lineHeight: 1.4,
        textAlign: 'center',
      }}>
        {label}
      </div>
      {description && (
        <div style={{
          fontSize: 10,
          fontWeight: 400,
          color: 'var(--color-text-secondary)',
          lineHeight: 1.3,
          textAlign: 'center',
          paddingTop: 'var(--space-sm)',
        }}>
          {description}
        </div>
      )}
    </>
  )

  const contentStyle = {
    textDecoration: 'none',
    color: 'inherit',
    textAlign: 'center' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 'var(--space-xs)',
  }

  return (
    <motion.div
      aria-label={disabled ? disabledTooltip : undefined}
      aria-describedby={explains && tip ? tipId : undefined}
      onMouseMove={explains ? (e: React.MouseEvent) => setTip({ x: e.clientX, y: e.clientY }) : undefined}
      onMouseLeave={explains ? () => setTip(null) : undefined}
      onFocus={explains ? (e: React.FocusEvent<HTMLDivElement>) => {
        const r = e.currentTarget.getBoundingClientRect()
        setTip({ x: r.left, y: r.bottom + 8 })
      } : undefined}
      onBlur={explains ? () => setTip(null) : undefined}
      aria-disabled={disabled ? 'true' : undefined}
      tabIndex={disabled ? 0 : undefined}
      style={{
        position: 'relative',
        height: 160,
        width: 180,
        padding: 'var(--space-lg)',
        background: 'var(--color-glass-bg)',
        border: '1px solid var(--color-glass-border)',
        borderRadius: 8,
        boxShadow: 'var(--shadow-standard)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--space-sm)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'var(--font-sans)',
        color: 'var(--color-text-primary)',
        overflow: 'hidden',
        opacity: disabled ? 0.35 : undefined,
      }}
      whileHover={disabled ? {} : { scale: 1.05 }}
    >
      {disabled ? (
        <div style={contentStyle}>{inner}</div>
      ) : (
        <a href={href} onClick={navigationClickHandler(href, onNavigate)} style={contentStyle}>
          {inner}
        </a>
      )}
      {explains && tip && <Tooltip id={tipId} x={tip.x} y={tip.y} content={disabledTooltip!} />}
    </motion.div>
  )
}
