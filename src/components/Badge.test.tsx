// @vitest-environment jsdom
/**
 * Badge BADGE_BG token-drift guard (87-10, D-03 §3a; extended Phase 89 plan 04, D-14).
 *
 * `contrastText()` in Badge.tsx does `parseInt(hex.slice(...), 16)` per channel to compute
 * WCAG relative luminance and choose black/white label text — a `var(--token)` string cannot
 * be `parseInt`'d, so BADGE_BG's hex literals are a deliberate, documented exception to
 * "never hardcoded color," not a candidate for a `var()` swap (see the comment in
 * badgeTokens.ts, where BADGE_BG is defined — moved to a sibling module per the 87-10 Rule 3
 * deviation documented in 87-10-SUMMARY.md — and 87-UI-SPEC.md §Color 3a / 89-UI-SPEC.md
 * §Component Contract 2 for the full reasoning).
 *
 * Phase 89 D-14 changed BADGE_BG's SHAPE from a single flat map to a per-theme map
 * (`Record<'dark'|'light', Record<BadgeColor,string>>`), because `Badge.tsx`'s `outline`
 * variant renders `BADGE_BG[theme][color]` directly as the label's TEXT color against the
 * page background — so every value must independently clear WCAG AA (4.5:1) as *text*, in
 * its own theme, not just work as a self-contained filled chip. This file now has THREE
 * mechanical-enforcement levers instead of one:
 *   1. A dark drift guard (unchanged from 87-10) — pins each BADGE_BG.dark value against a
 *      literal constant equal to its named token's hex.
 *   2. A light drift guard (new, D-14) — same shape, against BADGE_BG.light.
 *   3. An outline-as-text contrast gate (new, D-04/D-14) — asserts every value in BOTH
 *      themes clears 4.5:1 against that theme's `--color-bg-primary`, which is the actual
 *      page background the `outline` variant's text sits on. This is the assertion that
 *      encodes WHY a per-theme map is required at all: a value can look fine as a filled
 *      chip and still be illegible as outline text.
 *
 * ⚠ Cross-plan interaction: plan 87-21 retired --brand-primary and --status-critical as
 * duplicate canonical names in favor of --color-accent and --color-destructive. The hex
 * VALUES are byte-identical, so the dark assertions below remain correct across that
 * rename — the comment on each affected line names the surviving token.
 *
 * BADGE_BG.grey has no token equivalent — it duplicates nothing, so D-03's own scope ("hex
 * that duplicates a token") does not reach it. Not asserted in the tracking block below, by
 * design (both the dark and light drift guards still pin its literal value).
 */

import { describe, it, expect } from 'vitest'
import { BADGE_BG } from './badgeTokens'
import { DARK_THEME, LIGHT_THEME } from '../styles/chromeTheme'
import { contrastRatio } from '../internal/color'

describe('Badge BADGE_BG dark drift guard (D-03)', () => {
  it('grey is #64748B', () => {
    expect(BADGE_BG.dark.grey).toBe('#64748B')
  })

  it('brand tracks --color-accent (formerly --brand-primary)', () => {
    expect(BADGE_BG.dark.brand).toBe('#0FAF73')
  })

  it('blue tracks --status-info', () => {
    expect(BADGE_BG.dark.blue).toBe('#3B82F6')
  })

  it('success tracks --status-success', () => {
    expect(BADGE_BG.dark.success).toBe('#1DB954')
  })

  it('warning tracks --status-warning', () => {
    expect(BADGE_BG.dark.warning).toBe('#F5A623')
  })

  it('danger tracks --color-destructive (formerly --status-critical)', () => {
    expect(BADGE_BG.dark.danger).toBe('#E03C3C')
  })
})

describe('Badge BADGE_BG light drift guard (D-14, 89-UI-SPEC.md §Component Contract 2)', () => {
  it('grey is #475569', () => {
    expect(BADGE_BG.light.grey).toBe('#475569')
  })

  it('brand tracks --color-accent (light)', () => {
    // Phase 89 plan 12, D-16/UAT-2: light --color-accent moved #0C7A4C -> #0A6440 (chosen for
    // WCAG parity with dark's own accent profile — see deferred-items.md OPERATOR DECISIONS).
    expect(BADGE_BG.light.brand).toBe('#0A6440')
  })

  it('blue tracks --status-info (light)', () => {
    expect(BADGE_BG.light.blue).toBe('#1D4ED8')
  })

  it('success tracks --status-success (light)', () => {
    expect(BADGE_BG.light.success).toBe('#127A3A')
  })

  it('warning tracks --status-warning (light)', () => {
    expect(BADGE_BG.light.warning).toBe('#9A5A0A')
  })

  it('danger tracks --color-destructive (light)', () => {
    expect(BADGE_BG.light.danger).toBe('#C62F2F')
  })
})

describe('Badge BADGE_BG tracks chromeTheme.ts badgeBg (single source of truth, D-11)', () => {
  it('brand matches chromeTheme.ts DARK_THEME/LIGHT_THEME badgeBg.brand', () => {
    expect(BADGE_BG.dark.brand).toBe(DARK_THEME.badgeBg.brand)
    expect(BADGE_BG.light.brand).toBe(LIGHT_THEME.badgeBg.brand)
  })

  it('blue matches chromeTheme.ts DARK_THEME/LIGHT_THEME badgeBg.blue', () => {
    expect(BADGE_BG.dark.blue).toBe(DARK_THEME.badgeBg.blue)
    expect(BADGE_BG.light.blue).toBe(LIGHT_THEME.badgeBg.blue)
  })

  it('success matches chromeTheme.ts DARK_THEME/LIGHT_THEME badgeBg.success', () => {
    expect(BADGE_BG.dark.success).toBe(DARK_THEME.badgeBg.success)
    expect(BADGE_BG.light.success).toBe(LIGHT_THEME.badgeBg.success)
  })

  it('warning matches chromeTheme.ts DARK_THEME/LIGHT_THEME badgeBg.warning', () => {
    expect(BADGE_BG.dark.warning).toBe(DARK_THEME.badgeBg.warning)
    expect(BADGE_BG.light.warning).toBe(LIGHT_THEME.badgeBg.warning)
  })

  it('danger matches chromeTheme.ts DARK_THEME/LIGHT_THEME badgeBg.danger', () => {
    expect(BADGE_BG.dark.danger).toBe(DARK_THEME.badgeBg.danger)
    expect(BADGE_BG.light.danger).toBe(LIGHT_THEME.badgeBg.danger)
  })
})

describe('Badge BADGE_BG outline-as-text contrast gate (D-04/D-14)', () => {
  // Badge.tsx's `outline` variant renders `color: BADGE_BG[theme][color]` directly against
  // the page background — every value must independently clear WCAG AA (4.5:1) as text.
  const DARK_BG = DARK_THEME.colorBgPrimary // '#0B0F14'
  const LIGHT_BG = LIGHT_THEME.colorBgPrimary // '#F8F7F6'

  // KNOWN_DARK_GAPS-style exemption (same pattern as src/styles/theme.test.ts, plan 89-01):
  // two BADGE_BG.dark values (unchanged/shipped) measure under 4.5:1 against dark
  // --color-bg-primary — never previously gated (no gate of any kind existed before Phase
  // 89). Fixing either means picking a new shipped DARK literal, which violates this plan's
  // "dark mode must be a verified byte-identical no-op" hard rule and is out of this plan's
  // scope (badgeTokens.ts dark-value remediation is a later plan's job, per
  // 89-01-SUMMARY.md's deferred-items precedent). Ratio is still computed and asserted sane.
  //   - grey   #64748B  4.038617652324358:1 vs #0B0F14 — no canonical token equivalent
  //   - danger #E03C3C  4.467125479049604:1 vs #0B0F14 — same underlying value as
  //     theme.test.ts's existing 'dark:colorDestructive:colorBgPrimary' KNOWN_DARK_GAPS entry
  const DARK_KNOWN_GAPS = new Set<string>(['grey', 'danger'])

  it('every dark BADGE_BG value clears 4.5:1 against --color-bg-primary (dark), except documented shipped gaps', () => {
    for (const [name, hex] of Object.entries(BADGE_BG.dark)) {
      const ratio = contrastRatio(hex, DARK_BG)
      if (DARK_KNOWN_GAPS.has(name)) {
        expect(ratio, `dark.${name} (${hex}) vs ${DARK_BG}`).toBeGreaterThan(1)
        continue
      }
      expect(ratio, `dark.${name} (${hex}) vs ${DARK_BG}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('every light BADGE_BG value clears 4.5:1 against --color-bg-primary (light)', () => {
    for (const [name, hex] of Object.entries(BADGE_BG.light)) {
      expect(contrastRatio(hex, LIGHT_BG), `light.${name} (${hex}) vs ${LIGHT_BG}`).toBeGreaterThanOrEqual(4.5)
    }
  })
})
