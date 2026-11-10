import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'

/**
 * BreaksHistogram — a field's distribution with its class breaks over it (stareSDK, operator-approved
 * 2026-11-09, OpenStare #458; first consumer: the Graduated style's breaks).
 *
 * Plain SVG. Each bin is a bar in the colour of the class its middle falls in (the caller's class
 * colours — data colours, not chrome); each inner break is a vertical handle the analyst can drag,
 * or move with the arrow keys, between its neighbours. While a handle moves, its value shows above
 * it. Without `onBreakChange` the histogram is read-only and has no handles to move. The chart adds
 * no other control.
 */

/** One bin: rows with `from <= value < to` (the last bin includes `to`). */
export interface BreaksHistogramBin {
  from: number
  to: number
  count: number
}

export interface BreaksHistogramProps {
  bins: readonly BreaksHistogramBin[]
  /** The class boundaries, ascending: the first is the lowest value, the last the highest. Each
   *  inner boundary is a handle. */
  breaks: readonly number[]
  /** One colour per class (`breaks.length - 1`). */
  colors: readonly string[]
  /** Called as inner break `index` (1 … `breaks.length - 2`) moves; omit for a read-only chart. */
  onBreakChange?: (index: number, value: number) => void
  /** A break's value as shown while it moves. Default: up to 4 significant digits. */
  formatValue?: (value: number) => string
  /** Plot height in pixels. Default 64. */
  height?: number
  'aria-label': string
  style?: CSSProperties
}

/** Width used until the container has been measured (and where ResizeObserver is unavailable). */
const FALLBACK_WIDTH = 240
/** Room above the bars for a moving break's value. */
const LABEL_ROOM = 14
/** How far a handle can be grabbed either side of its line, px. */
const GRAB_PX = 6

/** The default value format: up to 4 significant digits. Exported for tests. */
export function formatBreakValue(v: number): string {
  if (!Number.isFinite(v)) return '—'
  return Number(v.toPrecision(4)).toLocaleString()
}

/** The class a value falls in, by the breaks (the last class includes the top). Exported for tests. */
export function classIndexOf(value: number, breaks: readonly number[]): number {
  for (let i = 1; i < breaks.length - 1; i++) {
    if (value < breaks[i]) return i - 1
  }
  return Math.max(0, breaks.length - 2)
}

/** A moved break, kept strictly between its neighbours. Exported for tests. */
export function clampBreak(index: number, value: number, breaks: readonly number[]): number {
  const lo = breaks[index - 1]
  const hi = breaks[index + 1]
  const span = Math.abs(hi - lo)
  const eps = span > 0 ? span * 1e-6 : 0
  return Math.min(hi - eps, Math.max(lo + eps, value))
}

export function BreaksHistogram({
  bins,
  breaks,
  colors,
  onBreakChange,
  formatValue = formatBreakValue,
  height = 64,
  'aria-label': ariaLabel,
  style,
}: BreaksHistogramProps) {
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(FALLBACK_WIDTH)
  const [moving, setMoving] = useState<number | null>(null)

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

  const lo = bins.length > 0 ? bins[0].from : breaks[0] ?? 0
  const hi = bins.length > 0 ? bins[bins.length - 1].to : breaks[breaks.length - 1] ?? 1
  const span = hi > lo ? hi - lo : 1
  const x = (v: number) => ((v - lo) / span) * width
  const valueAt = (px: number) => lo + (Math.min(width, Math.max(0, px)) / width) * span
  const maxCount = Math.max(1, ...bins.map(b => b.count))
  const plotH = height - LABEL_ROOM
  const editable = !!onBreakChange

  const move = (index: number, value: number) => onBreakChange?.(index, clampBreak(index, value, breaks))

  function onPointerDown(index: number, e: PointerEvent<SVGElement>) {
    if (!editable) return
    e.preventDefault()
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    setMoving(index)
  }
  function onPointerMove(e: PointerEvent<SVGSVGElement>) {
    if (moving === null) return
    const rect = e.currentTarget.getBoundingClientRect()
    move(moving, valueAt(e.clientX - rect.left))
  }
  function onKeyDown(index: number, e: KeyboardEvent<SVGElement>) {
    if (!editable) return
    const step = span / 100
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') move(index, breaks[index] - step)
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') move(index, breaks[index] + step)
    else return
    e.preventDefault()
  }

  return (
    <div ref={box} style={{ width: '100%', ...style }}>
      <svg
        width={width}
        height={height}
        role="group"
        aria-label={ariaLabel}
        style={{ display: 'block', touchAction: 'none' }}
        onPointerMove={onPointerMove}
        onPointerUp={() => setMoving(null)}
        onPointerCancel={() => setMoving(null)}
      >
        {bins.map((b, i) => {
          const h = (b.count / maxCount) * plotH
          const x0 = x(b.from)
          const w = Math.max(1, x(b.to) - x0 - 1)
          const color = colors[classIndexOf((b.from + b.to) / 2, breaks)] ?? colors[0]
          return <rect key={i} x={x0} y={LABEL_ROOM + plotH - h} width={w} height={h} fill={color} opacity={0.85} />
        })}
        <line x1={0} x2={width} y1={height - 0.5} y2={height - 0.5} stroke="var(--color-glass-border)" />
        {breaks.slice(1, -1).map((v, k) => {
          const index = k + 1
          const px = x(v)
          return (
            <g
              key={index}
              role={editable ? 'slider' : undefined}
              tabIndex={editable ? 0 : undefined}
              aria-label={editable ? `Break ${index}` : undefined}
              aria-valuemin={editable ? breaks[index - 1] : undefined}
              aria-valuemax={editable ? breaks[index + 1] : undefined}
              aria-valuenow={editable ? v : undefined}
              aria-valuetext={editable ? formatValue(v) : undefined}
              style={{ cursor: editable ? 'ew-resize' : 'default', outline: 'none' }}
              onPointerDown={e => onPointerDown(index, e)}
              onKeyDown={e => onKeyDown(index, e)}
            >
              {editable && <rect x={px - GRAB_PX} y={LABEL_ROOM} width={GRAB_PX * 2} height={plotH} fill="transparent" />}
              <line x1={px} x2={px} y1={LABEL_ROOM} y2={height} stroke="var(--color-text-primary)" strokeWidth={moving === index ? 2 : 1} />
              {editable && <rect x={px - 3} y={LABEL_ROOM - 2} width={6} height={6} rx={1} fill="var(--color-text-primary)" />}
              {moving === index && (
                <text
                  x={Math.min(width - 2, Math.max(2, px))}
                  y={LABEL_ROOM - 4}
                  textAnchor={px < 24 ? 'start' : px > width - 24 ? 'end' : 'middle'}
                  fontSize={10}
                  fontFamily="var(--font-mono)"
                  fill="var(--color-text-primary)"
                >
                  {formatValue(v)}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
