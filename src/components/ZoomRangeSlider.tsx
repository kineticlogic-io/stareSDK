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
 * The track is the generic `RangeSlider`; this adds the zoom bounds, the zoom aria labels and
 * the two "set from current zoom" buttons (`.zoom-range-slider__actions` in global.css).
 */
import { TbCurrentLocation } from 'react-icons/tb'
import { Button } from './Button.js'
import { RangeSlider } from './RangeSlider.js'

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
  /** The "set from current zoom" buttons: the same non-crossing, in-bounds clamp `RangeSlider`
   *  applies to a drag, with the other handle held. */
  function commit(nextMin: number, nextMax: number) {
    const a = Math.min(Math.max(nextMin, min), max)
    const b = Math.min(Math.max(nextMax, min), max)
    onChange(Math.min(a, b), Math.max(a, b))
  }
  const handleMinChange = (v: number) => commit(Math.min(v, maxValue), maxValue)
  const handleMaxChange = (v: number) => commit(minValue, Math.max(v, minValue))
  const canSetFromZoom = currentZoom != null && !disabled

  return (
    <div className="zoom-range-slider" aria-disabled={disabled}>
      <RangeSlider
        minValue={minValue}
        maxValue={maxValue}
        onChange={onChange}
        min={min}
        max={max}
        step={1}
        disabled={disabled}
        ariaLabels={['Minimum zoom', 'Maximum zoom']}
        formatValue={v => String(v)}
      />

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
