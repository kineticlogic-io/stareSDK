import { useEffect, useRef } from 'react'
import type { ChangeEvent, CSSProperties, ReactNode } from 'react'

/**
 * Checkbox — the shared themed checkbox (0.2.12, for OpenStare's shared-components sweep,
 * kineticlogic-io/OpenStare#340).
 *
 * A real `<input type="checkbox">` (so keyboard, forms, `aria-checked` and screen readers work
 * natively) tinted with the accent token, inside a `<label>` when it has visible text. Supports
 * the indeterminate state (set on the element — HTML has no attribute for it) and `disabled`.
 * Design tokens only.
 */
export interface CheckboxProps {
  checked: boolean
  /** Called with the new checked state. Never called while `disabled`. */
  onChange: (checked: boolean, event: ChangeEvent<HTMLInputElement>) => void
  /** Visible label beside the box. Without one, pass `ariaLabel`. */
  label?: ReactNode
  /** Accessible name when there is no visible `label`. */
  ariaLabel?: string
  /** Neither checked nor unchecked (e.g. a "select all" over a partial selection). */
  indeterminate?: boolean
  disabled?: boolean
  /** `sm` (13px box, 11px text) or `md` (default: 14px box, 12px text). */
  size?: 'sm' | 'md'
  id?: string
  name?: string
  title?: string
  /** Style for the outer element (the label, or the input when there is no label). */
  style?: CSSProperties
}

const BOX = { sm: 13, md: 14 } as const
const TEXT = { sm: 11, md: 12 } as const

export function Checkbox({
  checked,
  onChange,
  label,
  ariaLabel,
  indeterminate = false,
  disabled = false,
  size = 'md',
  id,
  name,
  title,
  style,
}: CheckboxProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = indeterminate
  }, [indeterminate])

  const input = (
    <input
      ref={inputRef}
      type="checkbox"
      className="ui-checkbox"
      id={id}
      name={name}
      checked={checked}
      disabled={disabled}
      aria-label={label == null ? ariaLabel : undefined}
      aria-checked={indeterminate ? 'mixed' : checked}
      title={label == null ? title : undefined}
      onChange={e => {
        if (!disabled) onChange(e.target.checked, e)
      }}
      style={{
        width: BOX[size],
        height: BOX[size],
        margin: 0,
        flexShrink: 0,
        accentColor: 'var(--color-accent)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        ...(label == null ? style : null),
      }}
    />
  )
  if (label == null) return input
  return (
    <label
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-sm)',
        fontFamily: 'var(--font-sans)',
        fontSize: TEXT[size],
        color: disabled ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        userSelect: 'none',
        ...style,
      }}
    >
      {input}
      <span>{label}</span>
    </label>
  )
}
