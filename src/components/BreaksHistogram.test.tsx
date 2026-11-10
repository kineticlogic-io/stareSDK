import { describe, it, expect, vi, afterEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { BreaksHistogram, classIndexOf, clampBreak, formatBreakValue } from './BreaksHistogram'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const BINS = [
  { from: 0, to: 25, count: 4 },
  { from: 25, to: 50, count: 8 },
  { from: 50, to: 75, count: 2 },
  { from: 75, to: 100, count: 1 },
]

let cleanup: (() => void) | null = null
afterEach(() => { cleanup?.(); cleanup = null })

function render(onBreakChange?: (i: number, v: number) => void) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(
      <BreaksHistogram bins={BINS} breaks={[0, 40, 100]} colors={['red', 'blue']} onBreakChange={onBreakChange} aria-label="Distribution" />,
    )
  })
  cleanup = () => { act(() => root.unmount()); container.remove() }
  return container
}

describe('BreaksHistogram', () => {
  it('draws a bar per bin in the colour of its class', () => {
    const c = render()
    const bars = Array.from(c.querySelectorAll('rect[opacity="0.85"]'))
    expect(bars.map(b => b.getAttribute('fill'))).toEqual(['red', 'red', 'blue', 'blue'])
  })

  it('is read-only without onBreakChange: no slider', () => {
    expect(render().querySelector('[role="slider"]')).toBeNull()
  })

  it('an inner break is a slider the arrow keys move, between its neighbours', () => {
    const onBreakChange = vi.fn()
    const c = render(onBreakChange)
    const slider = c.querySelector('[role="slider"]') as SVGGElement
    expect(slider.getAttribute('aria-valuenow')).toBe('40')
    act(() => { slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })) })
    expect(onBreakChange).toHaveBeenCalledWith(1, 41)
  })

  it('helpers: class of a value, a clamped break, a short value', () => {
    expect(classIndexOf(10, [0, 40, 100])).toBe(0)
    expect(classIndexOf(40, [0, 40, 100])).toBe(1)
    expect(classIndexOf(100, [0, 40, 100])).toBe(1)
    expect(clampBreak(1, 500, [0, 40, 100])).toBeLessThan(100)
    expect(clampBreak(1, -5, [0, 40, 100])).toBeGreaterThan(0)
    expect(formatBreakValue(1234.5678)).toBe((1235).toLocaleString())
  })
})
