// @vitest-environment jsdom
/**
 * RecordTable tests — React 19 createRoot + act + native DOM events (project convention).
 */
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { RECORD_FIELD_MIME, RecordTable } from './RecordTable.js'
import type { RecordTableProps } from './RecordTable.js'
import { cellChange, flattenRecord, formatCell, recordColumns } from './RecordTable.helpers.js'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const cleanups: Array<() => void> = []
afterEach(() => cleanups.splice(0).forEach((f) => f()))

function render(props: Partial<RecordTableProps> & Pick<RecordTableProps, 'rows'>) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => root.render(<RecordTable aria-label="Samples" {...props} />))
  cleanups.push(() => {
    act(() => root.unmount())
    container.remove()
  })
  return container
}

describe('record helpers', () => {
  it('flatten nested objects to dotted paths, keeping arrays and empty objects whole', () => {
    const f = flattenRecord({ id: 1, position: { latitude: 32, longitude: -117 }, ids: [1, 2], ext: {} })
    expect([...f.entries()]).toEqual([
      ['id', 1],
      ['position.latitude', 32],
      ['position.longitude', -117],
      ['ids', [1, 2]],
      ['ext', {}],
    ])
    expect([...flattenRecord('text').entries()]).toEqual([['', 'text']])
    expect(flattenRecord(undefined).size).toBe(0)
  })

  it('make columns in the order met, pinned first, with fields only the earlier form had', () => {
    const rows = [{ value: { b: 1, a: 2 }, before: { gone: 1 } }, { value: { c: 3, a: 4 } }]
    expect(recordColumns(rows, ['a', 'missing'])).toEqual(['a', 'b', 'gone', 'c'])
    expect(recordColumns(rows, [], false)).toEqual(['b', 'a', 'c'])
  })

  it('tell what changed in a cell', () => {
    const after = flattenRecord({ a: 1, b: 2, n: { x: 1 } })
    const before = flattenRecord({ a: 1, b: 3, c: 4, n: { x: 1 } })
    expect(cellChange('a', after, before)).toBeUndefined()
    expect(cellChange('b', after, before)).toBe('changed')
    expect(cellChange('c', after, before)).toBe('removed')
    expect(cellChange('n.x', after, before)).toBeUndefined()
    expect(cellChange('a', after, flattenRecord({}))).toBe('added')
    expect(cellChange('a', after, undefined)).toBeUndefined()
  })

  it('show strings as they are and the rest as compact JSON', () => {
    expect([formatCell('x'), formatCell(3), formatCell(null), formatCell([1, 'a']), formatCell(undefined)]).toEqual(['x', '3', 'null', '[1,"a"]', ''])
  })
})

describe('RecordTable', () => {
  it('lays records out by field, with what each step changed', () => {
    const c = render({
      rows: [
        { id: 's1', value: { key: '1', name: 'ALPHA', speed: 7 }, before: { key: '1', speed: 6, raw: 'x' } },
        { id: 's2', value: { key: '2' } },
      ],
    })
    const heads = [...c.querySelectorAll('thead th')].map((t) => t.textContent)
    expect(heads).toEqual(['#', 'key', 'name', 'speed', 'raw'])
    const first = [...c.querySelectorAll('tbody tr')[0].querySelectorAll('td')]
    expect(first.map((td) => [td.textContent, td.dataset.change ?? null])).toEqual([
      ['1', null],
      ['ALPHA', 'added'],
      ['7', 'changed'],
      ['x', 'removed'],
    ])
    expect(first[3].style.textDecoration).toBe('line-through')
    expect(c.querySelectorAll('tbody tr')[1].querySelector('th')?.textContent).toBe('#2')
  })

  it('shows a dropped record as the reason, and no changes when told not to', () => {
    const c = render({
      rows: [
        { id: 'a', value: { k: 1 }, before: { k: 0 } },
        { id: 'b', label: 'frame 2', dropped: 'dropped by Filter: drop_if matched' },
      ],
      showChanges: false,
    })
    const rows = c.querySelectorAll('tbody tr')
    expect(rows[0].querySelector('td')?.dataset.change).toBeUndefined()
    expect(rows[1].textContent).toBe('frame 2dropped by Filter: drop_if matched')
    expect(rows[1].querySelector('td')?.colSpan).toBe(1)
  })

  it('chooses a row by click or key, and marks the selected one', () => {
    const pick = vi.fn()
    const c = render({ rows: [{ id: 'a', value: { k: 1 } }, { id: 'b', value: { k: 2 } }], onRowClick: pick, selectedId: 'b' })
    const rows = c.querySelectorAll<HTMLTableRowElement>('tbody tr')
    expect(rows[1].getAttribute('aria-selected')).toBe('true')
    act(() => rows[0].click())
    act(() => {
      rows[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
    expect(pick.mock.calls).toEqual([['a'], ['b']])
  })

  it('lets a column be dragged out, carrying its field path', () => {
    const c = render({ rows: [{ id: 'a', value: { position: { latitude: 1 } } }], draggableColumns: true })
    const th = c.querySelector<HTMLTableCellElement>('thead th[draggable="true"]')!
    expect(th.textContent).toBe('position.latitude')
    const data = new Map<string, string>()
    const e = new Event('dragstart', { bubbles: true }) as Event & { dataTransfer: unknown }
    e.dataTransfer = { setData: (k: string, v: string) => data.set(k, v), effectAllowed: '' }
    act(() => {
      th.dispatchEvent(e)
    })
    expect(data.get(RECORD_FIELD_MIME)).toBe('position.latitude')
    expect(data.get('text/plain')).toBe('position.latitude')
    expect(render({ rows: [{ id: 'a', value: { k: 1 } }] }).querySelector('th[draggable]')).toBeNull()
  })

  it('says when there is nothing to show', () => {
    expect(render({ rows: [], empty: 'No samples yet.' }).textContent).toBe('No samples yet.')
  })
})
