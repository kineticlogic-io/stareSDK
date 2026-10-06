import type { CSSProperties, KeyboardEvent, ReactNode } from 'react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { TbArrowDown, TbArrowUp, TbSelector } from 'react-icons/tb'

/**
 * DataTable — shared, compact data table (stareSDK, requested for OpenTrack's source, field,
 * schema, registry and track lists; operator-approved 2026-09-25).
 *
 * Table chrome follows the neutral-table HARD RULE (CLAUDE.md "Tables — neutral, not branded"):
 * the header row is distinguished by weight, uppercase + `letter-spacing: 0.08em` and a bottom
 * border in `--color-text-secondary` — never a coloured fill or coloured text. The reference
 * implementation is `components/admin/UserManagementTab.tsx`. The brand green appears only on the
 * interactive affordances it is reserved for: the selected row's `--brand-subtle` wash and the
 * keyboard focus ring.
 *
 * Dense by default (operator direction: "tight, no oversized components"): 28px rows, 12px text,
 * `sm` spacing. `density="comfortable"` gives 34px rows for the few read-mostly lists that want
 * air.
 *
 * Sorting is optional per column (`sortValue`). It is uncontrolled unless `sort`/`onSortChange`
 * are passed. Sorting is stable and nulls sort last in both directions.
 *
 * Large lists: with `maxHeight` set and more than `virtualizeAbove` rows (default 200), only the
 * rows in view (plus overscan) are rendered, using the fixed row height. The header stays
 * sticky. Without `maxHeight` the table grows with its content and never virtualises.
 *
 * Rows become interactive (focusable, Enter/Space activates, arrow keys move) only when
 * `onRowClick` is given; otherwise they are plain rows with no hover affordance, so a read-only
 * table never pretends to be clickable.
 */

export type SortDirection = 'asc' | 'desc'

export interface DataTableSort {
  key: string
  direction: SortDirection
}

export interface DataTableColumn<T> {
  /** Stable column id; also the sort key. */
  key: string
  /** Header label. Rendered uppercase by the header style; pass it in natural case. */
  header: string
  /** Cell content. Defaults to `String(row[key])` when the row is an object. */
  render?: (row: T) => ReactNode
  /** Value to sort by; omit to make the column unsortable. */
  sortValue?: (row: T) => string | number | null | undefined
  /** CSS width (e.g. `120`, `'20%'`). Unset columns share the remaining width. */
  width?: number | string
  align?: 'left' | 'right' | 'center'
  /** Render cell text in `--font-mono` (ids, coordinates, codes). */
  mono?: boolean
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  /** Makes rows interactive. */
  onRowClick?: (row: T) => void
  /** Key of the selected row (highlighted). */
  selectedKey?: string | null
  /** Controlled sort; pair with `onSortChange`. */
  sort?: DataTableSort | null
  onSortChange?: (sort: DataTableSort | null) => void
  /** Initial sort when uncontrolled. */
  defaultSort?: DataTableSort | null
  /** Shown instead of rows when `rows` is empty. */
  empty?: ReactNode
  /** Scroll container height; enables the sticky header and virtualisation. */
  maxHeight?: number | string
  density?: 'compact' | 'comfortable'
  /** Row count above which rendering is virtualised (needs `maxHeight`). */
  virtualizeAbove?: number
  'aria-label': string
  style?: CSSProperties
}

const ROW_HEIGHT = { compact: 28, comfortable: 34 } as const
const OVERSCAN = 8

const TH_STYLE: CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 1,
  background: 'var(--color-bg-secondary)',
  borderBottom: '1px solid var(--color-glass-border)',
  padding: '0 var(--space-sm)',
  height: 28,
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--color-text-secondary)',
  whiteSpace: 'nowrap',
  userSelect: 'none',
}

const TD_STYLE: CSSProperties = {
  padding: '0 var(--space-sm)',
  fontSize: 12,
  color: 'var(--color-text-primary)',
  borderBottom: '1px solid var(--color-glass-border)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: 0,
}

/** Stable sort with nulls last in either direction. Exported for tests. */
export function sortRows<T>(
  rows: T[],
  sortValue: (row: T) => string | number | null | undefined,
  direction: SortDirection,
): T[] {
  const sign = direction === 'asc' ? 1 : -1
  return rows
    .map((row, index) => ({ row, index, v: sortValue(row) }))
    .sort((a, b) => {
      const an = a.v === null || a.v === undefined || a.v === ''
      const bn = b.v === null || b.v === undefined || b.v === ''
      if (an || bn) return an === bn ? a.index - b.index : an ? 1 : -1
      const cmp =
        typeof a.v === 'number' && typeof b.v === 'number'
          ? a.v - b.v
          : String(a.v).localeCompare(String(b.v), undefined, { numeric: true, sensitivity: 'base' })
      return cmp === 0 ? a.index - b.index : cmp * sign
    })
    .map((x) => x.row)
}

/** Default cell content for object rows. */
function defaultCell<T>(row: T, key: string): ReactNode {
  if (row && typeof row === 'object' && key in (row as object)) {
    const v = (row as Record<string, unknown>)[key]
    return v === null || v === undefined ? '' : String(v)
  }
  return ''
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  selectedKey,
  sort: controlledSort,
  onSortChange,
  defaultSort = null,
  empty = 'No rows',
  maxHeight,
  density = 'compact',
  virtualizeAbove = 200,
  'aria-label': ariaLabel,
  style,
}: DataTableProps<T>) {
  const [ownSort, setOwnSort] = useState<DataTableSort | null>(defaultSort)
  const sort = controlledSort !== undefined ? controlledSort : ownSort
  const [scrollTop, setScrollTop] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const rowHeight = ROW_HEIGHT[density]

  const sorted = useMemo(() => {
    if (!sort) return rows
    const col = columns.find((c) => c.key === sort.key)
    return col?.sortValue ? sortRows(rows, col.sortValue, sort.direction) : rows
  }, [rows, columns, sort])

  const toggleSort = useCallback(
    (key: string) => {
      const next: DataTableSort | null =
        sort?.key !== key
          ? { key, direction: 'asc' }
          : sort.direction === 'asc'
            ? { key, direction: 'desc' }
            : null
      if (controlledSort === undefined) setOwnSort(next)
      onSortChange?.(next)
    },
    [sort, controlledSort, onSortChange],
  )

  const viewport = typeof maxHeight === 'number' ? maxHeight : 600
  const virtual = maxHeight !== undefined && sorted.length > virtualizeAbove
  const first = virtual ? Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN) : 0
  const last = virtual
    ? Math.min(sorted.length, Math.ceil((scrollTop + viewport) / rowHeight) + OVERSCAN)
    : sorted.length
  const visible = sorted.slice(first, last)

  const focusRow = (index: number) => {
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-row-index="${index}"]`)
    el?.focus()
  }

  const onRowKey = (e: KeyboardEvent<HTMLTableRowElement>, row: T, index: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onRowClick?.(row)
    } else if (e.key === 'ArrowDown' && index + 1 < sorted.length) {
      e.preventDefault()
      focusRow(index + 1)
    } else if (e.key === 'ArrowUp' && index > 0) {
      e.preventDefault()
      focusRow(index - 1)
    }
  }

  return (
    <div
      ref={scrollRef}
      className="ui-data-table"
      onScroll={virtual ? (e) => setScrollTop(e.currentTarget.scrollTop) : undefined}
      style={{
        maxHeight,
        overflow: maxHeight !== undefined ? 'auto' : undefined,
        border: '1px solid var(--color-glass-border)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-bg-secondary)',
        ...style,
      }}
    >
      <table
        aria-label={ariaLabel}
        aria-rowcount={sorted.length + 1}
        style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' }}
      >
        <colgroup>
          {columns.map((c) => (
            <col key={c.key} style={{ width: c.width }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((c) => {
              const active = sort?.key === c.key
              const ariaSort = active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={c.sortValue ? ariaSort : undefined}
                  style={{ ...TH_STYLE, textAlign: c.align ?? 'left' }}
                >
                  {c.sortValue ? (
                    <button
                      type="button"
                      className="ui-data-table__sort"
                      onClick={() => toggleSort(c.key)}
                      style={{
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        color: active ? 'var(--color-text-primary)' : 'inherit',
                      }}
                    >
                      {c.header}
                      {active ? (
                        sort.direction === 'asc' ? <TbArrowUp size={12} aria-hidden /> : <TbArrowDown size={12} aria-hidden />
                      ) : (
                        <TbSelector size={12} aria-hidden style={{ opacity: 0.5 }} />
                      )}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{ ...TD_STYLE, maxWidth: undefined, height: 56, textAlign: 'center', color: 'var(--color-text-secondary)', borderBottom: 'none' }}
              >
                {empty}
              </td>
            </tr>
          ) : (
            <>
              {virtual && first > 0 && (
                <tr aria-hidden style={{ height: first * rowHeight }}>
                  <td colSpan={columns.length} style={{ padding: 0, border: 'none' }} />
                </tr>
              )}
              {visible.map((row, i) => {
                const index = first + i
                const key = rowKey(row)
                const selected = selectedKey != null && key === selectedKey
                const interactive = !!onRowClick
                return (
                  <tr
                    key={key}
                    data-row-index={index}
                    aria-rowindex={index + 2}
                    aria-selected={interactive ? selected : undefined}
                    tabIndex={interactive ? 0 : undefined}
                    className={interactive ? 'ui-data-table__row--interactive' : undefined}
                    onClick={interactive ? () => onRowClick(row) : undefined}
                    onKeyDown={interactive ? (e) => onRowKey(e, row, index) : undefined}
                    style={{
                      height: rowHeight,
                      cursor: interactive ? 'pointer' : undefined,
                      background: selected ? 'var(--brand-subtle)' : undefined,
                    }}
                  >
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        style={{
                          ...TD_STYLE,
                          textAlign: c.align ?? 'left',
                          fontFamily: c.mono ? 'var(--font-mono)' : undefined,
                        }}
                      >
                        {c.render ? c.render(row) : defaultCell(row, c.key)}
                      </td>
                    ))}
                  </tr>
                )
              })}
              {virtual && last < sorted.length && (
                <tr aria-hidden style={{ height: (sorted.length - last) * rowHeight }}>
                  <td colSpan={columns.length} style={{ padding: 0, border: 'none' }} />
                </tr>
              )}
            </>
          )}
        </tbody>
      </table>
    </div>
  )
}
