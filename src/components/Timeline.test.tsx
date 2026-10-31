// @vitest-environment jsdom
/**
 * Timeline tests — React 19 createRoot + act + native DOM events (project convention).
 * jsdom does no layout, so the plot keeps its 800 px fallback width throughout.
 */
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { Timeline } from './Timeline.js'
import type { TimelineEntry, TimelineProps } from './Timeline.js'
import {
  TIMELINE_DAY_MS,
  TIMELINE_MIN_SPAN_FLOOR_MS,
  TIMELINE_MIN_SPAN_MS,
  clampTimelineSpan,
  estimateTimelineLabelWidth,
  fitTimelineSpan,
  formatTimelineSpan,
  layoutTimelineAxisLabels,
  packTimelineLanes,
  resolveTimelineMinSpan,
  timelineTicks,
  zoomTimelineSpan,
  type TimelineLaneItem,
} from './Timeline.helpers.js'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const WIDTH = 800
const cleanups: Array<() => void> = []
afterEach(() => {
  cleanups.splice(0).forEach((f) => f())
})

function render(props: TimelineProps): { container: HTMLElement; root: Root; rerender: (p: TimelineProps) => void } {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => root.render(<Timeline {...props} />))
  cleanups.push(() => {
    act(() => root.unmount())
    container.remove()
  })
  return { container, root, rerender: (p) => act(() => root.render(<Timeline {...p} />)) }
}

const T = (s: string) => Date.parse(s)

const ENTRIES: TimelineEntry[] = [
  { id: 'c', label: 'Exercise BLUE DAGGER', start: '2024-03-01', end: '2024-05-15', tone: 'info', meta: 'Exercise' },
  { id: 'a', label: 'Port visit', start: '2024-01-10' },
  { id: 'b', label: 'Deployment', start: '2024-02-01', end: '2024-07-01', tone: 'warning' },
  { id: 'd', label: 'Report published', start: new Date(T('2024-06-20')), tone: 'neutral' },
]

const RANGE = { start: '2024-01-01', end: '2024-08-01' }

const entryButtons = (c: HTMLElement) => Array.from(c.querySelectorAll<HTMLButtonElement>('button[data-entry-id]'))
const byId = (c: HTMLElement, id: string) => c.querySelector<HTMLButtonElement>(`button[data-entry-id="${id}"]`)
const xOf = (el: HTMLElement) => Number(/translateX?\((-?[\d.]+)px/.exec(el.style.transform)?.[1])
const plot = (c: HTMLElement) => c.querySelector('[data-timeline-plot]') as HTMLElement
const button = (c: HTMLElement, name: string) => c.querySelector(`button[aria-label="${name}"]`) as HTMLButtonElement

function pointer(el: HTMLElement, type: string, clientX: number, clientY = 50) {
  act(() => {
    el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY, button: 0 }))
  })
}

function key(el: HTMLElement, k: string) {
  act(() => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }))
  })
}

// ---------------------------------------------------------------- lanes

describe('packTimelineLanes', () => {
  const overlaps = (a: TimelineLaneItem, b: TimelineLaneItem) => a.start <= b.end && b.start <= a.end

  it('never puts two overlapping ranges in one lane, and uses no more lanes than the deepest overlap', () => {
    let seed = 7
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const items: TimelineLaneItem[] = Array.from({ length: 300 }, (_, i) => {
      const start = Math.floor(rand() * 1000)
      return { id: `r${i}`, start, end: start + Math.floor(rand() * 120) }
    })
    const lanes = packTimelineLanes(items)
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        if (lanes.get(items[i].id) === lanes.get(items[j].id)) expect(overlaps(items[i], items[j])).toBe(false)
      }
    }
    let depth = 0
    for (let t = 0; t <= 1200; t++) depth = Math.max(depth, items.filter((it) => it.start <= t && t <= it.end).length)
    expect(Math.max(...lanes.values()) + 1).toBe(depth)
  })

  it('reuses a lane once the previous entry has ended', () => {
    const lanes = packTimelineLanes([
      { id: 'a', start: 0, end: 10 },
      { id: 'b', start: 5, end: 20 },
      { id: 'c', start: 11, end: 30 },
    ])
    expect([lanes.get('a'), lanes.get('b'), lanes.get('c')]).toEqual([0, 1, 0])
  })

  it('gives points a footprint so nearby markers never share a lane', () => {
    const items = [
      { id: 'p1', start: 100, end: 100 },
      { id: 'p2', start: 105, end: 105 },
      { id: 'p3', start: 200, end: 200 },
    ]
    expect(packTimelineLanes(items).get('p2')).toBe(0)
    const lanes = packTimelineLanes(items, 20)
    expect(lanes.get('p2')).toBe(1)
    expect(lanes.get('p3')).toBe(0)
  })

  it('renders lanes without overlap for the component too', () => {
    const many: TimelineEntry[] = Array.from({ length: 40 }, (_, i) => ({
      id: `e${i}`,
      label: `Entry ${i}`,
      start: new Date(T('2024-01-01') + (i % 10) * 9 * TIMELINE_DAY_MS),
      end: new Date(T('2024-01-01') + ((i % 10) * 9 + 30) * TIMELINE_DAY_MS),
    }))
    const { container } = render({ entries: many, 'aria-label': 'Events', range: RANGE })
    const byLane = new Map<string, { x: number; w: number }[]>()
    for (const b of entryButtons(container)) {
      const bar = b.querySelector('.ui-timeline__bar') as HTMLElement
      const list = byLane.get(b.dataset.lane as string) ?? []
      list.push({ x: xOf(b), w: parseFloat(bar.style.width) })
      byLane.set(b.dataset.lane as string, list)
    }
    expect(byLane.size).toBeGreaterThan(1)
    for (const list of byLane.values()) {
      list.sort((p, q) => p.x - q.x)
      for (let i = 1; i < list.length; i++) expect(list[i].x).toBeGreaterThanOrEqual(list[i - 1].x + list[i - 1].w - 1)
    }
  })
})

// ---------------------------------------------------------------- rendering

describe('Timeline rendering', () => {
  it('draws a range as a bar from start to end and a point as a marker', () => {
    const { container } = render({ entries: ENTRIES, 'aria-label': 'Events', range: RANGE })
    const msPerPx = (T(RANGE.end) - T(RANGE.start)) / WIDTH
    const range = byId(container, 'b')!
    expect(range.dataset.kind).toBe('range')
    const bar = range.querySelector('.ui-timeline__bar') as HTMLElement
    expect(xOf(range)).toBeCloseTo((T('2024-02-01') - T(RANGE.start)) / msPerPx, -1)
    expect(parseFloat(bar.style.width)).toBeCloseTo((T('2024-07-01') - T('2024-02-01')) / msPerPx, 0)
    expect(range.querySelector('.ui-timeline__mark')).toBeNull()

    const point = byId(container, 'a')!
    expect(point.dataset.kind).toBe('point')
    expect(point.querySelector('.ui-timeline__mark')).not.toBeNull()
    expect(point.querySelector('.ui-timeline__bar')).toBeNull()
  })

  it('renders entries as buttons in time order whatever the input order', () => {
    const { container } = render({ entries: ENTRIES, 'aria-label': 'Events', range: RANGE })
    expect(entryButtons(container).map((b) => b.dataset.entryId)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('names each entry by its label, dates and meta, with the same as its tooltip', () => {
    const { container } = render({ entries: ENTRIES, 'aria-label': 'Events', range: RANGE })
    const c = byId(container, 'c')!
    expect(c.getAttribute('aria-label')).toBe('Exercise BLUE DAGGER, 1 Mar 2024 to 15 May 2024, Exercise')
    expect(c.title).toBe('Exercise BLUE DAGGER\n1 Mar 2024 to 15 May 2024\nExercise')
    expect(byId(container, 'a')!.getAttribute('aria-label')).toBe('Port visit, 10 Jan 2024')
  })

  it('colours entries from tone tokens only', () => {
    const { container } = render({ entries: ENTRIES, 'aria-label': 'Events', range: RANGE })
    expect((byId(container, 'c')!.querySelector('.ui-timeline__bar') as HTMLElement).style.borderLeft).toContain('var(--status-info)')
    expect((byId(container, 'b')!.querySelector('.ui-timeline__bar') as HTMLElement).style.borderLeft).toContain('var(--status-warning)')
    expect((byId(container, 'a')!.querySelector('.ui-timeline__mark') as HTMLElement).style.background).toBe('var(--color-accent)')
    expect((byId(container, 'd')!.querySelector('.ui-timeline__mark') as HTMLElement).style.background).toBe('var(--text-muted)')
  })

  it('leaves out entries whose start does not parse', () => {
    const { container } = render({
      entries: [...ENTRIES, { id: 'bad', label: 'Broken', start: 'not a date' }],
      'aria-label': 'Events',
      range: RANGE,
    })
    expect(byId(container, 'bad')).toBeNull()
    expect(entryButtons(container).length).toBe(4)
  })

  it('renders only the entries near the view', () => {
    const many: TimelineEntry[] = Array.from({ length: 500 }, (_, i) => ({
      id: `e${i}`,
      label: `Entry ${i}`,
      start: new Date(T('1990-01-01') + i * 30 * TIMELINE_DAY_MS),
    }))
    const all = render({ entries: many, 'aria-label': 'Events' })
    expect(entryButtons(all.container).length).toBe(500)
    const narrow = render({ entries: many, 'aria-label': 'Events', range: { start: '2000-01-01', end: '2001-01-01' } })
    const n = entryButtons(narrow.container).length
    expect(n).toBeGreaterThan(5)
    expect(n).toBeLessThan(30)
  })

  it('draws the today line when today is in view and not otherwise', () => {
    const inView = render({ entries: ENTRIES, 'aria-label': 'Events', range: RANGE, now: '2024-04-01' })
    const line = inView.container.querySelector('[data-timeline-today]') as HTMLElement
    expect(line).not.toBeNull()
    expect(xOf(line)).toBeCloseTo((T('2024-04-01') - T(RANGE.start)) / ((T(RANGE.end) - T(RANGE.start)) / WIDTH), -1)
    expect(inView.container.textContent).toContain('Today')
    const outOfView = render({ entries: ENTRIES, 'aria-label': 'Events', range: RANGE, now: '2030-01-01' })
    expect(outOfView.container.querySelector('[data-timeline-today]')).toBeNull()
    const hidden = render({ entries: ENTRIES, 'aria-label': 'Events', range: RANGE, now: null })
    expect(hidden.container.querySelector('[data-timeline-today]')).toBeNull()
  })

  it('shows an empty state and no controls when there are no entries', () => {
    const { container } = render({ entries: [], 'aria-label': 'Events', emptyTitle: 'No events yet' })
    expect(container.querySelector('[role="region"]')!.getAttribute('aria-label')).toBe('Events')
    expect(container.querySelector('.ui-empty-state')!.textContent).toContain('No events yet')
    expect(container.querySelectorAll('button').length).toBe(0)
  })

  it('shows the default empty title', () => {
    const { container } = render({ entries: [], 'aria-label': 'Events' })
    expect(container.textContent).toContain('No entries to show')
  })
})

// ---------------------------------------------------------------- axis

describe('timelineTicks', () => {
  const span = (a: string, b: string) => ({ start: T(a), end: T(b) })

  it('uses years (in multiples) across decades', () => {
    const t = timelineTicks(span('1900-01-01', '1995-01-01'), WIDTH)
    expect(t.unit).toBe('year')
    expect(t.step).toBe(10)
    expect(t.ticks[0].label).toBe('1900')
    expect(t.ticks.map((k) => k.label)).toContain('1950')
  })

  it('uses single years across a decade', () => {
    const t = timelineTicks(span('2015-06-01', '2024-06-01'), WIDTH)
    expect(t.unit).toBe('year')
    expect(t.step).toBe(1)
    expect(t.ticks[0].label).toBe('2016')
  })

  it('uses months across a year, the year on the first tick and on January', () => {
    const t = timelineTicks(span('2023-10-15', '2024-06-15'), WIDTH)
    expect(t.unit).toBe('month')
    expect(t.step).toBe(1)
    const labels = t.ticks.map((k) => k.label)
    expect(labels[0]).toBe('Nov 2023')
    expect(labels).toContain('Dec')
    expect(labels).toContain('Jan 2024')
  })

  it('uses days across a few weeks, and weeks (on Mondays) across a few months', () => {
    const days = timelineTicks(span('2024-03-01', '2024-03-08'), WIDTH)
    expect(days.unit).toBe('day')
    expect(days.step).toBe(1)
    expect(days.ticks[0].label).toBe('1 Mar 2024')
    expect(days.ticks[1].label).toBe('2 Mar')
    const weeks = timelineTicks(span('2024-01-01', '2024-03-01'), WIDTH)
    expect(weeks.unit).toBe('day')
    expect(weeks.step).toBe(7)
    for (const k of weeks.ticks) expect(new Date(k.t).getUTCDay()).toBe(1)
  })

  it('keeps ticks at least the minimum spacing apart', () => {
    for (const [a, b] of [['1000-01-01', '2000-01-01'], ['2020-01-01', '2024-01-01'], ['2024-01-01', '2024-02-01']] as const) {
      const s = span(a, b)
      const t = timelineTicks(s, WIDTH)
      const pxPerMs = WIDTH / (s.end - s.start)
      for (let i = 1; i < t.ticks.length; i++) expect((t.ticks[i].t - t.ticks[i - 1].t) * pxPerMs).toBeGreaterThanOrEqual(75)
    }
  })

  it('renders the axis labels and the visible window at the axis precision', () => {
    const { container } = render({ entries: ENTRIES, 'aria-label': 'Events', range: RANGE })
    const labels = Array.from(container.querySelectorAll('[data-tick]')).map((s) => s.textContent)
    expect(labels[0]).toBe('Jan 2024')
    expect(container.querySelector('[data-timeline-span]')!.textContent).toBe('Jan 2024 – Aug 2024')
  })
})

// ---------------------------------------------------------------- pan and zoom

describe('Timeline pan and zoom', () => {
  const lastRange = (fn: ReturnType<typeof vi.fn>) => {
    const r = fn.mock.calls[fn.mock.calls.length - 1][0] as { start: Date; end: Date }
    return { start: r.start.getTime(), end: r.end.getTime() }
  }

  it('fits the entries by default', () => {
    const fit = fitTimelineSpan([
      { id: 'a', start: T('2024-01-10'), end: T('2024-01-10') },
      { id: 'b', start: T('2024-02-01'), end: T('2024-07-01') },
    ])!
    expect(fit.start).toBeLessThan(T('2024-01-10'))
    expect(fit.end).toBeGreaterThan(T('2024-07-01'))
    const { container } = render({ entries: ENTRIES, 'aria-label': 'Events' })
    const xs = entryButtons(container).map(xOf)
    expect(Math.min(...xs)).toBeGreaterThan(0)
    expect(Math.max(...xs)).toBeLessThan(WIDTH)
  })

  it('uncontrolled: drag pans, the buttons zoom, fit restores, each reported', () => {
    const onRangeChange = vi.fn()
    const { container } = render({ entries: ENTRIES, 'aria-label': 'Events', initialRange: RANGE, onRangeChange })
    const len = T(RANGE.end) - T(RANGE.start)
    const msPerPx = len / WIDTH
    const before = xOf(byId(container, 'b')!)

    const p = plot(container)
    pointer(p, 'pointerdown', 400)
    pointer(p, 'pointermove', 300)
    pointer(p, 'pointerup', 300)
    let r = lastRange(onRangeChange)
    expect(r.start).toBeCloseTo(T(RANGE.start) + 100 * msPerPx, -3)
    expect(r.end - r.start).toBeCloseTo(len, -3)
    expect(Math.abs(xOf(byId(container, 'b')!) - (before - 100))).toBeLessThanOrEqual(1)

    act(() => button(container, 'Zoom in').click())
    r = lastRange(onRangeChange)
    expect(r.end - r.start).toBeCloseTo(len / 2, -3)
    act(() => button(container, 'Zoom out').click())
    act(() => button(container, 'Zoom out').click())
    r = lastRange(onRangeChange)
    expect(r.end - r.start).toBeCloseTo(len * 2, -3)

    act(() => button(container, 'Fit all entries').click())
    r = lastRange(onRangeChange)
    // The entries run from 10 Jan (a point) to 1 Jul 2024 (the end of a range).
    const fit = fitTimelineSpan([{ id: 'all', start: T('2024-01-10'), end: T('2024-07-01') }])!
    expect(r.start).toBe(fit.start)
    expect(r.end).toBe(fit.end)
  })

  it('a drag does not select the entry it started on; a plain click does', () => {
    const onSelect = vi.fn()
    const { container } = render({ entries: ENTRIES, 'aria-label': 'Events', range: RANGE, onSelect })
    const b = byId(container, 'b')!
    pointer(b, 'pointerdown', 400)
    pointer(b, 'pointermove', 360)
    pointer(b, 'pointerup', 360)
    act(() => b.click())
    expect(onSelect).not.toHaveBeenCalled()
    pointer(b, 'pointerdown', 400)
    pointer(b, 'pointerup', 400)
    act(() => b.click())
    expect(onSelect).toHaveBeenCalledWith('b')
  })

  it('wheel zooms about the pointer; a sideways wheel pans', () => {
    const onRangeChange = vi.fn()
    const { container } = render({ entries: ENTRIES, 'aria-label': 'Events', initialRange: RANGE, onRangeChange })
    const len = T(RANGE.end) - T(RANGE.start)
    const anchor = T(RANGE.start) + 200 * (len / WIDTH)
    act(() => {
      plot(container).dispatchEvent(new WheelEvent('wheel', { deltaY: -200, clientX: 200, bubbles: true, cancelable: true }))
    })
    const r = lastRange(onRangeChange)
    expect(r.end - r.start).toBeLessThan(len)
    // The instant under the pointer stays under it.
    expect(r.start + 200 * ((r.end - r.start) / WIDTH)).toBeCloseTo(anchor, -3)

    act(() => {
      plot(container).dispatchEvent(new WheelEvent('wheel', { deltaX: 80, deltaY: 0, clientX: 200, bubbles: true, cancelable: true }))
    })
    const after = lastRange(onRangeChange)
    expect(after.end - after.start).toBeCloseTo(r.end - r.start, -3)
    expect(after.start).toBeGreaterThan(r.start)
  })

  it('controlled: interactions report the new window but only the range prop moves the view', () => {
    const onRangeChange = vi.fn()
    const props: TimelineProps = { entries: ENTRIES, 'aria-label': 'Events', range: RANGE, onRangeChange }
    const { container, rerender } = render(props)
    const before = xOf(byId(container, 'b')!)

    act(() => button(container, 'Zoom in').click())
    expect(onRangeChange).toHaveBeenCalledTimes(1)
    expect(xOf(byId(container, 'b')!)).toBe(before)

    const p = plot(container)
    pointer(p, 'pointerdown', 400)
    pointer(p, 'pointermove', 500)
    pointer(p, 'pointerup', 500)
    expect(onRangeChange).toHaveBeenCalledTimes(2)
    expect(xOf(byId(container, 'b')!)).toBe(before)

    const next = onRangeChange.mock.calls[0][0] as { start: Date; end: Date }
    rerender({ ...props, range: next })
    expect(xOf(byId(container, 'b')!)).not.toBe(before)
    expect(container.querySelector('[data-timeline-span]')!.textContent).not.toBe('Jan 2024 – Aug 2024')
  })

  it('never zooms in past the minimum span', () => {
    const s = { start: T('2024-01-01'), end: T('2024-01-05') }
    const z = zoomTimelineSpan(s, 0.01)
    expect(z.end - z.start).toBe(TIMELINE_MIN_SPAN_MS)
  })
})

// ---------------------------------------------------------------- keyboard

describe('Timeline keyboard', () => {
  it('has one tab stop; arrows move between entries in time order; Home and End jump', () => {
    const { container } = render({ entries: ENTRIES, 'aria-label': 'Events', range: RANGE })
    const tabbable = entryButtons(container).filter((b) => b.tabIndex === 0)
    expect(tabbable.map((b) => b.dataset.entryId)).toEqual(['a'])
    const a = byId(container, 'a')!
    act(() => a.focus())
    key(a, 'ArrowRight')
    expect((document.activeElement as HTMLElement).dataset.entryId).toBe('b')
    key(document.activeElement as HTMLElement, 'ArrowDown')
    expect((document.activeElement as HTMLElement).dataset.entryId).toBe('c')
    key(document.activeElement as HTMLElement, 'ArrowLeft')
    expect((document.activeElement as HTMLElement).dataset.entryId).toBe('b')
    key(document.activeElement as HTMLElement, 'End')
    expect((document.activeElement as HTMLElement).dataset.entryId).toBe('d')
    key(document.activeElement as HTMLElement, 'Home')
    expect((document.activeElement as HTMLElement).dataset.entryId).toBe('a')
    expect(entryButtons(container).filter((b) => b.tabIndex === 0).map((b) => b.dataset.entryId)).toEqual(['a'])
  })

  it('Enter selects the focused entry, and the selection is marked', () => {
    const onSelect = vi.fn()
    const { container, rerender } = render({ entries: ENTRIES, 'aria-label': 'Events', range: RANGE, onSelect })
    const c = byId(container, 'c')!
    act(() => c.focus())
    key(c, 'Enter')
    expect(onSelect).toHaveBeenCalledWith('c')
    rerender({ entries: ENTRIES, 'aria-label': 'Events', range: RANGE, onSelect, selectedId: 'c' })
    expect(byId(container, 'c')!.getAttribute('aria-pressed')).toBe('true')
    expect(byId(container, 'a')!.getAttribute('aria-pressed')).toBe('false')
  })

  it('+ and - zoom', () => {
    const onRangeChange = vi.fn()
    const { container } = render({ entries: ENTRIES, 'aria-label': 'Events', initialRange: RANGE, onRangeChange })
    const len = T(RANGE.end) - T(RANGE.start)
    const a = byId(container, 'a')!
    act(() => a.focus())
    key(a, '+')
    let r = onRangeChange.mock.calls[0][0] as { start: Date; end: Date }
    expect(r.end.getTime() - r.start.getTime()).toBeCloseTo(len / 2, -3)
    key(document.activeElement as HTMLElement, '-')
    r = onRangeChange.mock.calls[1][0] as { start: Date; end: Date }
    expect(r.end.getTime() - r.start.getTime()).toBeCloseTo(len, -3)
  })

  it('moving to an entry out of view pans to it and focuses it', () => {
    const entries: TimelineEntry[] = [
      { id: 'early', label: 'Early', start: '2020-01-01' },
      { id: 'late', label: 'Late', start: '2024-06-01' },
    ]
    const onRangeChange = vi.fn()
    const { container } = render({ entries, 'aria-label': 'Events', initialRange: { start: '2019-12-01', end: '2020-02-01' }, onRangeChange })
    expect(byId(container, 'late')).toBeNull()
    const early = byId(container, 'early')!
    act(() => early.focus())
    key(early, 'ArrowRight')
    expect(onRangeChange).toHaveBeenCalledTimes(1)
    expect((document.activeElement as HTMLElement).dataset.entryId).toBe('late')
  })

  it('the plot is the tab stop when no entry is in view, and arrows there pan', () => {
    const onRangeChange = vi.fn()
    const { container } = render({ entries: ENTRIES, 'aria-label': 'Events', initialRange: { start: '2030-01-01', end: '2030-06-01' }, onRangeChange })
    expect(entryButtons(container).length).toBe(0)
    const p = plot(container)
    expect(p.tabIndex).toBe(0)
    expect(p.getAttribute('role')).toBe('group')
    key(p, 'ArrowRight')
    const r = onRangeChange.mock.calls[0][0] as { start: Date; end: Date }
    expect(r.start.getTime()).toBeGreaterThan(T('2030-01-01'))
  })
})

// ---------------------------------------------------------------- 0.2.31: labels, axis, height

describe('label room (0.2.31)', () => {
  it('packTimelineLanes honours an item footprint beyond its own extent', () => {
    const items: TimelineLaneItem[] = [
      { id: 'p1', start: 100, end: 100, footprint: 50 },
      { id: 'p2', start: 120, end: 120 },
      { id: 'p3', start: 160, end: 160 },
    ]
    const lanes = packTimelineLanes(items, 10)
    expect(lanes.get('p2')).toBe(1)
    expect(lanes.get('p3')).toBe(0)
  })

  it('estimates wider text as wider, and errs wide for capitals', () => {
    expect(estimateTimelineLabelWidth('RAF Lakenheath', 11)).toBeGreaterThan(estimateTimelineLabelWidth('RAF', 11))
    expect(estimateTimelineLabelWidth('WWWW', 11)).toBeGreaterThan(estimateTimelineLabelWidth('iiii', 11))
    expect(estimateTimelineLabelWidth('', 11)).toBe(0)
  })

  it('shows a point label in full when a nearby entry can move to another lane', () => {
    // RANGE is 213 days over 800 px: entries 10 days apart are ~38 px apart, less than a label.
    const entries: TimelineEntry[] = [
      { id: 'raf', label: 'RAF Lakenheath', start: '2024-03-01' },
      { id: 'boeing', label: 'Boeing delivery', start: '2024-03-11' },
      { id: 'later', label: 'Later', start: '2024-06-20' },
    ]
    const { container } = render({ entries, 'aria-label': 'Events', range: RANGE, now: null })
    const lane = (id: string) => byId(container, id)!.dataset.lane
    expect(lane('raf')).not.toBe(lane('boeing'))
    // Free space is reused: the far entry goes back to the first lane, so only two lanes.
    expect(lane('later')).toBe(lane('raf'))
    for (const e of entries) {
      const label = byId(container, e.id)!.querySelector('.ui-timeline__label') as HTMLElement
      expect(label).not.toBeNull()
      expect(parseFloat(label.style.maxWidth)).toBeGreaterThanOrEqual(estimateTimelineLabelWidth(e.label, 11))
    }
  })

  it('puts a short bar\'s label beside it in full rather than truncated inside', () => {
    const entries: TimelineEntry[] = [
      { id: 'ex', label: 'BALTOPS exercise, phase two', start: '2024-03-01', end: '2024-03-20', tone: 'info' },
      { id: 'next', label: 'Port visit', start: '2024-03-25' },
    ]
    const { container } = render({ entries, 'aria-label': 'Events', range: RANGE, now: null })
    const ex = byId(container, 'ex')!
    expect(ex.querySelector('.ui-timeline__bar .ui-timeline__label')).toBeNull()
    const beside = ex.querySelector(':scope > .ui-timeline__label') as HTMLElement
    expect(parseFloat(beside.style.maxWidth)).toBeGreaterThanOrEqual(estimateTimelineLabelWidth(entries[0].label, 11))
    expect(byId(container, 'next')!.dataset.lane).not.toBe(ex.dataset.lane)
  })

  it('keeps every visible label clear of the next entry in its lane', () => {
    const entries: TimelineEntry[] = Array.from({ length: 30 }, (_, i) => ({
      id: `p${i}`,
      label: `Reported event number ${i}`,
      start: new Date(T('2024-01-05') + i * 6 * TIMELINE_DAY_MS),
    }))
    const { container } = render({ entries, 'aria-label': 'Events', range: RANGE, now: null })
    for (const b of entryButtons(container)) {
      const label = b.querySelector('.ui-timeline__label') as HTMLElement | null
      if (!label) continue
      // Away from the right edge, a label always has room for its whole text.
      if (xOf(b) + 300 > WIDTH) continue
      const text = label.textContent ?? ''
      expect(parseFloat(label.style.maxWidth)).toBeGreaterThanOrEqual(estimateTimelineLabelWidth(text, 11))
    }
  })
})

describe('layoutTimelineAxisLabels (0.2.31)', () => {
  const overlap = (a: { left: number; width: number }, b: { left: number; width: number }) =>
    a.left < b.left + b.width && b.left < a.left + a.width

  it('puts the today label right of the line when that side is clear', () => {
    const r = layoutTimelineAxisLabels([{ left: 4, width: 30 }, { left: 304, width: 30 }], { x: 150, width: 46 }, 800)
    expect(r).toEqual({ todayLeft: 152, hiddenTicks: [] })
  })

  it('moves the today label left of the line when a tick label is on its right', () => {
    const r = layoutTimelineAxisLabels([{ left: 4, width: 30 }, { left: 164, width: 30 }], { x: 158, width: 46 }, 800)
    expect(r.todayLeft).toBe(158 - 2 - 46)
    expect(r.hiddenTicks).toEqual([])
  })

  it('keeps the label inside the plot at the right edge', () => {
    const r = layoutTimelineAxisLabels([], { x: 790, width: 46 }, 800)
    expect(r.todayLeft).toBe(790 - 2 - 46)
  })

  it('hides the tick label it would cover when neither side is clear ("202( TODAY")', () => {
    // The today line 6 px right of a tick: its label covers both sides.
    const ticks = [{ left: 84, width: 30 }, { left: 164, width: 30 }, { left: 244, width: 30 }]
    const r = layoutTimelineAxisLabels(ticks, { x: 166, width: 46 }, 800)
    expect(r.todayLeft).not.toBeNull()
    expect(r.hiddenTicks).toEqual([1])
    const today = { left: r.todayLeft!, width: 46 }
    ticks.forEach((tk, i) => {
      if (!r.hiddenTicks.includes(i)) expect(overlap(today, tk)).toBe(false)
    })
  })

  it('never overlaps a shown tick label, wherever today falls', () => {
    const ticks = Array.from({ length: 10 }, (_, i) => ({ left: i * 80 + 4, width: 26 + (i % 3) * 20 }))
    for (let x = 0; x <= 800; x += 3) {
      const r = layoutTimelineAxisLabels(ticks, { x, width: 46 }, 800)
      const today = { left: r.todayLeft!, width: 46 }
      expect(today.left).toBeGreaterThanOrEqual(0)
      expect(today.left + today.width).toBeLessThanOrEqual(800)
      ticks.forEach((tk, i) => {
        if (!r.hiddenTicks.includes(i)) expect(overlap(today, tk)).toBe(false)
      })
    }
  })

  it('has nothing to place without a today label', () => {
    expect(layoutTimelineAxisLabels([{ left: 0, width: 10 }], null, 800)).toEqual({ todayLeft: null, hiddenTicks: [] })
  })

  it('renders the today label clear of every shown axis label', () => {
    for (const now of ['2019-12-20', '2020-02-01', '2020-01-01', '2023-12-31']) {
      const { container } = render({ entries: ENTRIES, 'aria-label': 'Events', range: { start: '2014-07-01', end: '2024-07-01' }, now })
      const label = container.querySelector('[data-timeline-today-label]') as HTMLElement
      expect(label).not.toBeNull()
      const today = { left: xOf(label), width: parseFloat(label.style.width) }
      const ticks = Array.from(container.querySelectorAll<HTMLElement>('[data-tick]'))
      expect(ticks.length).toBeGreaterThan(2)
      for (const tk of ticks) {
        const box = { left: xOf(tk), width: estimateTimelineLabelWidth(tk.textContent ?? '', 11) }
        expect(overlap(today, box)).toBe(false)
      }
    }
  })
})

describe('Timeline height (0.2.31)', () => {
  const root = (c: HTMLElement) => c.querySelector('.ui-timeline') as HTMLElement
  const stacked = (n: number): TimelineEntry[] =>
    Array.from({ length: n }, (_, i) => ({ id: `s${i}`, label: `Entry ${i}`, start: '2024-01-02', end: '2024-07-30' }))
  // 1 px border either side + 32 px toolbar + 24 px axis + 6 px lane padding either side.
  const CHROME = 70
  const LANE = 26

  it('sizes to its lanes when no height is given', () => {
    const { container } = render({ entries: stacked(5), 'aria-label': 'Events', range: RANGE, now: null })
    expect(new Set(entryButtons(container).map((b) => b.dataset.lane)).size).toBe(5)
    expect(root(container).style.height).toBe(`${CHROME + 5 * LANE}px`)
  })

  it('never shrinks below two lanes of room', () => {
    const { container } = render({ entries: stacked(1), 'aria-label': 'Events', range: RANGE, now: null })
    expect(root(container).style.height).toBe(`${CHROME + 2 * LANE}px`)
  })

  it('stops at the maximum and scrolls the lanes past it', () => {
    const { container } = render({ entries: stacked(30), 'aria-label': 'Events', range: RANGE, now: null })
    expect(root(container).style.height).toBe('320px')
    const lanes = container.querySelector('.ui-timeline__lanes') as HTMLElement
    expect(lanes.style.overflowY).toBe('auto')
    expect(parseFloat((lanes.firstElementChild as HTMLElement).style.height)).toBe(12 + 30 * LANE)
  })

  it('honours minHeight and maxHeight', () => {
    const tall = render({ entries: stacked(1), 'aria-label': 'Events', range: RANGE, now: null, minHeight: 180 })
    expect(root(tall.container).style.height).toBe('180px')
    const short = render({ entries: stacked(30), 'aria-label': 'Events', range: RANGE, now: null, maxHeight: 200 })
    expect(root(short.container).style.height).toBe('200px')
  })

  it('keeps an explicit height whatever the lanes', () => {
    const few = render({ entries: stacked(1), 'aria-label': 'Events', range: RANGE, height: 250 })
    expect(root(few.container).style.height).toBe('250px')
    const many = render({ entries: stacked(30), 'aria-label': 'Events', range: RANGE, height: 250 })
    expect(root(many.container).style.height).toBe('250px')
  })

  it('gives the empty state a compact auto height', () => {
    const { container } = render({ entries: [], 'aria-label': 'Events' })
    expect(root(container).style.height).toBe('140px')
  })
})

// ---------------------------------------------------------------- 0.2.36: short spans, picking a time

describe('Timeline short spans (0.2.36)', () => {
  it('a caller narrows the narrowest span to no less than a second, and the default is unchanged', () => {
    expect(resolveTimelineMinSpan(undefined)).toBe(TIMELINE_MIN_SPAN_MS)
    expect(resolveTimelineMinSpan(60_000)).toBe(60_000)
    expect(resolveTimelineMinSpan(10)).toBe(TIMELINE_MIN_SPAN_FLOOR_MS)
    expect(resolveTimelineMinSpan(30 * TIMELINE_DAY_MS)).toBe(TIMELINE_MIN_SPAN_MS)
    const s = { start: T('2015-10-14T08:00:00Z'), end: T('2015-10-14T08:00:30Z') }
    expect(clampTimelineSpan(s).end - clampTimelineSpan(s).start).toBe(TIMELINE_MIN_SPAN_MS)
    expect(clampTimelineSpan(s, 10_000)).toEqual(s)
    const z = zoomTimelineSpan(s, 0.01, undefined, 10_000)
    expect(z.end - z.start).toBe(10_000)
  })

  it('fits a lone point to its own short span when the caller allows one', () => {
    const p = [{ id: 'p', start: T('2015-10-14T08:00:00Z'), end: T('2015-10-14T08:00:00Z') }]
    const fitted = fitTimelineSpan(p, 60_000)!
    expect(fitted.end - fitted.start).toBe(120_000)
    expect(fitTimelineSpan(p)!.end - fitTimelineSpan(p)!.start).toBe(60 * TIMELINE_DAY_MS)
  })

  it('ticks hours, minutes, seconds and tenths of a second below a day, the date where the day changes', () => {
    const at = (s: string) => T(s)
    const hours = timelineTicks({ start: at('2015-10-13T20:00:00Z'), end: at('2015-10-14T08:00:00Z') }, WIDTH, 80, true)
    expect(hours.unit).toBe('hour')
    expect(hours.ticks[0].label).toBe('13 Oct 20:00')
    expect(hours.ticks.find((t) => t.t === at('2015-10-14T00:00:00Z'))?.label).toBe('14 Oct 00:00')
    expect(hours.ticks.find((t) => t.t === at('2015-10-14T02:00:00Z'))?.label).toBe('02:00')
    const minutes = timelineTicks({ start: at('2015-10-14T08:00:00Z'), end: at('2015-10-14T08:10:00Z') }, WIDTH, 80, true)
    expect(minutes.unit).toBe('minute')
    expect(minutes.ticks[1].label).toBe('08:01')
    const seconds = timelineTicks({ start: at('2015-10-14T08:00:00Z'), end: at('2015-10-14T08:00:20Z') }, WIDTH, 80, true)
    expect(seconds.unit).toBe('second')
    expect(seconds.ticks[1].label).toMatch(/^08:00:0\d$/)
    const tenths = timelineTicks({ start: at('2015-10-14T08:00:00Z'), end: at('2015-10-14T08:00:02Z') }, WIDTH, 80, true)
    expect(tenths.unit).toBe('millisecond')
    expect(tenths.ticks[1].label).toMatch(/^08:00:00\.\d{3}$/)
    // Without sub-day the same window keeps days, as before.
    expect(timelineTicks({ start: at('2015-10-13T20:00:00Z'), end: at('2015-10-14T08:00:00Z') }, WIDTH).unit).toBe('day')
  })

  it('shows the window to the axis precision and dates entries with their time', () => {
    expect(formatTimelineSpan({ start: T('2015-10-14T08:00:00Z'), end: T('2015-10-14T08:10:00Z') }, 'minute')).toBe('14 Oct 2015 08:00 – 08:10')
    const { container } = render({
      'aria-label': 'Coverage',
      entries: [{ id: 'r', label: 'Run', start: '2015-10-14T08:00:00Z', end: '2015-10-14T08:10:00Z' }],
      minSpanMs: 1000,
      now: null,
    })
    expect(byId(container, 'r')!.getAttribute('aria-label')).toBe('Run, 14 Oct 2015 08:00:00 to 14 Oct 2015 08:10:00')
    expect(container.querySelector('[data-timeline-span]')!.textContent).toMatch(/^14 Oct 2015 \d\d:\d\d(:\d\d)? – \d\d:\d\d(:\d\d)?$/)
  })
})

describe('Timeline now label and picking a time (0.2.36)', () => {
  const RUN: TimelineEntry[] = [{ id: 'r', label: 'Run', start: '2015-10-14T08:00:00Z', end: '2015-10-14T08:10:00Z' }]
  const VIEW = { start: '2015-10-14T08:00:00Z', end: '2015-10-14T08:10:00Z' }

  it('names the now line, keeps "Today" by default and can draw the line without a label', () => {
    const now = '2015-10-14T08:05:00Z'
    const named = render({ 'aria-label': 'x', entries: RUN, minSpanMs: 1000, initialRange: VIEW, now, nowLabel: 'Frame' })
    expect(named.container.querySelector('[data-timeline-today-label]')!.textContent).toBe('Frame')
    const bare = render({ 'aria-label': 'x', entries: RUN, minSpanMs: 1000, initialRange: VIEW, now, nowLabel: null })
    expect(bare.container.querySelector('[data-timeline-today]')).not.toBeNull()
    expect(bare.container.querySelector('[data-timeline-today-label]')).toBeNull()
    const old = render({ 'aria-label': 'x', entries: ENTRIES, initialRange: RANGE, now: '2024-04-01' })
    expect(old.container.querySelector('[data-timeline-today-label]')!.textContent).toBe('Today')
  })

  it('pan mode: a click on the plot outside an entry picks the time under it; a drag still pans and picks nothing', () => {
    const picked = vi.fn()
    const moved = vi.fn()
    const { container } = render({ 'aria-label': 'x', entries: RUN, minSpanMs: 1000, initialRange: VIEW, now: null, onTimePick: picked, onRangeChange: moved })
    const p = plot(container)
    pointer(p, 'pointerdown', 400)
    pointer(p, 'pointerup', 400)
    expect(picked).toHaveBeenCalledTimes(1)
    expect(picked.mock.calls[0][0]).toBe(T('2015-10-14T08:05:00Z'))
    pointer(p, 'pointerdown', 400)
    pointer(p, 'pointermove', 300)
    pointer(p, 'pointerup', 300)
    expect(picked).toHaveBeenCalledTimes(1)
    expect(moved).toHaveBeenCalled()
  })

  it('scrub mode: pressing and dragging pick times, Shift+drag pans, and the plot takes focus for arrow keys', () => {
    const picked = vi.fn()
    const moved = vi.fn()
    const { container } = render({
      'aria-label': 'Recording', entries: RUN, minSpanMs: 1000, initialRange: VIEW, now: '2015-10-14T08:05:00Z',
      onTimePick: picked, onRangeChange: moved, interaction: 'scrub',
    })
    const p = plot(container)
    expect(p.tabIndex).toBe(0)
    expect(p.getAttribute('aria-label')).toBe('Recording')
    pointer(p, 'pointerdown', 200)
    pointer(p, 'pointermove', 600)
    pointer(p, 'pointerup', 600)
    expect(picked.mock.calls.map((c) => c[0])).toEqual([T('2015-10-14T08:02:30Z'), T('2015-10-14T08:07:30Z')])
    expect(moved).not.toHaveBeenCalled()
    act(() => {
      p.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 400, shiftKey: true, button: 0 }))
    })
    pointer(p, 'pointermove', 300)
    pointer(p, 'pointerup', 300)
    expect(moved).toHaveBeenCalled()
    picked.mockClear()
    key(p, 'ArrowRight')
    expect(picked).toHaveBeenCalledWith(T('2015-10-14T08:05:06Z'))
    act(() => {
      p.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', shiftKey: true, bubbles: true, cancelable: true }))
    })
    expect(picked).toHaveBeenLastCalledWith(T('2015-10-14T08:04:00Z'))
  })

  it('without onTimePick nothing changes: drag pans and the plot is not an extra tab stop', () => {
    const { container } = render({ 'aria-label': 'x', entries: ENTRIES, initialRange: RANGE, interaction: 'scrub' })
    expect(plot(container).getAttribute('tabindex')).toBeNull()
  })
})

// ---------------------------------------------------------------- 0.2.37: density

describe('Timeline density (0.2.37)', () => {
  const DENSITY = {
    start: '2024-01-01T00:00:00Z',
    end: '2024-01-05T00:00:00Z',
    series: [
      { label: 'Images', tone: 'accent' as const, counts: [2, 0, 6, 1] },
      { label: 'Recordings', tone: 'info' as const, counts: [2, 0, 0, Number.NaN] },
    ],
  }
  const WINDOW = { start: '2024-01-01T00:00:00Z', end: '2024-01-05T00:00:00Z' }
  const bars = (c: HTMLElement) => Array.from(c.querySelectorAll<HTMLElement>('[data-density-bucket]'))

  it('with density and no entries: the plot, the axis and the zoom controls, no empty state, no lanes, no fit', () => {
    const { container } = render({ entries: [], density: DENSITY, range: WINDOW, 'aria-label': 'Acquisition timeline', height: 96 })
    expect(container.textContent).not.toContain('No entries to show')
    expect(container.querySelector('[data-timeline-density]')).not.toBeNull()
    expect(container.querySelector('[data-timeline-axis]')).not.toBeNull()
    expect(container.querySelector('.ui-timeline__lanes')).toBeNull()
    expect(button(container, 'Zoom in')).not.toBeNull()
    expect(button(container, 'Zoom out')).not.toBeNull()
    expect(button(container, 'Fit all entries')).toBeNull()
    const p = plot(container)
    expect(p.getAttribute('aria-label')).toBe('Acquisition timeline')
    expect(p.tabIndex).toBe(0)
  })

  it('one stacked bar per non-empty bucket, its height its share of the busiest bucket in view', () => {
    const { container } = render({ entries: [], density: DENSITY, range: WINDOW, 'aria-label': 'Acquisition timeline' })
    const b = bars(container)
    expect(b.map((el) => el.dataset.densityBucket)).toEqual(['0', '2', '3'])
    // Each bucket is a quarter of the 800 px view.
    expect(b.map((el) => xOf(el))).toEqual([0, 400, 600])
    const heights = (el: HTMLElement) => Array.from(el.querySelectorAll<HTMLElement>('[data-density-series]')).map((s) => s.style.height)
    expect(heights(b[0])).toEqual(['33.33333333333333%', '33.33333333333333%'])
    expect(heights(b[1])).toEqual(['100%'])
    // A non-finite count is 0.
    expect(heights(b[2]).length).toBe(1)
    // Each series in its own tone token.
    const tones = Array.from(b[0].querySelectorAll<HTMLElement>('[data-density-series]')).map((s) => s.style.background)
    expect(tones[0]).toContain('--color-accent')
    expect(tones[1]).toContain('--status-info')
  })

  it('names each bucket by its span and each series count', () => {
    const { container } = render({ entries: [], density: DENSITY, range: WINDOW, 'aria-label': 'Acquisition timeline' })
    const tip = bars(container)[0].title
    expect(tip).toMatch(/ · 2 images · 2 recordings$/)
    expect(tip).toContain(' to ')
  })

  it('scales to the busiest bucket in view and draws only buckets in view', () => {
    const { container } = render({ entries: [], density: DENSITY, range: { start: '2024-01-01T00:00:00Z', end: '2024-01-02T00:00:00Z' }, minSpanMs: 1000, 'aria-label': 'Acquisition timeline' })
    const b = bars(container)
    expect(b.map((el) => el.dataset.densityBucket)).toEqual(['0'])
    const h = Array.from(b[0].querySelectorAll<HTMLElement>('[data-density-series]')).map((s) => s.style.height)
    expect(h).toEqual(['50%', '50%'])
  })

  it('the arrow keys on the plot and the zoom buttons move the view, reported', () => {
    const onRangeChange = vi.fn()
    const { container } = render({ entries: [], density: DENSITY, range: WINDOW, onRangeChange, 'aria-label': 'Acquisition timeline' })
    key(plot(container), 'ArrowRight')
    expect((onRangeChange.mock.calls[0][0] as { start: Date }).start.getTime()).toBeGreaterThan(T('2024-01-01T00:00:00Z'))
    act(() => button(container, 'Zoom in').click())
    expect(onRangeChange).toHaveBeenCalledTimes(2)
  })

  it('with entries too, the lanes and the fit button stay, the density above the axis', () => {
    const { container } = render({ entries: ENTRIES, density: DENSITY, 'aria-label': 'Events' })
    expect(container.querySelector('.ui-timeline__lanes')).not.toBeNull()
    expect(button(container, 'Fit all entries')).not.toBeNull()
    const density = container.querySelector('[data-timeline-density]')!
    const axis = container.querySelector('[data-timeline-axis]')!
    expect(density.compareDocumentPosition(axis) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('an empty or malformed density draws no bars', () => {
    const { container } = render({ entries: [], density: { start: 'x', end: '2024-01-02', series: [{ label: 'Images', counts: [1] }] }, range: WINDOW, 'aria-label': 'A' })
    expect(bars(container)).toEqual([])
    expect(container.querySelector('[data-timeline-density]')).not.toBeNull()
  })

  it('a series with a colour of its own draws in it (0.2.39)', () => {
    const own = { ...DENSITY, series: [{ label: 'Car', color: 'var(--intel-cyan)', counts: [1, 0, 0, 0] }] }
    const { container } = render({ entries: [], density: own, range: WINDOW, 'aria-label': 'Detections' })
    const span = container.querySelector<HTMLElement>('[data-density-series]')!
    expect(span.style.background).toContain('--intel-cyan')
    expect(span.style.background).not.toContain('--color-accent')
  })
})
