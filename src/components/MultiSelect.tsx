/**
 * MultiSelect — a dropdown of checkboxes over labelled options (operator-approved 2026-10-01,
 * FGAC #152).
 *
 * The closed control is a button the size of `Select`, summarising the choice ("None", the chosen
 * labels, or "N selected" when they do not fit). Opening it shows the options as checkbox rows
 * directly below the button, in flow rather than floating, so it is never clipped by a scrolling
 * modal body; Escape or a click outside closes it. A `locked` option is shown checked and cannot be
 * changed (a value the user may keep but not add or remove).
 *
 * With `icon` (added 0.2.6 for OpenStare's attribute table column chooser, kineticlogic-io/OpenStare#64)
 * the closed control is instead an `xs` icon `Button` (its `ariaLabel` is the button's label and
 * tooltip), and the list floats below it — aligned to the button's `align` edge — so it can sit in a
 * toolbar without pushing the row open.
 */
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { TbChevronDown } from 'react-icons/tb'
import { Button } from './Button.js'

export interface MultiSelectOption {
  value: string
  label: string
  /** Shown checked and unchangeable. */
  locked?: boolean
}

export interface MultiSelectProps {
  options: MultiSelectOption[]
  value: string[]
  onChange: (value: string[]) => void
  ariaLabel: string
  /** Summary text when nothing is chosen (default "None"). */
  placeholder?: string
  disabled?: boolean
  /** Show the control as an `xs` icon button with this glyph, the list floating below it. */
  icon?: ReactNode
  /** Icon mode: which edge of the button the floating list lines up with (default `left`). */
  align?: 'left' | 'right'
}

/** Beyond this many chosen labels the summary becomes a count. */
const SUMMARY_LIMIT = 3

const triggerStyle: CSSProperties = {
  height: 28,
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 6,
  padding: '0 8px',
  background: 'var(--color-bg-primary)',
  border: '1px solid var(--color-glass-border)',
  borderRadius: 4,
  color: 'var(--color-text-primary)',
  fontFamily: 'var(--font-sans)',
  fontSize: 12,
  boxSizing: 'border-box',
  cursor: 'pointer',
  textAlign: 'left',
}

const panelStyle: CSSProperties = {
  marginTop: 4,
  maxHeight: 220,
  overflowY: 'auto',
  background: 'var(--color-glass-bg)',
  border: '1px solid var(--color-glass-border)',
  borderRadius: 4,
  padding: 'var(--space-xs) 0',
}

/** Icon mode: the list floats over what is below, above neighbouring chrome. */
const floatingPanelStyle: CSSProperties = {
  position: 'absolute',
  top: '100%',
  zIndex: 10,
  minWidth: 200,
  maxWidth: 320,
  background: 'var(--color-bg-secondary)',
  boxShadow: 'var(--shadow-standard)',
}

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-sm)',
  minHeight: 26,
  padding: '1px var(--space-sm)',
  fontFamily: 'var(--font-sans)',
  fontSize: 12,
  color: 'var(--color-text-primary)',
  cursor: 'pointer',
}

export function MultiSelect({ options, value, onChange, ariaLabel, placeholder = 'None', disabled, icon, align = 'left' }: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Close the list, not the modal around it.
        e.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointer)
    rootRef.current?.addEventListener('keydown', onKey)
    const root = rootRef.current
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      root?.removeEventListener('keydown', onKey)
    }
  }, [open])

  const chosen = options.filter(o => value.includes(o.value))
  const summary =
    chosen.length === 0
      ? placeholder
      : chosen.length <= SUMMARY_LIMIT
        ? chosen.map(o => o.label).join(', ')
        : `${chosen.length} selected`

  const toggle = (v: string) =>
    onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v])

  const list = open && (
    <div
      role="listbox"
      aria-multiselectable="true"
      aria-label={ariaLabel}
      style={icon ? { ...panelStyle, ...floatingPanelStyle, [align]: 0 } : panelStyle}
    >
      {options.map(o => (
        <label key={o.value} style={{ ...rowStyle, cursor: o.locked ? 'default' : 'pointer' }}>
          <input
            type="checkbox"
            checked={o.locked || value.includes(o.value)}
            disabled={o.locked}
            onChange={() => toggle(o.value)}
          />
          {o.label}
        </label>
      ))}
    </div>
  )

  if (icon) {
    return (
      <div ref={rootRef} style={{ position: 'relative', display: 'inline-flex' }}>
        <Button
          size="xs"
          variant="ghost"
          icon={icon}
          active={open}
          aria-label={ariaLabel}
          title={ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={disabled}
          onClick={() => setOpen(o => !o)}
        />
        {list}
      </div>
    )
  }

  return (
    <div ref={rootRef}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        style={{ ...triggerStyle, opacity: disabled ? 0.5 : 1 }}
      >
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: chosen.length === 0 ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
          }}
        >
          {summary}
        </span>
        <TbChevronDown size={12} aria-hidden />
      </button>
      {list}
    </div>
  )
}
