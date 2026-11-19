import {
  memo,
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
  type RefObject,
} from 'react'
import {
  TbArrowAutofitWidth,
  TbPlayerPause,
  TbPlayerPlay,
  TbPlayerTrackNext,
  TbPlayerTrackPrev,
  TbZoomIn,
  TbZoomOut,
} from 'react-icons/tb'
import { Badge } from './Badge.js'
import { Button } from './Button.js'
import { EmptyState } from './EmptyState.js'
import { InfoTip } from './InfoTip.js'
import { Input } from './Input.js'
import { Popover } from './Popover.js'
import { Select } from './Select.js'
import { UnitSelect } from './UnitSelect.js'
import type { TimelineTone } from './Timeline.js'
import {
  estimateTimelineLabelWidth,
  formatTimelineInstant,
  panTimelineSpan,
  timelineTicks,
  zoomTimelineSpan,
} from './Timeline.helpers.js'
import {
  DEFAULT_STEP_MS,
  PLAYBACK_MIN_SELECTION_MS,
  STEP_PRESETS_MS,
  clampSelection,
  formatStep,
  moveSelection,
  readTimelineHeight,
  writeTimelineHeight,
  resizeSelection,
  scrubSelection,
  stepFromUnit,
  type PlaybackSpan,
} from './PlaybackTimeline.helpers.js'
import type { TimeUnit } from '../units/units.js'

/**
 * PlaybackTimeline (0.2.46, operator-approved 2026-11-18, kineticlogic-io/OpenStare#532) — a time
 * axis for playing data back: one named **swim lane** per series showing when it has data, a
 * resizable **range window** that says what is shown, a **playhead** at the window's end, and
 * **playback controls** (step back, play/pause, step forward, step size).
 *
 * - **Lanes**: in the order given, each with its label in a gutter. `density` draws the series'
 *   counts in equal buckets (bars, normalised to the lane's busiest bucket in view); `instants`
 *   draws each real event as a mark (sparse data such as tracked events). A lane may have both.
 *   `loading` and `error` lanes say so.
 * - **Range window**: drag its body to move it, its handles to resize it. Press anywhere else on the
 *   plot to **scrub**: the window keeps its width and its end follows the pointer. Changes are
 *   reported continuously (`onSelectionChange(sel, { final: false })`) and once more on release
 *   (`final: true`), so a map can follow every move. The window stays inside `extent`.
 * - **View**: the zoomed part of the extent — wheel or pinch to zoom about the pointer, horizontal
 *   wheel or Shift+drag to pan, and zoom-out / zoom-in / fit-to-extent buttons. Uncontrolled
 *   (following the extent until the user zooms) or controlled (`view` + `onViewChange`).
 * - **Playback** is controlled and owns no timer: `playing` / `onPlayingChange`, `onStep(±1)`,
 *   `step` / `onStepChange` from `stepOptions` (default 1 s to 1 day) or **Custom…** (a value and a
 *   time unit). The caller's clock advances the window with `advanceSelection`; the operator's rule
 *   is one step per second while playing.
 * - **Live** (0.2.47): `live` shows a LIVE badge beside the readout (the caller decides: its range
 *   reaches now and live data is shown), announced politely to screen readers.
 * - **Resizable height** (0.2.48, operator 2026-11-18): `resizable` adds a drag handle on the top
 *   edge (the timeline sits at the bottom of a page, so dragging up makes it taller), also moved by
 *   Up/Down arrows. With `storageKey` the height persists in localStorage, the same opt-in-by-key
 *   rule as `SideNav`'s width. The drag is clamped to `minHeight`–`maxHeight` (default 600).
 * - **Toolbar** (0.2.48): the step size on the left with an InfoTip, the playback buttons centred,
 *   the readout, LIVE and zoom on the right.
 * - **Keyboard**: the window body and its handles are focusable — Left/Right move or resize by one
 *   step (Shift: ten); Space plays/pauses from the plot, the window or a handle; `+`/`-` zoom.
 *
 * Times are epoch ms in and out, shown in UTC. Data comes in through props only; design tokens
 * only, so it follows the dark and light themes. Lane marks are redrawn only when the view or the
 * lane's data changes — never while the window moves.
 */
export interface PlaybackLaneDensity {
  /** The buckets' span, epoch ms. */
  start: number
  end: number
  /** One count per equal bucket; a missing or non-finite count is 0. */
  counts: number[]
}

export interface PlaybackLane {
  id: string
  label: string
  /** A colour of the caller's own (any CSS colour, e.g. a layer's legend colour); overrides `tone`. */
  color?: string
  tone?: TimelineTone
  density?: PlaybackLaneDensity
  /** Real event instants, epoch ms, drawn one mark each. */
  instants?: readonly number[]
  /** The lane's data is on its way. */
  loading?: boolean
  /** The lane's data could not be read; the message is the lane's tooltip. */
  error?: string | null
}

export interface PlaybackTimelineProps {
  /** The outer bounds, epoch ms. The view and the window stay inside them. `null`: the empty state. */
  extent: PlaybackSpan | null
  lanes: PlaybackLane[]
  /** The range window, epoch ms; its end is the playhead. */
  selection: PlaybackSpan
  onSelectionChange: (selection: PlaybackSpan, info: { final: boolean }) => void
  /** Controlled view; pair with `onViewChange`. Without it the view follows the extent until zoomed. */
  view?: PlaybackSpan
  onViewChange?: (view: PlaybackSpan) => void
  playing: boolean
  onPlayingChange: (playing: boolean) => void
  /** Step back (-1) or forward (1) by `step`. */
  onStep: (dir: 1 | -1) => void
  /** The step, ms. */
  step?: number
  onStepChange?: (stepMs: number) => void
  /** The step presets, ms (default 1 s, 10 s, 1 min, 5 min, 15 min, 1 h, 6 h, 1 day). */
  stepOptions?: readonly number[]
  /** The narrowest window, ms (default one second). */
  minSelectionMs?: number
  /** The range reaches now and live data is shown (0.2.47): a LIVE badge beside the readout,
   *  announced politely to screen readers. */
  live?: boolean
  'aria-label': string
  /** A drag handle on the top edge resizes the height (0.2.48); Up/Down arrows on it too. */
  resizable?: boolean
  /** localStorage key for the user-resized height (0.2.48). Omit to keep it for the session only. */
  storageKey?: string
  /** Total height in px. Without it the timeline is as tall as its lanes, between `minHeight` and
   *  `maxHeight`; more lanes scroll. */
  height?: number
  minHeight?: number
  maxHeight?: number
  /** Width of the lane-label gutter in px (default 150). */
  labelWidth?: number
  emptyTitle?: ReactNode
  emptyDescription?: ReactNode
  /** Shown in the plot when there is an extent but no lanes. */
  noLanesText?: string
  style?: CSSProperties
}

const TONE_TOKEN: Record<TimelineTone, string> = {
  accent: '--color-accent',
  info: '--status-info',
  warning: '--status-warning',
  neutral: '--text-muted',
}

const FALLBACK_WIDTH = 800
const TOOLBAR_H = 36
const AXIS_H = 22
const LANE_H = 24
const MARK = 7
const HANDLE_HIT = 10
const GRIP_W = 8
const DRAG_THRESHOLD_PX = 3
const ZOOM_STEP = 0.5
const AUTO_MAX = 280
/** The tallest a resizable timeline is dragged to, unless `maxHeight` says otherwise. */
const RESIZE_MAX = 600
/** How far one Up/Down press on the resize handle moves the height: one lane. */
const RESIZE_KEY_PX = 24
const RESIZE_HIT = 6
const CUSTOM = '__custom'
/** The narrowest view: one second. */
const MIN_VIEW_MS = 1000

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

const laneColor = (lane: PlaybackLane) => lane.color ?? `var(${TONE_TOKEN[lane.tone ?? 'accent']})`

/** An extent at least a second long: a single instant (one observation) widens about itself. */
function usableExtent(e: PlaybackSpan | null): PlaybackSpan | null {
  if (!e || !Number.isFinite(e.start) || !Number.isFinite(e.end)) return null
  const start = Math.min(e.start, e.end)
  const end = Math.max(e.start, e.end)
  if (end - start >= MIN_VIEW_MS) return { start, end }
  const mid = (start + end) / 2
  return { start: Math.floor(mid - MIN_VIEW_MS / 2), end: Math.floor(mid - MIN_VIEW_MS / 2) + MIN_VIEW_MS }
}

/** The view inside the extent: never wider, never narrower than a second, shifted back inside. */
function clampView(v: PlaybackSpan, extent: PlaybackSpan): PlaybackSpan {
  const extentLen = extent.end - extent.start
  const len = Math.min(extentLen, Math.max(Math.min(MIN_VIEW_MS, extentLen), v.end - v.start))
  let start = v.start
  if (start < extent.start) start = extent.start
  if (start + len > extent.end) start = extent.end - len
  return { start, end: start + len }
}

type Drag =
  | { kind: 'move' | 'start' | 'end' | 'scrub'; x: number; sel: PlaybackSpan; msPerPx: number; moved: boolean; last: PlaybackSpan }
  | { kind: 'pan'; x: number; view: PlaybackSpan; msPerPx: number; moved: boolean }

export function PlaybackTimeline({
  extent: extentProp,
  lanes,
  selection,
  onSelectionChange,
  view: controlledView,
  onViewChange,
  playing,
  onPlayingChange,
  onStep,
  step = DEFAULT_STEP_MS,
  onStepChange,
  stepOptions = STEP_PRESETS_MS,
  minSelectionMs = PLAYBACK_MIN_SELECTION_MS,
  live = false,
  'aria-label': ariaLabel,
  resizable = false,
  storageKey,
  height,
  minHeight,
  maxHeight,
  labelWidth = 150,
  emptyTitle = 'No time range to show',
  emptyDescription,
  noLanesText = 'Nothing in time to show',
  style,
}: PlaybackTimelineProps) {
  const uid = useId()
  const extent = usableExtent(extentProp)
  const plotRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const lanesRef = useRef<HTMLDivElement>(null)
  const stepRef = useRef<HTMLSpanElement>(null)
  const drag = useRef<Drag | null>(null)
  const [width, setWidth] = useState(FALLBACK_WIDTH)
  const [dragging, setDragging] = useState<Drag['kind'] | null>(null)
  const [customOpen, setCustomOpen] = useState(false)

  // ---- the view: controlled, else the user's, else the whole extent
  const [userView, setUserView] = useState<PlaybackSpan | null>(null)
  const rawView = controlledView ?? userView ?? extent
  const view = extent && rawView ? clampView(rawView, extent) : null
  const msPerPx = view ? (view.end - view.start) / width : 1

  const commitView = (next: PlaybackSpan | null) => {
    if (!extent) return
    const target = next ? clampView(next, extent) : extent
    if (controlledView === undefined) setUserView(next ? target : null)
    onViewChange?.(target)
  }

  const sel = extent ? clampSelection(selection, extent, minSelectionMs) : selection

  // Handlers attached outside React (wheel) read the latest values through this ref.
  const latest = useRef({ view, msPerPx, commitView })
  useLayoutEffect(() => {
    latest.current = { view, msPerPx, commitView }
  })

  // ---- measure the track (the plot without its gutter and scrollbar)
  const hasExtent = extent !== null
  useEffect(() => {
    const el = trackRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.floor(entry.contentRect.width)
      if (w > 0) setWidth(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [hasExtent])

  // ---- wheel: zoom about the pointer (pinch arrives as ctrl+wheel); sideways or Shift pans
  useEffect(() => {
    const el = plotRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      const { view: v, msPerPx: mpp, commitView: c } = latest.current
      if (!v) return
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1
      const dx = e.deltaX * unit
      const dy = e.deltaY * unit
      if (dx === 0 && dy === 0) return
      const left = trackRef.current?.getBoundingClientRect().left ?? 0
      const vertical = Math.abs(dy) >= Math.abs(dx) && !e.shiftKey
      // Over the label gutter, and over lanes that overflow, a plain vertical wheel scrolls them;
      // a pinch (ctrl+wheel) still zooms.
      if (vertical && !e.ctrlKey) {
        const lanesEl = lanesRef.current
        const overLanes = lanesEl?.contains(e.target as Node) ?? false
        if (e.clientX < left || (overLanes && lanesEl!.scrollHeight > lanesEl!.clientHeight)) return
      }
      e.preventDefault()
      if (!vertical) {
        c(panTimelineSpan(v, (Math.abs(dx) > Math.abs(dy) ? dx : dy) * mpp))
        return
      }
      const anchor = v.start + Math.max(0, e.clientX - left) * mpp
      c(zoomTimelineSpan(v, Math.exp(dy * (e.ctrlKey ? 0.01 : 0.002)), anchor, MIN_VIEW_MS))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [hasExtent])

  const viewStart = view?.start ?? null
  const viewEnd = view?.end ?? null
  const ticks = useMemo(
    () =>
      viewStart !== null && viewEnd !== null
        ? timelineTicks({ start: viewStart, end: viewEnd }, width, 90, true)
        : { ticks: [], unit: 'day' as const },
    [viewStart, viewEnd, width],
  )

  // ---- step options: the presets, the current step when it is not one, then Custom…
  const stepSelectOptions = useMemo(() => {
    const values = stepOptions.includes(step) ? [...stepOptions] : [...stepOptions, step].sort((a, b) => a - b)
    return [...values.map((v) => ({ value: String(v), label: formatStep(v) })), { value: CUSTOM, label: 'Custom…' }]
  }, [stepOptions, step])

  // ---- the user-resized height (resizable only), read once from storage
  const autoMin = minHeight ?? TOOLBAR_H + AXIS_H + 2 * LANE_H + 2
  const resizeMax = Math.max(autoMin, maxHeight ?? RESIZE_MAX)
  const clampH = (h: number) => Math.round(Math.min(resizeMax, Math.max(autoMin, h)))
  const [userHeight, setUserHeight] = useState<number | null>(() => (resizable ? readTimelineHeight(storageKey) : null))
  const [resizeHover, setResizeHover] = useState(false)
  const resizeRef = useRef<{ y: number; h: number } | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const commitHeight = (h: number) => {
    const next = clampH(h)
    setUserHeight(next)
    writeTimelineHeight(storageKey, next)
  }

  // ---- render
  const autoMax = Math.max(autoMin, maxHeight ?? AUTO_MAX)
  const autoHeight = Math.min(autoMax, Math.max(autoMin, TOOLBAR_H + AXIS_H + Math.max(1, lanes.length) * LANE_H + 2))
  const resolvedHeight = height ?? (resizable && userHeight !== null ? clampH(userHeight) : autoHeight)
  const resizeHandle = resizable && height === undefined ? (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize timeline"
      aria-valuemin={autoMin}
      aria-valuemax={resizeMax}
      aria-valuenow={resolvedHeight}
      tabIndex={0}
      data-pt-resize=""
      onPointerDown={(e) => {
        resizeRef.current = { y: e.clientY, h: rootRef.current?.getBoundingClientRect().height ?? resolvedHeight }
        try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* noop */ }
        e.preventDefault()
        e.stopPropagation()
      }}
      onPointerMove={(e) => {
        const r = resizeRef.current
        if (r) setUserHeight(clampH(r.h + (r.y - e.clientY)))
      }}
      onPointerUp={(e) => {
        if (!resizeRef.current) return
        resizeRef.current = null
        try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* noop */ }
        commitHeight(rootRef.current?.getBoundingClientRect().height ?? resolvedHeight)
      }}
      onPointerCancel={() => { resizeRef.current = null }}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
        e.preventDefault()
        e.stopPropagation()
        commitHeight(resolvedHeight + (e.key === 'ArrowUp' ? 1 : -1) * RESIZE_KEY_PX * (e.shiftKey ? 4 : 1))
      }}
      onPointerEnter={() => setResizeHover(true)}
      onPointerLeave={() => setResizeHover(false)}
      onFocus={() => setResizeHover(true)}
      onBlur={() => setResizeHover(false)}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: RESIZE_HIT,
        zIndex: 2,
        cursor: 'ns-resize',
        touchAction: 'none',
        outline: 'none',
        borderTop: `2px solid ${resizeHover ? 'var(--color-accent)' : 'transparent'}`,
        boxSizing: 'border-box',
      }}
    />
  ) : null
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

  if (!extent || !view) {
    return (
      <div ref={rootRef} role="region" aria-label={ariaLabel} className="ui-playback-timeline" style={{ ...rootStyle, justifyContent: 'center' }}>
        {resizeHandle}
        <EmptyState size="sm" title={emptyTitle} description={emptyDescription} />
      </div>
    )
  }

  const xOf = (t: number) => (t - view.start) / msPerPx
  const timeAtClient = (clientX: number) => {
    const left = trackRef.current?.getBoundingClientRect().left ?? labelWidth
    return Math.round(view.start + (clientX - left) * msPerPx)
  }
  const atStart = sel.start <= extent.start
  const atEnd = sel.end >= extent.end

  const emit = (next: PlaybackSpan, final: boolean) => {
    const d = drag.current
    if (d && d.kind !== 'pan') d.last = next
    onSelectionChange(next, { final })
  }

  // ---- pointer: the window's body moves it, its handles resize it, the plot scrubs; Shift pans
  const capture = (pointerId: number) => {
    try {
      plotRef.current?.setPointerCapture?.(pointerId)
    } catch {
      /* not capturable (a synthetic event, or the pointer is already gone) */
    }
  }
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const target = e.target as Element | null
    const part = target?.closest?.('[data-pt-part]')?.getAttribute('data-pt-part') ?? null
    if (part !== 'body' && part !== 'start' && part !== 'end') {
      // The plot only: not the gutter, not the lanes' scrollbar.
      const rect = trackRef.current?.getBoundingClientRect()
      const left = rect?.left ?? labelWidth
      if (e.clientX < left || e.clientX > left + width) return
    }
    if (e.shiftKey && part === null) {
      drag.current = { kind: 'pan', x: e.clientX, view, msPerPx, moved: false }
      return
    }
    const kind = part === 'body' ? 'move' : part === 'start' ? 'start' : part === 'end' ? 'end' : 'scrub'
    drag.current = { kind, x: e.clientX, sel, msPerPx, moved: kind === 'scrub', last: sel }
    if (kind === 'scrub') {
      capture(e.pointerId)
      setDragging('scrub')
      emit(scrubSelection(sel, timeAtClient(e.clientX), extent), false)
    }
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x
    if (!d.moved && Math.abs(dx) < DRAG_THRESHOLD_PX) return
    if (!d.moved) {
      d.moved = true
      capture(e.pointerId)
      setDragging(d.kind)
    }
    if (d.kind === 'pan') {
      commitView(panTimelineSpan(d.view, -dx * d.msPerPx))
      return
    }
    const deltaMs = Math.round(dx * d.msPerPx)
    if (d.kind === 'move') emit(moveSelection(d.sel, deltaMs, extent), false)
    else if (d.kind === 'start') emit(resizeSelection(d.sel, 'start', d.sel.start + deltaMs, extent, minSelectionMs), false)
    else if (d.kind === 'end') emit(resizeSelection(d.sel, 'end', d.sel.end + deltaMs, extent, minSelectionMs), false)
    else emit(scrubSelection(d.sel, timeAtClient(e.clientX), extent), false)
  }

  const endPointer = () => {
    const d = drag.current
    drag.current = null
    if (dragging) setDragging(null)
    if (d && d.kind !== 'pan' && d.moved) onSelectionChange(d.last, { final: true })
  }

  // ---- keyboard
  const zoomBy = (factor: number) => commitView(zoomTimelineSpan(view, factor, (sel.start + sel.end) / 2, MIN_VIEW_MS))
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.altKey || e.metaKey || e.ctrlKey) return
    const target = e.target as HTMLElement
    const part = target.dataset?.ptPart
    const onPlot = part !== undefined || target === plotRef.current
    if (!onPlot) return
    if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault()
      if (playing || !atEnd) onPlayingChange(!playing)
      return
    }
    if (e.key === '+' || e.key === '=' || e.key === 'Add') {
      e.preventDefault()
      zoomBy(ZOOM_STEP)
      return
    }
    if (e.key === '-' || e.key === '_' || e.key === 'Subtract') {
      e.preventDefault()
      zoomBy(1 / ZOOM_STEP)
      return
    }
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const deltaMs = (e.key === 'ArrowLeft' ? -1 : 1) * step * (e.shiftKey ? 10 : 1)
    if (part === 'start') onSelectionChange(resizeSelection(sel, 'start', sel.start + deltaMs, extent, minSelectionMs), { final: true })
    else if (part === 'end') onSelectionChange(resizeSelection(sel, 'end', sel.end + deltaMs, extent, minSelectionMs), { final: true })
    else if (part === 'body') onSelectionChange(moveSelection(sel, deltaMs, extent), { final: true })
    else commitView(panTimelineSpan(view, deltaMs))
  }

  // ---- the axis labels, thinned where they would collide: a label that would run into the last
  // one shown, or off the track, is left out
  const hiddenTicks = new Set<number>()
  let shownRight = -Infinity
  ticks.ticks.forEach((tk, i) => {
    const left = Math.round(xOf(tk.t)) + 4
    const right = left + estimateTimelineLabelWidth(tk.label, 11)
    if (left < shownRight + 8 || right > width) hiddenTicks.add(i)
    else shownRight = right
  })

  // ---- the window on screen, clipped to the track
  const sx0 = xOf(sel.start)
  const sx1 = xOf(sel.end)
  const bodyLeft = Math.max(-HANDLE_HIT, Math.min(width + HANDLE_HIT, sx0))
  const bodyRight = Math.max(-HANDLE_HIT, Math.min(width + HANDLE_HIT, sx1))
  const startShown = sx0 >= 0 && sx0 <= width
  const endShown = sx1 >= 0 && sx1 <= width
  const helpId = `${uid}-help`
  const extentLen = extent.end - extent.start

  return (
    <div ref={rootRef} role="region" aria-label={ariaLabel} aria-describedby={helpId} className="ui-playback-timeline" style={rootStyle} onKeyDown={onKeyDown}>
      {resizeHandle}
      <div id={helpId} style={SR_ONLY}>
        Space plays and pauses. On the time range or its handles, left and right arrow keys move or resize it by one step, ten
        with Shift. Plus and minus zoom.
      </div>

      {/* ---- toolbar: the step size on the left, playback centred, the window as text and zoom on the right */}
      <div
        data-pt-toolbar=""
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
          alignItems: 'center',
          gap: 'var(--space-sm)',
          height: TOOLBAR_H,
          flexShrink: 0,
          padding: '0 var(--space-xs)',
          borderBottom: '1px solid var(--color-glass-border)',
        }}
      >
        <span data-pt-step="" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-xs)', minWidth: 0 }}>
          <span ref={stepRef} style={{ flexShrink: 0, width: 104 }}>
            <Select
              options={stepSelectOptions}
              value={String(step)}
              ariaLabel="Step size"
              title="Step size"
              disabled={!onStepChange}
              onChange={(v) => {
                if (v === CUSTOM) setCustomOpen(true)
                else if (v !== null) onStepChange?.(Number(v))
              }}
            />
          </span>
          <InfoTip label="Step size" width={260}>
            This controls playback speed: how far the time range moves with each step. Playing moves one step every second.
          </InfoTip>
        </span>
        <span data-pt-playback="" style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
          <Button size="xs" variant="ghost" icon={<TbPlayerTrackPrev />} aria-label="Step back" title="Step back" disabled={atStart} onClick={() => onStep(-1)} />
          <Button
            size="xs"
            variant="ghost"
            icon={playing ? <TbPlayerPause /> : <TbPlayerPlay />}
            aria-label={playing ? 'Pause' : 'Play'}
            title={playing ? 'Pause' : 'Play'}
            disabled={!playing && atEnd}
            onClick={() => onPlayingChange(!playing)}
          />
          <Button size="xs" variant="ghost" icon={<TbPlayerTrackNext />} aria-label="Step forward" title="Step forward" disabled={atEnd} onClick={() => onStep(1)} />
        </span>
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 'var(--space-sm)', minWidth: 0 }}>
          <span
            data-pt-readout=""
            style={{
              minWidth: 0,
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--color-text-secondary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {formatTimelineInstant(sel.start)} – {formatTimelineInstant(sel.end)} UTC
          </span>
          {live && (
            <span data-pt-live="" aria-hidden style={{ flexShrink: 0, display: 'inline-flex' }}>
              <Badge color="brand" outline uppercase size="sm">Live</Badge>
            </span>
          )}
          <span role="status" aria-live="polite" style={SR_ONLY}>
            {live ? 'Live' : ''}
          </span>
          <span style={{ display: 'inline-flex', gap: 2, flexShrink: 0 }}>
            <Button size="xs" variant="ghost" icon={<TbZoomOut />} aria-label="Zoom out" title="Zoom out" onClick={() => zoomBy(1 / ZOOM_STEP)} />
            <Button size="xs" variant="ghost" icon={<TbZoomIn />} aria-label="Zoom in" title="Zoom in" onClick={() => zoomBy(ZOOM_STEP)} />
            <Button size="xs" variant="ghost" icon={<TbArrowAutofitWidth />} aria-label="Fit to extent" title="Fit to extent" onClick={() => commitView(null)} />
          </span>
        </span>
      </div>

      <CustomStepPopover
        open={customOpen}
        anchorRef={stepRef}
        maxMs={extentLen}
        onClose={() => setCustomOpen(false)}
        onApply={(ms) => {
          setCustomOpen(false)
          onStepChange?.(ms)
        }}
      />

      {/* ---- plot: axis, lanes, and the window over both */}
      <div
        ref={plotRef}
        data-pt-plot=""
        tabIndex={0}
        role="group"
        aria-label={`${ariaLabel}: time axis`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        style={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          userSelect: 'none',
          touchAction: 'pan-y',
          cursor: dragging === 'pan' ? 'grabbing' : 'ew-resize',
          outline: 'none',
        }}
      >
        <div style={{ display: 'flex', height: AXIS_H, flexShrink: 0, borderBottom: '1px solid var(--color-glass-border)', overflowY: 'hidden', scrollbarGutter: 'stable' }}>
          <div style={{ width: labelWidth, flexShrink: 0, borderRight: '1px solid var(--color-glass-border)' }} />
          <div ref={trackRef} data-pt-axis="" aria-hidden style={{ position: 'relative', flex: 1, minWidth: 0, overflow: 'hidden', pointerEvents: 'none' }}>
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
          </div>
        </div>

        <div ref={lanesRef} style={{ position: 'relative', flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', scrollbarGutter: 'stable' }}>
          {lanes.length === 0 ? (
            <div style={{ display: 'flex', height: LANE_H }}>
              <div style={{ width: labelWidth, flexShrink: 0, borderRight: '1px solid var(--color-glass-border)' }} />
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', paddingLeft: 'var(--space-sm)', fontSize: 11, color: 'var(--text-muted)' }}>
                {noLanesText}
              </div>
            </div>
          ) : (
            lanes.map((lane) => (
              <div key={lane.id} data-pt-lane={lane.id} style={{ display: 'flex', height: LANE_H, borderBottom: '1px solid var(--color-glass-border)' }}>
                <div
                  title={lane.error ? `${lane.label}: ${lane.error}` : lane.label}
                  style={{
                    width: labelWidth,
                    flexShrink: 0,
                    boxSizing: 'border-box',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '0 var(--space-sm)',
                    borderRight: '1px solid var(--color-glass-border)',
                    fontSize: 11,
                    color: 'var(--color-text-primary)',
                    cursor: 'default',
                  }}
                >
                  <span aria-hidden style={{ flexShrink: 0, width: 8, height: 8, borderRadius: 2, background: laneColor(lane) }} />
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lane.label}</span>
                </div>
                <LaneTrack lane={lane} viewStart={view.start} viewEnd={view.end} width={width} />
              </div>
            ))
          )}
        </div>

        {/* ---- the window, its handles and the playhead, over the axis and lanes */}
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: labelWidth, width, pointerEvents: 'none', overflow: 'hidden' }}>
          {bodyRight > bodyLeft && (
            <div
              data-pt-part="body"
              role="group"
              tabIndex={0}
              aria-label={`Time range, ${formatTimelineInstant(sel.start)} to ${formatTimelineInstant(sel.end)} UTC`}
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                width: Math.max(1, bodyRight - bodyLeft),
                transform: `translateX(${Math.round(bodyLeft)}px)`,
                background: 'color-mix(in srgb, var(--color-accent) 14%, transparent)',
                borderTop: '2px solid var(--color-accent)',
                boxSizing: 'border-box',
                pointerEvents: 'auto',
                cursor: dragging === 'move' ? 'grabbing' : 'grab',
                outline: 'none',
              }}
            />
          )}
          {startShown && (
            <Handle
              edge="start"
              x={sx0}
              value={sel.start}
              extent={extent}
              active={dragging === 'start'}
            />
          )}
          {endShown && (
            <Handle
              edge="end"
              x={sx1}
              value={sel.end}
              extent={extent}
              active={dragging === 'end' || dragging === 'scrub'}
            />
          )}
        </div>
      </div>
    </div>
  )
}

/** A resize handle. The end handle is the playhead: a full-height line with a grip on the axis. */
function Handle({ edge, x, value, extent, active }: { edge: 'start' | 'end'; x: number; value: number; extent: PlaybackSpan; active: boolean }) {
  const playhead = edge === 'end'
  return (
    <div
      data-pt-part={edge}
      role="slider"
      tabIndex={0}
      aria-label={playhead ? 'Playhead (end of the time range)' : 'Start of the time range'}
      aria-valuemin={extent.start}
      aria-valuemax={extent.end}
      aria-valuenow={value}
      aria-valuetext={`${formatTimelineInstant(value)} UTC`}
      aria-orientation="horizontal"
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        width: HANDLE_HIT,
        transform: `translateX(${Math.round(x - HANDLE_HIT / 2)}px)`,
        pointerEvents: 'auto',
        cursor: 'ew-resize',
        outline: 'none',
      }}
    >
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: HANDLE_HIT / 2 - (playhead ? 1 : 0.5),
          width: playhead ? 2 : 1,
          background: 'var(--color-accent)',
        }}
      />
      <span
        aria-hidden
        className="ui-playback-timeline__grip"
        style={{
          position: 'absolute',
          top: 3,
          left: (HANDLE_HIT - GRIP_W) / 2,
          width: GRIP_W,
          height: AXIS_H - 6,
          borderRadius: 2,
          background: 'var(--color-accent)',
          boxShadow: '0 0 0 1px var(--color-bg-secondary)',
          transform: active ? 'scale(1.15)' : undefined,
          transition: 'transform 120ms ease-out',
        }}
      />
    </div>
  )
}

/**
 * One lane's marks: density bars and event instants as a single SVG with one path each. Memoised
 * on the lane's contents and the view (`LaneTrack`), so moving the window never redraws it.
 */
const LaneTrack = memo(LaneTrackImpl, (a, b) =>
  a.viewStart === b.viewStart &&
  a.viewEnd === b.viewEnd &&
  a.width === b.width &&
  sameLane(a.lane, b.lane),
)

/** Lanes that draw the same: callers may rebuild lane objects each render. */
function sameLane(a: PlaybackLane, b: PlaybackLane): boolean {
  if (a === b) return true
  if (a.id !== b.id || a.color !== b.color || a.tone !== b.tone || a.loading !== b.loading || a.error !== b.error) return false
  if (!sameNumbers(a.instants, b.instants)) return false
  const da = a.density
  const db = b.density
  if (da === db) return true
  if (!da || !db) return false
  return da.start === db.start && da.end === db.end && sameNumbers(da.counts, db.counts)
}

function sameNumbers(a: readonly number[] | undefined, b: readonly number[] | undefined): boolean {
  if (a === b) return true
  if (!a || !b || a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

function LaneTrackImpl({ lane, viewStart, viewEnd, width }: { lane: PlaybackLane; viewStart: number; viewEnd: number; width: number }) {
  const color = laneColor(lane)
  const mpp = (viewEnd - viewStart) / width
  const xOf = (t: number) => (t - viewStart) / mpp
  const innerH = LANE_H - 1

  const bars = useMemo(() => {
    const d = lane.density
    if (!d || !(d.end > d.start) || d.counts.length === 0) return ''
    const w = (d.end - d.start) / d.counts.length
    let first = Math.max(0, Math.floor((viewStart - d.start) / w))
    // The bucket holding the view's end (one that starts exactly there is out of view).
    const last = Math.min(d.counts.length - 1, Math.ceil((viewEnd - d.start) / w) - 1)
    let max = 0
    for (let i = first; i <= last; i++) {
      const c = d.counts[i]
      if (typeof c === 'number' && Number.isFinite(c) && c > max) max = c
    }
    if (max <= 0) return ''
    let p = ''
    for (; first <= last; first++) {
      const c = d.counts[first]
      if (!(typeof c === 'number' && Number.isFinite(c) && c > 0)) continue
      const x0 = Math.max(0, xOf(d.start + first * w))
      const x1 = Math.min(width, xOf(d.start + (first + 1) * w))
      const bw = Math.max(1, x1 - x0 - (x1 - x0 > 3 ? 1 : 0))
      const h = Math.max(1.5, (c / max) * (innerH - 4))
      p += `M${x0.toFixed(1)} ${(innerH - h).toFixed(1)}h${bw.toFixed(1)}V${innerH}h${(-bw).toFixed(1)}Z`
    }
    return p
  }, [lane.density, viewStart, viewEnd, width]) // eslint-disable-line react-hooks/exhaustive-deps

  const marks = useMemo(() => {
    const ts = lane.instants
    if (!ts || ts.length === 0) return ''
    const cy = innerH / 2
    const r = MARK / 2
    let p = ''
    let lastX = -Infinity
    for (const t of ts) {
      if (t < viewStart || t > viewEnd) continue
      const x = xOf(t)
      // Marks closer than a pixel draw once: the lane looks the same, the path stays small.
      if (Math.abs(x - lastX) < 1) continue
      lastX = x
      p += `M${x.toFixed(1)} ${cy - r}l${r} ${r}l${-r} ${r}l${-r} ${-r}Z`
    }
    return p
  }, [lane.instants, viewStart, viewEnd, width]) // eslint-disable-line react-hooks/exhaustive-deps

  const status = lane.error ? 'Unavailable' : lane.loading ? 'Loading…' : null
  return (
    <div data-pt-track="" style={{ position: 'relative', flex: 1, minWidth: 0, overflow: 'hidden' }}>
      {status ? (
        <span
          data-pt-status=""
          title={lane.error ?? undefined}
          style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', paddingLeft: 'var(--space-sm)', fontSize: 11, color: 'var(--text-muted)' }}
        >
          {status}
        </span>
      ) : (
        <svg aria-hidden width={width} height={innerH} style={{ display: 'block', overflow: 'hidden' }}>
          {bars && <path data-pt-density="" d={bars} style={{ fill: `color-mix(in srgb, ${color} 55%, transparent)` }} />}
          {marks && <path data-pt-instants="" d={marks} style={{ fill: color, stroke: 'var(--color-bg-secondary)', strokeWidth: 1 }} />}
        </svg>
      )}
    </div>
  )
}

/** Custom… step: a value and a time unit, applied when it is a positive duration within the extent. */
function CustomStepPopover({
  open,
  anchorRef,
  maxMs,
  onClose,
  onApply,
}: {
  open: boolean
  anchorRef: RefObject<HTMLElement | null>
  maxMs: number
  onClose: () => void
  onApply: (ms: number) => void
}) {
  const [value, setValue] = useState('30')
  const [unit, setUnit] = useState<TimeUnit>('min')
  const ms = stepFromUnit(Number(value), unit)
  const error = value.trim() === '' ? null : ms === null ? 'Enter a duration above zero.' : ms > maxMs ? 'Longer than the whole time range.' : null
  const valid = ms !== null && ms <= maxMs
  return (
    <Popover open={open} onClose={onClose} anchorRef={anchorRef} ariaLabel="Custom step size" minWidth={220} style={{ padding: 'var(--space-sm)' }}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (valid) onApply(ms)
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}
      >
        <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
          <Input
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            aria-label="Step value"
            value={value}
            error={error !== null}
            onChange={(e) => setValue(e.target.value)}
            style={{ width: 80, height: 28, fontSize: 12 }}
          />
          <UnitSelect family="time" value={unit} onChange={(u) => setUnit(u as TimeUnit)} ariaLabel="Step unit" style={{ flex: 1 }} />
        </div>
        {error && (
          <span role="alert" style={{ fontSize: 11, color: 'var(--color-destructive)' }}>
            {error}
          </span>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-xs)' }}>
          <Button size="sm" variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" type="submit" disabled={!valid}>
            Apply
          </Button>
        </div>
      </form>
    </Popover>
  )
}
