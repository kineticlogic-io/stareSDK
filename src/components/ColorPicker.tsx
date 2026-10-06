/**
 * ColorPicker — app-wide standard color input (D-19).
 *
 * Controlled contract mirrors OpacitySlider: `value` (a resolved hex string) + `onChange`.
 * Renders a compact swatch grid of curated design-token colors — resolved to literal hex
 * ONCE at module load, never `var()` (Pitfall 3: Leaflet writes path colors as raw SVG
 * presentation attributes, where `var()` is not a valid value — a feature styled with a
 * token reference renders stroke-less with a near-invisible fill). A "Custom" affordance
 * reveals a native `<input type="color">` plus a hex text field; typing a valid `#rrggbb`
 * normalizes to lowercase and calls `onChange`. Popover chrome reuses the same tokens as
 * GisLayerRow's kebab popover (layerRowStyles.ts) for visual consistency across the app's
 * two popover surfaces.
 *
 * `placement` (optional, defaults to `'bottom'`, T-VOV quick task): the popover normally opens
 * DOWNWARD (`top: calc(100% + 2px)`, the `popoverContainer` base). `placement="top"` flips it to
 * open UPWARD (`bottom: calc(100% + 2px)`, `top: auto`) for a consumer anchored near the bottom of
 * an `overflow: hidden` container — the VANTAGE floating Annotate toolbar, which sits at the
 * bottom of the stage. This is an additive, backwards-compatible option on the existing shared
 * component, not a new primitive: `RampPicker`, `StyleEditor`, `SketchToolbar` and
 * `MarkStylePopover` all pass nothing and keep today's downward behaviour unchanged.
 */
import { useEffect, useRef, useState } from 'react'
import { TbColorPicker, TbCheck } from 'react-icons/tb'
import { Button } from './Button'
import { popoverContainer, popoverDivider, popoverLabel } from '../internal/layerRowStyles'

interface ColorPickerProps {
  /** Current value — always a resolved hex string (e.g. `#0faf73`), never a `var()` token. */
  value: string
  /** Called with a normalized lowercase hex string (e.g. `#0faf73`). */
  onChange: (hex: string) => void
  disabled?: boolean
  'aria-label'?: string
  /** Popover open direction — `'bottom'` (default, unchanged) or `'top'` (opens upward; see
   *  module doc). */
  placement?: 'bottom' | 'top'
}

interface Swatch {
  label: string
  hex: string
}

// Resolved ONCE at module load from the Elite Command Design System tokens
// (global.css :root) — literal hex only. Never pass a `var(...)` string to onChange.
const SWATCHES: Swatch[] = [
  { label: 'Brand', hex: '#0faf73' },
  { label: 'Brand hover', hex: '#14c987' },
  { label: 'Brand active', hex: '#0b8c5c' },
  { label: 'Critical', hex: '#e03c3c' },
  { label: 'Warning', hex: '#f5a623' },
  { label: 'Success', hex: '#1db954' },
  { label: 'Info', hex: '#3b82f6' },
  { label: 'Intel cyan', hex: '#1fcfe8' },
  { label: 'Intel purple', hex: '#7c5cfa' },
  { label: 'Intel lime', hex: '#9fe870' },
  { label: 'Intel heat', hex: '#ff6a3d' },
  { label: 'Text primary', hex: '#e8eef5' },
  { label: 'Text secondary', hex: '#93a4b8' },
  { label: 'Text muted', hex: '#6e7f93' },
  { label: 'Surface elevated', hex: '#11161d' },
  { label: 'Surface layer 2', hex: '#1b2430' },
]

const HEX_RE = /^#([0-9a-f]{6})$/i

/** Validate + normalize free-typed hex text. Returns null (never emits) for invalid input. */
function normalizeHex(input: string): string | null {
  const trimmed = input.trim()
  const candidate = trimmed.startsWith('#') ? trimmed : `#${trimmed}`
  return HEX_RE.test(candidate) ? candidate.toLowerCase() : null
}

/** Perceptual luminance check — decides whether a checkmark on a swatch should be dark or light. */
function isLightHex(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 150
}

export function ColorPicker({
  value,
  onChange,
  disabled = false,
  'aria-label': ariaLabel = 'Color',
  placement = 'bottom',
}: ColorPickerProps) {
  const [open, setOpen] = useState(false)
  const [customOpen, setCustomOpen] = useState(false)
  const [hexInput, setHexInput] = useState(value)
  const containerRef = useRef<HTMLDivElement>(null)

  // Keep the free-text field in sync when the controlled value changes externally
  // (e.g. Reset-to-default in the parent StyleEditor).
  useEffect(() => {
    setHexInput(value)
  }, [value])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  function selectSwatch(hex: string) {
    onChange(hex)
    setOpen(false)
  }

  function commitHexInput(raw: string) {
    const normalized = normalizeHex(raw)
    if (normalized) onChange(normalized)
  }

  const validValue = HEX_RE.test(value) ? value : '#000000'

  return (
    <div
      ref={containerRef}
      // Explicit height matches the trigger Button's fixed `xs` size (Button.tsx: 28px) exactly —
      // without it, this wrapper's auto-height in an `align-items: stretch` flex row (e.g. the
      // VANTAGE Annotate toolbar's ButtonPalette) can render a hair taller than sibling buttons.
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', height: 28 }}
    >
      <Button
        size="xs"
        variant="ghost"
        disabled={disabled}
        aria-label={ariaLabel}
        title={value}
        onClick={() => setOpen(v => !v)}
        style={{ background: validValue, border: '1px solid var(--color-glass-border)' }}
      />

      {open && !disabled && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 1099 }}
            onClick={() => setOpen(false)}
          />
          <div
            style={{
              ...popoverContainer,
              padding: 'var(--space-sm)',
              width: 200,
              ...(placement === 'top' ? { top: 'auto', bottom: 'calc(100% + 2px)' } : {}),
            }}
          >
            <div style={popoverLabel}>Swatches</div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(6, 1fr)',
                gap: 4,
                marginBottom: 8,
              }}
            >
              {SWATCHES.map(s => {
                const selected = s.hex.toLowerCase() === value.toLowerCase()
                return (
                  <Button
                    key={s.hex}
                    size="xs"
                    variant="ghost"
                    icon={
                      selected ? (
                        <TbCheck color={isLightHex(s.hex) ? '#0b0f14' : '#ffffff'} />
                      ) : undefined
                    }
                    aria-label={s.label}
                    title={s.label}
                    onClick={() => selectSwatch(s.hex)}
                    style={{
                      width: 24,
                      height: 24,
                      background: s.hex,
                      border: selected
                        ? '2px solid var(--color-accent)'
                        : '1px solid var(--color-glass-border)',
                    }}
                  />
                )
              })}
            </div>

            <div style={popoverDivider} />

            <div style={{ marginTop: 8 }}>
              <Button
                size="sm"
                variant="ghost"
                fullWidth
                icon={<TbColorPicker />}
                onClick={() => setCustomOpen(v => !v)}
              >
                Custom
              </Button>

              {customOpen && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                  <input
                    type="color"
                    aria-label="Custom color picker"
                    value={validValue}
                    onChange={e => {
                      setHexInput(e.target.value)
                      onChange(e.target.value.toLowerCase())
                    }}
                    style={{
                      width: 28,
                      height: 28,
                      padding: 0,
                      border: '1px solid var(--color-glass-border)',
                      borderRadius: 4,
                      background: 'none',
                      cursor: 'pointer',
                    }}
                  />
                  <input
                    type="text"
                    value={hexInput}
                    aria-label="Custom hex value"
                    placeholder="#rrggbb"
                    onChange={e => setHexInput(e.target.value)}
                    onBlur={e => commitHexInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitHexInput((e.target as HTMLInputElement).value)
                    }}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      height: 28,
                      padding: '0 6px',
                      background: 'var(--color-bg-primary)',
                      border: '1px solid var(--color-glass-border)',
                      borderRadius: 4,
                      color: 'var(--color-text-primary)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
