import type { CSSProperties } from 'react'

/**
 * Standardized switch-style toggle (D-20, D-21).
 *
 * Reproduces the measured geometry of the four existing hand-rolled admin toggles
 * (`DisconnectedModeToggle`, `BannerSection` x2, `SamlSection`) exactly — 48x26 track,
 * 13px radius, 18px knob, top 3, left 4 fixed resting offset, 0/20px transform travel.
 * `DisconnectedModeToggle.tsx` is the ONE existing toggle that already animated the knob
 * correctly (via `transform: translateX`, not `left`); this primitive generalizes that
 * implementation. The other 3 call sites animate `left` today and are converted to this
 * primitive by plans 87-18/87-19 — NOT by this plan.
 *
 * Compositor-safe animation only (CLAUDE.md hard rule): the knob's `transform` and the
 * track's `background` are the only animated properties. `left` never appears in a
 * transition.
 *
 * Three deliberate additions beyond preservation (none of the 4 existing toggles has any
 * of these today — see 87-UI-SPEC.md Component Contract 1):
 *   - `role="switch"` + `aria-checked` (WAI-ARIA switch pattern)
 *   - a `:focus-visible` ring (keyboard-only, via the scoped `.ui-toggle:focus-visible`
 *     rule in global.css — chosen over an onFocus/onBlur `matches(':focus-visible')` JS
 *     check because inline styles cannot express a pseudo-class selector, and a small
 *     scoped class rule is the simplest correct implementation)
 *   - a `disabled` state (`opacity: 0.4; cursor: not-allowed`, matching the app-wide
 *     `.opacity-slider:disabled` / `.zoom-range-slider__input:disabled` convention)
 */

export interface ToggleProps {
  /** Current on/off state. */
  value: boolean
  /** Called with the negated value on click. Never called while `disabled`. */
  onChange: (next: boolean) => void
  disabled?: boolean
  /**
   * Track background when `value` is true. Defaults to `var(--color-accent)`.
   * `DisconnectedModeToggle` passes `var(--status-warning)` — airgap/disconnected
   * mode reads as a warning state, not a neutral "on." Do not fold that into the default.
   */
  onColor?: string
  /** Required — `ui/Toggle` renders no label of its own; the caller composes one alongside it. */
  'aria-label': string
  style?: CSSProperties
  /**
   * Track/knob size. `'md'` (default) is the original geometry (48x26 track, 18px knob) —
   * unchanged for every existing call site. `'sm'` is ~40% smaller (29x16 track, 12px knob),
   * added for compact inline label+switch rows (Phase 115 operator UAT feedback, 2026-09-02
   * — the kebab's Popups/Historic Mode rows read as oversized at the full `'md'` size).
   */
  size?: 'md' | 'sm'
}

/** Shared base — only geometry (width/height/borderRadius) varies by `size`. */
const TRACK_BASE_STYLE: CSSProperties = {
  border: '1px solid var(--color-glass-border)',
  position: 'relative',
  padding: 0,
  flexShrink: 0,
  transition: 'background 0.2s',
}

/**
 * Per-size geometry. `md` reproduces the legacy measured geometry byte-for-byte (including
 * its asymmetric 3px-top/4px-left knob resting offset — preserved as-is, not "fixed", since
 * changing it would visually shift every existing `md` toggle). `sm` is a clean, symmetric
 * new design (no legacy constraint) sized to ~40% smaller by track area.
 */
const SIZE_GEOMETRY: Record<
  NonNullable<ToggleProps['size']>,
  { track: CSSProperties; knobSize: number; knobTop: number; knobLeft: number; travel: number }
> = {
  md: {
    track: { width: 48, height: 26, borderRadius: 13 },
    knobSize: 18,
    knobTop: 3,
    knobLeft: 4,
    travel: 20,
  },
  sm: {
    track: { width: 29, height: 16, borderRadius: 8 },
    knobSize: 12,
    knobTop: 2,
    knobLeft: 2,
    travel: 13,
  },
}

// Phase 89 (D-04): the knob stays pure white in BOTH themes — this is a deliberate,
// theme-invariant exception, not an oversight. `var(--text-inverse)` was tried first (it
// resolves to `#FFFFFF` in light, which is a no-op here, but `#0B0F14` — near-black — in
// dark, because that token means "text drawn on an accent-filled surface," not "toggle
// knob"). Measured contrast ruled it out: a near-black dark-theme knob against the OFF
// track (`var(--border-strong)`, `#2F3E52`) is 1.77:1 — the knob nearly vanishes in its
// resting/off state, which is worse than today's shipped white knob (10.87:1 against the
// same OFF track). White clears >=3:1 non-text UI contrast against both the ON track
// (`--color-accent`) and the OFF track (`--border-strong`) in both themes, so it is kept
// as a literal here rather than threaded through `var(--text-inverse)` — the same
// "theme-invariant, not a themed surface color" reasoning `Badge.tsx`'s `LIGHT_TEXT`
// constant documents.
// eslint-disable-next-line no-restricted-syntax -- D-04 theme-invariant knob color, see extensive comment above
const KNOB_COLOR = '#FFFFFF'

export function Toggle({
  value,
  onChange,
  disabled = false,
  onColor = 'var(--color-accent)',
  'aria-label': ariaLabel,
  style,
  size = 'md',
}: ToggleProps) {
  const geo = SIZE_GEOMETRY[size]
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => {
        if (disabled) return
        onChange(!value)
      }}
      className="ui-toggle"
      style={{
        ...TRACK_BASE_STYLE,
        ...geo.track,
        background: value ? onColor : 'var(--border-strong)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        ...style,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: geo.knobTop,
          left: geo.knobLeft, // fixed — only `transform` moves the knob
          width: geo.knobSize,
          height: geo.knobSize,
          borderRadius: '50%',
          background: KNOB_COLOR,
          transition: 'transform 0.2s',
          willChange: 'transform',
          transform: value ? `translateX(${geo.travel}px)` : 'translateX(0)',
        }}
      />
    </button>
  )
}
