/**
 * PlaybackTimeline helpers (0.2.46, kineticlogic-io/OpenStare#532) — the pure arithmetic of the
 * range window: clamping to the extent, moving, resizing, scrubbing and stepping it, and the step
 * presets. The caller's clock (#535) steps and plays through `advanceSelection`, so the
 * stop-at-the-edge rule lives here once.
 */
import { durationToSeconds, type TimeUnit } from '../units/units.js'

/** A span in epoch ms, `start` < `end`. */
export interface PlaybackSpan {
  start: number
  end: number
}

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** The default step sizes (operator-approved 2026-11-18): 1 s to 1 day. */
export const STEP_PRESETS_MS: readonly number[] = [SECOND, 10 * SECOND, MINUTE, 5 * MINUTE, 15 * MINUTE, HOUR, 6 * HOUR, DAY]

/** The default step: one minute (the ATLAS timeslider's former fixed step). */
export const DEFAULT_STEP_MS = MINUTE

/** The narrowest range window, in ms, unless the caller sets one. */
export const PLAYBACK_MIN_SELECTION_MS = SECOND

/**
 * A step for display: "1 s", "15 min", "6 h", "1 d" in the largest whole unit; a step that is no
 * whole number of minutes is shown exactly in seconds ("90 s", "59.99 s", "3744 s"), so two
 * different steps never read the same.
 */
export function formatStep(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—'
  const units: Array<[number, string]> = [
    [DAY, 'd'],
    [HOUR, 'h'],
    [MINUTE, 'min'],
  ]
  for (const [size, label] of units) {
    if (ms >= size && ms % size === 0) return `${ms / size} ${label}`
  }
  if (ms < SECOND) return `${ms} ms`
  return `${Math.round(ms) / 1000} s`
}

/** A step typed as a value and a time unit, in ms; `null` when it is not a positive, finite duration. */
export function stepFromUnit(value: number, unit: TimeUnit): number | null {
  if (!Number.isFinite(value) || value <= 0) return null
  const ms = Math.round(durationToSeconds(value, unit) * 1000)
  return ms > 0 ? ms : null
}

/**
 * The selection inside the extent and at least `minMs` wide (never wider than the extent). A
 * selection that would cross an edge keeps its width and sits against that edge.
 */
export function clampSelection(sel: PlaybackSpan, extent: PlaybackSpan, minMs = PLAYBACK_MIN_SELECTION_MS): PlaybackSpan {
  const extentLen = Math.max(0, extent.end - extent.start)
  let start = Math.min(sel.start, sel.end)
  let end = Math.max(sel.start, sel.end)
  let len = Math.min(extentLen, Math.max(end - start, Math.min(minMs, extentLen)))
  if (!Number.isFinite(len)) len = extentLen
  if (end - start !== len) end = start + len
  if (start < extent.start) {
    start = extent.start
    end = start + len
  }
  if (end > extent.end) {
    end = extent.end
    start = end - len
  }
  return { start, end }
}

/** The selection moved by `deltaMs`, keeping its width, stopped at the extent's edges. */
export function moveSelection(sel: PlaybackSpan, deltaMs: number, extent: PlaybackSpan): PlaybackSpan {
  return clampSelection({ start: sel.start + deltaMs, end: sel.end + deltaMs }, extent, sel.end - sel.start)
}

/**
 * One edge of the selection dragged to `t`. The other edge stays put; the dragged edge stops at the
 * extent and never comes closer than `minMs` to the other.
 */
export function resizeSelection(
  sel: PlaybackSpan,
  edge: 'start' | 'end',
  t: number,
  extent: PlaybackSpan,
  minMs = PLAYBACK_MIN_SELECTION_MS,
): PlaybackSpan {
  if (edge === 'start') {
    const start = Math.max(extent.start, Math.min(t, sel.end - minMs))
    return { start: Math.min(start, sel.end), end: sel.end }
  }
  const end = Math.min(extent.end, Math.max(t, sel.start + minMs))
  return { start: sel.start, end: Math.max(end, sel.start) }
}

/** The selection, keeping its width, with its end (the playhead) at `endT`. */
export function scrubSelection(sel: PlaybackSpan, endT: number, extent: PlaybackSpan): PlaybackSpan {
  return moveSelection(sel, endT - sel.end, extent)
}

/**
 * The selection one step forward (`dir` 1) or back (-1). `atEdge` is true when it can go no
 * further that way: play stops there.
 */
export function advanceSelection(
  sel: PlaybackSpan,
  stepMs: number,
  dir: 1 | -1,
  extent: PlaybackSpan,
): { selection: PlaybackSpan; atEdge: boolean } {
  const selection = moveSelection(sel, dir * Math.max(0, stepMs), extent)
  const atEdge = dir > 0 ? selection.end >= extent.end : selection.start <= extent.start
  return { selection, atEdge }
}
