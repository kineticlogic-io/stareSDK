/**
 * Flyout — ui/Flyout.tsx
 *
 * **D-26 AUTHORISATION (127-CONTEXT.md):** this is a NEW `ui/*` primitive, ASKED ABOUT AND
 * EXPLICITLY AUTHORISED by the operator on 2026-09-14 under CLAUDE.md's shared-UI-first hard
 * rule ("ALWAYS look in `openstare/src/components/ui/*` for an existing component ... If a
 * suitable `ui/*` component does not exist, STOP and ASK the operator before creating a new
 * one"). No ready-made anchored, filterable, keyboard-navigable popover with a favourites
 * section and a disabled-item-with-reason contract existed in `ui/*` before this plan (VANTAGE
 * tool rail, VANT-07). This is the ONE new shared primitive Phase 127 is authorised to create —
 * do not build a second new `ui/*` popover/dropdown component; extend this one instead.
 *
 * Composed from three existing partial precedents rather than invented from scratch:
 *  - `ContextMenu.tsx` — the positioned-shell mechanics this file reuses: viewport edge-flip
 *    math (extended here to anchor against an ELEMENT's `getBoundingClientRect()` rather than a
 *    raw x/y click point), Escape + outside-click dismissal, and the WR-10
 *    `[data-portal-overlay]` exemption convention (a click that opens a portaled overlay — e.g.
 *    a future confirm dialog — as a direct result of a click that began inside this flyout must
 *    not immediately unmount it).
 *  - `TypeaheadPicker.tsx` (+ `TypeaheadPicker.helpers.ts`) — `SEARCH_DEBOUNCE_MS` is reused
 *    directly (not re-derived) for the filter box's debounce, the `role="listbox"` /
 *    `aria-activedescendant` keyboard-navigation shape is the same idiom, and the "`footer`
 *    always renders, regardless of state" contract is copied verbatim.
 *  - `PopoverMenuButton.tsx` — the `disabled` + `title`-as-reason row shape a disabled
 *    `FlyoutItem` renders through (dimmed opacity, `title` and `aria-label` both carrying the
 *    reason, no `onSelect` on click or Enter).
 *
 * Guarantees (see the co-located test file for full coverage):
 *  - Renders nothing when closed; a portaled panel (to `<body>`, matching `ui/Modal`'s portal
 *    discipline) anchored to `anchorRef` when open.
 *  - Flips to stay inside the viewport when the trigger is near an edge.
 *  - Escape and outside-click both close; a click on the trigger itself or inside the panel does
 *    not (the trigger's own `onClick` owns toggling `open` — this component never double-fires).
 *  - `filterable` renders a debounced filter box, focused on open.
 *  - Arrow keys move `aria-activedescendant` through ENABLED items only; Enter activates the
 *    active item; disabled items are skipped, dimmed, and carry their reason as `title` +
 *    `aria-label`.
 *  - `footer` always renders, including when the filtered item list is empty.
 *  - Focus returns to the trigger when the flyout closes.
 *  - Sits at the same in-page-control layer as `ContextMenu` (z-4900) — below `ui/Modal` (5000),
 *    far below the `ClassificationBanner` (9999).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject } from 'react'
import { createPortal } from 'react-dom'
import { TbBookmark, TbBookmarkFilled } from 'react-icons/tb'
import { SEARCH_DEBOUNCE_MS } from './TypeaheadPicker'

/** A single row in a `Flyout`. Data-only — `Flyout` owns all rendering. */
export interface FlyoutItem {
  id: string
  label: string
  icon?: ReactNode
  /** Rendered right-aligned in the row, e.g. `'H'`. */
  shortcut?: string
  /** One-line hint, rendered as the row's secondary line when the item is enabled. */
  hint?: string
  disabled?: boolean
  /** Required (in substance) when `disabled` is true — carried as the row's `title` +
   *  `aria-label` and shown as the secondary line in place of `hint`. */
  disabledReason?: string
  /** Whether this item is currently pinned as a favourite (D-28) — `Flyout` groups favourited
   *  items into a leading "Favourites" section; it does not persist this itself. */
  favourite?: boolean
}

export interface FlyoutProps {
  open: boolean
  onClose: () => void
  /** The trigger element this flyout is anchored to and returns focus to on close. */
  anchorRef: RefObject<HTMLElement | null>
  items: FlyoutItem[]
  onSelect: (id: string) => void
  /** Renders a debounced filter box, focused on open. Default false. */
  filterable?: boolean
  filterPlaceholder?: string
  /** Always rendered, regardless of the filtered item list's state — matches TypeaheadPicker's
   *  documented `footer` contract. The natural home for D-28's "Add … tool…" extension seam. */
  footer?: ReactNode
  ariaLabel: string
  /** Present (and non-undefined) to render a bookmark-pin affordance on every row; omit to hide
   *  favourites entirely. Called with the item's id when its pin is clicked. */
  onToggleFavourite?: (id: string) => void
  /** Estimated panel width/height for the viewport edge-flip math (mirrors `ContextMenu`'s own
   *  `width`/`estimatedHeight` props). */
  width?: number
  estimatedHeight?: number
}

let panelSeq = 0

const sectionHeaderStyle: CSSProperties = {
  padding: '4px 12px 4px',
  fontSize: 9,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--color-text-secondary)',
}

export function Flyout({
  open,
  onClose,
  anchorRef,
  items,
  onSelect,
  filterable = false,
  filterPlaceholder = 'Filter…',
  footer,
  ariaLabel,
  onToggleFavourite,
  width = 260,
  estimatedHeight = 360,
}: FlyoutProps) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const panelIdRef = useRef<string>('')
  if (!panelIdRef.current) panelIdRef.current = `flyout-${++panelSeq}`
  const panelId = panelIdRef.current
  const listboxId = `${panelId}-listbox`
  const optionDomId = useCallback((itemId: string) => `${panelId}-option-${itemId}`, [panelId])

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const wasOpenRef = useRef(false)

  // Debounced filter — reuses TypeaheadPicker's own SEARCH_DEBOUNCE_MS rather than a re-derived
  // constant, per this file's "compose, don't reinvent" mandate.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [query])

  // Open/close transitions: reset transient state and manage focus. Runs on every render but
  // only acts on the open->closed / closed->open EDGE (wasOpenRef), so it is safe alongside
  // `items`/`onClose` identity churn from the caller.
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      wasOpenRef.current = true
      setQuery('')
      setDebouncedQuery('')
      setActiveId(null)
      const t = setTimeout(() => {
        if (filterable) inputRef.current?.focus()
        else panelRef.current?.focus()
      }, 0)
      return () => clearTimeout(t)
    }
    if (!open && wasOpenRef.current) {
      wasOpenRef.current = false
      anchorRef.current?.focus()
    }
    return undefined
  }, [open, filterable, anchorRef])

  // Escape + outside-click dismissal — ContextMenu's shell, extended with an anchor exemption:
  // a mousedown that lands on the TRIGGER is not "outside" but is also not handled here — the
  // trigger's own onClick owns toggling `open`, so this listener simply does nothing for it
  // rather than also calling onClose (which would race the trigger's toggle).
  useEffect(() => {
    if (!open) return undefined
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    function onMouseDown(e: MouseEvent) {
      const target = e.target as Node
      if (panelRef.current?.contains(target)) return
      if (anchorRef.current?.contains(target)) return
      // WR-10 exemption (ContextMenu.tsx) — a portaled overlay opened as a direct result of an
      // interaction that began inside this flyout must not cause an immediate self-unmount.
      const targetEl = target instanceof Element ? target : (target as Node | null)?.parentElement ?? null
      if (targetEl?.closest?.('[data-portal-overlay]')) return
      onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onMouseDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onMouseDown)
    }
  }, [open, onClose, anchorRef])

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase()
    if (!q) return items
    return items.filter(it => it.label.toLowerCase().includes(q))
  }, [items, debouncedQuery])

  const favourites = useMemo(() => filtered.filter(it => it.favourite), [filtered])
  const rest = useMemo(() => filtered.filter(it => !it.favourite), [filtered])
  const ordered = useMemo(() => [...favourites, ...rest], [favourites, rest])
  const enabledIds = useMemo(() => ordered.filter(it => !it.disabled).map(it => it.id), [ordered])

  const moveActive = useCallback((dir: 1 | -1) => {
    if (enabledIds.length === 0) {
      setActiveId(null)
      return
    }
    const idx = activeId ? enabledIds.indexOf(activeId) : -1
    const next = idx === -1 ? (dir === 1 ? 0 : enabledIds.length - 1) : Math.min(Math.max(idx + dir, 0), enabledIds.length - 1)
    setActiveId(enabledIds[next])
  }, [enabledIds, activeId])

  const commitActive = useCallback(() => {
    if (!activeId) return
    const item = ordered.find(it => it.id === activeId)
    if (!item || item.disabled) return
    onSelect(item.id)
  }, [activeId, ordered, onSelect])

  const handleKeyDown = useCallback((e: ReactKeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      moveActive(1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      moveActive(-1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      commitActive()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }, [moveActive, commitActive, onClose])

  if (!open) return null

  const anchorRect = anchorRef.current?.getBoundingClientRect()
  const vpW = window.innerWidth
  const vpH = window.innerHeight
  const baseLeft = anchorRect ? anchorRect.right + 6 : 8
  const baseTop = anchorRect ? anchorRect.top : 8
  const left = baseLeft + width > vpW ? Math.max((anchorRect?.left ?? 0) - width - 6, 8) : baseLeft
  const top = baseTop + estimatedHeight > vpH ? Math.max(vpH - estimatedHeight - 8, 8) : baseTop
  const activeDomId = activeId ? optionDomId(activeId) : undefined

  const rows = (list: FlyoutItem[]) => list.map(item => (
    <FlyoutRow
      key={item.id}
      domId={optionDomId(item.id)}
      item={item}
      active={item.id === activeId}
      onSelect={onSelect}
      onHover={setActiveId}
      onToggleFavourite={onToggleFavourite}
    />
  ))

  const panel = (
    <div
      ref={panelRef}
      data-portal-overlay=""
      tabIndex={filterable ? undefined : -1}
      aria-activedescendant={filterable ? undefined : activeDomId}
      onKeyDown={handleKeyDown}
      style={{
        position: 'fixed',
        left,
        top,
        zIndex: 4900,
        width,
        maxHeight: estimatedHeight,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-glass-bg)',
        border: '1px solid var(--color-glass-border)',
        borderRadius: 8,
        boxShadow: 'var(--shadow-standard)',
        fontFamily: 'var(--font-sans)',
        overflow: 'hidden',
        outline: 'none',
      }}
    >
      {filterable && (
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls={listboxId}
          aria-activedescendant={activeDomId}
          aria-label={ariaLabel}
          value={query}
          placeholder={filterPlaceholder}
          onChange={e => setQuery(e.target.value)}
          style={{
            border: 'none',
            borderBottom: '1px solid var(--color-glass-border)',
            background: 'transparent',
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-sans)',
            fontSize: 12,
            padding: 'var(--space-sm) var(--space-md)',
            outline: 'none',
          }}
        />
      )}
      <div
        role="listbox"
        aria-label={ariaLabel}
        id={listboxId}
        style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: 'var(--space-xs) 0' }}
      >
        {favourites.length > 0 && <div style={sectionHeaderStyle}>Favourites</div>}
        {rows(favourites)}
        {favourites.length > 0 && rest.length > 0 && <div style={sectionHeaderStyle}>All tools</div>}
        {rows(rest)}
      </div>
      {footer}
    </div>
  )

  return createPortal(panel, document.body)
}

interface FlyoutRowProps {
  domId: string
  item: FlyoutItem
  active: boolean
  onSelect: (id: string) => void
  onHover: (id: string) => void
  onToggleFavourite?: (id: string) => void
}

function FlyoutRow({ domId, item, active, onSelect, onHover, onToggleFavourite }: FlyoutRowProps) {
  const { id, label, icon, shortcut, hint, disabled = false, disabledReason, favourite = false } = item
  const reason = disabled ? disabledReason : undefined
  return (
    <div
      id={domId}
      role="option"
      aria-selected={active}
      aria-disabled={disabled || undefined}
      title={reason}
      aria-label={reason ? `${label} — ${reason}` : label}
      onMouseEnter={() => { if (!disabled) onHover(id) }}
      onClick={() => { if (!disabled) onSelect(id) }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-sm)',
        padding: 'var(--space-xs) var(--space-md)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        background: active && !disabled ? 'var(--brand-subtle)' : 'transparent',
      }}
    >
      {icon && (
        <span style={{ display: 'flex', flexShrink: 0, color: 'var(--color-text-secondary)' }}>{icon}</span>
      )}
      <span style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            color: 'var(--color-text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </div>
        {(hint || reason) && (
          <div
            style={{
              fontSize: 10,
              color: 'var(--color-text-secondary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {reason ?? hint}
          </div>
        )}
      </span>
      {shortcut && (
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)', flexShrink: 0 }}>
          {shortcut}
        </span>
      )}
      {onToggleFavourite && (
        <button
          type="button"
          aria-label={favourite ? `Remove ${label} from favourites` : `Add ${label} to favourites`}
          aria-pressed={favourite}
          onClick={e => {
            e.stopPropagation()
            onToggleFavourite(id)
          }}
          style={{
            display: 'flex',
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            color: favourite ? 'var(--color-accent)' : 'var(--color-text-secondary)',
            flexShrink: 0,
          }}
        >
          {favourite ? <TbBookmarkFilled size={14} /> : <TbBookmark size={14} />}
        </button>
      )}
    </div>
  )
}
