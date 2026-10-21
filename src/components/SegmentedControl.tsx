import type { CSSProperties, KeyboardEvent, ReactNode } from 'react'
import { Button } from './Button.js'

/**
 * SegmentedControl — one choice from a few mutually exclusive views or modes, shown as a row of
 * buttons (0.2.25, for OpenStare's LEDGER content-management overhaul — e.g. grid / table —
 * kineticlogic-io/OpenStare#383–#388).
 *
 * This is the standard component for the pattern apps built by hand: `Button variant="ghost"`
 * rows with `active` on the chosen one, inside a `ButtonPalette` glass surface. It renders exactly
 * that look (the palette surface; ghost `Button`s; the chosen one in `Button`'s solid `active`
 * fill) with radio semantics in place of a toolbar of `aria-pressed` toggles: a
 * `role="radiogroup"` of `role="radio"` buttons with `aria-checked`, one tab stop (the chosen
 * option, or the first when none is), and arrow keys (Left/Up, Right/Down, wrapping; Home/End)
 * that move to and choose an option.
 *
 * Options carry a `label`, an `icon` (a react-icons/tb glyph), or both. An icon-only option is a
 * square button and must carry an `ariaLabel` (also shown as its `title`).
 *
 * Sizes: `sm` (default, 28px — `Button`'s `xs`/`sm`) and `md` (34px — `Button`'s `md`).
 */
export interface SegmentedOption<T extends string = string> {
  value: T
  /** Visible text. Omit for an icon-only option (then pass `ariaLabel`). */
  label?: ReactNode
  /** Leading icon, or the only content of an icon-only option. */
  icon?: ReactNode
  /** Accessible name; required when there is no `label`, shown as the button's `title`. */
  ariaLabel?: string
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentedOption<T>[]
  /** The chosen option's value, or `null` when none is chosen. */
  value: T | null
  onChange: (value: T) => void
  /** Accessible name of the group. */
  'aria-label': string
  size?: 'sm' | 'md'
  disabled?: boolean
  /** Draw the `ButtonPalette` glass surface around the options (default true). */
  surface?: boolean
  id?: string
  style?: CSSProperties
}

const HEIGHT = { sm: 28, md: 34 } as const

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  'aria-label': ariaLabel,
  size = 'sm',
  disabled = false,
  surface = true,
  id,
  style,
}: SegmentedControlProps<T>) {
  const chosen = options.findIndex((o) => o.value === value)
  const tabStop = chosen >= 0 ? chosen : 0

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled || options.length === 0) return
    const from = chosen >= 0 ? chosen : 0
    let next: number | null = null
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = chosen < 0 ? 0 : (from + 1) % options.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = chosen < 0 ? options.length - 1 : (from - 1 + options.length) % options.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = options.length - 1
    if (next == null) return
    e.preventDefault()
    if (options[next].value !== value) onChange(options[next].value)
    e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus()
  }

  return (
    <div
      id={id}
      role="radiogroup"
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      className="ui-segmented"
      onKeyDown={onKeyDown}
      style={{
        display: 'inline-flex',
        alignItems: 'stretch',
        gap: 2,
        padding: surface ? 'var(--space-xs)' : 0,
        background: surface ? 'var(--color-glass-bg)' : 'transparent',
        border: surface ? '1px solid var(--color-glass-border)' : 'none',
        borderRadius: surface ? 6 : 0,
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {options.map((o, i) => {
        const checked = i === chosen
        const iconOnly = o.label == null
        const buttonSize = size === 'md' ? 'md' : iconOnly ? 'xs' : 'sm'
        return (
          <Button
            key={o.value}
            role="radio"
            aria-checked={checked}
            aria-label={o.ariaLabel}
            title={o.ariaLabel}
            tabIndex={i === tabStop ? 0 : -1}
            className="ui-segmented__option"
            variant="ghost"
            size={buttonSize}
            icon={o.icon}
            active={checked}
            disabled={disabled}
            onClick={() => {
              if (!checked) onChange(o.value)
            }}
            style={iconOnly && size === 'md' ? { width: HEIGHT.md, padding: 0 } : undefined}
          >
            {o.label}
          </Button>
        )
      })}
    </div>
  )
}
