import { describe, it, expect } from 'vitest'
import {
  UNIT_OPTIONS, distanceToMeters, elevationToMeters, orientationToCompassDegrees,
  ellipseScaleForConfidence, rescaleEllipseAxis, speedToMetersPerSecond, speedFromMetersPerSecond,
  durationToSeconds, durationFromSeconds,
} from './units.js'

describe('units (#263)', () => {
  it('lists the approved options per family, default first', () => {
    expect(UNIT_OPTIONS.distance.map(o => o.value)).toEqual(['m', 'km', 'ft', 'mi', 'nmi'])
    expect(UNIT_OPTIONS.elevation.map(o => o.value)).toEqual(['m', 'ft', 'fl'])
    expect(UNIT_OPTIONS['elevation-reference'].map(o => o.value)).toEqual(['msl', 'ellipsoid', 'ground'])
    expect(UNIT_OPTIONS.orientation.map(o => o.value)).toEqual(['cw-north', 'ccw-east'])
    expect(UNIT_OPTIONS.confidence[0].value).toBe('0.95')
    expect(UNIT_OPTIONS.speed.map(o => o.value)).toEqual(['mps', 'kph', 'kn', 'mph'])
    expect(UNIT_OPTIONS.time.map(o => o.value)).toEqual(['s', 'min', 'h', 'd'])
  })

  it('converts distances to meters', () => {
    expect(distanceToMeters(2, 'km')).toBe(2000)
    expect(distanceToMeters(1, 'nmi')).toBe(1852)
    expect(distanceToMeters(1, 'mi')).toBeCloseTo(1609.344)
    expect(distanceToMeters(10, 'ft')).toBeCloseTo(3.048)
  })

  it('converts elevations to meters; a flight level is hundreds of feet', () => {
    expect(elevationToMeters(100, 'm')).toBe(100)
    expect(elevationToMeters(1000, 'ft')).toBeCloseTo(304.8)
    expect(elevationToMeters(350, 'fl')).toBeCloseTo(10668)
  })

  it('normalizes orientation to degrees clockwise from north', () => {
    expect(orientationToCompassDegrees(30, 'cw-north')).toBe(30)
    expect(orientationToCompassDegrees(0, 'ccw-east')).toBe(90)
    expect(orientationToCompassDegrees(90, 'ccw-east')).toBe(0)
    expect(orientationToCompassDegrees(180, 'ccw-east')).toBe(270)
    expect(orientationToCompassDegrees(-30, 'cw-north')).toBe(330)
  })

  it('scales 2D ellipses by confidence (1σ = 39.3%, 2σ = 86.5%)', () => {
    expect(ellipseScaleForConfidence(0.393)).toBeCloseTo(1, 2)
    expect(ellipseScaleForConfidence(0.865)).toBeCloseTo(2, 2)
    expect(ellipseScaleForConfidence(0.95)).toBeCloseTo(2.4477, 3)
    expect(rescaleEllipseAxis(100, '0.95', '0.393')).toBeCloseTo(100 / 2.4477, 1)
  })

  it('converts speeds to and from meters per second (0.2.18)', () => {
    expect(speedToMetersPerSecond(5, 'mps')).toBe(5)
    expect(speedToMetersPerSecond(36, 'kph')).toBeCloseTo(10)
    expect(speedToMetersPerSecond(1, 'kn')).toBeCloseTo(0.514444, 5)
    expect(speedToMetersPerSecond(1, 'mph')).toBeCloseTo(0.44704, 5)
    expect(speedFromMetersPerSecond(10, 'kph')).toBeCloseTo(36)
    expect(speedFromMetersPerSecond(1852 / 3600, 'kn')).toBeCloseTo(1)
    expect(speedFromMetersPerSecond(0.44704, 'mph')).toBeCloseTo(1)
    for (const u of ['mps', 'kph', 'kn', 'mph'] as const) {
      expect(speedFromMetersPerSecond(speedToMetersPerSecond(12.5, u), u)).toBeCloseTo(12.5)
    }
  })

  it('converts durations to and from seconds (0.2.18)', () => {
    expect(durationToSeconds(30, 's')).toBe(30)
    expect(durationToSeconds(5, 'min')).toBe(300)
    expect(durationToSeconds(2, 'h')).toBe(7200)
    expect(durationToSeconds(1.5, 'd')).toBe(129600)
    expect(durationFromSeconds(300, 'min')).toBe(5)
    expect(durationFromSeconds(5400, 'h')).toBe(1.5)
    expect(durationFromSeconds(86400, 'd')).toBe(1)
    for (const u of ['s', 'min', 'h', 'd'] as const) {
      expect(durationFromSeconds(durationToSeconds(7, u), u)).toBeCloseTo(7)
    }
  })
})
