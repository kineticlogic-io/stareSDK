// @vitest-environment jsdom
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { Stepper } from './Stepper.js'

const cleanups: Array<() => void> = []
afterEach(() => {
  cleanups.splice(0).forEach((f) => f())
})

function render(onStepClick?: (id: string) => void) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() =>
    root.render(
      <Stepper
        aria-label="Add source"
        onStepClick={onStepClick}
        steps={[
          { id: 'connect', label: 'Connect', status: 'complete' },
          { id: 'probe', label: 'Probe', status: 'error' },
          { id: 'map', label: 'Map', status: 'current' },
          { id: 'review', label: 'Review', status: 'upcoming' },
        ]}
      />,
    ),
  )
  cleanups.push(() => {
    act(() => root.unmount())
    container.remove()
  })
  return container
}

describe('Stepper', () => {
  it('marks the current step and only lets completed or failed steps be revisited', () => {
    const onStepClick = vi.fn()
    const c = render(onStepClick)
    expect(c.querySelector('[aria-current="step"]')!.textContent).toContain('Map')
    const buttons = c.querySelectorAll('button')
    expect([...buttons].map((b) => b.textContent)).toEqual(['Connect (complete)', 'Probe (needs attention)'])
    act(() => buttons[1].click())
    expect(onStepClick).toHaveBeenCalledWith('probe')
  })

  it('is not interactive without onStepClick', () => {
    expect(render().querySelectorAll('button')).toHaveLength(0)
  })
})
