/**
 * Timeline helpers (0.2.30; label-aware packing, axis label layout and label widths 0.2.31;
 * sub-day spans and axis units 0.2.36) — the
 * pure parts of `Timeline`: date parsing, lane packing, the adaptive axis, label geometry, and the
 * pan/zoom range arithmetic. Exported so an app can reuse the same packing
 * or axis outside the component, and so each part is tested on its own.
 *
 * All calendar arithmetic is in UTC: a date-only string such as `'2024-03-12'` is UTC midnight in
 * JavaScript, so labelling it in UTC keeps it on the day it names in every time zone.
 */

export const TIMELINE_DAY_MS = 86_400_000
const YEAR_MS = 365.2425 * TIMELINE_DAY_MS
const MONTH_MS = YEAR_MS / 12

/** Narrowest span the view zooms in to by default (days are then the finest axis unit). */
export const TIMELINE_MIN_SPAN_MS = 3 * TIMELINE_DAY_MS
/**
 * The narrowest `minSpanMs` a caller may set (0.2.36): one second. Below a day, the axis gains
 * hour, minute, second and sub-second ticks.
 */
export const TIMELINE_MIN_SPAN_FLOOR_MS = 1000

/** A caller's narrowest span, within the floor and the default (0.2.36). */
export function resolveTimelineMinSpan(minSpanMs: number | undefined): number {
  if (minSpanMs === undefined || !Number.isFinite(minSpanMs)) return TIMELINE_MIN_SPAN_MS
  return Math.min(TIMELINE_MIN_SPAN_MS, Math.max(TIMELINE_MIN_SPAN_FLOOR_MS, minSpanMs))
}
/** Widest span the view zooms out to. */
export const TIMELINE_MAX_SPAN_MS = 1000 * YEAR_MS

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** A time window in epoch milliseconds. */
export interface TimelineSpan {
  start: number
  end: number
}

/** Epoch ms of a `string | Date`, or `null` when it does not parse. */
export function parseTimelineTime(value: string | Date | number | null | undefined): number | null {
  if (value == null || value === '') return null
  const t = value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Date.parse(value)
  return Number.isFinite(t) ? t : null
}

/** "12 Mar 2024" (UTC). */
export function formatTimelineDate(t: number): string {
  const d = new Date(t)
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** "08:05", "08:05:09" or "08:05:09.250" (UTC), at `unit`'s precision (0.2.36). */
export function formatTimelineClock(t: number, unit: 'hour' | 'minute' | 'second' | 'millisecond'): string {
  const d = new Date(t)
  const hm = `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`
  if (unit === 'hour' || unit === 'minute') return hm
  const hms = `${hm}:${pad2(d.getUTCSeconds())}`
  return unit === 'second' ? hms : `${hms}.${String(d.getUTCMilliseconds()).padStart(3, '0')}`
}

/** "12 Mar 2024 08:05:09" (UTC) — an instant to the second (0.2.36, sub-day timelines). */
export function formatTimelineInstant(t: number): string {
  return `${formatTimelineDate(t)} ${formatTimelineClock(t, 'second')}`
}

const SUB_DAY_UNITS: readonly TimelineTickUnit[] = ['hour', 'minute', 'second', 'millisecond']

/** The visible window as text, at the axis's own precision ("Mar 2024 – Jun 2025"; below a day,
 *  "12 Mar 2024 08:00 – 08:10"). */
export function formatTimelineSpan(span: TimelineSpan, unit: TimelineTickUnit): string {
  if (SUB_DAY_UNITS.includes(unit)) {
    const clock = unit as 'hour' | 'minute' | 'second' | 'millisecond'
    const a = `${formatTimelineDate(span.start)} ${formatTimelineClock(span.start, clock)}`
    const sameDay = formatTimelineDate(span.start) === formatTimelineDate(span.end)
    const b = sameDay ? formatTimelineClock(span.end, clock) : `${formatTimelineDate(span.end)} ${formatTimelineClock(span.end, clock)}`
    return `${a} – ${b}`
  }
  const f = (t: number) => {
    const d = new Date(t)
    if (unit === 'year') return String(d.getUTCFullYear())
    if (unit === 'month') return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
    return formatTimelineDate(t)
  }
  const a = f(span.start)
  const b = f(span.end)
  return a === b ? a : `${a} – ${b}`
}

// ---------------------------------------------------------------- lanes

export interface TimelineLaneItem {
  id: string
  start: number
  /** Equal to `start` for a point. */
  end: number
  /**
   * The least time (ms, from `start`) this item occupies in its lane, when more than its own
   * extent and `minFootprint` — `Timeline` sets it to the room its label needs beside the marker
   * or bar (0.2.31), so a label is never cut short by the next entry in its lane.
   */
  footprint?: number
}

/**
 * Greedy lane packing: items sorted by start (longer first on a tie) each go into the first lane
 * whose last item ends strictly before this one starts, else a new lane. For intervals this
 * first-fit order is optimal — the lane count equals the most items overlapping at any instant.
 *
 * `minFootprint` (ms) is the least time an item is treated as occupying, so a point (or a very
 * short range) keeps room for its marker: two items closer than that never share a lane.
 * `Timeline` derives it from the current scale so markers never overlap on screen. An item's own
 * `footprint` widens that further (its label's room), so the next entry starts a lane only where
 * the label has ended and a crowded instant spreads over other lanes instead of truncating labels.
 */
export function packTimelineLanes(items: readonly TimelineLaneItem[], minFootprint = 0): Map<string, number> {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const laneEnds: number[] = []
  const lanes = new Map<string, number>()
  for (const it of sorted) {
    const end = Math.max(it.end, it.start + Math.max(minFootprint, it.footprint ?? 0))
    let lane = laneEnds.findIndex((e) => e < it.start)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(end)
    } else {
      laneEnds[lane] = end
    }
    lanes.set(it.id, lane)
  }
  return lanes
}

// ---------------------------------------------------------------- axis

export type TimelineTickUnit = 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second' | 'millisecond'

export interface TimelineTick {
  t: number
  label: string
}

export interface TimelineTicks {
  unit: TimelineTickUnit
  /** Units per tick (e.g. 5 for every five years). */
  step: number
  ticks: TimelineTick[]
}

/** Below a day (0.2.36), used only by a timeline whose narrowest span is under three days. */
const SUB_DAY_LADDER: { unit: TimelineTickUnit; step: number; ms: number }[] = [
  ...[100, 200, 500].map((step) => ({ unit: 'millisecond' as const, step, ms: step })),
  ...[1, 2, 5, 10, 15, 30].map((step) => ({ unit: 'second' as const, step, ms: step * 1000 })),
  ...[1, 2, 5, 10, 15, 30].map((step) => ({ unit: 'minute' as const, step, ms: step * 60_000 })),
  ...[1, 2, 3, 6, 12].map((step) => ({ unit: 'hour' as const, step, ms: step * 3_600_000 })),
]

const LADDER: { unit: TimelineTickUnit; step: number; ms: number }[] = [
  { unit: 'day', step: 1, ms: TIMELINE_DAY_MS },
  { unit: 'day', step: 2, ms: 2 * TIMELINE_DAY_MS },
  { unit: 'day', step: 7, ms: 7 * TIMELINE_DAY_MS },
  { unit: 'day', step: 14, ms: 14 * TIMELINE_DAY_MS },
  { unit: 'month', step: 1, ms: MONTH_MS },
  { unit: 'month', step: 3, ms: 3 * MONTH_MS },
  { unit: 'month', step: 6, ms: 6 * MONTH_MS },
  ...[1, 2, 5, 10, 20, 50, 100, 200, 500, 1000].map((step) => ({ unit: 'year' as const, step, ms: step * YEAR_MS })),
]

/**
 * The axis for a window `widthPx` wide: the finest step (days → weeks → months → quarters →
 * years → centuries) whose ticks are at least `minSpacingPx` apart, with ticks aligned to
 * calendar boundaries (whole days, Mondays for weekly steps, months, years) in UTC. With
 * `subDay` (0.2.36) the ladder starts finer — tenths of a second, seconds, minutes, hours — each
 * aligned to its own unit, and a tick label carries the date where the day changes.
 */
export function timelineTicks(span: TimelineSpan, widthPx: number, minSpacingPx = 80, subDay = false): TimelineTicks {
  const msPerPx = (span.end - span.start) / Math.max(1, widthPx)
  const ladder = subDay ? [...SUB_DAY_LADDER, ...LADDER] : LADDER
  const rung = ladder.find((r) => r.ms / msPerPx >= minSpacingPx) ?? ladder[ladder.length - 1]
  const { unit, step } = rung
  const ticks: TimelineTick[] = []
  const d = new Date(span.start)
  let t: number
  if (SUB_DAY_UNITS.includes(unit)) {
    const clock = unit as 'hour' | 'minute' | 'second' | 'millisecond'
    t = Math.floor(span.start / rung.ms) * rung.ms
    let prevDay: string | null = null
    for (let guard = 0; t <= span.end && guard < 4000; guard++, t += rung.ms) {
      if (t < span.start) continue
      const day = formatTimelineDate(t)
      const label = day !== prevDay ? `${new Date(t).getUTCDate()} ${MONTHS[new Date(t).getUTCMonth()]} ${formatTimelineClock(t, clock)}` : formatTimelineClock(t, clock)
      ticks.push({ t, label })
      prevDay = day
    }
    return { unit, step, ticks }
  }
  if (unit === 'year') {
    t = Date.UTC(Math.floor(d.getUTCFullYear() / step) * step, 0, 1)
  } else if (unit === 'month') {
    t = Date.UTC(d.getUTCFullYear(), Math.floor(d.getUTCMonth() / step) * step, 1)
  } else {
    const day = Math.floor(span.start / TIMELINE_DAY_MS)
    // Weekly steps start on a Monday (1970-01-05 was one); other steps on whole days from the epoch.
    const offset = step % 7 === 0 ? 4 : 0
    t = (Math.floor((day - offset) / step) * step + offset) * TIMELINE_DAY_MS
  }
  let prevYear: number | null = null
  for (let guard = 0; t <= span.end && guard < 2000; guard++) {
    if (t >= span.start) {
      const td = new Date(t)
      const year = td.getUTCFullYear()
      const withYear = prevYear === null || year !== prevYear
      let label: string
      if (unit === 'year') label = String(year)
      else if (unit === 'month') label = withYear ? `${MONTHS[td.getUTCMonth()]} ${year}` : MONTHS[td.getUTCMonth()]
      else label = withYear ? formatTimelineDate(t) : `${td.getUTCDate()} ${MONTHS[td.getUTCMonth()]}`
      ticks.push({ t, label })
      prevYear = year
    }
    const td = new Date(t)
    if (unit === 'year') t = Date.UTC(td.getUTCFullYear() + step, 0, 1)
    else if (unit === 'month') t = Date.UTC(td.getUTCFullYear(), td.getUTCMonth() + step, 1)
    else t += step * TIMELINE_DAY_MS
  }
  return { unit, step, ticks }
}

// ---------------------------------------------------------------- label geometry

/**
 * An estimate of a label's rendered width in px at `fontSizePx` in a proportional sans-serif,
 * from per-character widths (narrow, wide, capital, digit) rounded up so it errs wide. `Timeline`
 * uses it to reserve label room when the text cannot be measured (no `OffscreenCanvas`, as in
 * jsdom); `letterSpacingEm` adds tracking per character.
 */
export function estimateTimelineLabelWidth(text: string, fontSizePx = 11, letterSpacingEm = 0): number {
  let em = 0
  for (const ch of text) {
    if (/[iljtfI.,:;'|!() ]/.test(ch)) em += 0.32
    else if (/[mwMW@%]/.test(ch)) em += 0.92
    else if (/[A-Z]/.test(ch)) em += 0.7
    else if (/[0-9]/.test(ch)) em += 0.6
    else em += 0.58
    em += letterSpacingEm
  }
  return Math.ceil(em * fontSizePx)
}

/** A label's horizontal extent on the axis, in px from the plot's left edge. */
export interface TimelineAxisLabelBox {
  left: number
  width: number
}

export interface TimelineAxisLabelLayout {
  /** Left edge of the "today" label, or `null` when there is no today label. */
  todayLeft: number | null
  /** Indexes of tick labels hidden because the today label had to cover them. */
  hiddenTicks: number[]
}

/** Least gap between two axis labels, in px. */
const AXIS_LABEL_GAP = 4

/**
 * Places the "today" label on the axis so it never overlaps a tick label: right of the today line
 * (`todayX`), else left of it, whichever side stays inside the plot (`plotWidth`) and clear of
 * every tick label. When neither side is clear the label takes the side that stays in the plot
 * (right first) and the tick labels it would overlap are hidden — "today" wins, since the gridline
 * still marks the tick and the neighbouring labels name it.
 */
export function layoutTimelineAxisLabels(
  ticks: readonly TimelineAxisLabelBox[],
  today: { x: number; width: number } | null,
  plotWidth: number,
): TimelineAxisLabelLayout {
  if (!today) return { todayLeft: null, hiddenTicks: [] }
  const right = today.x + 2
  const left = today.x - 2 - today.width
  const fits = (l: number) => l >= 0 && l + today.width <= plotWidth
  const hits = (l: number) =>
    ticks.flatMap((tk, i) => (tk.left < l + today.width + AXIS_LABEL_GAP && l < tk.left + tk.width + AXIS_LABEL_GAP ? [i] : []))
  const sides = [right, left].filter(fits)
  if (sides.length === 0) sides.push(Math.min(Math.max(0, right), Math.max(0, plotWidth - today.width)))
  for (const l of sides) if (hits(l).length === 0) return { todayLeft: l, hiddenTicks: [] }
  // Neither side is clear: take the side that hides the fewest tick labels (right on a tie).
  let best = sides[0]
  let bestHits = hits(best)
  for (const l of sides.slice(1)) {
    const h = hits(l)
    if (h.length < bestHits.length) {
      best = l
      bestHits = h
    }
  }
  return { todayLeft: best, hiddenTicks: bestHits }
}

// ---------------------------------------------------------------- range arithmetic

/** Keeps a span inside the zoom limits, about its centre (`minSpanMs`, 0.2.36: a caller's
 *  narrowest span, default three days). */
export function clampTimelineSpan(span: TimelineSpan, minSpanMs: number = TIMELINE_MIN_SPAN_MS): TimelineSpan {
  const len = span.end - span.start
  const clamped = Math.min(TIMELINE_MAX_SPAN_MS, Math.max(minSpanMs, len))
  if (clamped === len) return span
  const mid = (span.start + span.end) / 2
  return { start: mid - clamped / 2, end: mid + clamped / 2 }
}

/** Zooms by `factor` (< 1 zooms in) keeping the instant `anchor` where it is on screen. */
export function zoomTimelineSpan(
  span: TimelineSpan,
  factor: number,
  anchor = (span.start + span.end) / 2,
  minSpanMs: number = TIMELINE_MIN_SPAN_MS,
): TimelineSpan {
  const len = span.end - span.start
  const next = Math.min(TIMELINE_MAX_SPAN_MS, Math.max(minSpanMs, len * factor))
  const k = next / len
  const start = anchor - (anchor - span.start) * k
  return { start, end: start + next }
}

/** Moves the window by `deltaMs` (positive moves later). */
export function panTimelineSpan(span: TimelineSpan, deltaMs: number): TimelineSpan {
  return { start: span.start + deltaMs, end: span.end + deltaMs }
}

/** The window that shows every item, with 5% room either side (a month either side of a lone
 *  point; with a sub-day `minSpanMs`, 0.2.36, that span either side). */
export function fitTimelineSpan(items: readonly TimelineLaneItem[], minSpanMs: number = TIMELINE_MIN_SPAN_MS): TimelineSpan | null {
  if (items.length === 0) return null
  let lo = Infinity
  let hi = -Infinity
  for (const it of items) {
    lo = Math.min(lo, it.start)
    hi = Math.max(hi, it.end)
  }
  const len = hi - lo
  const pad = len > 0 ? len * 0.05 : minSpanMs < TIMELINE_MIN_SPAN_MS ? minSpanMs : 30 * TIMELINE_DAY_MS
  return clampTimelineSpan({ start: lo - pad, end: hi + pad }, minSpanMs)
}
