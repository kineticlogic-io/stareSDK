import type { ReactNode, CSSProperties } from 'react'
import { TbX } from 'react-icons/tb'
import { BADGE_BG } from './badgeTokens.js'
import { relativeLuminance } from '../internal/color.js'
import { useTheme } from '../theme/useTheme.js'

/**
 * Standardized pill Badge.
 *
 * - Pill-shaped, solid-filled, compact.
 * - `color` selects a standard fill; the text color is computed automatically
 *   (WCAG relative-luminance) to maximize contrast against that fill.
 * - Three standard sizes: sm / md / lg.
 *
 * This is the single source of truth for small status/label pills (roles,
 * statuses, counts, etc.). Prefer it over hand-rolled inline pill styles.
 *
 * `fill` (0.2.38) takes a fill colour of the caller's own as hex (`#RRGGBB` or `#RGB`) — a
 * data-viz class colour, say — in place of `color`; the text is chosen against it exactly as for
 * the standard fills. Hex only, for the same reason as BADGE_BG: `contrastText()` must parse it. A
 * value that is not hex falls back to `color`.
 *
 * `onRemove` (0.2.26) makes it a removable chip: a trailing × button (`TbX`) named by
 * `removeLabel` (default "Remove"), the same chip `TagInput` shows for each value — e.g. a
 * chosen filter value shown under its search field.
 */

export type BadgeColor = 'grey' | 'brand' | 'blue' | 'success' | 'warning' | 'danger'
export type BadgeSize = 'sm' | 'md' | 'lg'

// D-03/D-14: BADGE_BG's hex literals are DELIBERATE, not an oversight to swap to a CSS custom
// property — contrastText() below needs parseable hex (see badgeTokens.ts for the full
// reasoning). It is keyed by theme (`BADGE_BG[theme][color]`) because the `outline` variant
// below renders the raw hex directly as TEXT color, so each theme needs its own AA-legible set.
// Moved to a sibling module (87-10 Rule 3) so this file exports only the Badge component
// (react-refresh/only-export-components). Guarded by Badge.test.tsx's drift assertions.

// Height is driven by vertical padding (with line-height:1) so the label and any
// icon center cleanly — a tall line-height would float uppercase glyphs upward.
const SIZE_STYLES: Record<BadgeSize, CSSProperties> = {
  sm: { fontSize: 9, padding: '4px 7px', letterSpacing: '0.06em' },
  md: { fontSize: 10, padding: '5px 9px', letterSpacing: '0.06em' },
  lg: { fontSize: 12, padding: '6px 11px', letterSpacing: '0.08em' },
}

// eslint-disable-next-line no-restricted-syntax -- D-04 theme-invariant WCAG contrast-math constant, same rationale as badgeTokens.ts — contrastText() needs parseable hex, not a var() string
const LIGHT_TEXT = '#FFFFFF'
// Pure black, not a chrome token — contrastText() picks the higher-contrast of pure black/white
// against an arbitrary fill for maximum legibility; that choice is theme-invariant WCAG math, not
// a themed surface color, so it is NOT `var(--color-bg-primary)` in either mode (Phase 89 D-04).
// eslint-disable-next-line no-restricted-syntax -- D-04 theme-invariant WCAG contrast-math constant, same rationale as badgeTokens.ts — contrastText() needs parseable hex, not a var() string
const DARK_TEXT = '#0B0F14'

/** Pick black or white text for the higher WCAG contrast ratio against `hex`. */
function contrastText(hex: string): string {
  const L = relativeLuminance(hex)
  const contrastWhite = 1.05 / (L + 0.05)
  const contrastBlack = (L + 0.05) / 0.05
  return contrastWhite >= contrastBlack ? LIGHT_TEXT : DARK_TEXT
}

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

// Gap between the optional left icon and the label, per size.
const ICON_GAP: Record<BadgeSize, number> = { sm: 4, md: 5, lg: 6 }

interface BadgeProps {
  children: ReactNode
  color?: BadgeColor
  /** A fill of the caller's own, as hex (0.2.38); overrides `color`. Not hex: `color` is used. */
  fill?: string
  size?: BadgeSize
  /** Uppercase the label (typical for role/status pills). */
  uppercase?: boolean
  /** Optional icon rendered on the left side of the badge (e.g. a react-icons/tb glyph or status dot). */
  icon?: ReactNode
  /** Hollow style: transparent fill with a colored outline + colored text (instead of a solid fill). */
  outline?: boolean
  title?: string
  /** Adds a trailing × button that calls this (a removable chip). */
  onRemove?: () => void
  /** The × button's accessible name (default "Remove"). */
  removeLabel?: string
  /** Disables the × button. */
  removeDisabled?: boolean
  style?: CSSProperties
}

const removeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginLeft: 4,
  padding: 0,
  border: 'none',
  background: 'transparent',
  color: 'inherit',
  lineHeight: 1,
}

export function Badge({
  children,
  color = 'grey',
  fill,
  size = 'md',
  uppercase = false,
  icon,
  outline = false,
  title,
  onRemove,
  removeLabel = 'Remove',
  removeDisabled = false,
  style,
}: BadgeProps) {
  const { theme } = useTheme()
  const bg = fill !== undefined && HEX_RE.test(fill) ? fill : BADGE_BG[theme][color]
  return (
    <span
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: icon != null ? ICON_GAP[size] : 0,
        background: outline ? 'transparent' : bg,
        color: outline ? bg : contrastText(bg),
        border: outline ? `1px solid ${bg}` : 'none',
        borderRadius: 999,
        fontWeight: 700,
        fontFamily: 'var(--font-sans)',
        lineHeight: 1, // tight box so label + icon center on the same axis
        whiteSpace: 'nowrap',
        textTransform: uppercase ? 'uppercase' : 'none',
        ...SIZE_STYLES[size],
        ...style,
      }}
    >
      {icon != null && (
        <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>{icon}</span>
      )}
      {children}
      {onRemove && (
        <button
          type="button"
          aria-label={removeLabel}
          title={removeLabel}
          disabled={removeDisabled}
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          style={{ ...removeStyle, cursor: removeDisabled ? 'not-allowed' : 'pointer' }}
        >
          <TbX size={10} aria-hidden />
        </button>
      )}
    </span>
  )
}
