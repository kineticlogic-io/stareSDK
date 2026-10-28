import { useMemo } from 'react'
import type { CSSProperties, DragEvent as ReactDragEvent, KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'

/** The drag data type of a column dragged out of a `RecordTable` (`draggableColumns`): its field path. */
export const RECORD_FIELD_MIME = 'application/x-staresdk-record-field'
import { cellChange, flattenRecord, formatCell, recordColumns, type CellChange } from './RecordTable.helpers.js'

/**
 * RecordTable — records (JSON objects) side by side: one row each, one column per field, nested
 * fields as dotted paths (0.2.32, for OpenTrack's source samples, kineticlogic-io/OpenTrack#104).
 *
 * Give a row its `before` (the record as it was before a step) and the table shows what changed:
 * a field the step added or changed is tinted (`--color-accent`, `--status-warning`), and one it
 * removed shows its old value struck through. A row with `dropped` is the record a step dropped:
 * dimmed, with the reason across the row. Values longer than `maxCellWidth` are cut, with the
 * whole value as a tooltip. The header and the label column stay in view as the table scrolls.
 *
 * With `draggableColumns` (0.2.33) a column's header can be dragged out: the drag carries its field
 * path as `RECORD_FIELD_MIME` (and as text), for a drop target elsewhere to take.
 */
export interface RecordRow {
  id: string
  /** The first column (default `#1`, `#2`…). */
  label?: ReactNode
  /** The record now. */
  value?: unknown
  /** The record before, for the changes; omit for none. */
  before?: unknown
  /** Why the record was dropped: the row says so instead of its fields. */
  dropped?: ReactNode
}

export interface RecordTableProps {
  rows: RecordRow[]
  /** Tint what changed from each row's `before` (default true). */
  showChanges?: boolean
  /** Paths shown first, in this order, when the records have them. */
  pinned?: string[]
  selectedId?: string | null
  /** A row was clicked, or chosen with Enter or Space. */
  onRowClick?: (id: string) => void
  /** Widest a cell gets before its value is cut, in px (default 240). */
  maxCellWidth?: number
  /** Shown when there are no rows. */
  empty?: ReactNode
  /** Column headers can be dragged out, carrying their field path (`RECORD_FIELD_MIME`). */
  draggableColumns?: boolean
  'aria-label': string
  style?: CSSProperties
}

const TINT: Record<CellChange, string | undefined> = {
  added: 'color-mix(in srgb, var(--color-accent) 18%, transparent)',
  changed: 'color-mix(in srgb, var(--status-warning) 22%, transparent)',
  removed: undefined,
}

const CHANGE_WORD: Record<CellChange, string> = { added: 'added', changed: 'changed', removed: 'removed' }

const cellBase: CSSProperties = {
  padding: '4px 8px',
  borderBottom: '1px solid var(--color-glass-border)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  verticalAlign: 'top',
}

export function RecordTable({
  rows,
  showChanges = true,
  pinned = [],
  selectedId = null,
  onRowClick,
  maxCellWidth = 240,
  empty,
  draggableColumns = false,
  'aria-label': ariaLabel,
  style,
}: RecordTableProps) {
  const flat = useMemo(
    () =>
      rows.map((r) => ({
        after: flattenRecord(r.value),
        before: showChanges && r.before !== undefined ? flattenRecord(r.before) : undefined,
      })),
    [rows, showChanges],
  )
  const columns = useMemo(() => recordColumns(rows, pinned, showChanges), [rows, pinned, showChanges])

  if (rows.length === 0) {
    return (
      <div className="ui-record-table-empty" style={{ padding: 'var(--space-md)', fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
        {empty ?? 'No records.'}
      </div>
    )
  }

  const choose = (id: string) => onRowClick?.(id)
  const dragColumn = (path: string) => (e: ReactDragEvent<HTMLTableCellElement>) => {
    e.dataTransfer.setData(RECORD_FIELD_MIME, path)
    e.dataTransfer.setData('text/plain', path)
    e.dataTransfer.effectAllowed = 'copy'
  }
  const onKey = (id: string) => (e: ReactKeyboardEvent<HTMLTableRowElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      choose(id)
    }
  }

  return (
    <table
      className="ui-record-table"
      aria-label={ariaLabel}
      style={{
        borderCollapse: 'separate',
        borderSpacing: 0,
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: 'var(--color-text-primary)',
        width: 'max-content',
        minWidth: '100%',
        ...style,
      }}
    >
      <thead>
        <tr>
          <th
            scope="col"
            style={{ ...cellBase, position: 'sticky', top: 0, left: 0, zIndex: 2, background: 'var(--color-bg-secondary)', textAlign: 'left', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)', fontWeight: 600 }}
          >
            #
          </th>
          {columns.map((c) => (
            <th
              key={c}
              scope="col"
              title={draggableColumns ? `${c || 'value'} (drag it out)` : c || 'value'}
              draggable={draggableColumns || undefined}
              onDragStart={draggableColumns ? dragColumn(c) : undefined}
              style={{ ...cellBase, maxWidth: maxCellWidth, position: 'sticky', top: 0, zIndex: 1, background: 'var(--color-bg-secondary)', textAlign: 'left', color: 'var(--color-text-secondary)', fontWeight: 600, cursor: draggableColumns ? 'grab' : undefined }}
            >
              {c || 'value'}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const selected = r.id === selectedId
          const { after, before } = flat[i]
          const rowBg = selected ? 'color-mix(in srgb, var(--color-accent) 10%, var(--color-bg-primary))' : 'var(--color-bg-primary)'
          return (
            <tr
              key={r.id}
              aria-selected={onRowClick ? selected : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={onRowClick ? () => choose(r.id) : undefined}
              onKeyDown={onRowClick ? onKey(r.id) : undefined}
              style={{ cursor: onRowClick ? 'pointer' : undefined, opacity: r.dropped != null ? 0.65 : 1 }}
            >
              <th
                scope="row"
                style={{
                  ...cellBase,
                  position: 'sticky',
                  left: 0,
                  background: rowBg,
                  textAlign: 'left',
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 600,
                  color: 'var(--color-text-secondary)',
                  boxShadow: selected ? 'inset 2px 0 0 var(--color-accent)' : undefined,
                }}
              >
                {r.label ?? `#${i + 1}`}
              </th>
              {r.dropped != null ? (
                <td colSpan={Math.max(1, columns.length)} style={{ ...cellBase, background: rowBg, color: 'var(--color-destructive)', fontFamily: 'var(--font-sans)', whiteSpace: 'normal' }}>
                  {r.dropped}
                </td>
              ) : (
                columns.map((c) => {
                  const change = cellChange(c, after, before)
                  const removed = change === 'removed'
                  const text = formatCell(removed ? before?.get(c) : after.get(c))
                  return (
                    <td
                      key={c}
                      title={change ? `${text} (${CHANGE_WORD[change]})` : text}
                      data-change={change}
                      style={{
                        ...cellBase,
                        maxWidth: maxCellWidth,
                        backgroundImage: change && TINT[change] ? `linear-gradient(${TINT[change]}, ${TINT[change]})` : undefined,
                        backgroundColor: rowBg,
                        textDecoration: removed ? 'line-through' : undefined,
                        color: removed ? 'var(--text-muted)' : undefined,
                      }}
                    >
                      {text}
                    </td>
                  )
                })
              )}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
