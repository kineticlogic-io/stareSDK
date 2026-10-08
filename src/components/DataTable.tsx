import type { CSSProperties, DragEvent, KeyboardEvent, MouseEvent, PointerEvent, ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
 *
 * Attribute-table extras (added 0.2.5 for OpenStare's attribute table,
 * kineticlogic-io/OpenStare#64); every one is optional and off by default:
 *   - `manualSort`: the caller sorts (e.g. server-side). Header clicks still cycle the controlled
 *     `sort` through `onSortChange`, but rows render in the order given, never re-sorted here.
 *     In this mode every column is sortable by default, with or without `sortValue`.
 *   - Column `sortable` / `sortDisabledReason`: `sortable: false` removes a column's sort
 *     affordance and click; the reason (e.g. "Text fields cannot be sorted") becomes the header's
 *     `title` tooltip.
 *   - `pinFirstColumn`: the first column stays put while the table scrolls sideways.
 *   - `onColumnResize`: each header gets a drag handle on its right edge (pointer drag, or arrow
 *     keys on the focused handle; minimum 48px). Widths stay controlled through each column's
 *     `width`: the live width is shown while dragging and reported once, on pointer-up.
 *   - `onRowDoubleClick`: a double-click on a row.
 * With `pinFirstColumn` or `onColumnResize` the table is at least as wide as its columns
 * (numeric widths, 120px for a column without one) and scrolls horizontally instead of squeezing.
 * A single highlighted row is `selectedKey`; there is deliberately no second highlight style.
 *   - `headerDividers` (0.2.7): a faint `--color-glass-border` line between header cells only.
 *   - `onColumnReorder` (0.2.8): headers can be dragged onto another header to move a column
 *     (a line marks the drop side), or moved one place with Alt+Shift+Left/Right on a focused
 *     header. Reports `(key, toIndex)` once per move; the caller reorders `columns`. A pinned
 *     first column and any column with `reorderable: false` stay put, and nothing lands before a
 *     pinned column.
 *   - `selection` (0.2.9): a checkbox column fixed at the far left (before a pinned first column,
 *     never moved or resized) whose boxes toggle a row in or out of the caller's selection, and a
 *     header box whose state the caller gives (`all` / `none` / `some`, shown checked / unchecked /
 *     indeterminate) and whose click asks the caller to select or clear every row. The caller owns
 *     the selection — the table only reports clicks, with the modifier keys held. Rows the caller
 *     reports as selected get the same `--brand-subtle` wash as `selectedKey`. `onRowClick` also
 *     receives the modifier keys (Shift / Ctrl / Meta), so a caller can do range and toggle clicks.
 */

export type SortDirection = 'asc' | 'desc'

export interface DataTableSort {
  key: string
  direction: SortDirection
}

/** Modifier keys held during a row or checkbox click. */
export interface DataTableClickModifiers {
  shiftKey: boolean
  ctrlKey: boolean
  metaKey: boolean
}

/** The header checkbox's state: every row, none, or some of them selected. */
export type DataTableHeaderSelection = 'all' | 'none' | 'some'

/** A caller-owned row selection rendered as a fixed checkbox column (see the component doc). */
export interface DataTableRowSelection<T> {
  /** Whether `row` is in the selection. */
  isSelected: (row: T) => boolean
  /** A row's checkbox was clicked (Space on a focused box counts as a click). */
  onToggle: (row: T, modifiers: DataTableClickModifiers) => void
  /** The header checkbox's state. */
  header: DataTableHeaderSelection
  /** The header checkbox was clicked. */
  onToggleAll: () => void
  /** Accessible label of a row's checkbox (default "Select row"). */
  rowLabel?: (row: T) => string
  /** Accessible label of the header checkbox (default "Select all rows"). */
  headerLabel?: string
  /** Disables every checkbox (e.g. while a change is in flight). */
  disabled?: boolean
}

/** Width of the selection checkbox column, in px. */
export const DATA_TABLE_SELECTION_COLUMN_WIDTH = 32

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
  /**
   * Whether the header sorts on click. Defaults to `true` when the column has a `sortValue` or the
   * table is `manualSort`, `false` otherwise.
   */
  sortable?: boolean
  /** Tooltip (`title`) on a non-sortable header explaining why it cannot be sorted. */
  sortDisabledReason?: string
  /** With `onColumnReorder`: whether this column can be moved (default `true`). */
  reorderable?: boolean
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  /** Makes rows interactive; receives the modifier keys held (Shift / Ctrl / Meta). */
  onRowClick?: (row: T, modifiers: DataTableClickModifiers) => void
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
  /** Rows are already in display order (e.g. sorted server-side); header clicks only report. */
  manualSort?: boolean
  /** Keep the first column fixed while the table scrolls horizontally. */
  pinFirstColumn?: boolean
  /** Enables column resize handles; called with the final px width on pointer-up. */
  onColumnResize?: (key: string, width: number) => void
  /** Called when a row is double-clicked. */
  onRowDoubleClick?: (row: T) => void
  /** A faint line between header cells (headers only), for wide tables whose headings run together. */
  headerDividers?: boolean
  /** Enables moving columns by dragging headers; called with the column and its new index. */
  onColumnReorder?: (key: string, toIndex: number) => void
  /** A caller-owned row selection, shown as a fixed checkbox column at the far left. */
  selection?: DataTableRowSelection<T>
  'aria-label': string
  style?: CSSProperties
}

const ROW_HEIGHT = { compact: 28, comfortable: 34 } as const
const OVERSCAN = 8
/** Narrowest a resized column may become. */
export const DATA_TABLE_MIN_COLUMN_WIDTH = 48
/** Width assumed for a column without a numeric `width` when sizing a horizontally scrolling table. */
const FALLBACK_COLUMN_WIDTH = 120
/** Arrow-key step on a focused resize handle. */
const RESIZE_KEY_STEP = 16

// Stacking: body cells 0, the pinned body column 1, header cells 2, the pinned header cell 3 —
// so the sticky header covers everything that scrolls under it, and the pinned column covers
// the cells that scroll sideways under it.
const TH_STYLE: CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 2,
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

const RESIZE_HANDLE_STYLE: CSSProperties = {
  position: 'absolute',
  top: 0,
  right: 0,
  width: 6,
  height: '100%',
  cursor: 'col-resize',
  touchAction: 'none',
}

interface ResizeDrag {
  key: string
  startX: number
  startWidth: number
  width: number
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
  manualSort = false,
  pinFirstColumn = false,
  onColumnResize,
  onRowDoubleClick,
  headerDividers = false,
  onColumnReorder,
  selection,
  'aria-label': ariaLabel,
  style,
}: DataTableProps<T>) {
  const [ownSort, setOwnSort] = useState<DataTableSort | null>(defaultSort)
  const sort = controlledSort !== undefined ? controlledSort : ownSort
  const [scrollTop, setScrollTop] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const rowHeight = ROW_HEIGHT[density]
  // Live width of the column being dragged; the committed width comes back through `columns`.
  const [drag, setDrag] = useState<ResizeDrag | null>(null)

  const canSort = useCallback(
    (c: DataTableColumn<T>) => c.sortable ?? (manualSort || !!c.sortValue),
    [manualSort],
  )

  const sorted = useMemo(() => {
    if (!sort || manualSort) return rows
    const col = columns.find((c) => c.key === sort.key)
    return col?.sortValue ? sortRows(rows, col.sortValue, sort.direction) : rows
  }, [rows, columns, sort, manualSort])

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

  const resizable = !!onColumnResize
  const horizontal = pinFirstColumn || resizable
  const widthOf = (c: DataTableColumn<T>) => (drag?.key === c.key ? drag.width : c.width)
  // The selection column sits left of everything, so a pinned first column starts after it.
  const selectionWidth = selection ? DATA_TABLE_SELECTION_COLUMN_WIDTH : 0
  const totalColumns = columns.length + (selection ? 1 : 0)
  const minTableWidth = horizontal
    ? columns.reduce((sum, c) => {
        const w = widthOf(c)
        return sum + (typeof w === 'number' ? w : FALLBACK_COLUMN_WIDTH)
      }, selectionWidth)
    : undefined

  // The header checkbox's indeterminate state can only be set on the element.
  const headerBoxRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (headerBoxRef.current) headerBoxRef.current.indeterminate = selection?.header === 'some'
  }, [selection?.header])

  const startResize = (e: PointerEvent<HTMLDivElement>, c: DataTableColumn<T>) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const th = e.currentTarget.parentElement
    const measured = th ? th.getBoundingClientRect().width : 0
    const startWidth = typeof c.width === 'number' ? c.width : measured || FALLBACK_COLUMN_WIDTH
    e.currentTarget.setPointerCapture?.(e.pointerId)
    setDrag({ key: c.key, startX: e.clientX, startWidth, width: startWidth })
  }

  const moveResize = (e: PointerEvent<HTMLDivElement>, key: string) => {
    if (!drag || drag.key !== key) return
    const width = Math.max(DATA_TABLE_MIN_COLUMN_WIDTH, Math.round(drag.startWidth + e.clientX - drag.startX))
    if (width !== drag.width) setDrag({ ...drag, width })
  }

  const endResize = (e: PointerEvent<HTMLDivElement>, key: string) => {
    if (!drag || drag.key !== key) return
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    const width = Math.max(DATA_TABLE_MIN_COLUMN_WIDTH, Math.round(drag.startWidth + e.clientX - drag.startX))
    setDrag(null)
    onColumnResize?.(key, width)
  }

  const keyResize = (e: KeyboardEvent<HTMLDivElement>, c: DataTableColumn<T>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const th = e.currentTarget.parentElement
    const current = typeof c.width === 'number' ? c.width : (th?.getBoundingClientRect().width || FALLBACK_COLUMN_WIDTH)
    const step = e.key === 'ArrowRight' ? RESIZE_KEY_STEP : -RESIZE_KEY_STEP
    onColumnResize?.(c.key, Math.max(DATA_TABLE_MIN_COLUMN_WIDTH, Math.round(current + step)))
  }

  // Column reordering: the header being dragged, and where it would land.
  const [moving, setMoving] = useState<string | null>(null)
  const [dropAt, setDropAt] = useState<{ key: string; side: 'before' | 'after' } | null>(null)
  const firstMovable = pinFirstColumn ? 1 : 0
  const canMove = (c: DataTableColumn<T>, ci: number) =>
    !!onColumnReorder && ci >= firstMovable && c.reorderable !== false

  /** Report a move of `key` to land before (`side: before`) or after the column at `targetIndex`. */
  const moveColumn = (key: string, targetIndex: number, side: 'before' | 'after') => {
    const from = columns.findIndex((c) => c.key === key)
    if (from < 0) return
    let to = side === 'after' ? targetIndex + 1 : targetIndex
    if (from < to) to -= 1
    to = Math.max(firstMovable, Math.min(columns.length - 1, to))
    if (to !== from) onColumnReorder?.(key, to)
  }

  const dropSide = (e: DragEvent<HTMLTableCellElement>): 'before' | 'after' => {
    const r = e.currentTarget.getBoundingClientRect()
    return e.clientX < r.left + r.width / 2 ? 'before' : 'after'
  }

  const keyMove = (e: KeyboardEvent<HTMLTableCellElement>, c: DataTableColumn<T>, ci: number) => {
    if (!e.altKey || !e.shiftKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') || !canMove(c, ci)) return
    e.preventDefault()
    const to = ci + (e.key === 'ArrowRight' ? 1 : -1)
    if (to < firstMovable || to >= columns.length) return
    onColumnReorder?.(c.key, to)
  }

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

  const modifiersOf = (e: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }): DataTableClickModifiers => ({
    shiftKey: e.shiftKey,
    ctrlKey: e.ctrlKey,
    metaKey: e.metaKey,
  })

  const onRowKey = (e: KeyboardEvent<HTMLTableRowElement>, row: T, index: number) => {
    if (e.target !== e.currentTarget) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onRowClick?.(row, modifiersOf(e))
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
        overflow: maxHeight !== undefined || horizontal ? 'auto' : undefined,
        border: '1px solid var(--color-glass-border)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-bg-secondary)',
        ...style,
      }}
    >
      <table
        aria-label={ariaLabel}
        aria-rowcount={sorted.length + 1}
        style={{
          width: '100%',
          minWidth: minTableWidth,
          borderCollapse: 'separate',
          borderSpacing: 0,
          tableLayout: 'fixed',
        }}
      >
        <colgroup>
          {selection && <col style={{ width: DATA_TABLE_SELECTION_COLUMN_WIDTH }} />}
          {columns.map((c) => (
            <col key={c.key} style={{ width: widthOf(c) }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {selection && (
              <th
                scope="col"
                style={{
                  ...TH_STYLE,
                  left: 0,
                  zIndex: 4,
                  padding: 0,
                  textAlign: 'center',
                  width: DATA_TABLE_SELECTION_COLUMN_WIDTH,
                }}
              >
                <input
                  ref={headerBoxRef}
                  type="checkbox"
                  className="ui-data-table__select"
                  aria-label={selection.headerLabel ?? 'Select all rows'}
                  aria-checked={selection.header === 'some' ? 'mixed' : selection.header === 'all'}
                  checked={selection.header === 'all'}
                  disabled={selection.disabled}
                  readOnly
                  onClick={(e: MouseEvent<HTMLInputElement>) => {
                    e.preventDefault()
                    selection.onToggleAll()
                  }}
                />
              </th>
            )}
            {columns.map((c, ci) => {
              const active = sort?.key === c.key
              const ariaSort = active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'
              const sortable = canSort(c)
              const pinned = pinFirstColumn && ci === 0
              const width = widthOf(c)
              const movable = canMove(c, ci)
              const marked = dropAt?.key === c.key && moving !== null && moving !== c.key ? dropAt.side : null
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={sortable ? ariaSort : undefined}
                  title={!sortable && c.sortDisabledReason ? c.sortDisabledReason : undefined}
                  draggable={movable || undefined}
                  tabIndex={movable && !sortable ? 0 : undefined}
                  onDragStart={
                    movable
                      ? (e) => {
                          e.dataTransfer.effectAllowed = 'move'
                          e.dataTransfer.setData('text/plain', c.key)
                          setMoving(c.key)
                        }
                      : undefined
                  }
                  onDragOver={
                    moving !== null && ci >= firstMovable
                      ? (e) => {
                          e.preventDefault()
                          e.dataTransfer.dropEffect = 'move'
                          const side = dropSide(e)
                          if (dropAt?.key !== c.key || dropAt.side !== side) setDropAt({ key: c.key, side })
                        }
                      : undefined
                  }
                  onDrop={
                    moving !== null && ci >= firstMovable
                      ? (e) => {
                          e.preventDefault()
                          moveColumn(moving, ci, dropSide(e))
                          setMoving(null)
                          setDropAt(null)
                        }
                      : undefined
                  }
                  onDragEnd={
                    movable
                      ? () => {
                          setMoving(null)
                          setDropAt(null)
                        }
                      : undefined
                  }
                  onKeyDown={onColumnReorder ? (e) => keyMove(e, c, ci) : undefined}
                  style={{
                    ...TH_STYLE,
                    textAlign: c.align ?? 'left',
                    ...(headerDividers && ci < columns.length - 1
                      ? { borderRight: '1px solid var(--color-glass-border)' }
                      : null),
                    ...(pinned
                      ? { left: selectionWidth, zIndex: 3, borderRight: '1px solid var(--color-glass-border)' }
                      : null),
                    ...(movable ? { cursor: 'grab' } : null),
                    ...(moving === c.key ? { opacity: 0.5 } : null),
                    ...(marked
                      ? { boxShadow: `inset ${marked === 'before' ? 2 : -2}px 0 0 var(--color-accent)` }
                      : null),
                  }}
                >
                  {sortable ? (
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
                  {resizable && (
                    <div
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={`Resize ${c.header}`}
                      aria-valuemin={DATA_TABLE_MIN_COLUMN_WIDTH}
                      aria-valuenow={typeof width === 'number' ? width : undefined}
                      tabIndex={0}
                      className={`ui-data-table__resize${drag?.key === c.key ? ' ui-data-table__resize--active' : ''}`}
                      onPointerDown={(e) => startResize(e, c)}
                      onPointerMove={(e) => moveResize(e, c.key)}
                      onPointerUp={(e) => endResize(e, c.key)}
                      onPointerCancel={() => setDrag(null)}
                      onClick={(e) => e.stopPropagation()}
                      draggable={false}
                      onDragStart={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                      }}
                      onKeyDown={(e) => {
                        e.stopPropagation()
                        keyResize(e, c)
                      }}
                      style={RESIZE_HANDLE_STYLE}
                    />
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
                colSpan={totalColumns}
                style={{ ...TD_STYLE, maxWidth: undefined, height: 56, textAlign: 'center', color: 'var(--color-text-secondary)', borderBottom: 'none' }}
              >
                {empty}
              </td>
            </tr>
          ) : (
            <>
              {virtual && first > 0 && (
                <tr aria-hidden style={{ height: first * rowHeight }}>
                  <td colSpan={totalColumns} style={{ padding: 0, border: 'none' }} />
                </tr>
              )}
              {visible.map((row, i) => {
                const index = first + i
                const key = rowKey(row)
                const inSelection = selection ? selection.isSelected(row) : false
                const selected = (selectedKey != null && key === selectedKey) || inSelection
                const interactive = !!onRowClick
                return (
                  <tr
                    key={key}
                    data-row-index={index}
                    aria-rowindex={index + 2}
                    aria-selected={interactive ? selected : undefined}
                    tabIndex={interactive ? 0 : undefined}
                    className={interactive ? 'ui-data-table__row--interactive' : undefined}
                    onClick={interactive ? (e) => onRowClick(row, modifiersOf(e)) : undefined}
                    onDoubleClick={onRowDoubleClick ? () => onRowDoubleClick(row) : undefined}
                    onKeyDown={interactive ? (e) => onRowKey(e, row, index) : undefined}
                    style={{
                      height: rowHeight,
                      cursor: interactive ? 'pointer' : undefined,
                      background: selected ? 'var(--brand-subtle)' : undefined,
                    }}
                  >
                    {selection && (
                      <td
                        className="ui-data-table__pinned"
                        style={{
                          ...TD_STYLE,
                          maxWidth: undefined,
                          padding: 0,
                          textAlign: 'center',
                          position: 'sticky',
                          left: 0,
                          zIndex: 1,
                          backgroundColor: 'var(--color-bg-secondary)',
                          backgroundImage: selected
                            ? 'linear-gradient(var(--brand-subtle), var(--brand-subtle))'
                            : undefined,
                        }}
                        // A box click toggles the selection only — never the row's own click.
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          className="ui-data-table__select"
                          aria-label={selection.rowLabel ? selection.rowLabel(row) : 'Select row'}
                          checked={inSelection}
                          disabled={selection.disabled}
                          readOnly
                          onClick={(e: MouseEvent<HTMLInputElement>) => {
                            e.preventDefault()
                            e.stopPropagation()
                            selection.onToggle(row, modifiersOf(e))
                          }}
                        />
                      </td>
                    )}
                    {columns.map((c, ci) => (
                      <td
                        key={c.key}
                        className={pinFirstColumn && ci === 0 ? 'ui-data-table__pinned' : undefined}
                        style={{
                          ...TD_STYLE,
                          textAlign: c.align ?? 'left',
                          fontFamily: c.mono ? 'var(--font-mono)' : undefined,
                          ...(pinFirstColumn && ci === 0
                            ? {
                                position: 'sticky' as const,
                                left: selectionWidth,
                                zIndex: 1,
                                // Opaque so sideways-scrolled cells pass under it; the selected
                                // row's wash is layered on top so selection still reads.
                                backgroundColor: 'var(--color-bg-secondary)',
                                backgroundImage: selected
                                  ? 'linear-gradient(var(--brand-subtle), var(--brand-subtle))'
                                  : undefined,
                                borderRight: '1px solid var(--color-glass-border)',
                              }
                            : null),
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
                  <td colSpan={totalColumns} style={{ padding: 0, border: 'none' }} />
                </tr>
              )}
            </>
          )}
        </tbody>
      </table>
    </div>
  )
}
