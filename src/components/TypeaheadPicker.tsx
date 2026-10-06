/**
 * TypeaheadPicker — shared debounced-query → dropdown → keyboard-nav → select shell (D-27,
 * Phase 80 Plan 04). Extracted from the two shipped Phase 78/79 hand-rolled copies
 * (`WikiSearchBar`, the `[[` wikilink picker in `ArticleEditor`) once Phase 80 was about to
 * add a third and fourth copy (`ClassPicker` in 80-08, the entity-picker field in 80-09) —
 * operator-approved extraction per CLAUDE.md's shared-UI hard rule.
 *
 * `TypeaheadPicker` itself is PRESENTATIONAL: it owns the glass dropdown panel, row
 * hover/highlight styling, the loading/error/empty states, outside-click + Escape dismissal,
 * and `role="listbox"` / `role="option"` / `aria-activedescendant` wiring. It owns NO fetching
 * and NO query state — `highlightIndex` is controlled by the consumer (mouse hover inside this
 * component calls `onHighlightChange`; keyboard nav is the consumer's own concern, typically
 * via `useTypeaheadKeyboard` below).
 *
 * Outside-click dismissal convention: the panel walks up to its OWN DOM parent
 * (`panelRef.current.parentElement`) as the "inside" boundary — so a consumer must render its
 * anchor input/textarea as a SIBLING of `<TypeaheadPicker>` inside one `position: relative`
 * wrapper div (exactly the structure both `WikiSearchBar` and `ArticleEditor`'s `[[` picker
 * already use). A click on the anchor input itself is therefore never treated as "outside."
 *
 * `footer` is a generic trailing slot, always rendered (regardless of loading/error/empty/items
 * state) directly below the state body — the CONSUMER decides what (if anything) appears there
 * per state (e.g. a "Retry" action during `error`, a "Create new" CTA during a canEdit
 * zero-results case, a "See all results" row when items are present). This keeps
 * `TypeaheadPicker` itself free of any domain-specific copy or actions.
 */
import { useEffect, useRef, useState } from 'react'
import type React from 'react'
import { glass } from '../internal/styles'
import { typeaheadOptionId } from './TypeaheadPicker.helpers'

/** Default debounce, matching WikiSearchBar's original SEARCH_DEBOUNCE_MS exactly. */
export const SEARCH_DEBOUNCE_MS = 300

export interface TypeaheadRowState {
  /** True when this row is the currently keyboard/mouse-highlighted row (drives the panel's own background tint). */
  highlighted: boolean
  /** True while the pointer is directly over this row (independent of keyboard highlight). */
  hovered: boolean
}

export interface TypeaheadPickerProps<T> {
  open: boolean
  items: T[]
  getKey: (item: T) => string
  renderRow: (item: T, state: TypeaheadRowState) => React.ReactNode
  onSelect: (item: T) => void
  onDismiss: () => void
  highlightIndex: number
  onHighlightChange: (index: number) => void
  loading?: boolean
  error?: string | null
  emptyCopy?: string
  footer?: React.ReactNode
  ariaLabel?: string
  anchor?: 'below-input' | 'below-container'
}

const panelBaseStyle: React.CSSProperties = {
  ...glass,
  zIndex: 20,
  maxHeight: 320,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
}

const anchorStyle: Record<NonNullable<TypeaheadPickerProps<unknown>['anchor']>, React.CSSProperties> = {
  'below-input': { position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0 },
  'below-container': {
    position: 'absolute',
    left: 'var(--space-md)',
    bottom: 'var(--space-md)',
    minWidth: 220,
    maxWidth: 'calc(100% - var(--space-lg))',
  },
}

const hintStyleRegular: React.CSSProperties = {
  padding: 'var(--space-md)',
  fontSize: 15,
  color: 'var(--color-text-secondary)',
}

const hintStyleBold: React.CSSProperties = {
  padding: 'var(--space-md)',
  fontSize: 15,
  fontWeight: 600,
  color: 'var(--color-text-primary)',
}

const errorTextStyle: React.CSSProperties = {
  padding: 'var(--space-md)',
  fontSize: 15,
  color: 'var(--color-destructive)',
}

const rowStyle: React.CSSProperties = {
  padding: 'var(--space-sm) var(--space-md)',
  cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
}

export function TypeaheadPicker<T>({
  open,
  items,
  getKey,
  renderRow,
  onSelect,
  onDismiss,
  highlightIndex,
  onHighlightChange,
  loading = false,
  error = null,
  emptyCopy,
  footer,
  ariaLabel,
  anchor = 'below-input',
}: TypeaheadPickerProps<T>) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)

  // Outside-click / Escape dismiss — matches WikiSearchBar's and the [[ picker's original
  // per-component effects exactly, now owned once here.
  useEffect(() => {
    if (!open) return
    const handlePointer = (e: MouseEvent) => {
      const boundary = panelRef.current?.parentElement
      if (boundary && !boundary.contains(e.target as Node)) onDismiss()
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss()
    }
    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open, onDismiss])

  if (!open) return null

  return (
    <div
      ref={panelRef}
      role="listbox"
      aria-label={ariaLabel}
      // Keep the owning input/textarea focused on a row click (its onBlur would otherwise
      // close the picker before onClick fires) — matches the [[ picker's original guard.
      onMouseDown={e => e.preventDefault()}
      style={{ ...panelBaseStyle, ...anchorStyle[anchor] }}
    >
      {loading ? (
        <div style={hintStyleRegular}>Searching&hellip;</div>
      ) : error ? (
        <div style={errorTextStyle}>{error}</div>
      ) : items.length === 0 ? (
        emptyCopy ? <div style={hintStyleBold}>{emptyCopy}</div> : null
      ) : (
        items.map((item, i) => {
          const key = getKey(item)
          const highlighted = i === highlightIndex
          const hovered = hoveredKey === key
          return (
            <div
              key={key}
              id={typeaheadOptionId(key)}
              role="option"
              aria-selected={highlighted}
              onMouseEnter={() => {
                onHighlightChange(i)
                setHoveredKey(key)
              }}
              onMouseLeave={() => setHoveredKey(prev => (prev === key ? null : prev))}
              onClick={() => onSelect(item)}
              style={{ ...rowStyle, background: highlighted ? 'var(--brand-subtle)' : 'transparent' }}
            >
              {renderRow(item, { highlighted, hovered })}
            </div>
          )
        })
      )}
      {footer}
    </div>
  )
}

export interface UseTypeaheadKeyboardOptions {
  open: boolean
  itemCount: number
  highlightIndex: number
  onHighlightChange: (index: number) => void
  onCommit: () => void
  onDismiss: () => void
}

export interface UseDebouncedQueryResult<T> {
  /** null = no search has resolved yet for the current (non-empty) query; [] = resolved, zero hits. */
  items: T[] | null
  loading: boolean
  error: string | null
  retry: () => void
}
