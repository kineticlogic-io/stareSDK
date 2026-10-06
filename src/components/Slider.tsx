/**
 * Slider — the single, standardized generic single-handle numeric range control.
 *
 * Unlike `OpacitySlider` (hardcoded 0-100%) or `ZoomRangeSlider` (dual-handle,
 * integer zoom levels), this is a plain controlled `value`/`min`/`max`/`step` range
 * input for any single numeric setting (e.g. a multiplier). Styled by the
 * `.ui-slider` class family in global.css (tokenized track + thumb, mirrors
 * `.opacity-slider`'s visual language). `formatValue` renders an optional visible
 * value label next to the track (mirrors `ZoomRangeSlider`'s `__value` span) —
 * omit it for a bare slider with only an `aria-valuetext` (OpacitySlider's style).
 */

interface SliderProps {
  /** Current value, within [min, max]. */
  value: number
  /** Called with the new value. */
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  disabled?: boolean
  'aria-label'?: string
  /** Formats the visible value label and the `aria-valuetext`. Omit for no visible label. */
  formatValue?: (value: number) => string
}

export function Slider({
  value,
  onChange,
  min,
  max,
  step = 1,
  disabled = false,
  'aria-label': ariaLabel,
  formatValue,
}: SliderProps) {
  return (
    <div className="ui-slider" aria-disabled={disabled}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        className="ui-slider__input"
        aria-label={ariaLabel}
        aria-valuetext={formatValue ? formatValue(value) : undefined}
        onChange={e => onChange(Number(e.target.value))}
      />
      {formatValue && (
        <span className="ui-slider__value" aria-hidden>
          {formatValue(value)}
        </span>
      )}
    </div>
  )
}
