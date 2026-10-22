/**
 * Timeline helpers (0.2.30) — the pure parts of `Timeline`: date parsing, lane packing, the
 * adaptive axis, and the pan/zoom range arithmetic. Exported so an app can reuse the same packing
 * or axis outside the component, and so each part is tested on its own.
 *
 * All calendar arithmetic is in UTC: a date-only string such as `'2024-03-12'` is UTC midnight in
 * JavaScript, so labelling it in UTC keeps it on the day it names in every time zone.
 */

export const TIMELINE_DAY_MS = 86_400_000
const YEAR_MS = 365.2425 * TIMELINE_DAY_MS
const MONTH_MS = YEAR_MS / 12

/** Narrowest span the view zooms in to (days are the finest axis unit). */
export const TIMELINE_MIN_SPAN_MS = 3 * TIMELINE_DAY_MS
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

/** The visible window as text, at the axis's own precision ("Mar 2024 – Jun 2025"). */
export function formatTimelineSpan(span: TimelineSpan, unit: TimelineTickUnit): string {
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
}

/**
 * Greedy lane packing: items sorted by start (longer first on a tie) each go into the first lane
 * whose last item ends strictly before this one starts, else a new lane. For intervals this
 * first-fit order is optimal — the lane count equals the most items overlapping at any instant.
 *
 * `minFootprint` (ms) is the least time an item is treated as occupying, so a point (or a very
 * short range) keeps room for its marker: two items closer than that never share a lane.
 * `Timeline` derives it from the current scale so markers never overlap on screen.
 */
export function packTimelineLanes(items: readonly TimelineLaneItem[], minFootprint = 0): Map<string, number> {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const laneEnds: number[] = []
  const lanes = new Map<string, number>()
  for (const it of sorted) {
    const end = Math.max(it.end, it.start + minFootprint)
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

export type TimelineTickUnit = 'year' | 'month' | 'day'

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
 * calendar boundaries (whole days, Mondays for weekly steps, months, years) in UTC.
 */
export function timelineTicks(span: TimelineSpan, widthPx: number, minSpacingPx = 80): TimelineTicks {
  const msPerPx = (span.end - span.start) / Math.max(1, widthPx)
  const rung = LADDER.find((r) => r.ms / msPerPx >= minSpacingPx) ?? LADDER[LADDER.length - 1]
  const { unit, step } = rung
  const ticks: TimelineTick[] = []
  const d = new Date(span.start)
  let t: number
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

// ---------------------------------------------------------------- range arithmetic

/** Keeps a span inside the zoom limits, about its centre. */
export function clampTimelineSpan(span: TimelineSpan): TimelineSpan {
  const len = span.end - span.start
  const clamped = Math.min(TIMELINE_MAX_SPAN_MS, Math.max(TIMELINE_MIN_SPAN_MS, len))
  if (clamped === len) return span
  const mid = (span.start + span.end) / 2
  return { start: mid - clamped / 2, end: mid + clamped / 2 }
}

/** Zooms by `factor` (< 1 zooms in) keeping the instant `anchor` where it is on screen. */
export function zoomTimelineSpan(span: TimelineSpan, factor: number, anchor = (span.start + span.end) / 2): TimelineSpan {
  const len = span.end - span.start
  const next = Math.min(TIMELINE_MAX_SPAN_MS, Math.max(TIMELINE_MIN_SPAN_MS, len * factor))
  const k = next / len
  const start = anchor - (anchor - span.start) * k
  return { start, end: start + next }
}

/** Moves the window by `deltaMs` (positive moves later). */
export function panTimelineSpan(span: TimelineSpan, deltaMs: number): TimelineSpan {
  return { start: span.start + deltaMs, end: span.end + deltaMs }
}

/** The window that shows every item, with 5% room either side (a month either side of a lone point). */
export function fitTimelineSpan(items: readonly TimelineLaneItem[]): TimelineSpan | null {
  if (items.length === 0) return null
  let lo = Infinity
  let hi = -Infinity
  for (const it of items) {
    lo = Math.min(lo, it.start)
    hi = Math.max(hi, it.end)
  }
  const len = hi - lo
  const pad = len > 0 ? len * 0.05 : 30 * TIMELINE_DAY_MS
  return clampTimelineSpan({ start: lo - pad, end: hi + pad })
}
