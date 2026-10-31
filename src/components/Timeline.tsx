import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { TbArrowAutofitWidth, TbZoomIn, TbZoomOut } from 'react-icons/tb'
import { Button } from './Button.js'
import { EmptyState } from './EmptyState.js'
import {
  clampTimelineSpan,
  estimateTimelineLabelWidth,
  fitTimelineSpan,
  formatTimelineDate,
  formatTimelineInstant,
  formatTimelineSpan,
  layoutTimelineAxisLabels,
  packTimelineLanes,
  panTimelineSpan,
  parseTimelineTime,
  resolveTimelineMinSpan,
  TIMELINE_MIN_SPAN_MS,
  timelineTicks,
  zoomTimelineSpan,
  type TimelineLaneItem,
  type TimelineSpan,
} from './Timeline.helpers.js'

/**
 * Timeline (0.2.30, operator-approved 2026-10-22 for the CODEX homepage, kineticlogic-io/OpenStare#392;
 * label-aware lanes, a today label clear of the axis labels and auto height 0.2.31)
 * — dated entries on a horizontal time axis, in non-overlapping lanes.
 *
 * - An entry with `end` is a **range**, drawn as a bar from start to end; without `end` it is a
 *   **point**, drawn as a diamond marker. `tone` picks a token colour, never a raw colour.
 * - **Lanes** are packed greedily (`packTimelineLanes`): ranges never overlap, and every entry keeps
 *   room for its marker and its label at the current zoom — a label beside a point or a short bar
 *   reserves its measured width (estimated where text cannot be measured), so a nearby entry moves
 *   to another lane rather than cutting the label short. A label sits inside its bar when the bar
 *   is wide enough for it, else beside it; it is truncated only past `LABEL_MAX_PX` or at the edge
 *   of the view. The full label, dates and `meta` are the entry's tooltip and accessible name.
 * - **Axis**: ticks adapt from centuries down to single days (`timelineTicks`), on calendar
 *   boundaries in UTC (a date-only string is UTC midnight, so it stays on the day it names). A
 *   "today" line marks the current date (`now` overrides it, `null` hides it); its label sits on
 *   whichever side of the line clears the tick labels, hiding a tick label only when neither does
 *   (`layoutTimelineAxisLabels`).
 * - **Height**: `height` fixes it; without it the timeline is as tall as its lanes, between
 *   `minHeight` and `maxHeight`, and more lanes than that scroll.
 * - **Pan and zoom**: drag to pan (vertical drag scrolls the lanes), wheel or pinch to zoom about
 *   the pointer, horizontal wheel to pan, and zoom-in / zoom-out / fit buttons. The visible window
 *   is uncontrolled (`initialRange`, else fitted to the entries and re-fitted as they change until
 *   the user moves it) or controlled (`range` + `onRangeChange`).
 * - **Keyboard**: entries are buttons in time order with one tab stop; arrow keys move to the
 *   previous / next entry (panning it into view), Home / End to the first / last, Enter selects,
 *   `+` / `-` zoom.
 * - **Performance**: only entries in or near the view are rendered, each placed with a transform;
 *   lanes re-pack only when the zoom crosses a doubling, so panning never reshuffles them.
 * - **Empty**: no entries renders an `EmptyState` and no controls.
 *
 * - **Short spans and picking a time** (0.2.36): `minSpanMs` lets the view zoom in below the
 *   default three days (down to a second); the axis then gains hour, minute, second and sub-second
 *   ticks and tooltips carry the time. `onTimePick` reports a time picked on the plot — a click
 *   outside an entry; with `interaction: 'scrub'` also a press-and-drag anywhere on the plot
 *   (Shift+drag still pans) and the arrow keys while the plot has focus (a hundredth of the view
 *   per press, a tenth with Shift, from the `now` line). `nowLabel` names the `now` line (default
 *   "Today"; `null` draws the line without a label).
 *
 * - **Density** (0.2.37): `density` draws a bar histogram of counts in equal time buckets between
 *   the toolbar and the axis — `start`/`end` the buckets' span, each series' `counts` one per
 *   bucket, the series stacked in their own token tones. A bar's height is its bucket's share of
 *   the busiest bucket in view; hovering one shows its time span and each series' count. With
 *   `density` and no entries the plot and its controls render (no empty state, no lanes, and no
 *   fit button — there are no entries to fit); drag, wheel, pinch, the zoom buttons and the arrow
 *   keys on the focused plot move the view, reported through `onRangeChange`. A series' `color`
 *   (0.2.39) is a colour of the caller's own in place of its tone (data-viz categories).
 *
 * Data comes in through props only; design tokens only, so it follows the dark and light themes.
 * Interaction feedback animates only `filter`, `opacity` and `transform`.
 */
export type TimelineTone = 'accent' | 'info' | 'warning' | 'neutral'

export interface TimelineEntry {
  id: string
  label: string
  /** An ISO date / date-time string or a `Date`. An entry whose start does not parse is left out. */
  start: string | Date
  /** Makes the entry a range. Omitted (or unparseable) makes it a point. */
  end?: string | Date
  tone?: TimelineTone
  /** Secondary text for the tooltip and accessible name (a type, a place, a source). */
  meta?: string
}

/** A visible window as the caller gives it. */
/** One series of a density histogram (0.2.37): a count per bucket, in the series' token tone. */
export interface TimelineDensitySeries {
  label: string
  tone?: TimelineTone
  /** A colour of the caller's own (0.2.39) — any CSS colour, e.g. a data-viz category colour
   *  generated from the series' identity; overrides `tone`. */
  color?: string
  /** One count per bucket; a missing or non-finite count is 0. */
  counts: number[]
}

/** A density histogram (0.2.37): equal buckets from `start` to `end`, one count per bucket per series. */
export interface TimelineDensity {
  start: string | Date
  end: string | Date
  series: TimelineDensitySeries[]
}

export interface TimelineRange {
  start: string | Date
  end: string | Date
}

export interface TimelineProps {
  entries: TimelineEntry[]
  onSelect?: (id: string) => void
  selectedId?: string | null
  /**
   * Total height in px, toolbar and axis included. More lanes than fit scroll. Without it the
   * timeline sizes to its lanes, between `minHeight` and `maxHeight` (0.2.31; 0.2.30 defaulted to 260).
   */
  height?: number
  /** Least auto height in px (default: room for two lanes). Ignored when `height` is set. */
  minHeight?: number
  /** Greatest auto height in px (default 320); more lanes scroll. Ignored when `height` is set. */
  maxHeight?: number
  /** Uncontrolled starting window. Without it the window fits the entries. */
  initialRange?: TimelineRange
  /** Controlled window; pair with `onRangeChange`. */
  range?: TimelineRange
  /** Every pan, zoom and fit reports the new window. */
  onRangeChange?: (range: { start: Date; end: Date }) => void
  'aria-label': string
  /** Where the "today" line sits (default the current date); `null` hides it. */
  now?: string | Date | null
  /** The `now` line's label (0.2.36; default "Today", shown upper-case); `null` draws the line
   *  without a label. */
  nowLabel?: string | null
  /** The narrowest span the view zooms in to, in ms (0.2.36; default three days, at least one
   *  second). Below three days the axis gains hour, minute, second and sub-second ticks. */
  minSpanMs?: number
  /** A time picked on the plot, in epoch ms (0.2.36): a click outside an entry; with
   *  `interaction: 'scrub'`, also a press-and-drag and the arrow keys on the focused plot. */
  onTimePick?: (ms: number) => void
  /** What dragging the plot does (0.2.36): `'pan'` (default) moves the view; `'scrub'` picks times
   *  through `onTimePick`, and Shift+drag moves the view. */
  interaction?: 'pan' | 'scrub'
  /** A density histogram between the toolbar and the axis (0.2.37). With it, an empty `entries`
   *  still renders the plot and its controls. */
  density?: TimelineDensity
  /** Empty-state title (default "No entries to show"). */
  emptyTitle?: ReactNode
  emptyDescription?: ReactNode
  style?: CSSProperties
}

const TONE_TOKEN: Record<TimelineTone, string> = {
  accent: '--color-accent',
  info: '--status-info',
  warning: '--status-warning',
  neutral: '--text-muted',
}

/** Width used until the plot has been measured (and where ResizeObserver is unavailable). */
const FALLBACK_WIDTH = 800
const TOOLBAR_H = 32
const AXIS_H = 24
/** The density band's least height (it grows into the room lanes would take). */
const DENSITY_MIN_H = 24
/** Room above the busiest bar. */
const DENSITY_TOP_PAD = 4
const LANE_H = 26
const BAR_H = 18
const LANES_PAD = 6
const MARKER = 10
/** The least on-screen room an entry occupies in its lane: a marker and a gap. */
const FOOTPRINT_PX = 24
/**
 * Room kept after a beside label so the next entry in the lane cannot cut it short: the 6 px the
 * label stops before the next entry, half a marker (a point's diamond reaches left of its instant)
 * and a pixel to spare.
 */
const LABEL_CLEAR_PX = 6 + 10 / 2 + 2
/** An inside label's padding within its bar. */
const INSIDE_LABEL_PAD = 12
const ENTRY_FONT = '600 11px'
const TICK_FONT = '400 11px'
const TODAY_FONT = '600 10px'
const TODAY_TEXT = 'Today'
/** A now label's tracking (0.08em at 10 px per character) and its 4 px side padding. */
const nowLabelExtraPx = (text: string) => text.length * 0.8 + 8
const AUTO_MAX_HEIGHT = 320
/** Toolbar, axis, lane padding and the 1 px border either side: the height with no lanes. */
const CHROME_H = 2 + TOOLBAR_H + AXIS_H + LANES_PAD * 2
const EMPTY_AUTO_HEIGHT = 140
/** A bar at least this wide carries its label inside. */
const INSIDE_LABEL_MIN_PX = 56
const LABEL_MAX_PX = 240
/** Bars are clipped this far beyond the view, so a deep zoom never asks for a giant element. */
const CLIP_PAD = 400
const DRAG_THRESHOLD_PX = 4
const ZOOM_STEP = 0.5

const SR_ONLY: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
}

interface Item {
  entry: TimelineEntry
  id: string
  start: number
  end: number
  point: boolean
  index: number
}

function parseRange(r: TimelineRange | undefined, minSpanMs: number): TimelineSpan | null {
  if (!r) return null
  const start = parseTimelineTime(r.start)
  const end = parseTimelineTime(r.end)
  if (start == null || end == null || end <= start) return null
  return clampTimelineSpan({ start, end }, minSpanMs)
}

type MeasureText = (text: string, font: string, fontSizePx: number) => number

/**
 * Measures text with an `OffscreenCanvas` in the page's sans-serif (`--font-sans`), or estimates
 * it where there is no canvas (server rendering, jsdom). Read once per mount; never in a frame loop.
 */
function createMeasure(): MeasureText {
  const estimate: MeasureText = (text, _font, size) => estimateTimelineLabelWidth(text, size)
  if (typeof OffscreenCanvas === 'undefined' || typeof document === 'undefined') return estimate
  try {
    const ctx = new OffscreenCanvas(1, 1).getContext('2d')
    const family = getComputedStyle(document.documentElement).getPropertyValue('--font-sans').trim()
    if (!ctx || !family) return estimate
    const cache = new Map<string, number>()
    return (text, font, size) => {
      const key = `${font}|${text}`
      let w = cache.get(key)
      if (w === undefined) {
        ctx.font = `${font} ${family}`
        w = Math.ceil(ctx.measureText(text).width) + 2
        cache.set(key, w)
      }
      return w ?? estimateTimelineLabelWidth(text, size)
    }
  } catch {
    return estimate
  }
}

interface DensityBucket {
  index: number
  start: number
  end: number
  counts: number[]
  total: number
}

/** The buckets of a density histogram, each with its per-series counts and their total. */
function densityBuckets(density: TimelineDensity | undefined): DensityBucket[] {
  if (!density) return []
  const start = parseTimelineTime(density.start)
  const end = parseTimelineTime(density.end)
  const n = density.series.reduce((m, s) => Math.max(m, s.counts.length), 0)
  if (start == null || end == null || end <= start || n === 0) return []
  const w = (end - start) / n
  const out: DensityBucket[] = []
  for (let i = 0; i < n; i++) {
    const counts = density.series.map((s) => {
      const c = s.counts[i]
      return typeof c === 'number' && Number.isFinite(c) && c > 0 ? c : 0
    })
    out.push({ index: i, start: start + i * w, end: start + (i + 1) * w, counts, total: counts.reduce((a, b) => a + b, 0) })
  }
  return out
}

function datesOf(it: Item, withTime: boolean): string {
  const f = withTime ? formatTimelineInstant : formatTimelineDate
  return it.point ? f(it.start) : `${f(it.start)} to ${f(it.end)}`
}

export function Timeline({
  entries,
  onSelect,
  selectedId = null,
  height,
  minHeight,
  maxHeight,
  initialRange,
  range,
  onRangeChange,
  'aria-label': ariaLabel,
  now,
  nowLabel,
  minSpanMs,
  onTimePick,
  interaction = 'pan',
  density,
  emptyTitle = 'No entries to show',
  emptyDescription,
  style,
}: TimelineProps) {
  const uid = useId()
  const minSpan = resolveTimelineMinSpan(minSpanMs)
  const subDay = minSpan < TIMELINE_MIN_SPAN_MS
  const scrub = interaction === 'scrub' && onTimePick !== undefined
  const plotRef = useRef<HTMLDivElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const entryEls = useRef(new Map<string, HTMLButtonElement>())
  const pendingFocus = useRef<string | null>(null)
  const suppressClick = useRef(false)
  const drag = useRef<{ x: number; y: number; span: TimelineSpan; msPerPx: number; scrollTop: number; moved: boolean; mouse: boolean; scrubbing: boolean } | null>(null)
  const pointers = useRef(new Map<number, number>())
  const pinch = useRef<{ d0: number; span: TimelineSpan; anchor: number } | null>(null)

  const [width, setWidth] = useState(FALLBACK_WIDTH)
  const [dragging, setDragging] = useState(false)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [clock, setClock] = useState(() => Date.now())
  const [measure, setMeasure] = useState(createMeasure)
  // A web font that finishes loading after mount changes label widths: measure again once.
  useEffect(() => {
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined
    if (!fonts || fonts.status === 'loaded') return
    let live = true
    fonts.ready.then(
      () => {
        if (live) setMeasure(() => createMeasure())
      },
      () => {},
    )
    return () => {
      live = false
    }
  }, [])

  // ---- entries, in time order
  const items = useMemo<Item[]>(() => {
    const out: Omit<Item, 'index'>[] = []
    for (const entry of entries) {
      const a = parseTimelineTime(entry.start)
      if (a == null) continue
      const b = parseTimelineTime(entry.end)
      const point = b == null || b === a
      const start = point ? a : Math.min(a, b)
      const end = point ? a : Math.max(a, b)
      out.push({ entry, id: entry.id, start, end, point })
    }
    out.sort((p, q) => p.start - q.start || q.end - p.end || (p.id < q.id ? -1 : p.id > q.id ? 1 : 0))
    return out.map((it, index) => ({ ...it, index }))
  }, [entries])
  const fitted = useMemo(() => fitTimelineSpan(items, minSpan), [items, minSpan])
  const buckets = useMemo(() => densityBuckets(density), [density])
  const hasDensity = density !== undefined
  /** Nothing to draw at all: the empty state. */
  const empty = items.length === 0 && !hasDensity
  /** A density histogram and no entries: no lanes, nothing to fit. */
  const densityOnly = items.length === 0 && hasDensity

  // ---- the visible window: controlled, else the user's, else fitted to the entries
  const controlledStart = parseTimelineTime(range?.start)
  const controlledEnd = parseTimelineTime(range?.end)
  const controlled = range !== undefined
  const controlledSpan = useMemo(
    () => (controlledStart != null && controlledEnd != null ? parseRange({ start: new Date(controlledStart), end: new Date(controlledEnd) }, minSpan) : null),
    [controlledStart, controlledEnd, minSpan],
  )
  const [internal, setInternal] = useState<TimelineSpan | null>(() => parseRange(initialRange, minSpan))
  const span: TimelineSpan =
    (controlled ? controlledSpan : internal) ?? fitted ?? { start: clock - 180 * 86_400_000, end: clock + 180 * 86_400_000 }
  const msPerPx = (span.end - span.start) / width

  const commit = useCallback(
    (next: TimelineSpan | null) => {
      // `null` = follow the fitted window again (the fit button).
      const target = next ? clampTimelineSpan(next, minSpan) : fitted
      if (!controlled) setInternal(next ? target : null)
      if (target) onRangeChange?.({ start: new Date(target.start), end: new Date(target.end) })
    },
    [controlled, fitted, onRangeChange, minSpan],
  )

  // Handlers attached outside React (wheel) read the latest values through this ref.
  const latest = useRef({ span, msPerPx, commit, minSpan })
  useLayoutEffect(() => {
    latest.current = { span, msPerPx, commit, minSpan }
  })

  // ---- measure
  useEffect(() => {
    const el = plotRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.floor(entry.contentRect.width)
      if (w > 0) setWidth(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [empty])

  // ---- today, refreshed each minute unless the caller fixes it
  useEffect(() => {
    if (now !== undefined) return
    const id = setInterval(() => setClock(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [now])
  const today = now === null ? null : now === undefined ? clock : parseTimelineTime(now)

  // ---- wheel: zoom about the pointer (pinch on a trackpad arrives as ctrl+wheel); sideways pans
  useEffect(() => {
    const el = plotRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      const { span: s, msPerPx: mpp, commit: c, minSpan: ms } = latest.current
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1
      const dx = e.deltaX * unit
      const dy = e.deltaY * unit
      if (dx === 0 && dy === 0) return
      e.preventDefault()
      if (Math.abs(dx) > Math.abs(dy) || e.shiftKey) {
        c(panTimelineSpan(s, (Math.abs(dx) > Math.abs(dy) ? dx : dy) * mpp))
        return
      }
      const rect = el.getBoundingClientRect()
      const anchor = s.start + (e.clientX - rect.left) * mpp
      c(zoomTimelineSpan(s, Math.exp(dy * (e.ctrlKey ? 0.01 : 0.002)), anchor, ms))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [empty])

  // ---- lanes: packed at the current scale rounded up to a doubling, so a pan never re-packs
  const packScale = 2 ** Math.ceil(Math.log2(Math.max(msPerPx, 1)))
  /** Each entry's label width in px (the selected weight, so selecting never needs more room). */
  const labelW = useMemo(() => {
    const m = new Map<string, number>()
    for (const it of items) m.set(it.id, Math.min(LABEL_MAX_PX, measure(it.entry.label, ENTRY_FONT, 11)))
    return m
  }, [items, measure])
  const lanes = useMemo(() => {
    const laneItems: TimelineLaneItem[] = items.map((it) => {
      const lw = labelW.get(it.id) ?? 0
      let reservePx = 0
      if (it.point) reservePx = MARKER / 2 + 4 + lw + LABEL_CLEAR_PX
      else {
        // At the packing scale a bar is never wider than on screen, so a label packed beside it
        // keeps its room whether it ends up beside or inside.
        const barPx = (it.end - it.start) / packScale
        if (barPx < lw + INSIDE_LABEL_PAD) reservePx = Math.max(3, barPx) + 4 + lw + LABEL_CLEAR_PX
      }
      return { id: it.id, start: it.start, end: it.end, footprint: reservePx * packScale }
    })
    return packTimelineLanes(laneItems, FOOTPRINT_PX * packScale)
  }, [items, labelW, packScale])
  const laneCount = useMemo(() => {
    let n = 0
    for (const l of lanes.values()) n = Math.max(n, l + 1)
    return n
  }, [lanes])
  /** Start of the next entry in the same lane (where a beside-label must stop). */
  const nextInLane = useMemo(() => {
    const last = new Map<number, Item>()
    const next = new Map<string, number>()
    for (const it of items) {
      const lane = lanes.get(it.id) ?? 0
      const prev = last.get(lane)
      if (prev) next.set(prev.id, it.start)
      last.set(lane, it)
    }
    return next
  }, [items, lanes])

  const ticks = useMemo(() => timelineTicks({ start: span.start, end: span.end }, width, 80, subDay), [span.start, span.end, width, subDay])

  const xOf = (t: number) => (t - span.start) / msPerPx
  const visible = items.filter((it) => xOf(it.end) >= -(LABEL_MAX_PX + FOOTPRINT_PX) && xOf(it.start) <= width)
  const visibleIds = new Set(visible.map((it) => it.id))
  const tabStop =
    (focusId && visibleIds.has(focusId) && focusId) ||
    (selectedId && visibleIds.has(selectedId) && selectedId) ||
    visible.find((it) => xOf(it.start) >= 0)?.id ||
    visible[0]?.id ||
    null

  /** Focuses a rendered entry without letting the browser scroll the clipped plot sideways. */
  const focusEntry = useCallback(
    (id: string) => {
      const el = entryEls.current.get(id)
      if (!el) return false
      el.focus({ preventScroll: true })
      const scroller = scrollerRef.current
      if (scroller) {
        const top = LANES_PAD + (lanes.get(id) ?? 0) * LANE_H
        if (top < scroller.scrollTop) scroller.scrollTop = top
        else if (top + LANE_H > scroller.scrollTop + scroller.clientHeight) scroller.scrollTop = top + LANE_H - scroller.clientHeight
      }
      return true
    },
    [lanes],
  )

  // ---- keyboard focus that had to wait for a pan to bring its entry into the DOM
  useEffect(() => {
    const id = pendingFocus.current
    if (id && focusEntry(id)) pendingFocus.current = null
  })

  const moveTo = (index: number) => {
    const it = items[Math.max(0, Math.min(items.length - 1, index))]
    if (!it) return
    setFocusId(it.id)
    if (it.start < span.start || it.start > span.end) {
      pendingFocus.current = it.id
      const len = span.end - span.start
      commit({ start: it.start - len / 2, end: it.start + len / 2 })
    } else if (!focusEntry(it.id)) {
      pendingFocus.current = it.id
    }
  }

  const zoomBy = (factor: number, anchor?: number) => commit(zoomTimelineSpan(span, factor, anchor, minSpan))

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.altKey || e.metaKey || e.ctrlKey) return
    const target = e.target as HTMLElement
    const entryId = target.dataset?.entryId
    const current = entryId != null ? items.find((it) => it.id === entryId) : undefined
    if (e.key === '+' || e.key === '=' || e.key === 'Add') {
      e.preventDefault()
      zoomBy(ZOOM_STEP, current?.start)
      return
    }
    if (e.key === '-' || e.key === '_' || e.key === 'Subtract') {
      e.preventDefault()
      zoomBy(1 / ZOOM_STEP, current?.start)
      return
    }
    if (current) {
      const go = (i: number) => {
        e.preventDefault()
        moveTo(i)
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') go(current.index + 1)
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') go(current.index - 1)
      else if (e.key === 'Home') go(0)
      else if (e.key === 'End') go(items.length - 1)
      else if (e.key === 'Enter') {
        e.preventDefault()
        onSelect?.(current.id)
      }
      return
    }
    if (target === plotRef.current && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault()
      const len = span.end - span.start
      const dir = e.key === 'ArrowLeft' ? -1 : 1
      if (scrub) {
        // Step the picked time from the `now` line (a hundredth of the view; Shift, a tenth).
        const from = today ?? (span.start + span.end) / 2
        onTimePick?.(Math.round(from + dir * len * (e.shiftKey ? 0.1 : 0.01)))
        return
      }
      commit(panTimelineSpan(span, dir * 0.1 * len))
    }
  }

  /** The instant under a pointer at `clientX`. */
  const timeAt = (clientX: number) => {
    const rect = plotRef.current?.getBoundingClientRect()
    return Math.round(span.start + (clientX - (rect?.left ?? 0)) * msPerPx)
  }

  // ---- pointer: drag pans, two pointers pinch
  const capture = (pointerId: number) => {
    try {
      plotRef.current?.setPointerCapture?.(pointerId)
    } catch {
      /* not capturable (a synthetic event, or the pointer is already gone) */
    }
  }
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    suppressClick.current = false
    // A mouse has one pointer; a release outside the plot before a drag began left no pointerup here.
    if (!e.pointerType || e.pointerType === 'mouse') pointers.current.clear()
    pointers.current.set(e.pointerId ?? 0, e.clientX)
    if (pointers.current.size === 2) {
      capture(e.pointerId)
      const [a, b] = [...pointers.current.values()]
      const rect = plotRef.current?.getBoundingClientRect()
      pinch.current = { d0: Math.max(1, Math.abs(a - b)), span, anchor: span.start + ((a + b) / 2 - (rect?.left ?? 0)) * msPerPx }
      drag.current = null
      return
    }
    const scrubbing = scrub && !e.shiftKey
    drag.current = {
      x: e.clientX,
      y: e.clientY,
      span,
      msPerPx,
      scrollTop: scrollerRef.current?.scrollTop ?? 0,
      moved: false,
      mouse: !e.pointerType || e.pointerType === 'mouse',
      scrubbing,
    }
    if (scrubbing) onTimePick?.(timeAt(e.clientX))
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId ?? 0)) return
    pointers.current.set(e.pointerId ?? 0, e.clientX)
    const p = pinch.current
    if (p && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()]
      suppressClick.current = true
      commit(zoomTimelineSpan(p.span, p.d0 / Math.max(1, Math.abs(a - b)), p.anchor, minSpan))
      return
    }
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (!d.moved && Math.abs(dx) < DRAG_THRESHOLD_PX && Math.abs(dy) < DRAG_THRESHOLD_PX) return
    if (!d.moved) {
      // Capture only once it is a drag: a captured press would retarget the click off the entry.
      d.moved = true
      capture(e.pointerId)
      setDragging(true)
    }
    if (d.scrubbing) {
      onTimePick?.(timeAt(e.clientX))
      return
    }
    commit(panTimelineSpan(d.span, -dx * d.msPerPx))
    if (d.mouse && scrollerRef.current) scrollerRef.current.scrollTop = d.scrollTop - dy
  }

  const endPointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId ?? 0)
    // A click (no drag) on the plot outside an entry picks a time; in scrub mode the press already did.
    const d = drag.current
    if (e.type === 'pointerup' && d && !d.moved && !d.scrubbing && !pinch.current && onTimePick) {
      const onEntry = (e.target as Element | null)?.closest?.('[data-entry-id]')
      if (!onEntry) onTimePick(timeAt(e.clientX))
    }
    if (drag.current?.moved) suppressClick.current = true
    drag.current = null
    if (pointers.current.size < 2) pinch.current = null
    if (dragging) setDragging(false)
  }

  // ---- render
  const autoMin = minHeight ?? CHROME_H + 2 * LANE_H
  const autoMax = Math.max(autoMin, maxHeight ?? AUTO_MAX_HEIGHT)
  const densityH = hasDensity ? DENSITY_MIN_H : 0
  const resolvedHeight =
    height ??
    (densityOnly
      ? 2 + TOOLBAR_H + DENSITY_MIN_H * 2 + AXIS_H
      : Math.min(autoMax, Math.max(autoMin, empty ? EMPTY_AUTO_HEIGHT : CHROME_H + densityH + laneCount * LANE_H)))
  const rootStyle: CSSProperties = {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    height: resolvedHeight,
    boxSizing: 'border-box',
    background: 'var(--color-bg-secondary)',
    border: '1px solid var(--color-glass-border)',
    borderRadius: 'var(--radius-md)',
    fontFamily: 'var(--font-sans)',
    overflow: 'hidden',
    ...style,
  }

  if (empty) {
    return (
      <div role="region" aria-label={ariaLabel} className="ui-timeline" style={{ ...rootStyle, justifyContent: 'center' }}>
        <EmptyState size="sm" title={emptyTitle} description={emptyDescription} />
      </div>
    )
  }

  const todayX = today == null ? null : xOf(today)
  const todayPx = todayX != null && todayX >= 0 && todayX <= width ? Math.round(todayX) : null
  const todayShown = todayPx != null
  const nowText = nowLabel === undefined ? TODAY_TEXT : nowLabel
  const todayW = nowText ? Math.ceil(measure(nowText.toUpperCase(), TODAY_FONT, 10) + nowLabelExtraPx(nowText)) : 0
  const axis = layoutTimelineAxisLabels(
    ticks.ticks.map((tk) => ({ left: Math.round(xOf(tk.t)) + 4, width: measure(tk.label, TICK_FONT, 11) })),
    todayPx != null && nowText ? { x: todayPx, width: todayW } : null,
    width,
  )
  const hiddenTicks = new Set(axis.hiddenTicks)
  const helpId = `${uid}-help`

  return (
    <div role="region" aria-label={ariaLabel} aria-describedby={helpId} className="ui-timeline" style={rootStyle} onKeyDown={onKeyDown}>
      <div id={helpId} style={SR_ONLY}>
        {densityOnly
          ? 'Left and right arrow keys move the view. Plus and minus zoom.'
          : 'Arrow keys move between entries in time order. Enter selects. Plus and minus zoom.'}
        {scrub ? ' On the timeline itself, left and right arrow keys move the time.' : ''}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-sm)',
          height: TOOLBAR_H,
          flexShrink: 0,
          padding: '0 var(--space-xs) 0 var(--space-sm)',
          borderBottom: '1px solid var(--color-glass-border)',
        }}
      >
        <span
          data-timeline-span=""
          style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
        >
          {formatTimelineSpan(span, ticks.unit)}
        </span>
        <span style={{ display: 'inline-flex', gap: 2, flexShrink: 0 }}>
          <Button size="xs" variant="ghost" icon={<TbZoomIn />} aria-label="Zoom in" title="Zoom in" onClick={() => zoomBy(ZOOM_STEP)} />
          <Button size="xs" variant="ghost" icon={<TbZoomOut />} aria-label="Zoom out" title="Zoom out" onClick={() => zoomBy(1 / ZOOM_STEP)} />
          {!densityOnly && (
            <Button size="xs" variant="ghost" icon={<TbArrowAutofitWidth />} aria-label="Fit all entries" title="Fit all entries" onClick={() => commit(null)} />
          )}
        </span>
      </div>

      <div
        ref={plotRef}
        data-timeline-plot=""
        tabIndex={tabStop == null || scrub ? 0 : undefined}
        role={tabStop == null || scrub ? 'group' : undefined}
        aria-label={densityOnly || scrub ? ariaLabel : tabStop == null ? `${ariaLabel}: no entries in view` : undefined}
        className="ui-timeline__plot"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onClickCapture={(e) => {
          if (suppressClick.current) {
            suppressClick.current = false
            e.stopPropagation()
            e.preventDefault()
          }
        }}
        style={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          cursor: scrub ? 'ew-resize' : dragging ? 'grabbing' : 'grab',
          touchAction: 'pan-y',
          userSelect: 'none',
        }}
      >
        {/* Grid lines and the today line sit behind the lanes, full height. */}
        <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {ticks.ticks.map((tk) => (
            <div
              key={tk.t}
              style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 1, background: 'var(--color-glass-border)', transform: `translateX(${Math.round(xOf(tk.t))}px)` }}
            />
          ))}
          {todayShown && (
            <div
              data-timeline-today=""
              style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 0, borderLeft: '1px dashed var(--color-destructive)', transform: `translateX(${todayPx}px)` }}
            />
          )}
        </div>

        {hasDensity && (
          <DensityBand
            buckets={buckets}
            series={density?.series ?? []}
            xOf={xOf}
            width={width}
            withTime={subDay}
            grow={densityOnly}
          />
        )}

        <div
          aria-hidden
          data-timeline-axis=""
          style={{ position: 'relative', height: AXIS_H, flexShrink: 0, borderBottom: '1px solid var(--color-glass-border)', overflow: 'hidden', pointerEvents: 'none' }}
        >
          {ticks.ticks.map((tk, i) =>
            hiddenTicks.has(i) ? null : (
            <span
              key={tk.t}
              data-tick=""
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                lineHeight: `${AXIS_H}px`,
                fontSize: 11,
                color: 'var(--color-text-secondary)',
                whiteSpace: 'nowrap',
                transform: `translateX(${Math.round(xOf(tk.t)) + 4}px)`,
              }}
            >
              {tk.label}
            </span>
            ),
          )}
          {todayShown && nowText && axis.todayLeft != null && (
            <span
              data-timeline-today-label=""
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: todayW,
                boxSizing: 'border-box',
                textAlign: 'center',
                whiteSpace: 'nowrap',
                lineHeight: `${AXIS_H}px`,
                padding: '0 4px',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--color-destructive)',
                background: 'var(--color-bg-secondary)',
                // Whichever side of the line clears the tick labels (layoutTimelineAxisLabels).
                transform: `translateX(${Math.round(axis.todayLeft)}px)`,
              }}
            >
              {nowText}
            </span>
          )}
        </div>

        {!densityOnly && (
        <div
          ref={scrollerRef}
          className="ui-timeline__lanes"
          onScroll={(e) => {
            // Focus can scroll a clipped box sideways; the axis would no longer line up.
            if (e.currentTarget.scrollLeft !== 0) e.currentTarget.scrollLeft = 0
          }}
          style={{ position: 'relative', flex: 1, minHeight: 0, overflowX: 'hidden', overflowY: 'auto' }}
        >
          <div style={{ position: 'relative', height: LANES_PAD * 2 + laneCount * LANE_H }}>
            {visible.map((it) => {
              const lane = lanes.get(it.id) ?? 0
              const tone = `var(${TONE_TOKEN[it.entry.tone ?? 'accent']})`
              const selected = it.id === selectedId
              const x0 = xOf(it.start)
              const x1 = xOf(it.end)
              const nextStart = nextInLane.get(it.id)
              const roomEnd = Math.min(width, nextStart == null ? Infinity : xOf(nextStart)) - 6
              const y = LANES_PAD + lane * LANE_H + (LANE_H - BAR_H) / 2
              const dates = datesOf(it, subDay)
              const name = it.entry.meta ? `${it.entry.label}, ${dates}, ${it.entry.meta}` : `${it.entry.label}, ${dates}`
              const tip = [it.entry.label, dates, it.entry.meta].filter(Boolean).join('\n')
              const common = {
                ref: (el: HTMLButtonElement | null) => {
                  if (el) entryEls.current.set(it.id, el)
                  else entryEls.current.delete(it.id)
                },
                type: 'button' as const,
                className: 'ui-timeline__entry',
                'data-entry-id': it.id,
                'data-kind': it.point ? 'point' : 'range',
                'data-lane': lane,
                'aria-label': name,
                'aria-pressed': onSelect ? selected : undefined,
                title: tip,
                tabIndex: it.id === tabStop ? 0 : -1,
                onFocus: () => setFocusId(it.id),
                onClick: () => {
                  setFocusId(it.id)
                  onSelect?.(it.id)
                },
              }
              const buttonBase: CSSProperties = {
                position: 'absolute',
                left: 0,
                top: 0,
                height: BAR_H,
                display: 'flex',
                alignItems: 'center',
                padding: 0,
                margin: 0,
                border: 'none',
                background: 'transparent',
                color: 'var(--color-text-primary)',
                font: 'inherit',
                fontSize: 11,
                fontWeight: selected ? 600 : 500,
                cursor: 'inherit',
                borderRadius: 'var(--radius-sm)',
                whiteSpace: 'nowrap',
              }
              const labelStyle = (maxWidth: number): CSSProperties => ({
                display: 'block',
                maxWidth: Math.max(0, maxWidth),
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                minWidth: 0,
              })

              if (it.point) {
                const besideRoom = Math.min(LABEL_MAX_PX, roomEnd - (x0 + MARKER / 2 + 4))
                return (
                  <button
                    key={it.id}
                    {...common}
                    style={{ ...buttonBase, gap: 4, transform: `translate(${Math.round(x0 - MARKER / 2)}px, ${y}px)` }}
                  >
                    <span
                      aria-hidden
                      className="ui-timeline__mark"
                      style={{
                        flexShrink: 0,
                        width: MARKER,
                        height: MARKER,
                        background: tone,
                        borderRadius: 2,
                        transform: `rotate(45deg)${selected ? ' scale(1.3)' : ''}`,
                        boxShadow: selected ? `0 0 0 2px var(--color-bg-secondary), 0 0 0 3px ${tone}` : undefined,
                      }}
                    />
                    {besideRoom >= 20 && (
                      <span className="ui-timeline__label" style={labelStyle(besideRoom)}>
                        {it.entry.label}
                      </span>
                    )}
                  </button>
                )
              }

              // A range: clip the bar to near the view; keep an inside label at the visible part.
              const c0 = Math.max(x0, -CLIP_PAD)
              const c1 = Math.min(x1, width + CLIP_PAD)
              const barW = Math.max(3, c1 - c0)
              const visibleW = Math.min(c1, width) - Math.max(c0, 0)
              // Inside when the bar holds the whole label; a bar cut off by the view keeps its
              // label inside (beside it would be out of view), truncated to the visible part.
              const lw = labelW.get(it.id) ?? 0
              const inside = visibleW >= INSIDE_LABEL_MIN_PX && (x1 - x0 >= lw + INSIDE_LABEL_PAD || visibleW < x1 - x0 - 1)
              const besideRoom = Math.min(LABEL_MAX_PX, roomEnd - (c0 + barW + 4))
              return (
                <button
                  key={it.id}
                  {...common}
                  style={{ ...buttonBase, gap: 4, transform: `translate(${Math.round(c0)}px, ${y}px)` }}
                >
                  <span
                    className="ui-timeline__bar"
                    style={{
                      position: 'relative',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      width: barW,
                      height: BAR_H,
                      boxSizing: 'border-box',
                      background: `color-mix(in srgb, ${tone} ${selected ? 42 : 22}%, transparent)`,
                      // Longhands only: React warns when a shorthand and its longhand change together.
                      borderTop: `1px solid ${selected ? tone : 'transparent'}`,
                      borderRight: `1px solid ${selected ? tone : 'transparent'}`,
                      borderBottom: `1px solid ${selected ? tone : 'transparent'}`,
                      borderLeft: `3px solid ${tone}`,
                      borderRadius: 'var(--radius-sm)',
                      overflow: 'hidden',
                    }}
                  >
                    {inside && (
                      <span
                        className="ui-timeline__label"
                        style={{ ...labelStyle(visibleW - 12), position: 'absolute', left: Math.max(0, -c0) + 5 }}
                      >
                        {it.entry.label}
                      </span>
                    )}
                  </span>
                  {!inside && besideRoom >= 20 && (
                    <span className="ui-timeline__label" style={labelStyle(besideRoom)}>
                      {it.entry.label}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
        )}
      </div>
    </div>
  )
}

/** The density histogram (0.2.37): one stacked bar per bucket in view, each bar's height its share
 *  of the busiest bucket in view; its native tooltip names the span and each series' count. */
function DensityBand({
  buckets,
  series,
  xOf,
  width,
  withTime,
  grow,
}: {
  buckets: DensityBucket[]
  series: TimelineDensitySeries[]
  xOf: (t: number) => number
  width: number
  withTime: boolean
  grow: boolean
}) {
  const inView = buckets.filter((b) => xOf(b.end) >= 0 && xOf(b.start) <= width)
  const max = inView.reduce((m, b) => Math.max(m, b.total), 0)
  const fmt = withTime ? formatTimelineInstant : formatTimelineDate
  return (
    <div
      data-timeline-density=""
      style={{
        position: 'relative',
        flex: grow ? 1 : undefined,
        height: grow ? undefined : DENSITY_MIN_H,
        minHeight: DENSITY_MIN_H,
        flexShrink: 0,
        borderBottom: '1px solid var(--color-glass-border)',
        overflow: 'hidden',
      }}
    >
      {max > 0 &&
        inView.map((b) => {
          if (b.total === 0) return null
          const x0 = Math.max(0, xOf(b.start))
          const x1 = Math.min(width, xOf(b.end))
          const w = Math.max(1, x1 - x0 - (x1 - x0 > 3 ? 1 : 0))
          const tip = [`${fmt(b.start)} to ${fmt(b.end)}`, ...series.map((s, i) => `${b.counts[i] ?? 0} ${s.label.toLowerCase()}`)].join(' · ')
          return (
            <div
              key={b.index}
              data-density-bucket={b.index}
              title={tip}
              style={{
                position: 'absolute',
                left: 0,
                bottom: 0,
                top: DENSITY_TOP_PAD,
                width: w,
                display: 'flex',
                flexDirection: 'column-reverse',
                justifyContent: 'flex-start',
                transform: `translateX(${Math.round(x0)}px)`,
              }}
            >
              {series.map((s, i) => {
                const c = b.counts[i] ?? 0
                if (c === 0) return null
                return (
                  <span
                    key={i}
                    data-density-series={i}
                    style={{
                      display: 'block',
                      flexShrink: 0,
                      height: `${(c / max) * 100}%`,
                      minHeight: 1,
                      background: `color-mix(in srgb, ${s.color ?? `var(${TONE_TOKEN[s.tone ?? 'accent']})`} 70%, transparent)`,
                    }}
                  />
                )
              })}
            </div>
          )
        })}
    </div>
  )
}
