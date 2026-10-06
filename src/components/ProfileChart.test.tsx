// @vitest-environment jsdom
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { ProfileChart, formatAxisValue, terrainRuns } from './ProfileChart.js'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const cleanups: Array<() => void> = []
afterEach(() => cleanups.splice(0).forEach(f => f()))

function render(ui: React.ReactElement): HTMLElement {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => { root.render(ui) })
  cleanups.push(() => { act(() => root.unmount()); container.remove() })
  return container
}

/** The number of subpaths (`M` commands) in a path's `d`. */
function subpaths(d: string | null): number {
  return (d ?? '').split('M').length - 1
}

describe('terrainRuns', () => {
  it('splits the samples at every null height', () => {
    const runs = terrainRuns([
      { distance_m: 0, height_m: 10 },
      { distance_m: 10, height_m: 12 },
      { distance_m: 20, height_m: null },
      { distance_m: 30, height_m: 15 },
      { distance_m: 40, height_m: 16 },
    ])
    expect(runs).toHaveLength(2)
    expect(runs[0].map(p => p.distance_m)).toEqual([0, 10])
    expect(runs[1].map(p => p.distance_m)).toEqual([30, 40])
  })

  it('returns no runs when no sample has a height', () => {
    expect(terrainRuns([{ distance_m: 0, height_m: null }])).toEqual([])
  })
})

describe('formatAxisValue', () => {
  it('rounds large values and keeps one decimal on small ones', () => {
    expect(formatAxisValue(1234.6)).toBe((1235).toLocaleString())
    expect(formatAxisValue(12.34)).toBe('12.3')
    expect(formatAxisValue(5)).toBe('5')
  })
})

describe('ProfileChart', () => {
  it('renders the terrain line, its fill and the axis bounds', () => {
    const c = render(
      <ProfileChart
        aria-label="Elevation profile"
        samples={[
          { distance_m: 0, height_m: 100 },
          { distance_m: 1000, height_m: 150 },
          { distance_m: 2000, height_m: 120 },
        ]}
      />,
    )
    const svg = c.querySelector('svg[aria-label="Elevation profile"]')
    expect(svg).toBeTruthy()
    expect(subpaths(c.querySelector('[data-series="terrain"]')!.getAttribute('d'))).toBe(1)
    expect(c.querySelector('[data-series="terrain-area"]')).toBeTruthy()
    // A 2 km path is labelled in kilometres.
    expect(c.textContent).toContain('2 km')
    expect(c.textContent).toContain('0 km')
    // Chrome and data colours are tokens, never literals.
    expect(c.querySelector('[data-series="terrain"]')!.getAttribute('stroke')).toBe('var(--color-accent)')
    expect(c.querySelector('[data-series="sight-line"]')).toBeNull()
    expect(c.querySelector('[data-series="obstruction"]')).toBeNull()
  })

  it('breaks the terrain line at a gap instead of bridging it', () => {
    const c = render(
      <ProfileChart
        aria-label="Profile"
        samples={[
          { distance_m: 0, height_m: 10 },
          { distance_m: 100, height_m: 11 },
          { distance_m: 200, height_m: null },
          { distance_m: 300, height_m: 12 },
          { distance_m: 400, height_m: 13 },
        ]}
      />,
    )
    expect(subpaths(c.querySelector('[data-series="terrain"]')!.getAttribute('d'))).toBe(2)
    // A sub-kilometre path is labelled in metres.
    expect(c.textContent).toContain('400 m')
  })

  it('draws the sight line dashed and marks the obstruction', () => {
    const c = render(
      <ProfileChart
        aria-label="Line of sight"
        samples={[
          { distance_m: 0, height_m: 10 },
          { distance_m: 500, height_m: 40 },
          { distance_m: 1000, height_m: 10 },
        ]}
        sightLine={[
          { distance_m: 0, height_m: 12 },
          { distance_m: 1000, height_m: 10 },
        ]}
        obstruction={{ distance_m: 500, height_m: 40 }}
        distanceUnit="m"
      />,
    )
    const sight = c.querySelector('[data-series="sight-line"]')!
    expect(sight.getAttribute('stroke-dasharray')).toBe('4 3')
    expect(subpaths(sight.getAttribute('d'))).toBe(1)
    const obstruction = c.querySelector('[data-series="obstruction"]')!
    expect(obstruction.getAttribute('fill')).toBe('var(--color-destructive)')
    // An explicit unit wins over the automatic choice.
    expect(c.textContent).toContain(`${(1000).toLocaleString()} m`)
  })

  it('labels the axes in nautical miles and feet when asked', () => {
    const c = render(
      <ProfileChart
        aria-label="Nautical"
        samples={[
          { distance_m: 0, height_m: 0 },
          { distance_m: 3704, height_m: 30.48 },
        ]}
        distanceUnit="nm"
        heightUnit="ft"
      />,
    )
    expect(c.textContent).toContain('2 nm')
    expect(c.textContent).toContain(' ft')
    expect(c.textContent).not.toContain(' m')
  })

  it('renders an empty frame when no sample has a height', () => {
    const c = render(<ProfileChart aria-label="Empty" samples={[{ distance_m: 0, height_m: null }]} />)
    expect(c.querySelector('svg')).toBeTruthy()
    expect(c.querySelector('[data-series="terrain"]')).toBeNull()
  })
})
