// @vitest-environment jsdom
/**
 * PlaybackTimeline tests — React 19 createRoot + act + native DOM events (project convention).
 * jsdom does no layout: the track keeps its 800 px fallback width and its left edge reads 0, so a
 * pointer's clientX is its x on the track.
 */
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { PlaybackTimeline, type PlaybackTimelineProps } from './PlaybackTimeline.js'
import {
  STEP_PRESETS_MS,
  advanceSelection,
  clampSelection,
  formatStep,
  moveSelection,
  resizeSelection,
  scrubSelection,
  stepFromUnit,
} from './PlaybackTimeline.helpers.js'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const T = (s: string) => Date.parse(s)
const H = 3_600_000
const EXTENT = { start: T('2024-01-01T00:00:00Z'), end: T('2024-01-02T00:00:00Z') }
/** 800 px over a day: 108 000 ms (1.8 min) a pixel. */
const MS_PER_PX = (EXTENT.end - EXTENT.start) / 800
const SEL = { start: T('2024-01-01T06:00:00Z'), end: T('2024-01-01T08:00:00Z') }

const cleanups: Array<() => void> = []
afterEach(() => {
  cleanups.splice(0).forEach((f) => f())
})

function props(over: Partial<PlaybackTimelineProps> = {}): PlaybackTimelineProps {
  return {
    extent: EXTENT,
    lanes: [
      { id: 'ships', label: 'Ships', density: { start: EXTENT.start, end: EXTENT.end, counts: [0, 4, 9, 2] } },
      { id: 'events', label: 'Events of interest', instants: [T('2024-01-01T03:00:00Z'), T('2024-01-01T15:30:00Z')], tone: 'warning' },
    ],
    selection: SEL,
    onSelectionChange: vi.fn(),
    playing: false,
    onPlayingChange: vi.fn(),
    onStep: vi.fn(),
    step: 60_000,
    onStepChange: vi.fn(),
    onViewChange: vi.fn(),
    'aria-label': 'Workspace time',
    ...over,
  }
}

function render(p: PlaybackTimelineProps) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => root.render(<PlaybackTimeline {...p} />))
  cleanups.push(() => {
    act(() => root.unmount())
    container.remove()
  })
  return { container, rerender: (q: PlaybackTimelineProps) => act(() => root.render(<PlaybackTimeline {...q} />)) }
}

function pointer(el: Element, type: string, clientX: number, extra: MouseEventInit = {}) {
  act(() => {
    el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY: 40, button: 0, ...extra }))
  })
}
function key(el: Element, k: string, extra: KeyboardEventInit = {}) {
  act(() => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...extra }))
  })
}
function setValue(el: HTMLInputElement | HTMLSelectElement, v: string) {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
  act(() => {
    Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, v)
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }))
  })
}
const q = <E extends Element>(c: ParentNode, sel: string) => c.querySelector<E>(sel)!
const button = (c: ParentNode, label: string) => q<HTMLButtonElement>(c, `button[aria-label="${label}"]`)
const plot = (c: ParentNode) => q<HTMLElement>(c, '[data-pt-plot]')
const lastCall = (fn: unknown) => (fn as ReturnType<typeof vi.fn>).mock.calls.at(-1)!

describe('PlaybackTimeline helpers', () => {
  it('formats steps in whole units', () => {
    expect(formatStep(1000)).toBe('1 s')
    expect(formatStep(90_000)).toBe('90 s')
    expect(formatStep(60_000)).toBe('1 min')
    expect(formatStep(6 * H)).toBe('6 h')
    expect(formatStep(24 * H)).toBe('1 d')
    expect(formatStep(0)).toBe('—')
    // Not a whole number of minutes: exact seconds, so two steps never read the same.
    expect(formatStep(3_744_000)).toBe('3744 s')
    expect(formatStep(59_990)).toBe('59.99 s')
    expect(STEP_PRESETS_MS.map(formatStep)).toEqual(['1 s', '10 s', '1 min', '5 min', '15 min', '1 h', '6 h', '1 d'])
  })

  it('reads a custom step from a value and a unit, refusing zero, negatives and junk', () => {
    expect(stepFromUnit(30, 'min')).toBe(30 * 60_000)
    expect(stepFromUnit(1.5, 'h')).toBe(1.5 * H)
    expect(stepFromUnit(0, 's')).toBeNull()
    expect(stepFromUnit(-2, 'd')).toBeNull()
    expect(stepFromUnit(Number.NaN, 's')).toBeNull()
  })

  it('clamps a selection inside the extent, keeping its width', () => {
    expect(clampSelection({ start: EXTENT.end - H, end: EXTENT.end + H }, EXTENT)).toEqual({ start: EXTENT.end - 2 * H, end: EXTENT.end })
    expect(clampSelection({ start: EXTENT.start - 5 * H, end: EXTENT.end + 5 * H }, EXTENT)).toEqual(EXTENT)
    expect(clampSelection({ start: SEL.start, end: SEL.start }, EXTENT, 1000)).toEqual({ start: SEL.start, end: SEL.start + 1000 })
  })

  it('moves, resizes and scrubs within the extent', () => {
    expect(moveSelection(SEL, 30 * H, EXTENT)).toEqual({ start: EXTENT.end - 2 * H, end: EXTENT.end })
    expect(resizeSelection(SEL, 'start', SEL.end + H, EXTENT, 1000)).toEqual({ start: SEL.end - 1000, end: SEL.end })
    expect(resizeSelection(SEL, 'end', EXTENT.end + H, EXTENT)).toEqual({ start: SEL.start, end: EXTENT.end })
    expect(scrubSelection(SEL, T('2024-01-01T12:00:00Z'), EXTENT)).toEqual({ start: T('2024-01-01T10:00:00Z'), end: T('2024-01-01T12:00:00Z') })
  })

  it('advances by a step and reports the edge', () => {
    expect(advanceSelection(SEL, H, 1, EXTENT)).toEqual({ selection: { start: SEL.start + H, end: SEL.end + H }, atEdge: false })
    const last = advanceSelection({ start: EXTENT.end - 2 * H - 1000, end: EXTENT.end - 1000 }, H, 1, EXTENT)
    expect(last).toEqual({ selection: { start: EXTENT.end - 2 * H, end: EXTENT.end }, atEdge: true })
    expect(advanceSelection({ start: EXTENT.start, end: EXTENT.start + H }, H, -1, EXTENT).atEdge).toBe(true)
  })
})

describe('PlaybackTimeline', () => {
  it('draws one named lane per series: density bars, event marks, loading and error', () => {
    const { container, rerender } = render(props())
    const lanes = Array.from(container.querySelectorAll('[data-pt-lane]'))
    expect(lanes.map((l) => l.textContent)).toEqual(['Ships', 'Events of interest'])
    expect(q(lanes[0], '[data-pt-density]').getAttribute('d')).toMatch(/^M/)
    // Two instants, two diamonds.
    expect(q(lanes[1], '[data-pt-instants]').getAttribute('d')!.match(/M/g)).toHaveLength(2)

    rerender(props({ lanes: [{ id: 'a', label: 'A', loading: true }, { id: 'b', label: 'B', error: 'Layer offline' }] }))
    const status = Array.from(container.querySelectorAll('[data-pt-status]'))
    expect(status.map((s) => s.textContent)).toEqual(['Loading…', 'Unavailable'])
    expect(status[1].getAttribute('title')).toBe('Layer offline')
  })

  it('without an extent shows the empty state; without lanes says so', () => {
    const { container, rerender } = render(props({ extent: null }))
    expect(container.textContent).toContain('No time range to show')
    expect(container.querySelector('[data-pt-plot]')).toBeNull()
    rerender(props({ lanes: [] }))
    expect(container.textContent).toContain('Nothing in time to show')
  })

  it('a single-instant extent still draws (widened to a second), with nothing NaN', () => {
    const t = T('2024-01-01T06:00:00Z')
    const { container } = render(props({ extent: { start: t, end: t }, selection: { start: t, end: t } }))
    expect(container.querySelector('[data-pt-plot]')).not.toBeNull()
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
  })

  it("a lane's label is its tooltip, with its error", () => {
    const { container } = render(props({ lanes: [{ id: 'a', label: 'Aircraft (ADS-B) feed west', error: 'ES timeout' }] }))
    const label = q<HTMLElement>(container, '[data-pt-lane="a"] > div')
    expect(label.getAttribute('title')).toBe('Aircraft (ADS-B) feed west: ES timeout')
    expect(label.style.pointerEvents).not.toBe('none')
  })

  it('shows the window as UTC text', () => {
    const { container } = render(props())
    expect(q(container, '[data-pt-readout]').textContent).toBe('1 Jan 2024 06:00:00 – 1 Jan 2024 08:00:00 UTC')
  })

  it('play, pause and the step buttons call back; play is off at the end of the extent', () => {
    const p = props()
    const { container, rerender } = render(p)
    act(() => button(container, 'Play').click())
    expect(p.onPlayingChange).toHaveBeenCalledWith(true)
    act(() => button(container, 'Step back').click())
    act(() => button(container, 'Step forward').click())
    expect((p.onStep as ReturnType<typeof vi.fn>).mock.calls).toEqual([[-1], [1]])

    rerender({ ...p, playing: true })
    act(() => button(container, 'Pause').click())
    expect(lastCall(p.onPlayingChange)).toEqual([false])

    rerender({ ...p, selection: { start: EXTENT.end - H, end: EXTENT.end } })
    expect(button(container, 'Play').disabled).toBe(true)
    expect(button(container, 'Step forward').disabled).toBe(true)
    expect(button(container, 'Step back').disabled).toBe(false)
  })

  it('picks a step from the presets, and a custom one from a value and a unit', () => {
    const p = props()
    const { container, rerender } = render(p)
    const select = q<HTMLSelectElement>(container, 'select[aria-label="Step size"]')
    expect(select.value).toBe('60000')
    setValue(select, String(5 * 60_000))
    expect(p.onStepChange).toHaveBeenCalledWith(5 * 60_000)

    setValue(select, '__custom')
    const dialog = q<HTMLElement>(document.body, '[aria-label="Custom step size"]')
    const value = q<HTMLInputElement>(dialog, 'input[aria-label="Step value"]')
    const apply = () => Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent === 'Apply')!
    setValue(value, '0')
    expect(apply().disabled).toBe(true)
    expect(dialog.querySelector('[role="alert"]')?.textContent).toBe('Enter a duration above zero.')
    setValue(value, '2')
    setValue(q<HTMLSelectElement>(dialog, 'select[aria-label="Step unit"]'), 'h')
    act(() => apply().click())
    expect(lastCall(p.onStepChange)).toEqual([2 * H])

    // A step that is no preset is offered as itself.
    rerender({ ...p, step: 2 * H })
    expect(Array.from(select.options).map((o) => o.textContent)).toContain('2 h')
    expect(select.value).toBe(String(2 * H))
  })

  it('pressing the plot scrubs: the window keeps its width and its end follows the pointer', () => {
    const p = props()
    const { container } = render(p)
    const at12 = Math.round((T('2024-01-01T12:00:00Z') - EXTENT.start) / MS_PER_PX)
    pointer(plot(container), 'pointerdown', at12)
    const [sel, info] = lastCall(p.onSelectionChange)
    expect(info).toEqual({ final: false })
    expect(sel.end - sel.start).toBe(2 * H)
    expect(Math.abs(sel.end - T('2024-01-01T12:00:00Z'))).toBeLessThan(MS_PER_PX)

    pointer(plot(container), 'pointermove', at12 + 600)
    expect(lastCall(p.onSelectionChange)[0]).toEqual({ start: EXTENT.end - 2 * H, end: EXTENT.end })
    pointer(plot(container), 'pointerup', at12 + 600)
    expect(lastCall(p.onSelectionChange)).toEqual([{ start: EXTENT.end - 2 * H, end: EXTENT.end }, { final: true }])
  })

  it('dragging the window body moves it; dragging a handle resizes it', () => {
    const p = props()
    const { container } = render(p)
    const body = q(container, '[data-pt-part="body"]')
    pointer(body, 'pointerdown', 220)
    pointer(plot(container), 'pointermove', 320)
    expect(lastCall(p.onSelectionChange)).toEqual([{ start: SEL.start + 100 * MS_PER_PX, end: SEL.end + 100 * MS_PER_PX }, { final: false }])
    pointer(plot(container), 'pointerup', 320)
    expect(lastCall(p.onSelectionChange)[1]).toEqual({ final: true })

    const end = q(container, '[data-pt-part="end"]')
    pointer(end, 'pointerdown', 267)
    pointer(plot(container), 'pointermove', 317)
    expect(lastCall(p.onSelectionChange)[0]).toEqual({ start: SEL.start, end: SEL.end + 50 * MS_PER_PX })
    pointer(plot(container), 'pointerup', 317)

    // A click on the body without a drag changes nothing.
    const calls = (p.onSelectionChange as ReturnType<typeof vi.fn>).mock.calls.length
    pointer(body, 'pointerdown', 230)
    pointer(plot(container), 'pointerup', 230)
    expect((p.onSelectionChange as ReturnType<typeof vi.fn>).mock.calls.length).toBe(calls)
  })

  it('the keyboard moves and resizes by the step, Space plays', () => {
    const p = props()
    const { container } = render(p)
    key(q(container, '[data-pt-part="body"]'), 'ArrowRight')
    expect(lastCall(p.onSelectionChange)).toEqual([{ start: SEL.start + 60_000, end: SEL.end + 60_000 }, { final: true }])
    key(q(container, '[data-pt-part="body"]'), 'ArrowLeft', { shiftKey: true })
    expect(lastCall(p.onSelectionChange)[0]).toEqual({ start: SEL.start - 600_000, end: SEL.end - 600_000 })
    const start = q(container, '[data-pt-part="start"]')
    expect(start.getAttribute('role')).toBe('slider')
    expect(start.getAttribute('aria-valuetext')).toBe('1 Jan 2024 06:00:00 UTC')
    key(start, 'ArrowLeft')
    expect(lastCall(p.onSelectionChange)[0]).toEqual({ start: SEL.start - 60_000, end: SEL.end })
    key(plot(container), ' ')
    expect(p.onPlayingChange).toHaveBeenCalledWith(true)
  })

  it('zooms about the window and fits back to the extent; the view never leaves the extent', () => {
    const p = props()
    const { container } = render(p)
    act(() => button(container, 'Zoom in').click())
    const v = lastCall(p.onViewChange)[0]
    expect(v.end - v.start).toBe((EXTENT.end - EXTENT.start) / 2)
    // About the window's centre (07:00): 07:00 stays where it was on screen.
    expect(v.start).toBe(EXTENT.start + 3.5 * H)
    act(() => button(container, 'Fit to extent').click())
    expect(lastCall(p.onViewChange)).toEqual([EXTENT])
    act(() => button(container, 'Zoom out').click())
    expect(lastCall(p.onViewChange)).toEqual([EXTENT])
  })

  it('Shift+drag pans the view without moving the window', () => {
    const p = props({ view: { start: T('2024-01-01T06:00:00Z'), end: T('2024-01-01T12:00:00Z') } })
    const { container } = render(p)
    const before = (p.onSelectionChange as ReturnType<typeof vi.fn>).mock.calls.length
    pointer(plot(container), 'pointerdown', 400, { shiftKey: true })
    pointer(plot(container), 'pointermove', 300, { shiftKey: true })
    pointer(plot(container), 'pointerup', 300, { shiftKey: true })
    expect((p.onSelectionChange as ReturnType<typeof vi.fn>).mock.calls.length).toBe(before)
    const v = lastCall(p.onViewChange)[0]
    expect(v.end - v.start).toBe(6 * H)
    expect(v.start).toBeGreaterThan(T('2024-01-01T06:00:00Z'))
  })
})
