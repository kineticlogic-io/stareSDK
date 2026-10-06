import type { CSSProperties, ReactNode } from 'react'

/**
 * ItemClassificationBar — one item's classification marking as a full-width coloured bar (FGAC
 * #74, D-31/D-41; extracted from VANTAGE's `ImageSummary`, #149). Used at the top of a panel or
 * popup body that describes a single item: an image, a track observation, a feature.
 *
 * - `banner` is the marking text to show (`SECRET//SI//REL TO USA, FVEY`). `null` means the item
 *   carries no classification at all and renders the distinct black CLASSIFICATION NOT SET bar —
 *   never nothing, and never the green UNCLASSIFIED bar (that one asserts a real value).
 * - `level` is the bare classification word that picks the colour (UNCLASSIFIED, CUI,
 *   CONFIDENTIAL, SECRET, TOP SECRET; anything else falls back to grey). `hasCaveats` turns
 *   any level above UNCLASSIFIED purple (SCI/control systems). UNCLASSIFIED is always green.
 * - `children` replaces the bar's text (VANTAGE puts a copyable provenance value there); it
 *   receives the resolved text colour via `renderText` instead when it needs it.
 *
 * Colours are theme-invariant domain colours (classification markings), matching the app's
 * classification-banner presets. Takes its data as props; whether banners are on is the caller's
 * decision.
 */

// eslint-disable-next-line no-restricted-syntax -- classification marking colour, theme-invariant domain colour (UNCLASSIFIED green, matches the classification-banner presets)
export const CLASSIFICATION_UNCLASSIFIED = '#006400'
// eslint-disable-next-line no-restricted-syntax -- classification marking colour (CUI purple, matches the classification-banner presets)
export const CLASSIFICATION_CUI = '#502b85'
// eslint-disable-next-line no-restricted-syntax -- classification marking colour (CONFIDENTIAL blue, matches the classification-banner presets)
export const CLASSIFICATION_CONFIDENTIAL = '#0033a0'
// eslint-disable-next-line no-restricted-syntax -- classification marking colour (SECRET red, matches the classification-banner presets)
export const CLASSIFICATION_SECRET = '#c8102e'
// eslint-disable-next-line no-restricted-syntax -- classification marking colour (TOP SECRET orange, matches the classification-banner presets)
export const CLASSIFICATION_TOP_SECRET = '#ff8300'
// eslint-disable-next-line no-restricted-syntax -- classification marking colour (SCI/control-system caveat purple; overrides any level above UNCLASSIFIED)
export const CLASSIFICATION_CAVEAT = '#6A3FA0'
// eslint-disable-next-line no-restricted-syntax -- classification marking colour (neutral fallback for an unrecognised classification word)
export const CLASSIFICATION_FALLBACK = '#5A6472'
// eslint-disable-next-line no-restricted-syntax -- classification marking colour (the CLASSIFICATION NOT SET bar: pure black, theme-invariant)
export const CLASSIFICATION_NOT_SET = '#000000'
// eslint-disable-next-line no-restricted-syntax -- the NOT SET bar's light grey text, legible on pure black (the muted text token reads too dark there)
export const CLASSIFICATION_NOT_SET_TEXT = '#BEBEBE'
// eslint-disable-next-line no-restricted-syntax -- WCAG contrast-math constant (light text), parsed as a luminance number
export const CLASSIFICATION_TEXT_LIGHT = '#FFFFFF'
// eslint-disable-next-line no-restricted-syntax -- WCAG contrast-math constant (dark text), parsed as a luminance number
export const CLASSIFICATION_TEXT_DARK = '#0B0F14'

/** The bar colour for a classification word. UNCLASSIFIED is always green; above it, caveats
 *  win over the level colour; an unrecognised word is neutral grey. */
export function classificationColor(level: string | null | undefined, hasCaveats = false): string {
  const word = (level ?? '').trim().toUpperCase()
  if (word === 'UNCLASSIFIED') return CLASSIFICATION_UNCLASSIFIED
  if (hasCaveats) return CLASSIFICATION_CAVEAT
  switch (word) {
    case 'CUI':
      return CLASSIFICATION_CUI
    case 'CONFIDENTIAL':
      return CLASSIFICATION_CONFIDENTIAL
    case 'SECRET':
      return CLASSIFICATION_SECRET
    case 'TOP SECRET':
      return CLASSIFICATION_TOP_SECRET
    default:
      return CLASSIFICATION_FALLBACK
  }
}

function luminance(hex: string): number {
  const n = hex.replace('#', '')
  const channel = (i: number) => {
    const c = parseInt(n.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4)
}

/** Black or white text, whichever has the higher WCAG contrast against `hex`. */
export function classificationTextColor(hex: string): string {
  const L = luminance(hex)
  return 1.05 / (L + 0.05) >= (L + 0.05) / 0.05 ? CLASSIFICATION_TEXT_LIGHT : CLASSIFICATION_TEXT_DARK
}

const BAR_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  width: '100%',
  boxSizing: 'border-box',
  padding: '0.7px 5%',
  borderRadius: 999,
  fontFamily: 'var(--font-sans)',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

export interface ItemClassificationBarProps {
  /** The marking text; `null` = the item carries no classification (CLASSIFICATION NOT SET). */
  banner: string | null
  /** The bare classification word that picks the colour. */
  level?: string | null
  /** SCI/control-system caveats present (purple above UNCLASSIFIED). */
  hasCaveats?: boolean
  /** Custom content for a marked item, given the resolved text colour. */
  renderText?: (text: string, textColor: string) => ReactNode
  style?: CSSProperties
}

export function ItemClassificationBar({ banner, level, hasCaveats = false, renderText, style }: ItemClassificationBarProps) {
  if (banner === null) {
    return (
      <div
        role="note"
        aria-label="Classification not set"
        style={{ ...BAR_STYLE, background: CLASSIFICATION_NOT_SET, color: CLASSIFICATION_NOT_SET_TEXT, ...style }}
      >
        CLASSIFICATION NOT SET
      </div>
    )
  }
  const background = classificationColor(level, hasCaveats)
  const color = classificationTextColor(background)
  return (
    <div role="note" aria-label={`Classification: ${banner}`} style={{ ...BAR_STYLE, background, color, ...style }}>
      {renderText ? renderText(banner, color) : banner}
    </div>
  )
}
