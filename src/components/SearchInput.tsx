import { useEffect, useRef } from 'react'
import type { CSSProperties, KeyboardEvent, Ref } from 'react'
import { TbSearch, TbX } from 'react-icons/tb'
import { Input } from './Input.js'

/**
 * SearchInput — the shared search field (0.2.25, for OpenStare's LEDGER content-management
 * overhaul, kineticlogic-io/OpenStare#383–#388).
 *
 * The canonical `Input` (same surface, border, radius, focus treatment and subdued placeholder)
 * with a leading `TbSearch` glyph and, while it holds text, a trailing clear button (`TbX`,
 * "Clear search"). Escape clears it too; an Escape on an already-empty field is left to bubble
 * (so a surrounding `Modal` or drawer can still close on it).
 *
 * Controlled: `value` + `onChange(value)` report every keystroke. For a query that should only
 * run once typing pauses, pass `onDebouncedChange`: it fires `debounceMs` (default 250) after the
 * last change, and at once when the field is cleared. A change of `value` made by the parent is
 * reported the same way, and a value already reported is never reported twice.
 *
 * Sizes: `sm` (28px, 12px text — a panel header's compact search) and `md` (default, 36px, 13px —
 * `Input`'s default recipe). Design tokens only, so it follows the dark and light themes.
 */
export type SearchInputSize = 'sm' | 'md'

export interface SearchInputProps {
  value: string
  /** Called with the new text on every change (and with `''` when cleared). */
  onChange: (value: string) => void
  /** Called with the text once it has stopped changing for `debounceMs`, and at once on clear. */
  onDebouncedChange?: (value: string) => void
  /** Pause before `onDebouncedChange` fires, in ms (default 250). */
  debounceMs?: number
  placeholder?: string
  /** Accessible name of the field (required: a search box rarely has a visible label). */
  'aria-label': string
  autoFocus?: boolean
  size?: SearchInputSize
  disabled?: boolean
  id?: string
  name?: string
  /** React 19 ref-as-prop, forwarded to the `<input>`. */
  ref?: Ref<HTMLInputElement>
  /** Style for the outer wrapper (e.g. a `width`). */
  style?: CSSProperties
}

const SIZE: Record<SearchInputSize, { height: number; fontSize: number; icon: number; pad: number }> = {
  sm: { height: 28, fontSize: 12, icon: 14, pad: 8 },
  md: { height: 36, fontSize: 13, icon: 16, pad: 10 },
}

const DEFAULT_DEBOUNCE_MS = 250

export function SearchInput({
  value,
  onChange,
  onDebouncedChange,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  placeholder,
  'aria-label': ariaLabel,
  autoFocus,
  size = 'md',
  disabled = false,
  id,
  name,
  ref,
  style,
}: SearchInputProps) {
  const s = SIZE[size]
  const inputRef = useRef<HTMLInputElement | null>(null)
  // The last value handed to onDebouncedChange: starts at the initial value (nothing to report
  // on mount) so a value is reported once, whether it came from typing, a clear or the parent.
  const reported = useRef(value)
  const debounced = useRef(onDebouncedChange)
  useEffect(() => {
    debounced.current = onDebouncedChange
  }, [onDebouncedChange])

  useEffect(() => {
    if (value === reported.current) return
    const fire = () => {
      reported.current = value
      debounced.current?.(value)
    }
    if (value === '') {
      fire()
      return
    }
    const timer = setTimeout(fire, debounceMs)
    return () => clearTimeout(timer)
  }, [value, debounceMs])

  const clear = () => {
    onChange('')
    inputRef.current?.focus()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Escape' || value === '') return
    e.preventDefault()
    e.stopPropagation()
    onChange('')
  }

  const showClear = value !== '' && !disabled
  const clearSize = s.height - 8

  return (
    <div
      className="ui-search-input"
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', width: '100%', ...style }}
    >
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: s.pad,
          display: 'inline-flex',
          alignItems: 'center',
          fontSize: s.icon,
          color: 'var(--text-muted)',
          pointerEvents: 'none',
          opacity: disabled ? 0.4 : 1,
        }}
      >
        <TbSearch />
      </span>
      <Input
        ref={(el) => {
          inputRef.current = el
          if (typeof ref === 'function') ref(el)
          else if (ref) ref.current = el
        }}
        type="search"
        id={id}
        name={name}
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoFocus={autoFocus}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        style={{
          width: '100%',
          height: s.height,
          fontSize: s.fontSize,
          paddingLeft: s.pad + s.icon + 6,
          paddingRight: showClear ? clearSize + 8 : s.pad,
        }}
      />
      {showClear && (
        <button
          type="button"
          className="ui-search-input__clear"
          aria-label="Clear search"
          title="Clear search"
          onClick={clear}
          style={{
            position: 'absolute',
            right: 4,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: clearSize,
            height: clearSize,
            padding: 0,
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            background: 'transparent',
            color: 'var(--color-text-secondary)',
            fontSize: s.icon,
            cursor: 'pointer',
          }}
        >
          <TbX aria-hidden />
        </button>
      )}
    </div>
  )
}
