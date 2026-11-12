/**
 * RangeSlider — the one dual-handle numeric range control: a minimum and a maximum on one track.
 *
 * Controlled: `minValue`/`maxValue` + `onChange(min, max)`. The handles never cross — every
 * emitted pair satisfies `min <= minValue <= maxValue <= max` (`commit`). `formatValue` renders
 * the visible value at each end and each handle's `aria-valuetext`.
 *
 * Two native `<input type="range">` elements stacked over a shared visual track; each input's own
 * track is transparent and only its thumb takes the pointer, so both handles stay draggable.
 * Styled by the `.range-slider` class family in global.css. `ZoomRangeSlider` is built on it.
 */

interface RangeSliderProps {
  /** Current minimum. Always <= maxValue after any onChange. */
  minValue: number
  /** Current maximum. Always >= minValue after any onChange. */
  maxValue: number
  /** Called with a clamped, non-crossing (min, max) pair. */
  onChange: (min: number, max: number) => void
  /** Lower bound for both handles. */
  min: number
  /** Upper bound for both handles. */
  max: number
  step?: number
  disabled?: boolean
  /** The two handles' accessible names: [minimum handle, maximum handle]. */
  ariaLabels: [string, string]
  /** Formats the visible end values and each handle's `aria-valuetext`. Default: the number. */
  formatValue?: (value: number) => string
}

export function RangeSlider({
  minValue,
  maxValue,
  onChange,
  min,
  max,
  step = 1,
  disabled = false,
  ariaLabels,
  formatValue = v => String(v),
}: RangeSliderProps) {
  /** The one choke point for the min <= max invariant — every emitted pair passes through here. */
  function commit(nextMin: number, nextMax: number) {
    const a = Math.min(Math.max(nextMin, min), max)
    const b = Math.min(Math.max(nextMax, min), max)
    onChange(Math.min(a, b), Math.max(a, b))
  }

  const range = max - min || 1
  const minPct = ((minValue - min) / range) * 100
  const maxPct = ((maxValue - min) / range) * 100

  return (
    <div className="range-slider" aria-disabled={disabled}>
      <span className="range-slider__value" aria-hidden>
        {formatValue(minValue)}
      </span>
      <div className="range-slider__track-wrap">
        <div
          className="range-slider__fill"
          style={{ left: `${minPct}%`, width: `${Math.max(maxPct - minPct, 0)}%` }}
        />
        <input
          type="range"
          className="range-slider__input range-slider__input--min"
          min={min}
          max={max}
          step={step}
          value={minValue}
          disabled={disabled}
          aria-label={ariaLabels[0]}
          aria-valuetext={formatValue(minValue)}
          onChange={e => commit(Math.min(Number(e.target.value), maxValue), maxValue)}
        />
        <input
          type="range"
          className="range-slider__input range-slider__input--max"
          min={min}
          max={max}
          step={step}
          value={maxValue}
          disabled={disabled}
          aria-label={ariaLabels[1]}
          aria-valuetext={formatValue(maxValue)}
          onChange={e => commit(minValue, Math.max(Number(e.target.value), minValue))}
        />
      </div>
      <span className="range-slider__value" aria-hidden>
        {formatValue(maxValue)}
      </span>
    </div>
  )
}
