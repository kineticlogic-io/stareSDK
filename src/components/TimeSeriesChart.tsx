import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import uPlot from 'uplot'

/**
 * TimeSeriesChart — a compact line chart over time (stareSDK, operator-approved 2026-09-25; first
 * consumer: OpenTrack's system metrics).
 *
 * Rendering is uPlot (canvas, fast with live data), an optional peer, which is why this component
 * lives behind its own entry point (`staresdk/chart`). Consumers import uPlot's structural
 * stylesheet once: `import 'uplot/dist/uPlot.min.css'`.
 *
 * Canvas cannot read CSS variables, so every colour and font is resolved from the design tokens on
 * the chart's own element and re-resolved when the theme changes (`data-theme` on `<html>`).
 * Series pick a `tone`, never a colour. uPlot's legend is replaced by a compact token-styled one
 * that shows each series' value under the cursor, or its latest value. The chart adds no controls.
 */
export type ChartTone = 'accent' | 'info' | 'success' | 'warning' | 'danger' | 'neutral'

export interface ChartSeries {
  label: string
  /** One value per entry in `times`; `null` is a gap. */
  values: (number | null)[]
  tone?: ChartTone
}

export interface TimeSeriesChartProps {
  /** Unix seconds, ascending. */
  times: number[]
  series: ChartSeries[]
  /** Appended to values in the legend, e.g. `/min` or ` MB`. */
  unit?: string
  /** Plot height in pixels (the legend adds one line). Default 140. */
  height?: number
  'aria-label': string
  style?: CSSProperties
}

const TONE_TOKEN: Record<ChartTone, string> = {
  accent: '--color-accent',
  info: '--status-info',
  success: '--status-success',
  warning: '--status-warning',
  danger: '--color-destructive',
  neutral: '--color-text-secondary',
}

/** Tone for the i-th series when it names none: accent first, then distinct status colours. */
const TONE_ORDER: ChartTone[] = ['accent', 'info', 'warning', 'danger', 'neutral', 'success']

export function toneOf(s: ChartSeries, i: number): ChartTone {
  return s.tone ?? TONE_ORDER[i % TONE_ORDER.length]
}

/** Compact legend value: 1234 → 1.2k, 0.25 → 0.25, null → —. Exported for tests. */
export function formatValue(v: number | null | undefined, unit = ''): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—'
  const a = Math.abs(v)
  const n =
    a >= 1e9 ? `${(v / 1e9).toFixed(1)}G` :
    a >= 1e6 ? `${(v / 1e6).toFixed(1)}M` :
    a >= 1e4 ? `${(v / 1e3).toFixed(1)}k` :
    Number.isInteger(v) ? String(v) :
    a >= 100 ? v.toFixed(0) : a >= 1 ? v.toFixed(1) : v.toFixed(2)
  return `${n}${unit}`
}

/** The last non-null value of a series. */
function latest(values: (number | null)[]): number | null {
  for (let i = values.length - 1; i >= 0; i--) if (values[i] !== null) return values[i]
  return null
}

interface Palette {
  axis: string
  grid: string
  font: string
  series: string[]
}

function readPalette(el: HTMLElement, series: ChartSeries[]): Palette {
  const css = getComputedStyle(el)
  const token = (name: string) => css.getPropertyValue(name).trim()
  const sans = token('--font-sans') || 'sans-serif'
  return {
    axis: token('--color-text-secondary'),
    grid: token('--color-glass-border'),
    font: `10px ${sans}`,
    series: series.map((s, i) => token(TONE_TOKEN[toneOf(s, i)])),
  }
}

/** Re-render when the app switches theme. */
function useThemeVersion(): number {
  const [v, setV] = useState(0)
  useEffect(() => {
    const obs = new MutationObserver(() => setV((n) => n + 1))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] })
    return () => obs.disconnect()
  }, [])
  return v
}

export function TimeSeriesChart({ times, series, unit = '', height = 140, 'aria-label': ariaLabel, style }: TimeSeriesChartProps) {
  const box = useRef<HTMLDivElement>(null)
  const plot = useRef<uPlot | null>(null)
  const [width, setWidth] = useState(0)
  const [cursor, setCursor] = useState<number | null>(null)
  const theme = useThemeVersion()
  // Rebuild only when the shape changes; new data alone goes through setData.
  const shape = series.map((s, i) => `${s.label}:${toneOf(s, i)}`).join('|')

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const data = useMemo(() => [times, ...series.map((s) => s.values)] as uPlot.AlignedData, [times, series])

  useEffect(() => {
    const el = box.current
    if (!el || width === 0) return
    const p = readPalette(el, series)
    const axis: uPlot.Axis = {
      stroke: p.axis,
      font: p.font,
      size: 28,
      gap: 4,
      grid: { stroke: p.grid, width: 1 },
      ticks: { stroke: p.grid, width: 1, size: 4 },
    }
    const u = new uPlot(
      {
        width,
        height,
        legend: { show: false },
        cursor: { y: false, points: { size: 5 } },
        padding: [6, 6, 0, 0],
        scales: { x: { time: true }, y: { range: (_u, min, max) => [Math.min(0, min), max > 0 ? max * 1.1 : 1] } },
        axes: [axis, { ...axis, size: 40, values: (_u, ticks) => ticks.map((t) => formatValue(t)) }],
        series: [{}, ...series.map((s, i) => ({ label: s.label, stroke: p.series[i], width: 1.5, points: { show: false } }))],
        hooks: { setCursor: [(u) => setCursor(u.cursor.idx ?? null)] },
      },
      data,
      el.querySelector('[data-plot]') as HTMLElement,
    )
    plot.current = u
    return () => {
      u.destroy()
      plot.current = null
    }
    // `data` is applied below without rebuilding; `series` is covered by `shape`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, shape, theme])

  useEffect(() => {
    plot.current?.setData(data)
  }, [data])

  return (
    <div
      ref={box}
      role="img"
      aria-label={ariaLabel}
      style={{ width: '100%', minWidth: 0, fontFamily: 'var(--font-sans)', ...style }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '2px var(--space-md)',
          fontSize: 11,
          lineHeight: '16px',
          color: 'var(--color-text-secondary)',
        }}
      >
        {series.map((s, i) => {
          const v = cursor !== null ? s.values[cursor] : latest(s.values)
          return (
            <span key={s.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
              <span
                aria-hidden
                style={{ width: 10, height: 2, borderRadius: 1, background: `var(${TONE_TOKEN[toneOf(s, i)]})` }}
              />
              {s.label}
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>{formatValue(v, unit)}</span>
            </span>
          )
        })}
      </div>
      <div data-plot style={{ height }} />
    </div>
  )
}
