import type { BadgeColor } from './Badge'
import { DARK_THEME, LIGHT_THEME } from '../styles/chromeTheme'

/**
 * Sibling pure-values module for Badge.tsx's BADGE_BG (87-10 Rule 3 deviation — the react-refresh
 * "only export components" lint rule flags any non-component value export from a file that also
 * exports a component; matches the established layerRowStyles.ts / useKebabPopoverAnchor.ts
 * extraction pattern used elsewhere in this codebase for the same class of lint error).
 *
 * D-03/D-14: these stay DELIBERATE hardcoded hex literals, not an oversight to swap to a CSS
 * custom property. `contrastText()` in Badge.tsx does `parseInt(hex.slice(...), 16)` per channel
 * to compute WCAG relative luminance — a CSS custom property reference string cannot be
 * parseInt'd, so referencing a token here instead of a literal would silently break every Badge's
 * text color (parses as NaN, contrastText degenerates to a single fixed branch). This is the
 * standing CLAUDE.md raw-hex exception for this file; Phase 89 D-14 changes its SHAPE from
 * dark-only to per-theme, not its rationale.
 *
 * Per-theme, because `Badge.tsx`'s `outline` variant renders `BADGE_BG[theme][color]` directly
 * as the label's TEXT color against the page background (`color: outline ? bg : ...`) — so every
 * value must independently clear WCAG AA as *text* in its own theme, not just work as a
 * self-contained filled chip. Several dark-tuned values (e.g. `success` `#1DB954`) fail outright
 * on a light page.
 *
 * Values are sourced from `chromeTheme.ts`'s `badgeBg` group (D-11's single TS source of truth)
 * rather than retyped here, so the two cannot drift — `Badge.test.tsx` asserts each value against
 * its named token's hex, so a future token rename that isn't mirrored there fails CI instead of
 * drifting silently. See 87-UI-SPEC.md §Color 3a and 89-UI-SPEC.md §Component Contract 2.
 */
export const BADGE_BG: Record<'dark' | 'light', Record<BadgeColor, string>> = {
  dark: DARK_THEME.badgeBg,
  light: LIGHT_THEME.badgeBg,
}
