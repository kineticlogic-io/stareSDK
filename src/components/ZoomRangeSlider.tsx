/**
 * ZoomRangeSlider — dual-handle zoom-range control (D-20).
 *
 * Controlled: `minValue`/`maxValue` (integer zoom levels) + `onChange(min, max)`. The two
 * handles can never cross — every emitted pair satisfies `minValue <= maxValue` via the
 * `commit()` clamp, so callers never see an inverted range. Bounds default to `min=0,
 * max=19` (the analysis map's zoom range). A per-handle "set from current zoom" button
 * (react-icons/tb, ui/Button) snaps that handle to `Math.round(currentZoom)` when a
 * `currentZoom` prop is supplied — operators think in "what I see now", not zoom numbers.
 *
 * Implemented as two native `<input type="range">` elements stacked over a shared visual
 * track (no dual-handle analog existed in this codebase — see 62-PATTERNS.md). Styled by
 * the `.zoom-range-slider` class family in global.css (tokenized, compositor-safe).
 */
import { TbCurrentLocation } from 'react-icons/tb'
import { Button } from './Button'

interface ZoomRangeSliderProps {
  /** Current minimum zoom (inclusive). Always <= maxValue after any onChange. */
  minValue: number
  /** Current maximum zoom (inclusive). Always >= minValue after any onChange. */
  maxValue: number
  /** Called with a clamped, non-crossing (min, max) pair. */
  onChange: (min: number, max: number) => void
  /** Lower bound for both handles. Defaults to 0 (analysis map minZoom). */
  min?: number
  /** Upper bound for both handles. Defaults to 19 (analysis map maxZoom). */
  max?: number
  /** The map's current zoom level — enables the "set from current zoom" buttons. */
  currentZoom?: number
  disabled?: boolean
}

export function ZoomRangeSlider({
  minValue,
  maxValue,
  onChange,
  min = 0,
  max = 19,
  currentZoom,
  disabled = false,
}: ZoomRangeSliderProps) {
  /** Single choke point for the min<=max invariant — every emitted pair passes through here. */
  function commit(nextMin: number, nextMax: number) {
    const clampedMin = Math.min(Math.max(nextMin, min), max)
    const clampedMax = Math.min(Math.max(nextMax, min), max)
    // Never emit an inverted range — smaller value always wins the min slot.
    const finalMin = Math.min(clampedMin, clampedMax)
    const finalMax = Math.max(clampedMin, clampedMax)
    onChange(finalMin, finalMax)
  }

  function handleMinChange(v: number) {
    // Clamp the min handle so it cannot pass the max handle.
    commit(Math.min(v, maxValue), maxValue)
  }

  function handleMaxChange(v: number) {
    // Clamp the max handle so it cannot pass the min handle.
    commit(minValue, Math.max(v, minValue))
  }

  const range = max - min || 1
  const minPct = ((minValue - min) / range) * 100
  const maxPct = ((maxValue - min) / range) * 100
  const canSetFromZoom = currentZoom != null && !disabled

  return (
    <div className="zoom-range-slider" aria-disabled={disabled}>
      <div className="zoom-range-slider__row">
        <span className="zoom-range-slider__value" aria-hidden>
          {minValue}
        </span>
        <div className="zoom-range-slider__track-wrap">
          <div
            className="zoom-range-slider__fill"
            style={{ left: `${minPct}%`, width: `${Math.max(maxPct - minPct, 0)}%` }}
          />
          <input
            type="range"
            className="zoom-range-slider__input zoom-range-slider__input--min"
            min={min}
            max={max}
            step={1}
            value={minValue}
            disabled={disabled}
            aria-label="Minimum zoom"
            aria-valuetext={`Zoom ${minValue}`}
            onChange={e => handleMinChange(Number(e.target.value))}
          />
          <input
            type="range"
            className="zoom-range-slider__input zoom-range-slider__input--max"
            min={min}
            max={max}
            step={1}
            value={maxValue}
            disabled={disabled}
            aria-label="Maximum zoom"
            aria-valuetext={`Zoom ${maxValue}`}
            onChange={e => handleMaxChange(Number(e.target.value))}
          />
        </div>
        <span className="zoom-range-slider__value" aria-hidden>
          {maxValue}
        </span>
      </div>

      <div className="zoom-range-slider__actions">
        <Button
          size="xs"
          variant="ghost"
          icon={<TbCurrentLocation />}
          aria-label="Set minimum zoom to current map zoom"
          title={
            currentZoom != null
              ? `Set min to current zoom (${Math.round(currentZoom)})`
              : 'Set min to current zoom'
          }
          disabled={!canSetFromZoom}
          onClick={() => currentZoom != null && handleMinChange(Math.round(currentZoom))}
        />
        <Button
          size="xs"
          variant="ghost"
          icon={<TbCurrentLocation />}
          aria-label="Set maximum zoom to current map zoom"
          title={
            currentZoom != null
              ? `Set max to current zoom (${Math.round(currentZoom)})`
              : 'Set max to current zoom'
          }
          disabled={!canSetFromZoom}
          onClick={() => currentZoom != null && handleMaxChange(Math.round(currentZoom))}
        />
      </div>
    </div>
  )
}
