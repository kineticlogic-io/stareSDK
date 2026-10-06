/**
 * RampPicker — controlled curated color-ramp selector popover (Phase 64, STYLE-04/05, D-09).
 *
 * Mirrors `ui/ColorPicker`'s controlled contract and popover mechanics exactly (same
 * `popoverContainer`/`popoverLabel`/`popoverDivider` tokens, same fixed-overlay
 * click-outside-to-close, same Escape-to-close) so the two color-input surfaces read as one
 * family. Curated ramp data (`RAMPS`/`sampleRamp`) comes from `colorRamps.ts` (64-01) — this
 * component only renders/selects, it never invents ramp hex values.
 */
import { useEffect, useState } from 'react'
import { TbSwitchHorizontal } from 'react-icons/tb'
import { Button } from './Button.js'
import { popoverContainer, popoverDivider, popoverLabel } from '../internal/layerRowStyles.js'
import { RAMPS, sampleRamp, type ColorRamp } from '../internal/colorRamps.js'

interface RampPickerProps {
  /** id of the currently selected curated ramp — see `colorRamps.ts`'s `RAMPS`. */
  rampId: string
  onChange: (rampId: string) => void
  reversed: boolean
  onReverseChange: (reversed: boolean) => void
  /** Which curated subset to list — graduated (sequential+diverging) vs categorized (qualitative). */
  kind: 'sequential-diverging' | 'qualitative'
  disabled?: boolean
}

/**
 * Build a CSS `linear-gradient` string from ordered hex stops. Qualitative ramps render as hard
 * color-stops (discrete swatch bands, no blending) so they read as distinct categories at a
 * glance; sequential/diverging ramps render as a smooth blend.
 */
function buildGradient(stops: string[], hardStops: boolean): string {
  if (stops.length === 0) return 'var(--color-bg-primary)'
  if (stops.length === 1) return stops[0]
  if (!hardStops) return `linear-gradient(90deg, ${stops.join(', ')})`
  const n = stops.length
  const parts: string[] = []
  stops.forEach((c, i) => {
    parts.push(`${c} ${(i / n) * 100}%`, `${c} ${((i + 1) / n) * 100}%`)
  })
  return `linear-gradient(90deg, ${parts.join(', ')})`
}

/** A single ramp row inside the popover — always previewed forward (unreversed); the reverse
 *  toggle affects only the trigger + downstream styling, not the option list itself. */
function RampRow({
  ramp,
  selected,
  onSelect,
}: {
  ramp: ColorRamp
  selected: boolean
  onSelect: () => void
}) {
  const stops = sampleRamp(ramp, 5)
  const gradient = buildGradient(stops, ramp.kind === 'qualitative')
  return (
    <button
      type="button"
      onClick={onSelect}
      title={ramp.label}
      aria-label={ramp.label}
      style={{
        display: 'block',
        width: '100%',
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <div
        style={{
          height: 16,
          borderRadius: 'var(--radius-sm)',
          background: gradient,
          border: selected ? '2px solid var(--color-accent)' : '1px solid var(--color-glass-border)',
          boxSizing: 'border-box',
        }}
      />
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--color-text-secondary)',
          marginTop: 2,
        }}
      >
        {ramp.label}
      </div>
    </button>
  )
}

export function RampPicker({
  rampId,
  onChange,
  reversed,
  onReverseChange,
  kind,
  disabled = false,
}: RampPickerProps) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  const selectedRamp = RAMPS.find(r => r.id === rampId) ?? RAMPS[0]
  const triggerStops = sampleRamp(selectedRamp, 5, reversed)
  const triggerGradient = buildGradient(triggerStops, selectedRamp.kind === 'qualitative')

  function selectRamp(id: string) {
    onChange(id)
    setOpen(false)
  }

  const sequentialRamps = RAMPS.filter(r => r.kind === 'sequential-single' || r.kind === 'sequential-multi')
  const divergingRamps = RAMPS.filter(r => r.kind === 'diverging')
  const qualitativeRamps = RAMPS.filter(r => r.kind === 'qualitative')

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <Button
        size="xs"
        variant="ghost"
        disabled={disabled}
        aria-label="Color ramp"
        title={selectedRamp.label}
        onClick={() => setOpen(v => !v)}
        style={{
          width: 64,
          height: 28,
          background: triggerGradient,
          border: '1px solid var(--color-glass-border)',
          borderRadius: 'var(--radius-sm)',
        }}
      />

      {open && !disabled && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 1099 }} onClick={() => setOpen(false)} />
          <div style={{ ...popoverContainer, padding: 'var(--space-sm)', width: 240 }}>
            {kind === 'sequential-diverging' ? (
              <>
                <div style={popoverLabel}>Sequential</div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-xs)',
                    marginBottom: 8,
                  }}
                >
                  {sequentialRamps.map(r => (
                    <RampRow key={r.id} ramp={r} selected={r.id === rampId} onSelect={() => selectRamp(r.id)} />
                  ))}
                </div>
                <div style={popoverDivider} />
                <div style={{ ...popoverLabel, marginTop: 8 }}>Diverging</div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-xs)',
                    marginBottom: 8,
                  }}
                >
                  {divergingRamps.map(r => (
                    <RampRow key={r.id} ramp={r} selected={r.id === rampId} onSelect={() => selectRamp(r.id)} />
                  ))}
                </div>
              </>
            ) : (
              <>
                <div style={popoverLabel}>Qualitative</div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-xs)',
                    marginBottom: 8,
                  }}
                >
                  {qualitativeRamps.map(r => (
                    <RampRow key={r.id} ramp={r} selected={r.id === rampId} onSelect={() => selectRamp(r.id)} />
                  ))}
                </div>
              </>
            )}

            <div style={popoverDivider} />

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 8,
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 11,
                  fontWeight: 500,
                  color: 'var(--color-text-primary)',
                }}
              >
                Reverse ramp
              </span>
              <Button
                size="xs"
                variant="ghost"
                icon={<TbSwitchHorizontal />}
                aria-label="Reverse ramp"
                title="Reverse ramp"
                active={reversed}
                onClick={() => onReverseChange(!reversed)}
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
