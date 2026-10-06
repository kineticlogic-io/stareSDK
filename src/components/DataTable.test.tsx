// @vitest-environment jsdom
/**
 * DataTable tests — React 19 createRoot + act + native DOM events (project convention; no
 * @testing-library/react).
 */

import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { DataTable, sortRows, type DataTableColumn } from './DataTable.js'

interface Row {
  id: string
  name: string
  speed: number | null
}

const COLUMNS: DataTableColumn<Row>[] = [
  { key: 'id', header: 'Id', mono: true },
  { key: 'name', header: 'Name', sortValue: (r) => r.name },
  { key: 'speed', header: 'Speed', align: 'right', sortValue: (r) => r.speed },
]

const ROWS: Row[] = [
  { id: 'a', name: 'Charlie', speed: 3 },
  { id: 'b', name: 'alpha', speed: null },
  { id: 'c', name: 'Bravo', speed: 10 },
]

const cleanups: Array<() => void> = []
afterEach(() => {
  cleanups.splice(0).forEach((f) => f())
})

function render(ui: React.ReactElement) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => root.render(ui))
  cleanups.push(() => {
    act(() => root.unmount())
    container.remove()
  })
  return container
}

const cellText = (c: HTMLElement, col: number) =>
  [...c.querySelectorAll('tbody tr')].map((tr) => tr.querySelectorAll('td')[col]?.textContent)

describe('DataTable', () => {
  it('sortRows is stable, case-insensitive and puts nulls last both ways', () => {
    expect(sortRows(ROWS, (r) => r.name, 'asc').map((r) => r.id)).toEqual(['b', 'c', 'a'])
    expect(sortRows(ROWS, (r) => r.speed, 'asc').map((r) => r.id)).toEqual(['a', 'c', 'b'])
    expect(sortRows(ROWS, (r) => r.speed, 'desc').map((r) => r.id)).toEqual(['c', 'a', 'b'])
  })

  it('renders neutral uppercase headers and cycles sort asc → desc → none', () => {
    const c = render(<DataTable aria-label="t" columns={COLUMNS} rows={ROWS} rowKey={(r) => r.id} />)
    const th = c.querySelectorAll('th')
    expect(th[0].style.textTransform).toBe('uppercase')
    expect(th[0].style.color).toBe('var(--color-text-secondary)')
    expect(th[0].getAttribute('aria-sort')).toBeNull()
    const sortName = th[1].querySelector('button')!
    act(() => sortName.click())
    expect(th[1].getAttribute('aria-sort')).toBe('ascending')
    expect(cellText(c, 1)).toEqual(['alpha', 'Bravo', 'Charlie'])
    act(() => sortName.click())
    expect(th[1].getAttribute('aria-sort')).toBe('descending')
    act(() => sortName.click())
    expect(th[1].getAttribute('aria-sort')).toBe('none')
    expect(cellText(c, 0)).toEqual(['a', 'b', 'c'])
  })

  it('rows are interactive only with onRowClick, with keyboard activation', () => {
    const readOnly = render(<DataTable aria-label="t" columns={COLUMNS} rows={ROWS} rowKey={(r) => r.id} />)
    expect(readOnly.querySelector('tbody tr')!.getAttribute('tabindex')).toBeNull()

    const onRowClick = vi.fn()
    const c = render(
      <DataTable aria-label="t" columns={COLUMNS} rows={ROWS} rowKey={(r) => r.id} onRowClick={onRowClick} selectedKey="c" />,
    )
    const rows = c.querySelectorAll<HTMLTableRowElement>('tbody tr')
    expect(rows[2].getAttribute('aria-selected')).toBe('true')
    expect(rows[2].style.background).toBe('var(--brand-subtle)')
    act(() => rows[0].click())
    expect(onRowClick).toHaveBeenLastCalledWith(ROWS[0])
    act(() => {
      rows[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
    expect(onRowClick).toHaveBeenLastCalledWith(ROWS[1])
  })

  it('shows the empty message and virtualises large lists', () => {
    const empty = render(<DataTable aria-label="t" columns={COLUMNS} rows={[]} rowKey={(r) => r.id} empty="Nothing yet" />)
    expect(empty.textContent).toContain('Nothing yet')

    const many: Row[] = Array.from({ length: 1000 }, (_, i) => ({ id: `r${i}`, name: `n${i}`, speed: i }))
    const c = render(<DataTable aria-label="t" columns={COLUMNS} rows={many} rowKey={(r) => r.id} maxHeight={280} />)
    const rendered = c.querySelectorAll('tbody tr[data-row-index]').length
    expect(rendered).toBeGreaterThan(0)
    expect(rendered).toBeLessThan(40)
    expect(c.querySelector('table')!.getAttribute('aria-rowcount')).toBe('1001')
  })
})
