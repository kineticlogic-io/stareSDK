// @vitest-environment jsdom
/**
 * RangeSlider tests — React 19 createRoot + act + native DOM events (project convention).
 */
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { RangeSlider } from './RangeSlider.js'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const cleanups: Array<() => void> = []
afterEach(() => {
  cleanups.splice(0).forEach((f) => f())
})

function render(onChange: (a: number, b: number) => void, minValue = 16, maxValue = 48) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() =>
    root.render(
      <RangeSlider
        minValue={minValue}
        maxValue={maxValue}
        onChange={onChange}
        min={8}
        max={96}
        ariaLabels={['Smallest cluster', 'Largest cluster']}
        formatValue={(v) => `${v} px`}
      />,
    ),
  )
  cleanups.push(() => {
    act(() => root.unmount())
    container.remove()
  })
  return container
}

const handle = (c: HTMLElement, name: string) => c.querySelector(`input[aria-label="${name}"]`) as HTMLInputElement

/** Sets a range input's value the way a drag does, so React's onChange fires. */
function drag(input: HTMLInputElement, value: number) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  act(() => {
    setter.call(input, String(value))
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('RangeSlider', () => {
  it('names each handle and shows each end formatted', () => {
    const c = render(vi.fn())
    expect(handle(c, 'Smallest cluster').getAttribute('aria-valuetext')).toBe('16 px')
    expect(handle(c, 'Largest cluster').getAttribute('aria-valuetext')).toBe('48 px')
    const shown = Array.from(c.querySelectorAll('.range-slider__value')).map((e) => e.textContent)
    expect(shown).toEqual(['16 px', '48 px'])
  })

  it('moves one handle and keeps the other', () => {
    const onChange = vi.fn()
    const c = render(onChange)
    drag(handle(c, 'Smallest cluster'), 20)
    expect(onChange).toHaveBeenLastCalledWith(20, 48)
    drag(handle(c, 'Largest cluster'), 60)
    expect(onChange).toHaveBeenLastCalledWith(16, 60)
  })

  it('never lets the handles cross', () => {
    const onChange = vi.fn()
    const c = render(onChange)
    drag(handle(c, 'Smallest cluster'), 70)
    expect(onChange).toHaveBeenLastCalledWith(48, 48)
    drag(handle(c, 'Largest cluster'), 10)
    expect(onChange).toHaveBeenLastCalledWith(16, 16)
  })
})
