import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'

/**
 * ProfileChart — distance against height along a path (stareSDK, operator-approved 2026-10-06,
 * #275; first consumer: ATLAS terrain analysis).
 *
 * Plain SVG, so every colour is a design token read through `var()` and follows the theme with no
 * re-render: the terrain line and its fill are the accent, the optional sight line is secondary
 * text (dashed), and the optional obstruction is the destructive tone. A `null` height is a gap in
 * the terrain line, never an interpolated value. The chart adds no controls.
 */

/** One terrain sample: its distance along the path and the height there (`null` = no data). */
export interface ProfileChartSample {
  distance_m: number
  height_m: number | null
}

/** A point of the sight line, or the obstruction. */
export interface ProfileChartPoint {
  distance_m: number
  height_m: number
}

export interface ProfileChartProps {
  samples: readonly ProfileChartSample[]
  /** The observer→target sight line, drawn dashed over the terrain. */
  sightLine?: readonly ProfileChartPoint[]
  /** Where terrain first rises through the sight line. */
  obstruction?: ProfileChartPoint | null
  /** The distance axis unit (values stay metres). Default: kilometres when the path is at least
   *  1 km long, else metres. */
  distanceUnit?: 'm' | 'km' | 'nm'
  /** The height axis unit (values stay metres). Default metres. */
  heightUnit?: 'm' | 'ft'
  /** Plot height in pixels. Default 160. */
  height?: number
  'aria-label': string
  style?: CSSProperties
}

/** Room for the axis labels around the plot. */
const MARGIN = { top: 8, right: 8, bottom: 18, left: 44 }

const METRES_PER: Record<'m' | 'km' | 'nm' | 'ft', number> = { m: 1, km: 1000, nm: 1852, ft: 0.3048 }

/** Width used until the container has been measured (and where ResizeObserver is unavailable). */
const FALLBACK_WIDTH = 320

/** Compact axis value: whole numbers from 100 up, one decimal below. Exported for tests. */
export function formatAxisValue(v: number): string {
  if (!Number.isFinite(v)) return '—'
  const a = Math.abs(v)
  return a >= 100 || Number.isInteger(v) ? Math.round(v).toLocaleString() : v.toFixed(1)
}

/**
 * The terrain as runs of consecutive samples that have a height — one SVG subpath per run, so a
 * gap (`null`) breaks the line. Exported for tests.
 */
export function terrainRuns(samples: readonly ProfileChartSample[]): ProfileChartPoint[][] {
  const runs: ProfileChartPoint[][] = []
  let run: ProfileChartPoint[] = []
  for (const s of samples) {
    if (s.height_m === null || !Number.isFinite(s.height_m)) {
      if (run.length > 0) runs.push(run)
      run = []
    } else {
      run.push({ distance_m: s.distance_m, height_m: s.height_m })
    }
  }
  if (run.length > 0) runs.push(run)
  return runs
}

export function ProfileChart({
  samples,
  sightLine,
  obstruction,
  distanceUnit,
  heightUnit = 'm',
  height = 160,
  'aria-label': ariaLabel,
  style,
}: ProfileChartProps) {
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(FALLBACK_WIDTH)

  useEffect(() => {
    const el = box.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.floor(entry.contentRect.width)
      if (w > 0) setWidth(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const runs = useMemo(() => terrainRuns(samples), [samples])

  const scale = useMemo(() => {
    let maxD = 0
    let minH = Infinity
    let maxH = -Infinity
    const take = (p: ProfileChartPoint) => {
      if (p.distance_m > maxD) maxD = p.distance_m
      if (p.height_m < minH) minH = p.height_m
      if (p.height_m > maxH) maxH = p.height_m
    }
    for (const s of samples) if (s.distance_m > maxD) maxD = s.distance_m
    runs.forEach(r => r.forEach(take))
    sightLine?.forEach(take)
    if (obstruction) take(obstruction)
    if (!Number.isFinite(minH)) { minH = 0; maxH = 1 }
    // A flat profile still needs a visible band; otherwise pad 5% above and below.
    const pad = maxH - minH > 0 ? (maxH - minH) * 0.05 : 1
    return { maxD: maxD > 0 ? maxD : 1, minH: minH - pad, maxH: maxH + pad }
  }, [samples, runs, sightLine, obstruction])

  const plotW = Math.max(1, width - MARGIN.left - MARGIN.right)
  const plotH = Math.max(1, height - MARGIN.top - MARGIN.bottom)
  const x = (d: number) => MARGIN.left + (d / scale.maxD) * plotW
  const y = (h: number) => MARGIN.top + (1 - (h - scale.minH) / (scale.maxH - scale.minH)) * plotH
  const baseY = MARGIN.top + plotH

  const line = (pts: readonly ProfileChartPoint[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.distance_m).toFixed(1)},${y(p.height_m).toFixed(1)}`).join('')
  const terrainPath = runs.map(line).join('')
  const terrainArea = runs
    .map(r => `${line(r)}L${x(r[r.length - 1].distance_m).toFixed(1)},${baseY}L${x(r[0].distance_m).toFixed(1)},${baseY}Z`)
    .join('')

  const unit = distanceUnit ?? (scale.maxD >= 1000 ? 'km' : 'm')
  const distanceLabel = (d: number) => `${formatAxisValue(d / METRES_PER[unit])} ${unit}`
  const heightLabel = (h: number) => `${formatAxisValue(h / METRES_PER[heightUnit])} ${heightUnit}`
  const label: CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--color-text-secondary)' }

  return (
    <div ref={box} style={{ width: '100%', ...style }}>
      <svg width={width} height={height} role="img" aria-label={ariaLabel} style={{ display: 'block' }}>
        {/* Frame: top and bottom grid lines at the height bounds. */}
        <line x1={MARGIN.left} x2={MARGIN.left + plotW} y1={MARGIN.top} y2={MARGIN.top} stroke="var(--color-glass-border)" strokeWidth={1} />
        <line x1={MARGIN.left} x2={MARGIN.left + plotW} y1={baseY} y2={baseY} stroke="var(--color-glass-border)" strokeWidth={1} />
        <line x1={MARGIN.left} x2={MARGIN.left} y1={MARGIN.top} y2={baseY} stroke="var(--color-glass-border)" strokeWidth={1} />

        {terrainArea && <path data-series="terrain-area" d={terrainArea} fill="var(--color-accent)" fillOpacity={0.15} stroke="none" />}
        {terrainPath && (
          <path data-series="terrain" d={terrainPath} fill="none" stroke="var(--color-accent)" strokeWidth={1.5} strokeLinejoin="round" />
        )}
        {sightLine && sightLine.length > 1 && (
          <path
            data-series="sight-line"
            d={line(sightLine)}
            fill="none"
            stroke="var(--color-text-secondary)"
            strokeWidth={1}
            strokeDasharray="4 3"
          />
        )}
        {obstruction && (
          <circle
            data-series="obstruction"
            cx={x(obstruction.distance_m)}
            cy={y(obstruction.height_m)}
            r={3.5}
            fill="var(--color-destructive)"
            stroke="var(--color-bg-primary)"
            strokeWidth={1}
          />
        )}

        {/* Height bounds on the left, distance bounds along the bottom. */}
        <text x={MARGIN.left - 4} y={MARGIN.top + 3} textAnchor="end" dominantBaseline="middle" style={label}>
          {heightLabel(scale.maxH)}
        </text>
        <text x={MARGIN.left - 4} y={baseY} textAnchor="end" dominantBaseline="middle" style={label}>
          {heightLabel(scale.minH)}
        </text>
        <text x={MARGIN.left} y={height - 4} textAnchor="start" style={label}>
          {distanceLabel(0)}
        </text>
        <text x={MARGIN.left + plotW} y={height - 4} textAnchor="end" style={label}>
          {distanceLabel(scale.maxD)}
        </text>
      </svg>
    </div>
  )
}
