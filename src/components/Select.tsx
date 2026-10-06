/**
 * Select — a single-select dropdown over labelled options (operator-approved 2026-10-01, FGAC #152).
 *
 * A native `<select>` (keyboard and screen-reader behaviour for free) with `FieldSelect`'s metrics,
 * but each option carries a `value` and a separate `label`, so a stored id can be shown by name
 * (a classification level stored as `S`, shown as `SECRET`). `placeholder` renders a leading empty
 * option for "nothing chosen yet"; picking it reports `null`.
 */
import type { CSSProperties } from 'react'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps {
  options: SelectOption[]
  value: string | null
  onChange: (value: string | null) => void
  ariaLabel: string
  /** Text of the leading "nothing chosen" option; omit to offer none. */
  placeholder?: string
  disabled?: boolean
  style?: CSSProperties
}

const selectStyle: CSSProperties = {
  height: 28,
  width: '100%',
  padding: '0 8px',
  background: 'var(--color-bg-primary)',
  border: '1px solid var(--color-glass-border)',
  borderRadius: 4,
  color: 'var(--color-text-primary)',
  fontFamily: 'var(--font-sans)',
  fontSize: 12,
  boxSizing: 'border-box',
}

export function Select({ options, value, onChange, ariaLabel, placeholder, disabled, style }: SelectProps) {
  return (
    <select
      value={value ?? ''}
      aria-label={ariaLabel}
      disabled={disabled}
      onChange={e => onChange(e.target.value === '' ? null : e.target.value)}
      style={{ ...selectStyle, ...style }}
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map(o => (
        <option key={o.value} value={o.value} disabled={o.disabled}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
