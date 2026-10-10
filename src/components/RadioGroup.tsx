import { useId } from 'react'
import type { CSSProperties, ReactNode } from 'react'

/**
 * RadioGroup — a single choice from a short list of options, all visible at once (0.2.15, for
 * OpenStare's shared-components sweep, kineticlogic-io/OpenStare#340). Use `Select` when the list
 * is long; use this when the options should be read side by side.
 *
 * Options-array API, like `Select`: each option has a `value`, a `label`, an optional
 * `description` (secondary text beside the label — e.g. a classification's short id) and an
 * optional `disabled`. Controlled: `value` is the chosen option's value (`null` = none chosen).
 *
 * Real `<input type="radio">` elements sharing one `name` inside a `role="radiogroup"` container,
 * so the browser provides the radio semantics: one tab stop (the checked option, or the first
 * when none is), arrow keys move AND select within the group, Space selects. Tinted with the accent
 * token like `Checkbox`; design tokens only, so it follows the dark and light themes.
 */
export interface RadioOption {
  value: string
  label: ReactNode
  /** Secondary text shown after the label, quieter. */
  description?: ReactNode
  disabled?: boolean
}

export interface RadioGroupProps {
  options: RadioOption[]
  /** The chosen option's value, or `null` when none is chosen. */
  value: string | null
  /** Called with the newly chosen option's value. */
  onChange: (value: string) => void
  /** Accessible name of the group (required even with a visible `label`). */
  ariaLabel: string
  /** Optional visible group heading above the options. */
  label?: ReactNode
  /** `vertical` (default) stacks the options; `horizontal` lays them out in a row. */
  orientation?: 'vertical' | 'horizontal'
  /** Disable every option. */
  disabled?: boolean
  /** `sm` (13px control, 11px text) or `md` (default: 14px control, 12px text). */
  size?: 'sm' | 'md'
  /** The radios' shared `name`; one is generated when omitted. */
  name?: string
  id?: string
  style?: CSSProperties
}

const CONTROL = { sm: 13, md: 14 } as const
const TEXT = { sm: 11, md: 12 } as const

export function RadioGroup({
  options,
  value,
  onChange,
  ariaLabel,
  label,
  orientation = 'vertical',
  disabled = false,
  size = 'md',
  name,
  id,
  style,
}: RadioGroupProps) {
  const generated = useId()
  const groupName = name ?? `radio-${generated}`
  const horizontal = orientation === 'horizontal'
  return (
    <div
      id={id}
      role="radiogroup"
      aria-label={ariaLabel}
      aria-orientation={orientation}
      aria-disabled={disabled || undefined}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)', fontFamily: 'var(--font-sans)', ...style }}
    >
      {label != null && (
        <div style={{ fontSize: TEXT[size], color: 'var(--color-text-secondary)' }}>{label}</div>
      )}
      <div
        style={{
          display: 'flex',
          flexDirection: horizontal ? 'row' : 'column',
          flexWrap: horizontal ? 'wrap' : 'nowrap',
          gap: horizontal ? 'var(--space-md)' : 'var(--space-xs)',
        }}
      >
        {options.map(option => {
          const optionDisabled = disabled || !!option.disabled
          return (
            <label
              key={option.value}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-sm)',
                minHeight: 24,
                fontSize: TEXT[size],
                color: optionDisabled ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
                cursor: optionDisabled ? 'not-allowed' : 'pointer',
                opacity: optionDisabled ? 0.6 : 1,
                userSelect: 'none',
              }}
            >
              <input
                type="radio"
                className="ui-radio"
                name={groupName}
                value={option.value}
                checked={value === option.value}
                disabled={optionDisabled}
                onChange={() => {
                  if (!optionDisabled) onChange(option.value)
                }}
                style={{
                  width: CONTROL[size],
                  height: CONTROL[size],
                  margin: 0,
                  flexShrink: 0,
                  accentColor: 'var(--color-accent)',
                  cursor: optionDisabled ? 'not-allowed' : 'pointer',
                }}
              />
              <span>{option.label}</span>
              {option.description != null && (
                <span style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)', fontSize: TEXT[size] - 1 }}>
                  {option.description}
                </span>
              )}
            </label>
          )
        })}
      </div>
    </div>
  )
}
