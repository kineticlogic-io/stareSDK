import { useEffect, useState } from 'react'
import { headerControlStyle } from './headerControls'

export interface ClockBadge {
  timezone: string
  /**
   * Operator-configured human-friendly site name (e.g. "HQ") that REPLACES the timezone
   * abbreviation in the rendered badge when set (D-09/D-10). Falls back to the timezone
   * abbreviation when absent or blank.
   */
  label?: string
}

function formatBadge(date: Date, badge: ClockBadge): string {
  const tz = badge.timezone
  try {
    const trimmed = badge.label?.trim() ?? ''
    const isLocal = tz === 'Local'
    const timeOptions: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }
    if (!isLocal) {
      timeOptions.timeZone = tz
    }
    const timeStr = new Intl.DateTimeFormat(undefined, timeOptions).format(date)

    const abbrOptions: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZoneName: 'short',
    }
    if (!isLocal) {
      abbrOptions.timeZone = tz
    }
    const parts = new Intl.DateTimeFormat(undefined, abbrOptions).formatToParts(date)
    const tzAbbr = parts.find(p => p.type === 'timeZoneName')?.value ?? tz

    return `${trimmed !== '' ? trimmed : tzAbbr} ${timeStr}`
  } catch {
    const trimmed = badge.label?.trim() ?? ''
    return trimmed !== '' ? trimmed : badge.timezone
  }
}

// D-36 badge truncation staircase — deterministic viewport-width breakpoints, not a runtime
// measured-element fit. Coarse and jank-free on purpose: no layout-thrash risk, fully
// compositor-safe (no measured-width state driving reflow on every resize tick).
//
// RE-DERIVED (operator correction, post-checkpoint 2026-08-13): the prior revision (`ae4d450e`)
// raised these thresholds to 1680/1360/1120 purely by adding ~80px of headroom per step to the
// original 1600/1280/1024 values, without ever computing what viewport width the badge group
// (or the header's other chrome) actually needs. The result: on the operator's real, full-size
// desktop window (well under 1680px), 5 configured badges collapsed to 3. No environment here
// can render real DOM to measure text (no headless browser / canvas available), so the numbers
// below are a from-scratch worst-realistic-case computation instead of a guessed offset:
//
//   Per-badge width — worst-plausible common case: a 4-char zone abbreviation + space + 8-char
//   HH:MM:SS ("AEST 14:23:07" = 13 chars) at 13px/600 Montserrat with 0.04em letter-spacing:
//     text   ≈ 13 * 7.8px/char + 13 * 0.52px (letter-spacing) ≈ 110px
//     chrome ≈ headerControlStyle padding (16px * 2) + border (1px * 2) = 34px
//     per badge ≈ 144px; inter-badge gap (--space-xs) = 4px
//   Group width = 5 * 144 + 4 * 4 = 736px (5 badges) / 3 * 144 + 2 * 4 = 440px (3) /
//                 2 * 144 + 1 * 4 = 292px (2)
//
//   Fixed overhead around the centre track (must stay visible, never shrinks):
//     page padding (--space-lg * 2)                                    = 48px
//     grid column gaps (--space-md * 2, either side of centre track)   = 32px
//     column 1 floor: HomeButton (~54px) + gap (--space-md) + a short,
//       still-legible truncated title (~90px)                         = 160px
//     column 3 (assistant + user pill; must never truncate/drop):
//       AssistantButton (~128px) + gap (--space-md) + UserChip capsule
//       at its worst-case (120px-max username) width (~178px)         = 322px
//     total fixed overhead                                            = 562px
//
//   Threshold = 562px + group width, rounded up with a small safety margin for the
//   character-width estimate above (no live font metrics available to verify exactly):
//     5 badges: 562 + 736 = 1298  -> 1340
//     3 badges: 562 + 440 = 1002  -> 1040
//     2 badges: 562 + 292 = 854   ->  880
//
// These clear common full-size desktop/laptop windows (1440/1512/1728/1920px) with room to
// spare, which the previous 1680 did not.
function visibleCountForWidth(width: number): number {
  if (width >= 1340) return 5
  if (width >= 1040) return 3
  if (width >= 880) return 2
  return 0
}

/**
 * Header clock badges: one glass chip per configured clock, ticking every second, with a
 * deterministic width staircase (5 → 3 → 2 → 0 badges) so the header never overflows.
 *
 * Props only (#31): the host app resolves its configuration. `clocks` has three states, all
 * meaningful — `null` while the configuration is still unknown (renders nothing, so no default
 * clock ever flashes during a page change), `[]` for a deliberate "no clocks", or the list to
 * show (at most the first 5).
 */
export interface ClockBadgesProps {
  clocks: ClockBadge[] | null
}

export function ClockBadges({ clocks }: ClockBadgesProps) {
  const [now, setNow] = useState<Date>(() => new Date())
  const [visibleCount, setVisibleCount] = useState<number>(() =>
    typeof window === 'undefined' ? 5 : visibleCountForWidth(window.innerWidth)
  )

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    function onResize() {
      setVisibleCount(visibleCountForWidth(window.innerWidth))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  if (clocks === null) return null
  const badges = clocks

  // Below 880px the clock group collapses entirely so the centre grid track shrinks cleanly
  // rather than leaving an empty box (D-36); the same applies to a deliberate "no clocks".
  if (visibleCount === 0 || badges.length === 0) return null

  const visibleBadges = badges.slice(0, visibleCount)

  return (
    <div style={{ display: 'flex', gap: 'var(--space-xs)', flexShrink: 0, alignItems: 'center' }}>
      {visibleBadges.map((badge, idx) => {
        const formattedTime = formatBadge(now, badge)
        return (
          <div
            key={idx}
            aria-label={`Clock: ${badge.timezone} ${formattedTime}`}
            style={{
              ...headerControlStyle,
              // Bolder + one size up from the shared 12px/400 recipe (post-checkpoint,
              // 2026-08-13 — "make the clock text bold and bigger to fill out the box").
              // 13px/600 are both existing scale entries (Popover name line / chip-label
              // weight) reused here, not new values.
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '0.04em',
              // Fixed-width digits so the badge never resizes ("blinks") as the time ticks.
              fontVariantNumeric: 'tabular-nums',
              userSelect: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {formattedTime}
          </div>
        )
      })}
    </div>
  )
}
