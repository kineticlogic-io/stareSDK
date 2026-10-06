/**
 * hexToRgb family — shared hex-color parsing for the Analysis/GIS symbology and
 * thematic-styling surfaces (colorRamps, GisVectorDisplayLayer, trackGrouping,
 * thematicStyleEngine, symbologyEngine).
 *
 * This is a RECONCILIATION, not a pure move (D-24, 87-20). The five pre-existing
 * copies had two incompatible return shapes (`{r,g,b}` object vs `[r,g,b]` tuple)
 * and three different malformed-input fallbacks (black / white / grey). See
 * 87-20-SUMMARY.md for the full five-way comparison table and the reasoning
 * behind the choices below.
 *
 * - Tuple form (`[r,g,b]` / `[r,g,b,a]`) is canonical — it matches deck.gl's own
 *   color convention and was already the majority shape (3 of 5 copies).
 * - Default fallback on malformed input is opaque WHITE, not colorRamps.ts's
 *   original black — this app's map surfaces are dark-themed (Elite Command
 *   Design System), so a black fallback would silently vanish against the
 *   basemap while white stays visibly wrong (T-87-20-02). Call sites whose
 *   rendering depended on a DIFFERENT fallback (colorRamps.ts's black,
 *   trackGrouping.ts's semantic "unclassified" grey) pass their own `fallback`
 *   argument to preserve that behavior exactly rather than silently changing
 *   what renders.
 */

/** A parsed color as deck.gl-convention channel values 0-255. */
export type RGB = [number, number, number]

/** A parsed color with an alpha channel, 0-255 (deck.gl `[r,g,b,a]` convention). */
export type RGBA = [number, number, number, number]

/** Default malformed-input fallback: opaque white. See module header for reasoning. */
export const DEFAULT_HEX_FALLBACK: RGB = [255, 255, 255]

/**
 * Parse a hex color string (`#rgb`, `#rrggbb`, with or without a leading `#`,
 * with or without surrounding whitespace) into an `[r,g,b]` tuple in 0-255.
 * Never throws (T-87-20-01) — malformed input returns `fallback` (default
 * opaque white; pass a different tuple to preserve a call site's own
 * pre-reconciliation fallback).
 */
export function hexToRgb(hex: string, fallback: RGB = DEFAULT_HEX_FALLBACK): RGB {
  const normalized = hex.trim().replace(/^#/, '')
  if (normalized.length === 3) {
    const r0 = normalized[0]
    const g0 = normalized[1]
    const b0 = normalized[2]
    const expanded = `${r0}${r0}${g0}${g0}${b0}${b0}`
    const n = Number.parseInt(expanded, 16)
    if (!Number.isNaN(n)) return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  } else if (normalized.length === 6) {
    const n = Number.parseInt(normalized, 16)
    if (!Number.isNaN(n)) return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  return fallback
}

/**
 * Parse a hex color string into an `[r,g,b,a]` tuple, with the alpha channel
 * set to `alpha` (0-255, default opaque). Consolidates symbologyEngine's
 * `hexToRgba` and thematicStyleEngine's `hexToRgbaLocal` — both already shared
 * the exact `(hex, alpha = 255)` signature; the only real difference was that
 * symbologyEngine's copy had no malformed-input guard at all (NaN would
 * silently propagate into the color channels). This keeps the guard. Never
 * throws.
 */
export function hexToRgba(hex: string, alpha = 255, fallback: RGB = DEFAULT_HEX_FALLBACK): RGBA {
  const [r, g, b] = hexToRgb(hex, fallback)
  return [r, g, b, alpha]
}

/**
 * WCAG relative luminance of a hex color, 0 (black) to 1 (white).
 *
 * Lifted verbatim from `ui/Badge.tsx`'s private `contrastText()` (the `toLin` sRGB-linearization
 * closure plus the 0.2126/0.7152/0.0722 weighted sum) so results stay byte-identical to that
 * function's existing behavior — this is a pure extraction, not a reimplementation (Phase 89
 * plan 01, D-04). Reuses `hexToRgb` for parsing rather than a second `parseInt`-based parser, so
 * this file keeps exactly one hex-parsing implementation (this file's own stated reason for
 * existing — see module header).
 */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  const toLin = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b)
}

/**
 * WCAG contrast ratio between two hex colors, `(Lmax + 0.05) / (Lmin + 0.05)`.
 * Always >= 1. Used by `theme.test.ts`'s D-04 contrast gate (Phase 89 plan 01).
 */
export function contrastRatio(hexA: string, hexB: string): number {
  const La = relativeLuminance(hexA)
  const Lb = relativeLuminance(hexB)
  const lighter = Math.max(La, Lb)
  const darker = Math.min(La, Lb)
  return (lighter + 0.05) / (darker + 0.05)
}
