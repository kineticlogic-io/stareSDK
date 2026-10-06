/**
 * units.ts — the shared unit vocabularies and conversions behind `UnitSelect` (#263, operator-approved
 * 2026-10-05). One definition per family, so tool forms (#264–#266) and the layer Elevation setting
 * (#272) never hand-roll unit math.
 */

export type UnitFamily = 'distance' | 'elevation' | 'elevation-reference' | 'orientation' | 'confidence'

export type DistanceUnit = 'm' | 'km' | 'ft' | 'mi' | 'nmi'
export type ElevationUnit = 'm' | 'ft' | 'fl'
export type ElevationReference = 'msl' | 'ellipsoid' | 'ground'
export type OrientationConvention = 'cw-north' | 'ccw-east'
/** A 2D confidence level, as a probability string (`'0.95'`). */
export type ConfidenceLevel = '0.393' | '0.5' | '0.865' | '0.9' | '0.95' | '0.989' | '0.99'

export interface UnitOption {
  value: string
  label: string
}

/** The option list for each family, in display order. The first entry is the default. */
export const UNIT_OPTIONS: Record<UnitFamily, readonly UnitOption[]> = {
  distance: [
    { value: 'm', label: 'Meters' },
    { value: 'km', label: 'Kilometers' },
    { value: 'ft', label: 'Feet' },
    { value: 'mi', label: 'Statute miles' },
    { value: 'nmi', label: 'Nautical miles' },
  ],
  elevation: [
    { value: 'm', label: 'Meters' },
    { value: 'ft', label: 'Feet' },
    { value: 'fl', label: 'Flight level' },
  ],
  'elevation-reference': [
    { value: 'msl', label: 'Above sea level' },
    { value: 'ellipsoid', label: 'Above ellipsoid (GPS)' },
    { value: 'ground', label: 'Above ground' },
  ],
  orientation: [
    { value: 'cw-north', label: 'Degrees clockwise from north' },
    { value: 'ccw-east', label: 'Degrees counter-clockwise from east' },
  ],
  confidence: [
    { value: '0.95', label: '95%' },
    { value: '0.393', label: '39.3% (1σ)' },
    { value: '0.5', label: '50% (CEP)' },
    { value: '0.865', label: '86.5% (2σ)' },
    { value: '0.9', label: '90%' },
    { value: '0.989', label: '98.9% (3σ)' },
    { value: '0.99', label: '99%' },
  ],
}

const METERS_PER: Record<DistanceUnit, number> = { m: 1, km: 1000, ft: 0.3048, mi: 1609.344, nmi: 1852 }

/** A distance in `unit`, in meters. */
export function distanceToMeters(value: number, unit: DistanceUnit): number {
  return value * METERS_PER[unit]
}

/** An elevation in `unit`, in meters. A flight level is hundreds of feet (FL350 = 35,000 ft). */
export function elevationToMeters(value: number, unit: ElevationUnit): number {
  if (unit === 'm') return value
  if (unit === 'ft') return value * 0.3048
  return value * 100 * 0.3048
}

/** An orientation in `convention`, as degrees clockwise from north in `[0, 360)`. */
export function orientationToCompassDegrees(value: number, convention: OrientationConvention): number {
  const deg = convention === 'cw-north' ? value : 90 - value
  return ((deg % 360) + 360) % 360
}

/**
 * The scale of a 2D error ellipse at confidence `p`, relative to its 1σ ellipse: √(−2 ln(1 − p))
 * (the chi-square quantile for two degrees of freedom). 1σ covers 39.3%, not the 1D 68%.
 */
export function ellipseScaleForConfidence(p: number): number {
  return Math.sqrt(-2 * Math.log(1 - p))
}

/** Rescales an ellipse axis drawn at confidence `from` to the same ellipse at confidence `to`. */
export function rescaleEllipseAxis(axis: number, from: ConfidenceLevel, to: ConfidenceLevel): number {
  return axis * (ellipseScaleForConfidence(Number(to)) / ellipseScaleForConfidence(Number(from)))
}
