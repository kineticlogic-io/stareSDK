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
  TIMELINE_MIN_SPAN_MS,
  fitTimelineSpan,
  packTimelineLanes,
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
