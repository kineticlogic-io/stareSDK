/**
 * TagInput — free-entry values shown as removable chips (added 0.2.20 for OpenStare's multi-valued
 * info-card fields, a radar's ELNOTs; kineticlogic-io/OpenStare#361).
 *
 * Type a value and press Enter or comma to add it; pasting "a, b, c" adds each. Backspace in the
 * empty input removes the last chip, and each chip has its own × button. Values are trimmed (then
 * passed through `normalize`, when given) and never added twice. A value `validate` rejects is not
 * added; its message shows under the field. Leaving the field adds what was typed, so a value is
 * never lost by clicking Save without pressing Enter.
 *
 * With `suggestions`, typing shows the matching ones below the field (ArrowUp/ArrowDown to move,
 * Enter to pick, Escape to close); free entry still works. `maxItems` stops adding once reached.
 * `readOnly` shows the chips without × buttons or an input; `disabled` greys the whole control.
 *
 * Chips are `Badge`s (grey, `sm`); colors are design tokens only, so both themes apply.
 */
import { useId, useRef, useState } from 'react'
import type { ClipboardEvent, CSSProperties, KeyboardEvent } from 'react'
import { TbX } from 'react-icons/tb'
import { Badge } from './Badge.js'

export interface TagInputProps {
  value: string[]
  onChange: (value: string[]) => void
  /** Names the field for assistive technology (the input and the chip group). */
  ariaLabel: string
  /** The input's id, so a `Label htmlFor` can point at it. */
  id?: string
  placeholder?: string
  /** A message for a value that may not be added, or `null` when it may. */
  validate?: (value: string) => string | null
  /** Applied to each trimmed value before it is checked and added (e.g. lower-casing). */
  normalize?: (value: string) => string
  /** Values offered as the user types; free entry is still allowed. */
  suggestions?: string[]
  /** No more values are added once there are this many. */
  maxItems?: number
  disabled?: boolean
  /** Show the chips only: no input and no remove buttons. */
  readOnly?: boolean
  /** A chip's × button label (default "Remove <value>"), e.g. to tell tag chips from other rows. */
  removeLabel?: (value: string) => string
  'aria-describedby'?: string
  style?: CSSProperties
}

/** At most this many suggestions are listed at once. */
const SUGGESTION_LIMIT = 8

const boxStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 4,
  minHeight: 36,
  width: '100%',
  padding: '4px var(--space-sm)',
  background: 'var(--surface-layer-2)',
  border: '1px solid var(--color-glass-border)',
  borderRadius: 4,
  boxSizing: 'border-box',
  fontFamily: 'var(--font-sans)',
  transition: 'border-color 0.15s',
}

const inputStyle: CSSProperties = {
  flex: '1 1 80px',
  minWidth: 80,
  height: 26,
  border: 'none',
  outline: 'none',
  background: 'transparent',
  color: 'var(--color-text-primary)',
  fontFamily: 'var(--font-sans)',
  fontSize: 13,
  padding: 0,
}

const removeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginLeft: 4,
  padding: 0,
  border: 'none',
  background: 'transparent',
  color: 'inherit',
  cursor: 'pointer',
  lineHeight: 1,
}

const listStyle: CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  zIndex: 20,
  marginTop: 2,
  padding: 4,
  listStyle: 'none',
  background: 'var(--color-bg-secondary)',
  border: '1px solid var(--color-glass-border)',
  borderRadius: 4,
  boxShadow: 'var(--shadow-standard)',
  maxHeight: 240,
  overflowY: 'auto',
}

const optionStyle: CSSProperties = {
  padding: '4px 8px',
  borderRadius: 3,
  fontSize: 12,
  color: 'var(--color-text-primary)',
  cursor: 'pointer',
}

const errorStyle: CSSProperties = {
  marginTop: 4,
  fontSize: 11,
  color: 'var(--color-destructive)',
}

/** The values typed or pasted, split on commas and new lines (pure). */
function splitTagText(text: string): string[] {
  return text.split(/[,\n]/)
}

export function TagInput({
  value,
  onChange,
  ariaLabel,
  id,
  placeholder,
  validate,
  normalize,
  suggestions,
  maxItems,
  disabled = false,
  readOnly = false,
  removeLabel = (v: string) => `Remove ${v}`,
  'aria-describedby': describedBy,
  style,
}: TagInputProps) {
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [focused, setFocused] = useState(false)
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const uid = useId()
  const listId = `${uid}-list`
  const errorId = `${uid}-error`

  const full = maxItems !== undefined && value.length >= maxItems
  const clean = (raw: string) => {
    const trimmed = raw.trim()
    return normalize ? normalize(trimmed) : trimmed
  }

  /** Add each of `raws` that is new, valid and fits; returns whether all were added. */
  const add = (raws: string[]): boolean => {
    const next = [...value]
    let problem: string | null = null
    for (const raw of raws) {
      const v = clean(raw)
      if (v === '' || next.includes(v)) continue
      if (maxItems !== undefined && next.length >= maxItems) {
        problem = `At most ${maxItems}`
        break
      }
      const message = validate?.(v) ?? null
      if (message) {
        problem = message
        continue
      }
      next.push(v)
    }
    if (next.length !== value.length) onChange(next)
    setError(problem)
    return problem === null
  }

  const remove = (v: string) => {
    onChange(value.filter((x) => x !== v))
    setError(null)
    inputRef.current?.focus()
  }

  const query = clean(draft).toLowerCase()
  const matches =
    suggestions && query !== ''
      ? suggestions.filter((s) => !value.includes(s) && s.toLowerCase().includes(query)).slice(0, SUGGESTION_LIMIT)
      : []
  const listOpen = open && matches.length > 0 && !full

  const commitDraft = () => {
    if (draft.trim() === '') return
    if (add([draft])) setDraft('')
  }

  const pick = (s: string) => {
    if (add([s])) setDraft('')
    setOpen(false)
    setHighlight(-1)
    inputRef.current?.focus()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (listOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault()
      const step = e.key === 'ArrowDown' ? 1 : -1
      setHighlight((h) => (h + step + matches.length) % matches.length)
      return
    }
    if (e.key === 'Escape' && listOpen) {
      e.preventDefault()
      setOpen(false)
      setHighlight(-1)
      return
    }
    if (e.key === 'Enter' || e.key === ',') {
      // Enter with nothing typed is left alone, so it can still submit a surrounding form.
      if (e.key === 'Enter' && draft.trim() === '' && !(listOpen && highlight >= 0)) return
      e.preventDefault()
      if (listOpen && highlight >= 0 && e.key === 'Enter') pick(matches[highlight])
      else commitDraft()
      return
    }
    if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      e.preventDefault()
      onChange(value.slice(0, -1))
      setError(null)
    }
  }

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text')
    if (!/[,\n]/.test(text)) return
    e.preventDefault()
    const parts = splitTagText(draft + text)
    const last = parts.pop() ?? ''
    add(parts)
    setDraft(last)
  }

  const describedByIds = [describedBy, error ? errorId : undefined].filter(Boolean).join(' ') || undefined

  return (
    <div style={{ position: 'relative', width: '100%', ...style }}>
      <div
        role="group"
        aria-label={ariaLabel}
        onClick={() => inputRef.current?.focus()}
        style={{
          ...boxStyle,
          borderColor: error ? 'var(--color-destructive)' : focused ? 'var(--color-accent)' : 'var(--color-glass-border)',
          opacity: disabled ? 0.4 : 1,
          cursor: disabled ? 'not-allowed' : readOnly ? 'default' : 'text',
        }}
      >
        {value.map((v) => (
          <Badge key={v} color="grey" size="sm" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>
            {v}
            {!readOnly && (
              <button
                type="button"
                aria-label={removeLabel(v)}
                disabled={disabled}
                onClick={(e) => {
                  e.stopPropagation()
                  remove(v)
                }}
                style={{ ...removeStyle, cursor: disabled ? 'not-allowed' : 'pointer' }}
              >
                <TbX size={10} aria-hidden />
              </button>
            )}
          </Badge>
        ))}
        {!readOnly && (
          <input
            ref={inputRef}
            id={id}
            aria-label={ariaLabel}
            aria-describedby={describedByIds}
            aria-invalid={error ? true : undefined}
            role={suggestions ? 'combobox' : undefined}
            aria-autocomplete={suggestions ? 'list' : undefined}
            aria-expanded={suggestions ? listOpen : undefined}
            aria-controls={suggestions ? listId : undefined}
            aria-activedescendant={listOpen && highlight >= 0 ? `${listId}-${highlight}` : undefined}
            value={draft}
            placeholder={full ? undefined : placeholder}
            disabled={disabled || full}
            onChange={(e) => {
              setDraft(e.target.value)
              setOpen(true)
              setHighlight(-1)
              if (error) setError(null)
            }}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false)
              setOpen(false)
              setHighlight(-1)
              commitDraft()
            }}
            style={inputStyle}
          />
        )}
      </div>
      {listOpen && (
        <ul id={listId} role="listbox" aria-label={`${ariaLabel} suggestions`} style={listStyle}>
          {matches.map((s, i) => (
            <li
              key={s}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === highlight}
              // Keep focus in the input so its blur does not commit the half-typed text first.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(s)}
              onMouseEnter={() => setHighlight(i)}
              style={{ ...optionStyle, background: i === highlight ? 'var(--brand-subtle)' : 'transparent' }}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <div id={errorId} role="alert" style={errorStyle}>
          {error}
        </div>
      )}
    </div>
  )
}
