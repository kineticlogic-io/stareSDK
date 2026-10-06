/**
 * FieldSelect — the shared `AttributeField` picker (Phase 118, POPUP-01/MAPUX-01).
 *
 * A single, token-only `<select>` reproducing `FilterCreator.tsx`'s `filterControlStyle` metrics
 * (28px height, `0 8px` padding, `var(--color-bg-primary)` background, `1px solid
 * var(--color-glass-border)` border, 4px radius, `var(--color-text-primary)` color,
 * `var(--font-mono)` family, 11px size, `border-box` sizing). Every consumer that needs to pick a
 * field from an `AttributeField[]` list should use this component instead of hand-rolling an
 * equivalent `<select>` (CLAUDE.md's shared-UI HARD RULE) — two intended consumers this phase:
 * the Configure Popups field-source dropdown (plan 118-06) and the Style-pane Tooltip field
 * picker (plan 118-07).
 *
 * A field's `name` may be a dot path for a promoted nested sub-field (plan 118-01's P-F, e.g.
 * `"attributes.t"`). This component treats `name` as an opaque string throughout — it is never
 * split, parsed, or transformed, only rendered as an `<option>` value/label and passed straight
 * through `onChange`.
 *
 * Does NOT import from or modify `FilterCreator.tsx` — its metrics are copied here as literal
 * values, not shared by reference; `FilterCreator.tsx` itself is outside this plan's file set and
 * may converge onto this component in a later phase.
 *
 * `fields`' element type (Phase 127 plan 19) is `FieldSelectOption`, not `AttributeField` — this
 * component only ever reads `name`/`disabled`/`disabledReason` off each entry, so it was
 * generalised to the minimal shape it actually needs rather than staying pinned to the GIS-only
 * `AttributeField` (`{name, type, is_label}`) shape. `AttributeField[]` remains assignable
 * wherever it is passed (every existing call site is unchanged) because `AttributeField` already
 * structurally satisfies `FieldSelectOption`. `disabled`/`disabledReason` (VANTAGE's SAR remap
 * select, `VantageSubBar.tsx`) render as the `<option>`'s `disabled` attribute and `title` — the
 * "shipped but not yet usable, dimmed with its reason" discipline used elsewhere in this phase,
 * never a silently-omitted option.
 */
import type { CSSProperties } from 'react'

export interface FieldSelectOption {
  name: string
  /** Renders this option `disabled`, with `disabledReason` as its `title` tooltip. Omit/`false`
   *  for a normal, selectable option — the common case. */
  disabled?: boolean
  /** Only meaningful alongside `disabled: true`. */
  disabledReason?: string
}

export interface FieldSelectProps {
  /** The candidate fields to offer, rendered in the given order. */
  fields: FieldSelectOption[]
  /** Currently selected field name, or `null` for the None option (requires `allowNone`). */
  value: string | null
  /** Called with the selected field's `name`, or `null` when the None option is chosen. */
  onChange: (field: string | null) => void
  /** Render a leading `<option value="">None</option>`. Default false. */
  allowNone?: boolean
  /** Applied as the `<select>`'s `aria-label`. */
  ariaLabel: string
  /** Merged onto the base metrics — lets a caller set width/flex without forking them. */
  style?: CSSProperties
}

const fieldSelectStyle: CSSProperties = {
  height: 28,
  padding: '0 8px',
  background: 'var(--color-bg-primary)',
  border: '1px solid var(--color-glass-border)',
  borderRadius: 4,
  color: 'var(--color-text-primary)',
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  boxSizing: 'border-box',
}

export function FieldSelect({ fields, value, onChange, allowNone = false, ariaLabel, style }: FieldSelectProps) {
  return (
    <select
      value={value ?? ''}
      aria-label={ariaLabel}
      onChange={e => onChange(e.target.value === '' ? null : e.target.value)}
      style={{ ...fieldSelectStyle, ...style }}
    >
      {allowNone && <option value="">None</option>}
      {fields.map(f => (
        <option key={f.name} value={f.name} disabled={f.disabled} title={f.disabledReason}>
          {f.name}
        </option>
      ))}
    </select>
  )
}
