// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'

// MapLibre needs WebGL, which jsdom lacks; the pure helpers are what is tested here.
vi.mock('maplibre-gl', () => ({ Map: class {}, Popup: class {} }))
const { coordinateBounds, linesToGeoJSON, pointBounds, pointsToGeoJSON } = await import('./MapView.js')

describe('MapView helpers', () => {
  const points = [
    { id: 'a', latitude: 32.7, longitude: -117.2, color: '#3987e5', label: 'ALPHA' },
    { id: 'b', latitude: 21.3, longitude: -157.9 },
    { id: 'bad', latitude: 95, longitude: 0 },
    { id: 'nan', latitude: Number.NaN, longitude: 0 },
  ]

  it('builds features, skipping invalid coordinates and marking the selection', () => {
    const fc = pointsToGeoJSON(points, 'b', 'DEFAULT')
    expect(fc.features.map((f) => f.properties.id)).toEqual(['a', 'b'])
    expect(fc.features[0].geometry.coordinates).toEqual([-117.2, 32.7])
    expect(fc.features[0].properties).toMatchObject({ color: '#3987e5', label: 'ALPHA', selected: false })
    expect(fc.features[1].properties).toMatchObject({ color: 'DEFAULT', label: 'b', selected: true })
  })

  it('computes bounds for fitting', () => {
    expect(pointBounds(points.slice(0, 2))).toEqual([
      [-157.9, 21.3],
      [-117.2, 32.7],
    ])
    expect(pointBounds([])).toBeNull()
  })

  it('builds lines, dropping invalid coordinates and lines left too short', () => {
    const fc = linesToGeoJSON(
      [
        { id: 'trail', coordinates: [[-117.2, 32.7], [Number.NaN, 0], [-117.1, 32.8], [0, 95]], color: '#e53935', width: 3, dashed: true },
        { id: 'plain', coordinates: [[0, 0], [1, 1]] },
        { id: 'short', coordinates: [[0, 0], [200, 0]] },
      ],
      'DEFAULT',
    )
    expect(fc.features.map((f) => f.properties.id)).toEqual(['trail', 'plain'])
    expect(fc.features[0].geometry.coordinates).toEqual([
      [-117.2, 32.7],
      [-117.1, 32.8],
    ])
    expect(fc.features[0].properties).toEqual({ id: 'trail', color: '#e53935', width: 3, opacity: 0.9, dashed: true })
    expect(fc.features[1].properties).toEqual({ id: 'plain', color: 'DEFAULT', width: 2, opacity: 0.9, dashed: false })
  })

  it('computes bounds of coordinates for fitTo', () => {
    expect(
      coordinateBounds([
        [-117.2, 32.7],
        [-157.9, 21.3],
        [Number.NaN, 0],
      ]),
    ).toEqual([
      [-157.9, 21.3],
      [-117.2, 32.7],
    ])
    expect(coordinateBounds([[10, 20]])).toEqual([
      [10, 20],
      [10, 20],
    ])
    expect(coordinateBounds([])).toBeNull()
  })
})
