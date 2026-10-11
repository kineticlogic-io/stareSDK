// @vitest-environment jsdom
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { UnitSelect } from './UnitSelect.js'

describe('UnitSelect (#263)', () => {
  it('offers the family\'s options and reports the picked value', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    const onChange = vi.fn()
    act(() => { root.render(<UnitSelect family="elevation" value="ft" onChange={onChange} ariaLabel="Elevation unit" />) })
    const select = container.querySelector('select[aria-label="Elevation unit"]') as HTMLSelectElement
    expect([...select.options].map(o => o.value)).toEqual(['m', 'ft', 'fl'])
    expect(select.value).toBe('ft')
    act(() => {
      select.value = 'fl'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(onChange).toHaveBeenCalledWith('fl')
    act(() => { root.unmount() })
    container.remove()
  })

  it('offers the speed and time families (0.2.18)', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    const onSpeed = vi.fn()
    act(() => {
      root.render(
        <>
          <UnitSelect family="speed" value="kn" onChange={onSpeed} ariaLabel="Speed unit" />
          <UnitSelect family="time" value="min" onChange={() => {}} ariaLabel="Time unit" />
        </>,
      )
    })
    const speed = container.querySelector('select[aria-label="Speed unit"]') as HTMLSelectElement
    const time = container.querySelector('select[aria-label="Time unit"]') as HTMLSelectElement
    expect([...speed.options].map(o => o.value)).toEqual(['mps', 'kph', 'kn', 'mph'])
    expect(speed.value).toBe('kn')
    expect([...time.options].map(o => o.value)).toEqual(['s', 'min', 'h', 'd'])
    expect(time.value).toBe('min')
    act(() => {
      speed.value = 'mph'
      speed.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(onSpeed).toHaveBeenCalledWith('mph')
    act(() => { root.unmount() })
    container.remove()
  })
})
