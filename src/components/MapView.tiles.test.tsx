/**
 * MapView's `tiles` basemap, against a fake MapLibre map that records sources, layers, layout and
 * controls. React 19 createRoot + act (project convention — no @testing-library/react).
 */
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'

const maps: FakeMap[] = []

class FakeMap {
  sources = new Map<string, unknown>()
  layers: string[] = []
  layout = new Map<string, string>()
  controls: unknown[] = []
  touchZoomRotate = { disableRotation() {} }
  private load?: () => void
  constructor() {
    maps.push(this)
  }
  on(event: string, a: unknown) {
    if (event === 'load') this.load = a as () => void
  }
  fire() {
    this.load?.()
  }
  addSource(id: string, spec: unknown) {
    this.sources.set(id, { ...(spec as object), setData() {} })
  }
  getSource(id: string) {
    return this.sources.get(id)
  }
  removeSource(id: string) {
    this.sources.delete(id)
  }
  addLayer(spec: { id: string }, before?: string) {
    const i = before ? this.layers.indexOf(before) : -1
    if (i >= 0) this.layers.splice(i, 0, spec.id)
    else this.layers.push(spec.id)
  }
  removeLayer(id: string) {
    this.layers = this.layers.filter((l) => l !== id)
  }
  setLayoutProperty(layer: string, _prop: string, value: string) {
    this.layout.set(layer, value)
  }
  setPaintProperty() {}
  addControl(c: unknown) {
    this.controls.push(c)
  }
  removeControl(c: unknown) {
    this.controls = this.controls.filter((x) => x !== c)
  }
  getCanvas() {
    return { style: {} }
  }
  fitBounds() {}
  easeTo() {}
  remove() {}
}

vi.mock('maplibre-gl', () => ({
  Map: FakeMap,
  Popup: class {
    remove() {}
  },
  AttributionControl: class {},
}))

const { MapView } = await import('./MapView')

let cleanup: (() => void) | null = null
afterEach(() => {
  cleanup?.()
  cleanup = null
  maps.length = 0
})

function mount(tiles?: { url: string; attribution?: string }) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const render = (t?: { url: string; attribution?: string }) =>
    act(() => {
      root.render(<MapView points={[]} aria-label="Map" tiles={t} />)
    })
  render(tiles)
  act(() => maps[0].fire())
  cleanup = () => {
    act(() => root.unmount())
    container.remove()
  }
  return { map: maps[0], render }
}

describe('MapView tiles', () => {
  it('draws the offline basemap without tiles', () => {
    const { map } = mount()
    expect(map.sources.has('basemap')).toBe(false)
    expect(map.layout.get('land')).toBeUndefined()
  })

  it('draws the tiles above the ocean and hides the land and borders', () => {
    const { map } = mount({ url: 'https://tiles.example/{z}/{x}/{y}.png', attribution: '© Example' })
    expect(map.sources.get('basemap')).toMatchObject({ type: 'raster', tiles: ['https://tiles.example/{z}/{x}/{y}.png'], tileSize: 256 })
    expect(map.layers.indexOf('basemap')).toBe(map.layers.indexOf('land') - 1)
    expect(map.layers.indexOf('basemap')).toBeGreaterThan(map.layers.indexOf('background'))
    expect(map.layout.get('land')).toBe('none')
    expect(map.layout.get('borders')).toBe('none')
    expect(map.controls).toHaveLength(1)
  })

  it('goes back to the offline basemap when the tiles are removed', () => {
    const { map, render } = mount({ url: 'https://tiles.example/{z}/{x}/{y}.png' })
    expect(map.controls).toHaveLength(0)
    render({ url: '  ' })
    expect(map.sources.has('basemap')).toBe(false)
    expect(map.layers).not.toContain('basemap')
    expect(map.layout.get('land')).toBe('visible')
    expect(map.layout.get('borders')).toBe('visible')
  })
})
