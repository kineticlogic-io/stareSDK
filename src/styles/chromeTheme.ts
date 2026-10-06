/**
 * chromeTheme.ts — the single TypeScript-side source of truth for the dark/light chrome
 * palette (Phase 89 Light Mode, plan 01, D-11).
 *
 * WHY THIS FILE EXISTS: deck.gl layers, the landing canvas render loop (Canvas2D), and Leaflet
 * `PathOptions`/`divIcon` SVG strings cannot read CSS custom properties. Every one of those
 * render surfaces must import a typed value directly — never `getComputedStyle` inside a render
 * path (D-11's hard rule).
 *
 * TWO HALVES:
 * 1. Twenty CSS-mirrored scalar fields — these mirror `global.css`'s `:root` / `[data-theme="light"]`
 *    custom-property blocks 1:1 (same 19 D-03 tokens plus `--color-link-hover`, which is a raw hex
 *    literal in `global.css`, not a `var()`). `theme.test.ts`'s drift gate parses `global.css` at
 *    test time and asserts these values match exactly — do NOT hand-edit one without the other.
 * 2. JS-only groups/scalars with NO CSS custom-property equivalent — consumed directly by Canvas2D,
 *    Leaflet, and plain-object lookups (severity ramp, landing canvas basemap half, offline vector
 *    basemap, badge fills, and the AI reasoning-step marker color).
 *
 * `DARK_THEME`'s 20 scalar fields are byte-identical to the current (pre-Phase-89) `:root`
 * declarations — dark mode is a provable no-op. `LIGHT_THEME`'s values are transcribed verbatim
 * from `89-UI-SPEC.md`'s computed WCAG contrast table; do not re-derive them by algorithmic
 * inversion (D-01).
 */

export type ThemeName = 'dark' | 'light'

export interface ChromeTheme {
  // === 20 CSS-mirrored scalar fields (19 D-03 tokens + --color-link-hover) ===
  colorBgPrimary: string
  colorBgSecondary: string
  colorAccent: string
  colorTextPrimary: string
  colorTextSecondary: string
  colorDestructive: string
  colorGlassBg: string
  colorGlassBorder: string
  surfaceLayer2: string
  borderStrong: string
  textMuted: string
  textInverse: string
  brandPrimaryHover: string
  brandPrimaryActive: string
  brandSubtle: string
  shadowStandard: string
  shadowDeep: string
  statusWarning: string
  statusSuccess: string
  statusInfo: string
  /** Raw hex in global.css (not a `var()`) — the `.wiki-link`/`.wiki-md a` hover color. */
  colorLinkHover: string

  // === JS-only groups — no CSS custom-property equivalent ===

  /**
   * The shared four-color-plus-two severity ramp (D-14, originally extracted from the since-
   * retired mesh topology graph), plus a `fallback` key carrying that graph's previously-unnamed default
   * (`|| '#8aa0b5'`) and its light counterpart — a new finding surfaced by 89-RESEARCH.md Q3,
   * not individually named in CONTEXT.md/UI-SPEC.md.
   */
  severityRamp: {
    live: string
    lagging: string
    degraded: string
    stale: string
    offline: string
    gps: string
    fallback: string
  }

  /** The landing canvas's basemap-half palette (Component Contract §11, D-12). The
   * ship/plane/ping/beacon burnt-orange track colors are theme-invariant and are NOT part of
   * this module — c2MapData.ts keeps them untouched. */
  landingBasemap: {
    bg: string
    bgCenter: string
    land: string
    landBorder: string
    graticule: string
    portNode: string
  }

  /**
   * Canvas2D `globalCompositeOperation` for the landing canvas's track/pulse draw passes
   * (Phase 89 plan 13 gap-closure). Deliberately kept OUTSIDE `landingBasemap` — a blend mode is
   * engine compositing behavior, not a color, and must not count against the D-12 strict six-key
   * gate or the "track colors are theme-invariant" boundary (criterion 7). The four burnt-orange
   * track COLORS (`CONFIG.ship`/`plane`/`ping`/`beacon` in `c2MapData.ts`) stay theme-invariant in
   * both themes, exactly as D-12 specifies — this field only changes HOW those declared colors are
   * composited onto the basemap, never what they are.
   *
   * Root cause this exists to fix: `'lighter'` (additive: result = src*alpha + dst, clamped) is
   * correct on the dark basemap (adds an orange glow to near-black land) but SATURATES TO WHITE on
   * the light basemap's near-white land/bgCenter, making tracks/pulses render invisibly regardless
   * of their declared RGB — no color choice can fix an additive-blend problem. DARK keeps
   * `'lighter'` byte-identical (the shipped glow aesthetic). LIGHT uses normal `'source-over'`
   * alpha compositing so the declared burnt-orange color is what actually paints.
   */
  landingTrackBlendMode: GlobalCompositeOperation

  /** The airgap offline PMTiles basemap's container background (D-10, Component Contract §9;
   * `ocean` is `StareMapEngine.tsx`/`MapLayout.tsx`'s pre-paint backdrop — hardcoded black at four
   * sites originally, so the "pale ocean is free" UI-SPEC claim does not hold; see plan 89-09).
   * Phase 134 plan 20 removed `countryBorder`/`landFill`/`landFillOpacity`/`admin1Border` — those
   * were `CountriesLayer.tsx`/`Admin1Layer.tsx`'s Leaflet `PathOptions` for the retired
   * embedded-GeoJSON Natural Earth rendering, deleted along with those two components once
   * `StareMapEngine`'s bundled PMTiles planet extract became the one offline builtin (D-01/D-03).
   *
   * `countryBorder`/`landFill`/`landFillOpacity`/`admin1Border` remain for stareSDK's standalone
   * `MapView` (its offline land/border style), which OpenStare itself does not use. */
  offlineBasemap: {
    ocean: string
    countryBorder: string
    landFill: string
    landFillOpacity: number
    admin1Border: string
  }

  /** BADGE_BG's per-theme map (D-14) — stays raw hex in both themes because `contrastText()`
   * needs `parseInt`-able hex, not a `var()` string (standing CLAUDE.md exception). */
  badgeBg: Record<'grey' | 'brand' | 'blue' | 'success' | 'warning' | 'danger', string>

  /** ReasoningChain.tsx's non-tool-call reasoning-step marker color, paired beside
   * `var(--color-accent)` for the tool-call case — a real semantic distinction that must survive
   * both themes without collapsing into the accent hue. Read-only for plan 89-08; authored here. */
  reasoningStep: string

  /**
   * StareMapEngine's offline PMTiles default basemap flavor (Phase 134 plan 09, D-02). JS-only —
   * no CSS custom-property equivalent, since `@protomaps/basemaps`' `namedFlavor()` takes this
   * exact string and MapLibre style JSON generation happens in
   * `lib/mapEngine/adapters/pmtilesBasemap.ts`, never in a render path that could read
   * `getComputedStyle`. `StareMapEngine.tsx`'s `basemapSpecFor` is the one reader.
   */
  basemapFlavor: 'dark' | 'light'

  /**
   * Canvas-usable shadow fill for the vertical-stack spiderfy box (Phase 114, D-02/D-06) —
   * `shadowStandard`/`shadowDeep` above are full CSS `box-shadow` shorthand STRINGS (offset + blur
   * + color combined), unusable by a deck.gl `getFillColor` accessor, which needs a plain
   * `[r, g, b, a]` tuple. This pair restates each theme's own `shadowStandard` color/alpha as a
   * canvas-consumable scalar split — same standing exception as `badgeBg`/`reasoningStep`/
   * `offlineBasemap` above ("JS-only groups/scalars with NO CSS custom-property equivalent").
   */
  spiderfyBoxShadowRgb: [number, number, number]
  spiderfyBoxShadowAlpha: number
}

export const DARK_THEME: ChromeTheme = {
  colorBgPrimary: '#0B0F14',
  colorBgSecondary: '#11161D',
  colorAccent: '#0FAF73',
  colorTextPrimary: '#E8EEF5',
  colorTextSecondary: '#93A4B8',
  colorDestructive: '#E03C3C',
  colorGlassBg: '#151C24',
  colorGlassBorder: '#263241',
  surfaceLayer2: '#1B2430',
  borderStrong: '#2F3E52',
  textMuted: '#6E7F93',
  textInverse: '#0B0F14',
  brandPrimaryHover: '#14C987',
  brandPrimaryActive: '#0B8C5C',
  brandSubtle: 'rgba(15, 175, 115, 0.12)',
  shadowStandard: '0 4px 12px rgba(0, 0, 0, 0.35)',
  shadowDeep: '0 12px 32px rgba(0, 0, 0, 0.45)',
  statusWarning: '#F5A623',
  statusSuccess: '#1DB954',
  statusInfo: '#3B82F6',
  colorLinkHover: '#5B9BFF',

  severityRamp: {
    live: '#22c55e',
    lagging: '#eab308',
    degraded: '#f59e0b',
    stale: '#ef4444',
    offline: '#6b7280',
    gps: '#a855f7',
    fallback: '#8aa0b5',
  },

  landingBasemap: {
    bg: '#080a0c',
    bgCenter: '#0e1318',
    land: '#1b2026',
    landBorder: '#2b333b',
    graticule: 'rgba(120,170,205,0.06)',
    portNode: 'rgba(150,180,200,0.06)',
  },

  // Byte-identical to the shipped `'lighter'` additive glow — dark mode is a provable no-op.
  landingTrackBlendMode: 'lighter',

  offlineBasemap: {
    ocean: '#000000',
    countryBorder: '#4a4a52',
    landFill: '#14141a',
    landFillOpacity: 0.55,
    admin1Border: '#3f3f47',
  },

  badgeBg: {
    grey: '#64748B',
    brand: '#0FAF73',
    blue: '#3B82F6',
    success: '#1DB954',
    warning: '#F5A623',
    danger: '#E03C3C',
  },

  reasoningStep: '#78DC64',

  // Restates shadowStandard's own 'rgba(0, 0, 0, 0.35)' as a canvas-usable tuple (Phase 114, D-02).
  spiderfyBoxShadowRgb: [0, 0, 0],
  spiderfyBoxShadowAlpha: 0.35,

  basemapFlavor: 'dark',
}

export const LIGHT_THEME: ChromeTheme = {
  colorBgPrimary: '#F8F7F6',
  colorBgSecondary: '#F1EFEC',
  // Phase 89 plan 12, D-16/UAT-2: moved from #0C7A4C (failed AA on glass-bg, 4.32:1) to
  // #0A6440 — chosen for WCAG parity with dark's own accent profile, not maximum contrast.
  // Mirrored in global.css's [data-theme="light"] block in the same commit (89-01's drift
  // gate asserts the two never disagree).
  colorAccent: '#0A6440',
  colorTextPrimary: '#1B232B',
  colorTextSecondary: '#4B6072',
  colorDestructive: '#C62F2F',
  colorGlassBg: '#E9E6E2',
  colorGlassBorder: '#C4B9A5',
  surfaceLayer2: '#DCD7D1',
  borderStrong: '#8C7F6B',
  textMuted: '#52667A',
  textInverse: '#FFFFFF',
  // Re-derived from the new colorAccent using the same proportional darken ratios the old
  // #0C7A4C -> #0A6B42/#075A38 ladder used, so accent > hover > active lightness ordering
  // still holds (the old pair sat BETWEEN the new, darker accent and black).
  brandPrimaryHover: '#085838',
  brandPrimaryActive: '#064A2F',
  brandSubtle: 'rgba(15, 175, 115, 0.16)',
  shadowStandard: '0 4px 12px rgba(23, 21, 15, 0.10)',
  shadowDeep: '0 12px 32px rgba(23, 21, 15, 0.16)',
  statusWarning: '#9A5A0A',
  statusSuccess: '#127A3A',
  statusInfo: '#1D4ED8',
  colorLinkHover: '#15399E',

  // D-14: light variant, same distinct hue family as dark — never collapses into --status-*.
  severityRamp: {
    live: '#166534',
    lagging: '#854D0E',
    degraded: '#9A3E0A',
    stale: '#B91C1C',
    offline: '#374151',
    gps: '#7E22CE',
    // Same ~209deg slate-blue hue family as dark's #8aa0b5 (209.3deg), darkened for AA on light
    // surfaces — 6.76:1/6.31:1/5.82:1 vs bg-primary/bg-secondary/glass-bg (all clear 4.5:1).
    fallback: '#46596B',
  },

  landingBasemap: {
    bg: '#F6F4F1',
    bgCenter: '#FBFAF8',
    // Phase 89 plan 13 gap-closure, live UAT: was #E4DFD3 (warm tan) — operator wants a shade of
    // grey. Neutral (desaturated) grey holding the SAME lightness relationship as the retired tan
    // pair (fill ~86% L, border ~72% L, ~14.5pt gap) so the border stays visibly darker without
    // going harsh. bg/bgCenter (warm off-white ocean tone) and the blue-tinted graticule/portNode
    // washes were left untouched — checked, they still read coherently against the new grey land.
    land: '#DCDCDC',
    landBorder: '#B7B7B7',
    graticule: 'rgba(70,90,110,0.08)',
    portNode: 'rgba(90,110,130,0.10)',
  },

  // Phase 89 plan 13 gap-closure: root-cause fix for "ships/pulses invisible in light mode".
  // `'lighter'` additively saturates to white against near-white land/bgCenter — no declared
  // track color can survive that. Normal alpha compositing lets the theme-invariant burnt-orange
  // colors (untouched, still in `c2MapData.ts`'s `CONFIG.ship/plane/ping/beacon`) actually paint.
  landingTrackBlendMode: 'source-over',

  offlineBasemap: {
    ocean: '#F8F7F6',
    countryBorder: '#8B8378',
    landFill: '#E6E1D3',
    landFillOpacity: 0.85,
    // Proportionally dimmer than countryBorder in light, matching the dark ratio
    // (admin1Border:countryBorder contrast-vs-bg ≈ 0.84 in dark; #9A917F ≈ 0.83 in light).
    admin1Border: '#9A917F',
  },

  badgeBg: {
    grey: '#475569',
    // Tracks colorAccent (light) — moved with it in the same D-16/UAT-2 accent change above.
    brand: '#0A6440',
    blue: '#1D4ED8',
    success: '#127A3A',
    warning: '#9A5A0A',
    danger: '#C62F2F',
  },

  // Olive-lime green (hue ~88deg), deliberately distinct from --color-accent's ~155deg teal-green
  // hue (~66.5deg hue distance) so the tool-call/reasoning-step visual distinction survives light
  // mode. Contrast: 5.94:1 / 5.53:1 / 5.11:1 vs bg-primary/bg-secondary/glass-bg — all clear 4.5:1.
  reasoningStep: '#3D6B0A',

  // Restates shadowStandard's own 'rgba(23, 21, 15, 0.10)' as a canvas-usable tuple (Phase 114, D-02).
  spiderfyBoxShadowRgb: [23, 21, 15],
  spiderfyBoxShadowAlpha: 0.10,

  basemapFlavor: 'light',
}

/** Resolve a `ChromeTheme` by name — the one lookup point every non-CSS consumer should use. */
export function themeFor(name: ThemeName): ChromeTheme {
  return name === 'light' ? LIGHT_THEME : DARK_THEME
}
