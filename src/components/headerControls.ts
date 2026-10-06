import type { CSSProperties } from 'react'

/**
 * Shared header-control sizing recipe (D-33/D-34, 88-11; height revised post-checkpoint
 * 2026-08-13 when the header itself shrank from 56px to 52px).
 *
 * `ClockBadges`, `AssistantButton`, and `UserChip`'s pill all import this so the "resized
 * together, one scale" invariant is enforced by construction rather than by convention — the
 * three controls literally cannot drift apart in height/padding without editing this one file.
 *
 * Kept as a plain `.ts` module (no component export) so the `react-hooks`/`react-refresh` lint
 * rules are not tripped — same reason `badgeTokens.ts` sits beside `Badge.tsx`.
 */

// 34px against a 52px header keeps ~9px breathing room top+bottom (was 36px against 56px,
// ~10px each side) — scaled down in step with the header's own -4px revision rather than left
// unchanged in a now-tighter band.
export const HEADER_CONTROL_HEIGHT = 34

/**
 * Full capsule/pill radius — half the shared control height, so a control using this
 * (instead of `--radius-sm`) always renders with perfectly semicircular ends no matter what
 * `HEADER_CONTROL_HEIGHT` becomes. Derived, not hardcoded, so it can never drift out of sync
 * with the height it depends on (operator correction, post-checkpoint 2026-08-13: "the pill
 * shape should share the height of the diameter of the image and the radius of it as well").
 *
 * `UserChip` is the one control that overrides `headerControlStyle.borderRadius` with this —
 * see UserChip.tsx. `ClockBadges` and `AssistantButton` stay boxy via `--radius-sm` below.
 */
export const HEADER_CONTROL_CAPSULE_RADIUS = HEADER_CONTROL_HEIGHT / 2

export const headerControlStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  height: HEADER_CONTROL_HEIGHT,
  boxSizing: 'border-box',
  padding: '0 var(--space-md)',
  // `--radius-sm` (4px) — the design system's box-corner token for BOXY chrome, used as-is by
  // `ClockBadges` and `AssistantButton`. `UserChip` overrides this field with
  // `HEADER_CONTROL_CAPSULE_RADIUS` above to render as a true capsule/pill instead of a box —
  // the two treatments are intentionally different per control, not a drift to guard against.
  borderRadius: 'var(--radius-sm)',
  background: 'var(--color-glass-bg)',
  border: '1px solid var(--color-glass-border)',
  fontFamily: 'var(--font-sans)',
  fontSize: 12,
  color: 'var(--color-text-primary)',
}
