// Shared ESLint gate definitions for OpenStare's design system — imported by both
// `stareSDK/eslint.config.js` and `openstare/eslint.config.js` so the two packages enforce one rule.

// D-15 (Phase 89 Light Mode, plan 12) — blocking raw-color-literal gate.
//
// A design-token system (chromeTheme.ts / global.css) only holds if nothing new can bypass it.
// Roughly 600 hardcoded color literals accumulated in this codebase WHILE the token system
// already existed (89-UI-SPEC.md audit finding H-4) — convention alone demonstrably did not
// hold. This rule makes a new raw hex or rgb()/rgba() literal fail `eslint src` in both
// `openstare` and `stareSDK` (#31: the design tokens live in stareSDK, so the gate does too), which
// `npm run check` and CI both already run as a blocking step.
//
// Four selectors, per 89-RESEARCH.md Q8/Pitfall 3 (a single selector under-catches). Split into
// non-overlapping cases so one literal is never reported twice under two different selectors:
//   1. a bare hex string literal ('#RGB' / '#RRGGBB' / '#RRGGBBAA', the ENTIRE literal value)
//   2. a string literal containing an embedded hex that is NOT the entire value — catches the
//      `cssText`/inline-style-string literals this codebase uses heavily (e.g. `'1px solid #E03C3C'`)
//   3. a string literal containing an rgb()/rgba() call (e.g. `'rgba(224,60,60,0.10)'`)
//   4. a template-literal static chunk containing either pattern
export const RAW_COLOR_MESSAGE =
  'Raw color literal (hex or rgb()/rgba()). Use a design token from stareSDK\'s chromeTheme ' +
  '(JS/TS/Canvas/map render paths) or its global.css custom properties (CSS/inline style var()) ' +
  'instead of a hardcoded literal. If this is a genuine domain-color exception (map/track/' +
  'tactical/data-viz/classification-banner color, D-13/D-07), use a per-site ' +
  '`eslint-disable-next-line no-restricted-syntax` with a comment naming the exception, or add ' +
  'this file to the allowlist block in its package\'s eslint.config.js if the WHOLE file is such an exception.'

const BARE_HEX = 'Literal[value=/^#[0-9a-fA-F]{3,8}$/]'

export const RAW_COLOR_LITERAL_SELECTORS = [
  {
    selector: BARE_HEX,
    message: RAW_COLOR_MESSAGE,
  },
  {
    selector: `Literal[value=/#[0-9a-fA-F]{3,8}\\b/]:not(${BARE_HEX})`,
    message: RAW_COLOR_MESSAGE,
  },
  {
    selector: 'Literal[value=/rgba?\\([^)]*\\)/]',
    message: RAW_COLOR_MESSAGE,
  },
  {
    selector: 'TemplateElement[value.raw=/(rgba?\\([^)]*\\)|#[0-9a-fA-F]{3,8}\\b)/]',
    message: RAW_COLOR_MESSAGE,
  },
]
