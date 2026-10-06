/**
 * OpacitySlider — the single, standardized opacity range control.
 *
 * One slider for the whole app. Presentational only: value (0–100) + onChange.
 * Styled by the `.opacity-slider` class in global.css (tokenized track + thumb).
 * Context-bound wrappers (e.g. ImageryOpacitySlider) delegate to this.
 */

interface OpacitySliderProps {
  /** Current value, 0–100. */
  value: number
  /** Called with the new 0–100 value. */
  onChange: (value: number) => void
  disabled?: boolean
  'aria-label'?: string
}

export function OpacitySlider({
  value,
  onChange,
  disabled = false,
  'aria-label': ariaLabel = 'Opacity',
}: OpacitySliderProps) {
  return (
    <input
      type="range"
      min={0}
      max={100}
      value={value}
      disabled={disabled}
      className="opacity-slider"
      aria-label={ariaLabel}
      aria-valuetext={`${Math.round(value)}%`}
      onChange={e => onChange(Number(e.target.value))}
    />
  )
}
