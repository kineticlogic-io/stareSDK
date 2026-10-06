// @vitest-environment jsdom
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest'

// uPlot draws on a canvas, which jsdom does not implement; record what it is given instead.
const made: { opts: { series: { stroke?: string }[] }; destroyed: boolean }[] = []
vi.mock('uplot', () => ({
  default: class {
    cursor = { idx: null }
    rec: (typeof made)[number]
    constructor(opts: (typeof made)[number]['opts']) {
      this.rec = { opts, destroyed: false }
      made.push(this.rec)
    }
    setData() {}
    destroy() {
      this.rec.destroyed = true
    }
  },
}))

import { TimeSeriesChart, formatValue, toneOf } from './TimeSeriesChart.js'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let resize: ((w: number) => void) | null = null
beforeAll(() => {
  ;(globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
    constructor(cb: (e: { contentRect: { width: number } }[]) => void) {
      resize = (w) => cb([{ contentRect: { width: w } }])
    }
    observe() {}
    disconnect() {}
  }
})

const cleanups: Array<() => void> = []
afterEach(() => cleanups.splice(0).forEach((f) => f()))

describe('formatValue', () => {
  it('keeps legend values short', () => {
    expect(formatValue(null)).toBe('—')
    expect(formatValue(42)).toBe('42')
    expect(formatValue(12_345)).toBe('12.3k')
    expect(formatValue(2_500_000, ' B')).toBe('2.5M B')
    expect(formatValue(0.256)).toBe('0.26')
    expect(formatValue(3.14159, '/s')).toBe('3.1/s')
  })
})

describe('toneOf', () => {
  it('uses the given tone, else accent first', () => {
    expect(toneOf({ label: 'a', values: [] }, 0)).toBe('accent')
    expect(toneOf({ label: 'b', values: [], tone: 'danger' }, 0)).toBe('danger')
  })
})

describe('TimeSeriesChart', () => {
  it('shows a legend with latest values and builds the plot once it has a width', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const root = createRoot(el)
    act(() =>
      root.render(
        <TimeSeriesChart
          aria-label="Throughput"
          unit="/min"
          times={[60, 120, 180]}
          series={[
            { label: 'frames', values: [10, 20, 30] },
            { label: 'errors', values: [1, 0, null], tone: 'danger' },
          ]}
        />,
      ),
    )
    cleanups.push(() => {
      act(() => root.unmount())
      el.remove()
    })
    expect(el.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('Throughput')
    expect(el.textContent).toContain('frames30/min')
    expect(el.textContent).toContain('errors0/min')
    expect(made).toHaveLength(0)
    act(() => resize?.(400))
    expect(made).toHaveLength(1)
    expect(made[0].opts.series).toHaveLength(3)
  })
})
