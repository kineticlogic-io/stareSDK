/**
 * UnitSelect — the standard form dropdown for units, orientation conventions and confidence levels
 * (#263, operator-approved 2026-10-05). A `Select` over one shared vocabulary from `units.ts`, so
 * every form offers the same choices in the same order.
 */
import type { CSSProperties } from 'react'
import { Select } from './Select'
import { UNIT_OPTIONS, type UnitFamily } from '../units/units'

export interface UnitSelectProps {
  family: UnitFamily
  value: string
  onChange: (value: string) => void
  ariaLabel: string
  disabled?: boolean
  style?: CSSProperties
}

export function UnitSelect({ family, value, onChange, ariaLabel, disabled, style }: UnitSelectProps) {
  return (
    <Select
      options={[...UNIT_OPTIONS[family]]}
      value={value}
      onChange={v => { if (v !== null) onChange(v) }}
      ariaLabel={ariaLabel}
      disabled={disabled}
      style={style}
    />
  )
}
