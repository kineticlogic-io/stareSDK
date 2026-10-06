import { useState } from 'react'
import type { ReactNode, CSSProperties, ButtonHTMLAttributes } from 'react'

/**
 * Standardized button.
 *
 * Sizes: xs / sm / md / lg / xl.
 *  - `xs` is a square, icon-only button (pass `icon`, no label; provide `aria-label`).
 *  - all other sizes take a label (`children`) and an optional left-side `icon`.
 *
 * Variants: primary (solid brand) / secondary (brand outline) / ghost (text) / danger (solid red).
 *
 * Prefer placing related buttons in a <ButtonPalette> rather than stacking full-width.
 */

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

const SIZE: Record<ButtonSize, { height: number; fontSize: number; padX: number; iconSize: number; gap: number }> = {
  xs: { height: 28, fontSize: 0, padX: 0, iconSize: 16, gap: 0 }, // square, icon-only
  sm: { height: 28, fontSize: 11, padX: 10, iconSize: 14, gap: 6 },
  md: { height: 34, fontSize: 12, padX: 14, iconSize: 16, gap: 7 },
  lg: { height: 40, fontSize: 13, padX: 18, iconSize: 18, gap: 8 },
  xl: { height: 46, fontSize: 14, padX: 22, iconSize: 20, gap: 9 },
}

interface VariantColors { bg: string; bgHover: string; fg: string; border: string }
const VARIANT: Record<ButtonVariant, VariantColors> = {
  primary: { bg: 'var(--color-accent)', bgHover: 'var(--brand-primary-hover)', fg: 'var(--text-inverse)', border: 'transparent' },
  secondary: { bg: 'transparent', bgHover: 'var(--color-glass-bg)', fg: 'var(--color-text-primary)', border: 'var(--color-glass-border)' },
  ghost: { bg: 'transparent', bgHover: 'var(--color-glass-bg)', fg: 'var(--color-text-secondary)', border: 'transparent' },
  // eslint-disable-next-line no-restricted-syntax -- PRE-EXISTING theme gap: danger.bgHover/fg literals predate Phase 89 and are pinned to specific hex values, not per-theme tokens — closing this needs a new hover/fg design decision, deferred (see deferred-items.md, same "picking new literal values" deferral pattern as 89-01 KNOWN_DARK_GAPS)
  danger: { bg: 'var(--color-destructive)', bgHover: '#C62F2F', fg: '#FFFFFF', border: 'transparent' },
}

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  size?: ButtonSize
  variant?: ButtonVariant
  /** Left-side icon (for `xs` it is the only content). Pass a react-icons/tb glyph; size is applied automatically. */
  icon?: ReactNode
  children?: ReactNode
  /** Stretch to the container width. Avoid stacking full-width buttons — prefer a ButtonPalette. */
  fullWidth?: boolean
  /** Selected/toggled state: renders a solid DARKER fill (never a transparent glass pane). */
  active?: boolean
  /**
   * Horizontal alignment of icon+label content within the button box. Defaults to
   * `'center'` (standard CTA look). Popover/menu-item buttons (fullWidth, left-reading
   * icon+label rows — e.g. kebab menu items) should pass `'flex-start'` so content hugs
   * the left edge instead of floating centered in the wide popover box.
   */
  justify?: 'center' | 'flex-start'
}

// Active/selected toggle look — a solid, darker fill so the on state is unmistakable.
const ACTIVE_BG = 'var(--brand-primary-active)'
const ACTIVE_BG_HOVER = 'var(--color-accent)'

export function Button({
  size = 'md',
  variant = 'primary',
  icon,
  children,
  fullWidth = false,
  active = false,
  disabled = false,
  type = 'button',
  justify = 'center',
  style,
  ...rest
}: ButtonProps) {
  const [hover, setHover] = useState(false)
  const s = SIZE[size]
  const v = VARIANT[variant]
  const isXs = size === 'xs'

  const css: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: justify,
    gap: isXs ? 0 : icon ? s.gap : 0,
    height: s.height,
    width: isXs ? s.height : fullWidth ? '100%' : undefined,
    padding: isXs ? 0 : `0 ${s.padX}px`,
    background: disabled
      ? 'var(--color-glass-bg)'
      : active
      ? hover ? ACTIVE_BG_HOVER : ACTIVE_BG
      : hover ? v.bgHover : v.bg,
    // eslint-disable-next-line no-restricted-syntax -- PRE-EXISTING theme gap: active-state fg is pinned to raw white rather than a themed token — same deferral as line 32 above
    color: disabled ? 'var(--color-text-secondary)' : active ? '#FFFFFF' : v.fg,
    border: `1px solid ${active ? 'var(--color-accent)' : v.border === 'transparent' ? 'transparent' : v.border}`,
    borderRadius: 4,
    fontFamily: 'var(--font-sans)',
    fontSize: s.fontSize,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    whiteSpace: 'nowrap',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    boxSizing: 'border-box',
    transition: 'background 0.15s, border-color 0.15s',
    ...style,
  }

  return (
    <button
      type={type}
      disabled={disabled}
      style={css}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      {...rest}
    >
      {icon != null && (
        <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, fontSize: s.iconSize }}>
          {icon}
        </span>
      )}
      {!isXs && children}
    </button>
  )
}
