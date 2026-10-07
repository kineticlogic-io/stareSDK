import type { CSSProperties } from 'react'
import { useState } from 'react'
import { TbChevronLeft, TbChevronRight, TbChevronsLeft, TbChevronsRight } from 'react-icons/tb'
import { Select } from './Select.js'

/**
 * Pagination — shared prev/next result-page control (extracted 97-03 addendum, operator
 * directive 2026-08-22, reversing that plan's original "phase-local, extract later" call for
 * LedgerPage's footer).
 *
 * Presentational only: the caller owns `offset` state and re-fetches on `onOffsetChange`.
 * This component never fetches, never derives page count from anything but the props it is
 * given, and never mutates its inputs.
 *
 * API is shaped directly off LedgerPage.tsx's real footer (offset/limit/total, prev/next
 * disabled-at-boundary buttons, an "X-Y of Z" count label) — the one existing discrete-page
 * call site in this codebase. `itemCount` is threaded separately from `limit`/`total` because
 * the last page of a result set returns fewer rows than `limit`, and the count label must
 * reflect what was actually returned, not the requested page size.
 *
 * `total: null` covers a backend that cannot cheaply compute an exact total (not the case for
 * `/api/catalog` today, but kept for the primitive to be genuinely reusable) — the label drops
 * "of N" and "next" is enabled only while a full page was returned.
 *
 * `maxOffset` mirrors a hard backend ceiling (openstare-server's `catalog.rs::MAX_OFFSET`,
 * currently 1000) — advancing past it is refused client-side too, so the control never asks
 * the backend for an offset it would clamp away silently.
 *
 * A single-item page (`limit={1}`, `itemCount={1}`) collapses the "X-Y of Z" range to one
 * number ("3 of 7") instead of the degenerate "3-3 of 7" — this lets the primitive double as a
 * plain "1 of N" stepper (e.g. the map popup multi-hit candidate footer) without any caller
 * forking the label logic.
 *
 * Optional extras (added 0.2.5 for OpenStare's attribute table, kineticlogic-io/OpenStare#64);
 * every one is off by default so existing callers render exactly as before:
 *   - `showEnds` adds First/Last buttons around prev/next. Last jumps to the offset of the final
 *     page (`floor((total - 1) / limit) * limit`, held under `maxOffset`), so it needs a known
 *     `total` and is disabled while `total` is `null`.
 *   - `pageSizes` + `onLimitChange` add a compact page-size `Select` after the buttons. The current
 *     `limit` is always offered, even when it is not in `pageSizes`, so the control never shows a
 *     value it cannot represent. The caller owns `limit` and decides how `offset` follows it.
 *   - `label="page"` replaces the "X-Y of Z" range with "Page X of Y · N <noun>" (noun defaults to
 *     "features"), or "Page X" while `total` is `null`. `noun` applies to page mode only; the range
 *     label keeps its original wording.
 */

export type PaginationSize = 'sm' | 'md' | 'lg'

export interface PaginationProps {
  /** Zero-based row offset of the current page (matches the `?offset=` query param). */
  offset: number
  /** Requested page size (matches the `?limit=` query param). */
  limit: number
  /** Exact total row count, or `null` if the caller cannot cheaply compute one. */
  total: number | null
  /** Row count actually returned for the current page (may be < `limit` on the last page). */
  itemCount: number
  /** Called with the next offset to fetch. Never called past a disabled boundary. */
  onOffsetChange: (nextOffset: number) => void
  size?: PaginationSize
  /** Hard backend offset ceiling (e.g. `MAX_OFFSET`). `next` disables before exceeding it. */
  maxOffset?: number
  /** Disables both buttons while a fetch is in flight (does not affect the label). */
  loading?: boolean
  ariaLabel?: string
  style?: CSSProperties
  /** Adds First / Last page buttons around prev/next. Last needs a known `total`. */
  showEnds?: boolean
  /** Page sizes offered by the page-size select; rendered only together with `onLimitChange`. */
  pageSizes?: number[]
  /** Called with the page size picked in the page-size select. The caller owns `limit`. */
  onLimitChange?: (limit: number) => void
  /** `'range'` (default) shows "X-Y of Z"; `'page'` shows "Page X of Y · N <noun>". */
  label?: PaginationLabel
  /** Plural noun counted by the `'page'` label (default "features"). Ignored by `'range'`. */
  noun?: string
}

export type PaginationLabel = 'range' | 'page'

type PaginationButton = 'first' | 'prev' | 'next' | 'last'

interface SizeStyle {
  button: number
  icon: number
  labelFontSize: number
  gap: number
}

// Control heights line up with Button.tsx's own scale (xs/sm=28, md=34) at md/lg so a
// Pagination control drops into the same toolbar row as a Button without visual mismatch;
// `sm` goes one step tighter (24) for compact contexts (e.g. an embedded card footer) that
// Button itself has no size for.
const SIZE_STYLES: Record<PaginationSize, SizeStyle> = {
  sm: { button: 24, icon: 12, labelFontSize: 10, gap: 6 },
  md: { button: 28, icon: 14, labelFontSize: 11, gap: 8 },
  lg: { button: 34, icon: 16, labelFontSize: 12, gap: 10 },
}

function formatRangeLabel(offset: number, itemCount: number, total: number | null): string {
  if (itemCount === 0) return total === 0 || total === null ? 'No results' : `0 of ${total}`
  const start = offset + 1
  const end = offset + itemCount
  if (start === end) return total === null ? `${start}` : `${start} of ${total}`
  return total === null ? `${start}-${end}` : `${start}-${end} of ${total}`
}

function formatPageLabel(offset: number, limit: number, total: number | null, noun: string): string {
  const page = Math.floor(offset / Math.max(1, limit)) + 1
  if (total === null) return `Page ${page.toLocaleString()}`
  const pages = Math.max(1, Math.ceil(total / Math.max(1, limit)))
  return `Page ${page.toLocaleString()} of ${pages.toLocaleString()} · ${total.toLocaleString()} ${noun}`
}

export function Pagination({
  offset,
  limit,
  total,
  itemCount,
  onOffsetChange,
  size = 'md',
  maxOffset,
  loading = false,
  ariaLabel = 'Pagination',
  style,
  showEnds = false,
  pageSizes,
  onLimitChange,
  label = 'range',
  noun = 'features',
}: PaginationProps) {
  const [hoveredButton, setHoveredButton] = useState<PaginationButton | null>(null)
  const s = SIZE_STYLES[size]

  const ceiling = maxOffset ?? Infinity
  const nextOffset = offset + limit
  // Unknown total: treat a short (or empty) page as the last page — the only signal available
  // without a total to compare against.
  const reachedKnownEnd = total !== null ? nextOffset >= total : itemCount < limit
  const canGoPrev = !loading && offset > 0
  const canGoNext = !loading && !reachedKnownEnd && nextOffset <= ceiling
  // Last page's offset, page-aligned and held at or under the backend ceiling.
  const lastOffset =
    total === null || limit <= 0
      ? null
      : Math.min(
          Math.max(0, Math.floor((total - 1) / limit) * limit),
          Number.isFinite(ceiling) ? Math.max(0, Math.floor(ceiling / limit) * limit) : Infinity,
        )
  const canGoFirst = canGoPrev
  const canGoLast = !loading && lastOffset !== null && offset < lastOffset

  const sizeOptions =
    pageSizes && onLimitChange
      ? [...new Set([...pageSizes, limit])]
          .filter(n => Number.isFinite(n) && n > 0)
          .sort((a, b) => a - b)
          .map(n => ({ value: String(n), label: String(n) }))
      : null

  const buttonStyle = (kind: PaginationButton, enabled: boolean): CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: s.button,
    height: s.button,
    flexShrink: 0,
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--color-glass-border)',
    background: !enabled
      ? 'transparent'
      : hoveredButton === kind
      ? 'var(--color-glass-bg)'
      : 'transparent',
    color: enabled ? 'var(--color-text-primary)' : 'var(--text-muted)',
    fontSize: s.icon,
    cursor: enabled ? 'pointer' : 'not-allowed',
    opacity: enabled ? 1 : 0.5,
    transition: 'background 0.15s, border-color 0.15s',
    padding: 0,
  })

  return (
    <nav
      aria-label={ariaLabel}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: s.gap,
        fontFamily: 'var(--font-mono)',
        ...style,
      }}
    >
      <span
        aria-live="polite"
        style={{ fontSize: s.labelFontSize, color: 'var(--color-text-secondary)' }}
      >
        {label === 'page' ? formatPageLabel(offset, limit, total, noun) : formatRangeLabel(offset, itemCount, total)}
      </span>
      {showEnds && (
        <button
          type="button"
          aria-label="First page"
          disabled={!canGoFirst}
          onMouseEnter={() => setHoveredButton('first')}
          onMouseLeave={() => setHoveredButton(prev => (prev === 'first' ? null : prev))}
          onClick={() => canGoFirst && onOffsetChange(0)}
          style={buttonStyle('first', canGoFirst)}
        >
          <TbChevronsLeft />
        </button>
      )}
      <button
        type="button"
        aria-label="Previous page"
        disabled={!canGoPrev}
        onMouseEnter={() => setHoveredButton('prev')}
        onMouseLeave={() => setHoveredButton(prev => (prev === 'prev' ? null : prev))}
        onClick={() => canGoPrev && onOffsetChange(Math.max(0, offset - limit))}
        style={buttonStyle('prev', canGoPrev)}
      >
        <TbChevronLeft />
      </button>
      <button
        type="button"
        aria-label="Next page"
        disabled={!canGoNext}
        onMouseEnter={() => setHoveredButton('next')}
        onMouseLeave={() => setHoveredButton(prev => (prev === 'next' ? null : prev))}
        onClick={() => canGoNext && onOffsetChange(Math.min(nextOffset, ceiling))}
        style={buttonStyle('next', canGoNext)}
      >
        <TbChevronRight />
      </button>
      {showEnds && (
        <button
          type="button"
          aria-label="Last page"
          disabled={!canGoLast}
          onMouseEnter={() => setHoveredButton('last')}
          onMouseLeave={() => setHoveredButton(prev => (prev === 'last' ? null : prev))}
          onClick={() => canGoLast && lastOffset !== null && onOffsetChange(lastOffset)}
          style={buttonStyle('last', canGoLast)}
        >
          <TbChevronsRight />
        </button>
      )}
      {sizeOptions && onLimitChange && (
        <Select
          ariaLabel="Page size"
          options={sizeOptions}
          value={String(limit)}
          disabled={loading}
          onChange={v => {
            const next = Number(v)
            if (Number.isFinite(next) && next > 0 && next !== limit) onLimitChange(next)
          }}
          style={{
            width: 'auto',
            height: s.button,
            padding: '0 4px',
            fontSize: s.labelFontSize,
            borderRadius: 'var(--radius-sm)',
          }}
        />
      )}
    </nav>
  )
}
