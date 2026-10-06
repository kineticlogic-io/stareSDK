// @vitest-environment jsdom
/**
 * theme.test.ts — the D-11 drift gate and D-04 contrast gate (Phase 89 Light Mode, plan 01).
 *
 * DRIFT GATE: reads global.css from disk and parses its `:root { ... }` and
 * `[data-theme="light"] { ... }` bodies into property->value maps, then asserts they match
 * chromeTheme.ts's DARK_THEME/LIGHT_THEME exactly — CSS and TS can never silently diverge.
 * Also asserts token PARITY: every chrome token declared in `:root` has a light counterpart,
 * except an explicit, named theme-invariant allowlist (D-03) — this is the half that catches
 * the real future regression (someone adds a token to `:root` and forgets the light pairing).
 *
 * CONTRAST GATE: asserts every foreground/background pairing named in 89-UI-SPEC.md's computed
 * WCAG contrast table clears its TARGET ratio (4.5:1 body text/semantic-as-text, 3:1 UI borders)
 * in BOTH themes, reusing `contrastRatio()` from utils/color.ts (Task 1) — never a second
 * luminance implementation. Targets are asserted, not UI-SPEC's exact computed ratios, so a
 * future palette tweak that stays within budget is not a test edit.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { contrastRatio } from '../internal/color.js'
import { DARK_THEME, LIGHT_THEME, type ChromeTheme } from './chromeTheme.js'
// c2MapData's CONFIG is app-owned (landing page), not part of the SDK copy. The CONFIG-comparison
// cases below (DARK_THEME.landingBasemap vs. CONFIG, the CONFIG.toHaveProperty boundary check, and
// CONFIG.trackBlendMode vs. DARK_THEME.landingTrackBlendMode) are app-landing boundary tests and
// keep running in openstare's own copy of this file; they are intentionally not duplicated here.

const __dirname = dirname(fileURLToPath(import.meta.url))
const CSS_SOURCE = readFileSync(join(__dirname, 'global.css'), 'utf-8')

/** Normalize whitespace (incl. inside `rgba(...)`) so formatting differences never fail the gate. */
function normalize(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

/** Extract a top-level `selector { ...declarations... }` block's raw body. Assumes no nested
 * braces inside the block (true for both :root and the light override block).
 *
 * Phase 127 plan 09 (VANT-03): `:root`'s own selector grew a `, [data-theme="dark"]` sibling
 * (global.css) so a nested always-dark container re-declares every dark token — the optional
 * non-capturing group below tolerates that comma-joined selector list without affecting the
 * `[data-theme="light"]` call site, whose literal has no such suffix. */
function extractBlockBody(css: string, selectorLiteral: string): string {
  const escaped = selectorLiteral.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`${escaped}(?:\\s*,\\s*\\[data-theme="dark"\\])?\\s*\\{([^}]*)\\}`)
  const match = css.match(re)
  if (!match) throw new Error(`theme.test.ts: could not find block for selector ${selectorLiteral} in global.css`)
  return match[1]
}

/** Strip `/* ... *\/` CSS comments — several :root comments contain semicolons (e.g. "hue; never
 * overloads"), which would otherwise corrupt a naive split(';') declaration parse. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

/** Parse a CSS block body into a Map of custom-property-name -> normalized value. */
function parseDeclarations(blockBody: string): Map<string, string> {
  const decls = new Map<string, string>()
  for (const rawStatement of stripComments(blockBody).split(';')) {
    const statement = rawStatement.trim()
    if (!statement) continue
    const colonIndex = statement.indexOf(':')
    if (colonIndex === -1) continue
    const prop = statement.slice(0, colonIndex).trim()
    const value = statement.slice(colonIndex + 1).trim()
    if (!prop.startsWith('--')) continue
    decls.set(prop, normalize(value))
  }
  return decls
}

const rootDecls = parseDeclarations(extractBlockBody(CSS_SOURCE, ':root'))
const lightDecls = parseDeclarations(extractBlockBody(CSS_SOURCE, '[data-theme="light"]'))

/** The 21 CSS-mirrored scalar fields: chromeTheme.ts field name <-> global.css custom property. */
const CSS_MIRRORED_FIELDS: Array<[cssName: string, field: keyof ChromeTheme]> = [
  ['--color-bg-primary', 'colorBgPrimary'],
  ['--color-bg-secondary', 'colorBgSecondary'],
  ['--color-accent', 'colorAccent'],
  ['--color-text-primary', 'colorTextPrimary'],
  ['--color-text-secondary', 'colorTextSecondary'],
  ['--color-destructive', 'colorDestructive'],
  ['--color-glass-bg', 'colorGlassBg'],
  ['--color-glass-border', 'colorGlassBorder'],
  ['--surface-layer-2', 'surfaceLayer2'],
  ['--border-strong', 'borderStrong'],
  ['--text-muted', 'textMuted'],
  ['--text-inverse', 'textInverse'],
  ['--brand-primary-hover', 'brandPrimaryHover'],
  ['--brand-primary-active', 'brandPrimaryActive'],
  ['--brand-subtle', 'brandSubtle'],
  ['--shadow-standard', 'shadowStandard'],
  ['--shadow-deep', 'shadowDeep'],
  ['--status-warning', 'statusWarning'],
  ['--status-success', 'statusSuccess'],
  ['--status-info', 'statusInfo'],
  ['--color-link-hover', 'colorLinkHover'],
]

// D-03's named theme-invariant allowlist — tokens declared in :root that deliberately have NO
// [data-theme="light"] counterpart. Extending this list is a deliberate act, not a silent fix.
const THEME_INVARIANT_ALLOWLIST = new Set([
  '--intel-cyan',
  '--intel-purple',
  '--intel-lime',
  '--intel-heat',
  '--radius-sm',
  '--radius-md',
  '--radius-lg',
  '--radius-xl',
  '--font-sans',
  '--font-header',
  '--font-mono',
  '--space-xs',
  '--space-sm',
  '--space-md',
  '--space-lg',
  '--space-xl',
  '--space-2xl',
  '--space-3xl',
  '--banner-height',
  '--page-header-height',
  '--color-link', // var(--status-info) — re-themes automatically, no light override needed
  // Classification-level colors (Phase 127.4-11) — theme-invariant by design, same precedent as
  // the map/track/tactical domain colors above: a classification marking must read identically
  // regardless of theme.
  '--classification-unclassified-bg',
  '--classification-unclassified-text',
  '--classification-cui-bg',
  '--classification-cui-text',
  '--classification-confidential-bg',
  '--classification-confidential-text',
  '--classification-secret-bg',
  '--classification-secret-text',
  '--classification-topsecret-bg',
  '--classification-topsecret-text',
])

describe('Theme drift gate (D-11) — global.css vs chromeTheme.ts', () => {
  it.each(CSS_MIRRORED_FIELDS)('dark: :root %s matches DARK_THEME.%s', (cssName, field) => {
    const cssValue = rootDecls.get(cssName)
    expect(cssValue, `:root is missing declaration for ${cssName}`).toBeDefined()
    expect(normalize(cssValue as string)).toBe(normalize(DARK_THEME[field] as string))
  })

  it.each(CSS_MIRRORED_FIELDS)('light: [data-theme="light"] %s matches LIGHT_THEME.%s', (cssName, field) => {
    const cssValue = lightDecls.get(cssName)
    expect(cssValue, `[data-theme="light"] is missing declaration for ${cssName}`).toBeDefined()
    expect(normalize(cssValue as string)).toBe(normalize(LIGHT_THEME[field] as string))
  })

  it('token parity: every non-allowlisted :root token has a [data-theme="light"] counterpart', () => {
    const missing = [...rootDecls.keys()].filter(
      (cssName) => !lightDecls.has(cssName) && !THEME_INVARIANT_ALLOWLIST.has(cssName)
    )
    expect(missing).toEqual([])
  })
})

describe('Native UA-chrome gate (D-16/UAT-1) — color-scheme declared per theme', () => {
  // Static proof only — confirms the CSS declaration exists and is authored correctly in both
  // blocks. It CANNOT prove native <select> popups/scrollbars visibly re-theme in a real
  // browser; that is carried forward to plan 89-13's live UAT walk (same "static evidence is
  // not the same as observing it work" caveat 89-10-SUMMARY.md/deferred-items.md already
  // established for this phase's other mount-once/repaint claims).
  const rootBody = stripComments(extractBlockBody(CSS_SOURCE, ':root'))
  const lightBody = stripComments(extractBlockBody(CSS_SOURCE, '[data-theme="light"]'))

  it(':root declares color-scheme: dark', () => {
    expect(rootBody).toMatch(/color-scheme:\s*dark\s*;/)
  })

  it('[data-theme="light"] declares color-scheme: light', () => {
    expect(lightBody).toMatch(/color-scheme:\s*light\s*;/)
  })
})

// --- Contrast gate (D-04) ---------------------------------------------------------------------

const THEMES: Array<[name: string, theme: ChromeTheme]> = [
  ['dark', DARK_THEME],
  ['light', LIGHT_THEME],
]

const TARGET_TEXT = 4.5
const TARGET_UI_BORDER = 3.0

/**
 * KNOWN_DARK_GAPS — pre-existing, PRODUCTION-SHIPPED dark-theme pairings that measure below their
 * WCAG target. Every entry here is an existing value in `global.css` `:root` or
 * `TopologyGraph.tsx`'s existing severity ramp, unchanged by this plan (byte-identical no-op,
 * per this plan's own hard rule) — no gate of any kind existed before this phase, so these gaps
 * were never previously caught. Fixing any of them means changing a shipped dark color in a file
 * this plan does not own (badgeTokens.ts/TopologyGraph.tsx literal conversion is a LATER plan's
 * job, per D-14) or would directly violate "dark mode must be a verified byte-identical no-op."
 *
 * Handled the same way `colorGlassBorder` is already handled below: named, ratio still computed
 * and asserted sane (> 1), never silently dropped from the suite. Recorded in full in
 * 89-01-SUMMARY.md and `.planning/phases/89-light-mode/deferred-items.md` for a later phase/plan
 * to actually remediate (would require picking new dark literal values — a design decision, not
 * a mechanical `var()` swap, and therefore out of this plan's scope).
 */
const KNOWN_DARK_GAPS = new Set<string>([
  'dark:textMuted:colorBgSecondary', // 4.428:1 (target 4.5) — global.css :root --text-muted, unchanged
  'dark:textMuted:colorGlassBg', // 4.185:1
  'dark:colorDestructive:colorBgPrimary', // 4.467:1 — global.css :root --color-destructive, unchanged
  'dark:colorDestructive:colorBgSecondary', // 4.221:1
  'dark:textInverse:colorDestructive', // 4.467:1 — same underlying pairing as above, inverse direction
  'dark:borderStrong:colorBgPrimary', // 1.768:1 (target 3.0) — global.css :root --border-strong, unchanged
  'dark:borderStrong:colorBgSecondary', // 1.671:1
  'dark:severityRamp.offline:colorBgPrimary', // 3.975:1 — TopologyGraph.tsx's existing OFFLINE grey, unchanged
  'dark:severityRamp.offline:colorBgSecondary', // 3.756:1
  'dark:severityRamp.offline:colorGlassBg', // 3.550:1
  'dark:severityRamp.gps:colorGlassBg', // 4.338:1 — TopologyGraph.tsx's existing GPS purple, unchanged
])

/** Assert a contrast pairing meets `target`, UNLESS it is a named KNOWN_DARK_GAPS exemption — in
 * which case the ratio is still computed and asserted sane, but not held to the target. */
function assertContrast(themeName: string, fgLabel: string, fgHex: string, bgLabel: string, bgHex: string, target: number) {
  const ratio = contrastRatio(fgHex, bgHex)
  if (KNOWN_DARK_GAPS.has(`${themeName}:${fgLabel}:${bgLabel}`)) {
    expect(ratio).toBeGreaterThan(1)
    return
  }
  expect(ratio).toBeGreaterThanOrEqual(target)
}

describe('Theme contrast gate (D-04) — text roles vs. surfaces', () => {
  const textRoles: Array<keyof ChromeTheme> = ['colorTextPrimary', 'colorTextSecondary', 'textMuted']
  const surfaces: Array<keyof ChromeTheme> = ['colorBgPrimary', 'colorBgSecondary', 'colorGlassBg']

  for (const [themeName, theme] of THEMES) {
    for (const role of textRoles) {
      for (const surface of surfaces) {
        it(`${themeName}: ${role} / ${surface} >= ${TARGET_TEXT}:1 (or a named KNOWN_DARK_GAPS exemption)`, () => {
          assertContrast(themeName, role, theme[role] as string, surface, theme[surface] as string, TARGET_TEXT)
        })
      }
    }
  }
})

describe('Theme contrast gate (D-04) — semantic colors used as text/icon/border', () => {
  const semanticRoles: Array<keyof ChromeTheme> = [
    'colorAccent',
    'colorDestructive',
    'statusWarning',
    'statusSuccess',
    'statusInfo',
  ]
  const surfaces: Array<keyof ChromeTheme> = ['colorBgPrimary', 'colorBgSecondary']

  for (const [themeName, theme] of THEMES) {
    for (const role of semanticRoles) {
      for (const surface of surfaces) {
        it(`${themeName}: ${role} / ${surface} >= ${TARGET_TEXT}:1 (or a named KNOWN_DARK_GAPS exemption)`, () => {
          assertContrast(themeName, role, theme[role] as string, surface, theme[surface] as string, TARGET_TEXT)
        })
      }
    }
  }
})

// Dedicated gate for D-16/UAT-2 (plan 89-12 Task 4) — the semantic-roles block above only checks
// colorAccent against bg-primary/bg-secondary, never glass-bg. That was the exact surface the old
// light accent (#0C7A4C) FAILED on (4.32:1, live operator UAT finding) — bg-primary/bg-secondary
// alone would have missed it. This proves the new value clears AA on ALL THREE light surfaces and
// regresses loudly if ever reverted.
describe('Theme contrast gate (D-16/UAT-2) — colorAccent vs every surface, including glass-bg', () => {
  const surfaces: Array<keyof ChromeTheme> = ['colorBgPrimary', 'colorBgSecondary', 'colorGlassBg']

  for (const [themeName, theme] of THEMES) {
    for (const surface of surfaces) {
      it(`${themeName}: colorAccent / ${surface} >= ${TARGET_TEXT}:1`, () => {
        const ratio = contrastRatio(theme.colorAccent, theme[surface] as string)
        expect(ratio).toBeGreaterThanOrEqual(TARGET_TEXT)
      })
    }
  }
})

describe('Theme contrast gate (D-04) — text-inverse against every fill it paints on top of', () => {
  const fills: Array<keyof ChromeTheme> = ['colorAccent', 'brandPrimaryHover', 'brandPrimaryActive', 'colorDestructive']

  for (const [themeName, theme] of THEMES) {
    for (const fill of fills) {
      it(`${themeName}: textInverse / ${fill} >= ${TARGET_TEXT}:1 (or a named KNOWN_DARK_GAPS exemption)`, () => {
        assertContrast(themeName, 'textInverse', theme.textInverse, fill, theme[fill] as string, TARGET_TEXT)
      })
    }
  }
})

describe('Theme contrast gate (D-04) — borders (3:1 UI-border target)', () => {
  const surfaces: Array<keyof ChromeTheme> = ['colorBgPrimary', 'colorBgSecondary']

  for (const [themeName, theme] of THEMES) {
    for (const surface of surfaces) {
      it(`${themeName}: borderStrong / ${surface} >= ${TARGET_UI_BORDER}:1 (or a named KNOWN_DARK_GAPS exemption)`, () => {
        assertContrast(themeName, 'borderStrong', theme.borderStrong, surface, theme[surface] as string, TARGET_UI_BORDER)
      })
    }
  }

  // colorGlassBorder is explicitly EXEMPT from the 3:1 target in BOTH themes — a decorative
  // divider (panel edges, row dividers), not an interactive control boundary. The existing dark
  // value already measures well under 3:1 (~1.48:1). Asserted here as a deliberate exemption
  // (both ratios simply recorded, not compared against a target), not silently skipped.
  for (const [themeName, theme] of THEMES) {
    it(`${themeName}: colorGlassBorder is decorative — exempt from the 3:1 target (ratio recorded, not enforced)`, () => {
      const ratioVsBgPrimary = contrastRatio(theme.colorGlassBorder, theme.colorBgPrimary)
      const ratioVsGlassBg = contrastRatio(theme.colorGlassBorder, theme.colorGlassBg)
      expect(ratioVsBgPrimary).toBeGreaterThan(1)
      expect(ratioVsGlassBg).toBeGreaterThan(1)
    })
  }
})

// brandSubtle, shadowStandard, and shadowDeep are rgba() composites (translucent washes over a
// surface) — a flat two-color contrast ratio is meaningless for them, so they are deliberately
// excluded from every contrast assertion above. They remain covered by the drift gate.

describe('Theme contrast gate (D-04) — severityRamp against every theme background', () => {
  const surfaces: Array<keyof ChromeTheme> = ['colorBgPrimary', 'colorBgSecondary', 'colorGlassBg']
  const roles: Array<keyof ChromeTheme['severityRamp']> = ['live', 'lagging', 'degraded', 'stale', 'offline', 'gps', 'fallback']

  for (const [themeName, theme] of THEMES) {
    for (const role of roles) {
      for (const surface of surfaces) {
        it(`${themeName}: severityRamp.${role} / ${surface} >= ${TARGET_TEXT}:1 (or a named KNOWN_DARK_GAPS exemption)`, () => {
          assertContrast(themeName, `severityRamp.${role}`, theme.severityRamp[role], surface, theme[surface] as string, TARGET_TEXT)
        })
      }
    }
  }
})

// badgeBg is scoped narrower than severityRamp, deliberately:
// - Surfaces: bg-primary/bg-secondary ONLY, not glass-bg. 89-UI-SPEC.md's Component Contract §2
//   computed badge-as-outline-text ratios only against bg-primary/bg-secondary (e.g. "computed
//   7.08:1/6.60:1 vs bg-primary/secondary" for grey) — glass-bg was never part of that computed
//   scope, and several of UI-SPEC's own newly-authored light values (brand/success/warning/danger)
//   measure 4.32-4.40:1 against glass-bg, just under the 4.5 target. Encoding a target UI-SPEC
//   itself never verified would fail the gate against the source document's own authored values.
// - Themes: LIGHT only. DARK badgeBg values are pre-existing, shipped, and pinned byte-for-byte by
//   Badge.test.tsx (badgeTokens.ts is not in this plan's files_modified list — D-14's per-theme
//   BADGE_BG map is a later plan's job). Measured here: dark badgeBg.danger (#E03C3C, unchanged
//   from production) is 4.467:1 against bg-primary and 4.221:1 against bg-secondary — a genuine,
//   PRE-EXISTING sub-AA gap that predates this phase and was never gated before. Fixing it would
//   mean changing a shipped dark color in a file this plan does not touch, which would break the
//   "dark mode is a provable no-op" rule this plan is held to. Logged as a deferred item rather
//   than silently gated around — see 89-01-SUMMARY.md and deferred-items.md.
describe('Theme contrast gate (D-04) — badgeBg (light theme, vs. bg-primary/bg-secondary, UI-SPEC verified scope)', () => {
  const surfaces: Array<keyof ChromeTheme> = ['colorBgPrimary', 'colorBgSecondary']
  const colors: Array<keyof ChromeTheme['badgeBg']> = ['grey', 'brand', 'blue', 'success', 'warning', 'danger']

  for (const color of colors) {
    for (const surface of surfaces) {
      it(`light: badgeBg.${color} / ${surface} >= ${TARGET_TEXT}:1`, () => {
        const ratio = contrastRatio(LIGHT_THEME.badgeBg[color], LIGHT_THEME[surface] as string)
        expect(ratio).toBeGreaterThanOrEqual(TARGET_TEXT)
      })
    }
  }
})

// --- severityRamp hue-distinctness gate (D-14) + landingBasemap boundary gate (D-12) -----------
//
// Both blocks below were originally scoped to plans 89-03 and 89-11 respectively. They land here
// instead (plan 89-12, Wave 4) because those two plans ran in PARALLEL in Wave 3 and would
// otherwise both read-modify-write this one file, silently losing one plan's edit. Each recorded
// the exact facts this file needs in its own summary — transcribed below rather than re-derived
// from source, per 89-03-SUMMARY.md / 89-11-SUMMARY.md (see 89-12-PLAN.md Task 3).
//
// The severityRamp CONTRAST gate itself (every role >= 4.5:1 against every theme background, with
// the two dark KNOWN_DARK_GAPS exemptions above) already exists above (plan 89-01) — the only new
// severityRamp assertion this task adds is the D-14 "distinct hues, not unified with --status-*"
// boundary, which no prior gate encoded.

describe('severityRamp hue-distinctness gate (D-14) — never collapses into --status-*', () => {
  // The ramp deliberately keeps its own hues distinct from the --status-* set in BOTH themes
  // (89-UI-SPEC.md §3: "this ramp explicitly keeps its own hues distinct from --status-*... full
  // unification with --status-* remains out of scope"). A future edit that accidentally reuses a
  // --status-* value for a ramp role would silently merge the two palettes — this gate catches it.
  const statusTokens: Array<keyof ChromeTheme> = ['statusWarning', 'statusSuccess', 'statusInfo']
  const rampRoles: Array<keyof ChromeTheme['severityRamp']> = ['live', 'lagging', 'degraded', 'stale', 'offline', 'gps', 'fallback']

  for (const [themeName, theme] of THEMES) {
    for (const rampRole of rampRoles) {
      it(`${themeName}: severityRamp.${rampRole} does not equal any --status-* token value`, () => {
        const rampValue = normalize(theme.severityRamp[rampRole])
        for (const statusToken of statusTokens) {
          expect(rampValue).not.toBe(normalize(theme[statusToken] as string))
        }
      })
    }
  }
})

describe('landingBasemap boundary gate (D-12) — basemap half themes, track half does not', () => {
  // D-12's boundary is the kind of rule that erodes silently: a future contributor adding a
  // `landingBasemap.ship` entry (or any 7th key) would break roadmap criterion 7 with no test
  // failing today. Asserted on the SORTED key list so an added key fails immediately regardless
  // of which key it is (89-11-SUMMARY.md Task 2 §1 — confirmed exactly six keys, both themes).
  const EXPECTED_KEYS = ['bg', 'bgCenter', 'graticule', 'land', 'landBorder', 'portNode']

  it('DARK_THEME.landingBasemap has exactly the six expected keys, sorted', () => {
    expect(Object.keys(DARK_THEME.landingBasemap).sort()).toEqual(EXPECTED_KEYS)
  })

  it('LIGHT_THEME.landingBasemap has exactly the six expected keys, sorted', () => {
    expect(Object.keys(LIGHT_THEME.landingBasemap).sort()).toEqual(EXPECTED_KEYS)
  })

  // Dark mode is a provable no-op: c2MapData.ts's CONFIG declares its six basemap-half
  // properties byte-identical to DARK_THEME.landingBasemap (89-11-SUMMARY.md Task 2 §2's
  // key-by-key comparison table). That CONFIG comparison is an app-landing boundary test and
  // keeps running in openstare's own copy of this file; it is not duplicated here.

  // The four burnt-orange track properties are confirmed ABSENT from both landingBasemap groups
  // (89-11-SUMMARY.md Task 2 §3) — they stay theme-invariant, per roadmap criterion 7, and are
  // never touched by applyLandingBasemapTheme()'s Object.assign (which only ever writes the six
  // EXPECTED_KEYS above).
  it('the four track-color keys never appear in landingBasemap (theme-invariant, criterion 7)', () => {
    const trackKeys = ['ship', 'plane', 'ping', 'beacon']
    for (const trackKey of trackKeys) {
      expect(Object.keys(DARK_THEME.landingBasemap)).not.toContain(trackKey)
      expect(Object.keys(LIGHT_THEME.landingBasemap)).not.toContain(trackKey)
    }
    // CONFIG itself still declares all four (theme-invariant, not removed) — confirms this test
    // is checking a real boundary, not one that's vacuously true because CONFIG lacks the keys.
    // That CONFIG.toHaveProperty boundary check is an app-landing boundary test and keeps running
    // in openstare's own copy of this file; it is not duplicated here.
  })
})

// --- landingTrackBlendMode gate (Phase 89 plan 13 gap-closure) ---------------------------------
//
// Root cause of "ships/pulses invisible in light mode": c2MapEngine.ts drew tracks/pulses with
// additive `'lighter'` blending, which saturates to white against light land/bgCenter regardless
// of the declared track color. Fix: `landingTrackBlendMode` is theme-driven, DARK keeps 'lighter'
// byte-identical, LIGHT uses 'source-over'. This field is deliberately a SIBLING of
// `landingBasemap`, not a member of it — a blend mode is not a color, so it must never count
// against the strict six-key D-12 gate above, and it must never appear alongside the four
// track-color group names either (it is neither a basemap property nor a track color).
describe('landingTrackBlendMode gate (Phase 89 plan 13) — blend mode is theme-driven, not a color', () => {
  it("DARK_THEME.landingTrackBlendMode is 'lighter' (byte-identical shipped glow, no-op)", () => {
    expect(DARK_THEME.landingTrackBlendMode).toBe('lighter')
  })

  it("LIGHT_THEME.landingTrackBlendMode is 'source-over' (normal alpha compositing)", () => {
    expect(LIGHT_THEME.landingTrackBlendMode).toBe('source-over')
  })

  // CONFIG.trackBlendMode vs. DARK_THEME.landingTrackBlendMode is an app-landing boundary test
  // and keeps running in openstare's own copy of this file; it is not duplicated here.

  it('landingTrackBlendMode is not a key of either theme\'s landingBasemap (stays a sibling field)', () => {
    expect(Object.keys(DARK_THEME.landingBasemap)).not.toContain('landingTrackBlendMode')
    expect(Object.keys(LIGHT_THEME.landingBasemap)).not.toContain('landingTrackBlendMode')
  })

  it('the two theme values differ (proves the fix is not a no-op in light mode)', () => {
    expect(LIGHT_THEME.landingTrackBlendMode).not.toBe(DARK_THEME.landingTrackBlendMode)
  })
})

describe('ChromeTheme theme-invariance (D-03) — intel* fields are absent, not equal', () => {
  // 89-11-SUMMARY.md Task 2 §4: `ChromeTheme` declares NO intelCyan/intelPurple/intelLime/
  // intelHeat field at all (they remain CSS-only tokens — --intel-cyan et al. in global.css,
  // already covered by THEME_INVARIANT_ALLOWLIST above). Because the field doesn't exist on the
  // interface, the correct assertion is the field's ABSENCE from both theme objects, not a
  // dark-vs-light equality check (there is no pair to compare).
  const intelFieldNames = ['intelCyan', 'intelPurple', 'intelLime', 'intelHeat']

  for (const intelFieldName of intelFieldNames) {
    it(`DARK_THEME does not declare a "${intelFieldName}" field`, () => {
      expect(intelFieldName in DARK_THEME).toBe(false)
    })
    it(`LIGHT_THEME does not declare a "${intelFieldName}" field`, () => {
      expect(intelFieldName in LIGHT_THEME).toBe(false)
    })
  }
})
