import { useState } from 'react'
import { TbSparkles } from 'react-icons/tb'
import { headerControlStyle } from './headerControls.js'

/**
 * Header "Assistant" chip — toggles an app's assistant panel. Styled to align with the other
 * header items (UserChip / ClockBadges): glass chip, 12px.
 *
 * Props only (#31): the app owns the assistant state and passes it in.
 */
export interface AssistantButtonProps {
  /** Whether the assistant panel is open (drives the pressed state). */
  open: boolean
  onToggle: () => void
}

export function AssistantButton({ open, onToggle }: AssistantButtonProps) {
  const [hovered, setHovered] = useState(false)
  const active = open || hovered

  return (
    <button
      onClick={onToggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label="Toggle AI assistant"
      aria-pressed={open}
      title="AI Assistant"
      style={{
        ...headerControlStyle,
        gap: 'var(--space-xs)',
        background: open ? 'var(--brand-subtle)' : 'var(--color-glass-bg)',
        border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-glass-border)'}`,
        fontWeight: 600,
        letterSpacing: '0.04em',
        color: active ? 'var(--color-accent)' : 'var(--color-text-primary)',
        cursor: 'pointer',
        pointerEvents: 'auto',
        transition: 'border-color 0.15s, color 0.15s',
      }}
    >
      <TbSparkles size={14} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
      <span>Assistant</span>
    </button>
  )
}
