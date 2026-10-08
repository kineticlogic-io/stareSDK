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
    expect(onRowClick).toHaveBeenLastCalledWith(ROWS[0], { shiftKey: false, ctrlKey: false, metaKey: false })
    act(() => {
      rows[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
    expect(onRowClick).toHaveBeenLastCalledWith(ROWS[1], { shiftKey: false, ctrlKey: false, metaKey: false })
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

  it('manualSort reports header clicks but renders rows in the given order', () => {
    const onSortChange = vi.fn()
    const c = render(
      <DataTable
        aria-label="t"
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(r) => r.id}
        manualSort
        sort={null}
        onSortChange={onSortChange}
      />,
    )
    act(() => c.querySelectorAll('th')[1].querySelector('button')!.click())
    expect(onSortChange).toHaveBeenLastCalledWith({ key: 'name', direction: 'asc' })
    expect(cellText(c, 0)).toEqual(['a', 'b', 'c'])

    // A controlled sort is shown on the header but still never reorders rows.
    const sortedC = render(
      <DataTable
        aria-label="t"
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(r) => r.id}
        manualSort
        sort={{ key: 'name', direction: 'desc' }}
        onSortChange={onSortChange}
      />,
    )
    expect(sortedC.querySelectorAll('th')[1].getAttribute('aria-sort')).toBe('descending')
    expect(cellText(sortedC, 0)).toEqual(['a', 'b', 'c'])
    // Under manualSort a column without sortValue is sortable by default.
    expect(sortedC.querySelectorAll('th')[0].querySelector('button')).not.toBeNull()
  })

  it('a non-sortable column shows no sort affordance, ignores clicks and explains why', () => {
    const onSortChange = vi.fn()
    const cols: DataTableColumn<Row>[] = [
      ...COLUMNS.slice(0, 2),
      { ...COLUMNS[2], sortable: false, sortDisabledReason: 'Speed is not indexed for sorting' },
    ]
    const c = render(
      <DataTable aria-label="t" columns={cols} rows={ROWS} rowKey={(r) => r.id} onSortChange={onSortChange} />,
    )
    const th = c.querySelectorAll('th')[2]
    expect(th.querySelector('button')).toBeNull()
    expect(th.querySelector('svg')).toBeNull()
    expect(th.getAttribute('title')).toBe('Speed is not indexed for sorting')
    expect(th.getAttribute('aria-sort')).toBeNull()
    act(() => th.click())
    expect(onSortChange).not.toHaveBeenCalled()
    expect(cellText(c, 0)).toEqual(['a', 'b', 'c'])
    // Sortable headers carry no tooltip.
    expect(c.querySelectorAll('th')[1].getAttribute('title')).toBeNull()
  })

  it('pinFirstColumn makes the first column sticky, opaque and above body cells; the table scrolls sideways', () => {
    const c = render(
      <DataTable aria-label="t" columns={COLUMNS.map((col) => ({ ...col, width: 300 }))} rows={ROWS} rowKey={(r) => r.id} pinFirstColumn selectedKey="b" onRowClick={() => {}} />,
    )
    const th = c.querySelectorAll('th')
    expect(th[0].style.position).toBe('sticky')
    expect(['0', '0px']).toContain(th[0].style.left)
    expect(Number(th[0].style.zIndex)).toBeGreaterThan(Number(th[1].style.zIndex))
    const firstCells = [...c.querySelectorAll<HTMLTableCellElement>('tbody tr')].map((tr) => tr.querySelectorAll('td')[0])
    for (const td of firstCells) {
      expect(td.style.position).toBe('sticky')
      expect(['0', '0px']).toContain(td.style.left)
      expect(td.style.backgroundColor).toBe('var(--color-bg-secondary)')
      expect(Number(td.style.zIndex)).toBeGreaterThan(0)
      expect(Number(td.style.zIndex)).toBeLessThan(Number(th[1].style.zIndex))
    }
    expect(firstCells[1].style.backgroundImage).toContain('var(--brand-subtle)')
    const other = c.querySelector('tbody tr')!.querySelectorAll('td')[1] as HTMLTableCellElement
    expect(other.style.position).toBe('')
    expect(c.querySelector('table')!.style.minWidth).toBe('900px')
    expect((c.firstElementChild as HTMLElement).style.overflow).toBe('auto')
  })

  it('without the new props the table neither pins nor forces a min width', () => {
    const c = render(<DataTable aria-label="t" columns={COLUMNS} rows={ROWS} rowKey={(r) => r.id} />)
    expect(c.querySelector('table')!.style.minWidth).toBe('')
    expect((c.querySelector('tbody td') as HTMLElement).style.position).toBe('')
    expect(c.querySelector('[role="separator"]')).toBeNull()
  })

  /** A native drag event jsdom can carry: a stub DataTransfer and a pointer x. */
  function drag(type: string, target: Element, clientX = 0) {
    const ev = new Event(type, { bubbles: true, cancelable: true })
    Object.defineProperty(ev, 'dataTransfer', {
      value: { setData: () => {}, getData: () => '', effectAllowed: '', dropEffect: '' },
    })
    Object.defineProperty(ev, 'clientX', { value: clientX })
    act(() => {
      target.dispatchEvent(ev)
    })
  }

  it('onColumnReorder: dragging a header onto another reports the column and its new index', () => {
    const onColumnReorder = vi.fn()
    const c = render(<DataTable aria-label="t" columns={COLUMNS} rows={ROWS} rowKey={(r) => r.id} onColumnReorder={onColumnReorder} />)
    const ths = () => Array.from(c.querySelectorAll('th')) as HTMLElement[]
    expect(ths().every((th) => th.getAttribute('draggable') === 'true')).toBe(true)
    // jsdom lays nothing out (every rect is 0 wide), so any x at or past the left edge drops "after".
    drag('dragstart', ths()[0])
    expect(ths()[0].style.opacity).toBe('0.5')
    drag('dragover', ths()[2], 10)
    expect(ths()[2].style.boxShadow).toContain('-2px')
    drag('drop', ths()[2], 10)
    expect(onColumnReorder).toHaveBeenCalledWith('id', 2)
    expect(ths()[0].style.opacity).toBe('')
  })

  it('onColumnReorder: a pinned first column stays put and nothing lands before it', () => {
    const onColumnReorder = vi.fn()
    const c = render(
      <DataTable aria-label="t" columns={COLUMNS} rows={ROWS} rowKey={(r) => r.id} pinFirstColumn onColumnReorder={onColumnReorder} />,
    )
    const ths = () => Array.from(c.querySelectorAll('th')) as HTMLElement[]
    expect(ths()[0].getAttribute('draggable')).toBeNull()
    drag('dragstart', ths()[2])
    drag('drop', ths()[0], -10)
    expect(onColumnReorder).not.toHaveBeenCalled()
    drag('dragstart', ths()[2])
    drag('drop', ths()[1], -10)
    expect(onColumnReorder).toHaveBeenCalledWith('speed', 1)
  })

  it('onColumnReorder: Alt+Shift+Arrow moves a focused header one place; without the prop nothing drags', () => {
    const onColumnReorder = vi.fn()
    const c = render(<DataTable aria-label="t" columns={COLUMNS} rows={ROWS} rowKey={(r) => r.id} onColumnReorder={onColumnReorder} />)
    const name = c.querySelectorAll('th')[1].querySelector('button') as HTMLElement
    act(() => {
      name.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, shiftKey: true, bubbles: true }))
    })
    expect(onColumnReorder).toHaveBeenCalledWith('name', 2)
    act(() => {
      name.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    })
    expect(onColumnReorder).toHaveBeenCalledTimes(1)
    const plain = render(<DataTable aria-label="u" columns={COLUMNS} rows={ROWS} rowKey={(r) => r.id} />)
    expect(plain.querySelector('th')!.getAttribute('draggable')).toBeNull()
  })

  it('selection: a fixed checkbox column toggles rows with the modifier keys, without clicking the row', () => {
    const onToggle = vi.fn()
    const onRowClick = vi.fn()
    const c = render(
      <DataTable
        aria-label="t"
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(r) => r.id}
        onRowClick={onRowClick}
        selection={{ isSelected: (r) => r.id === 'b', onToggle, header: 'some', onToggleAll: () => {}, rowLabel: (r) => `Select ${r.name}` }}
      />,
    )
    const boxes = Array.from(c.querySelectorAll('tbody input[type="checkbox"]')) as HTMLInputElement[]
    expect(boxes).toHaveLength(3)
    expect(boxes.map((b) => b.checked)).toEqual([false, true, false])
    expect(boxes[0].getAttribute('aria-label')).toBe('Select Charlie')
    // The selected row carries the selection wash and aria-selected.
    const trs = Array.from(c.querySelectorAll('tbody tr')) as HTMLElement[]
    expect(trs[1].getAttribute('aria-selected')).toBe('true')
    expect(trs[0].getAttribute('aria-selected')).toBe('false')
    act(() => {
      boxes[2].dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }))
    })
    expect(onToggle).toHaveBeenCalledWith(ROWS[2], { shiftKey: true, ctrlKey: false, metaKey: false })
    expect(onRowClick).not.toHaveBeenCalled()
    // The box column is first, sticky at the left edge, and every row cell spans one more column.
    const firstTd = trs[0].querySelector('td') as HTMLElement
    expect(firstTd.style.position).toBe('sticky')
    expect(firstTd.style.left).toBe('0px')
  })

  it('selection: the header box shows all / none / some and asks for every row', () => {
    const onToggleAll = vi.fn()
    const make = (header: 'all' | 'none' | 'some') =>
      render(
        <DataTable
          aria-label={`t-${header}`}
          columns={COLUMNS}
          rows={ROWS}
          rowKey={(r) => r.id}
          selection={{ isSelected: () => false, onToggle: () => {}, header, onToggleAll }}
        />,
      ).querySelector('thead input[type="checkbox"]') as HTMLInputElement
    const all = make('all')
    expect([all.checked, all.indeterminate, all.getAttribute('aria-checked')]).toEqual([true, false, 'true'])
    const none = make('none')
    expect([none.checked, none.indeterminate, none.getAttribute('aria-checked')]).toEqual([false, false, 'false'])
    const some = make('some')
    expect([some.checked, some.indeterminate, some.getAttribute('aria-checked')]).toEqual([false, true, 'mixed'])
    expect(some.getAttribute('aria-label')).toBe('Select all rows')
    act(() => some.click())
    expect(onToggleAll).toHaveBeenCalledTimes(1)
  })

  it('selection: a pinned first column starts after the box column, which never drags', () => {
    const c = render(
      <DataTable
        aria-label="t"
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(r) => r.id}
        pinFirstColumn
        onColumnReorder={() => {}}
        onColumnResize={() => {}}
        selection={{ isSelected: () => false, onToggle: () => {}, header: 'none', onToggleAll: () => {} }}
      />,
    )
    const ths = Array.from(c.querySelectorAll('th')) as HTMLElement[]
    expect(ths[0].getAttribute('draggable')).toBeNull()
    expect(ths[0].querySelector('[role="separator"]')).toBeNull()
    expect(ths[1].style.left).toBe('32px')
    const tds = Array.from(c.querySelectorAll('tbody tr')[0].querySelectorAll('td')) as HTMLElement[]
    expect(tds[1].style.left).toBe('32px')
    // The min width counts the box column.
    expect(c.querySelector('table')!.style.minWidth).toBe(`${32 + 3 * 120}px`)
  })

  it('onRowClick receives the modifier keys; a key press inside a cell is not a row activation', () => {
    const onRowClick = vi.fn()
    const c = render(
      <DataTable
        aria-label="t"
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(r) => r.id}
        onRowClick={onRowClick}
        selection={{ isSelected: () => false, onToggle: () => {}, header: 'none', onToggleAll: () => {} }}
      />,
    )
    const tr = c.querySelector('tbody tr') as HTMLElement
    act(() => {
      tr.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }))
    })
    expect(onRowClick).toHaveBeenLastCalledWith(ROWS[0], { shiftKey: false, ctrlKey: true, metaKey: false })
    const box = tr.querySelector('input') as HTMLInputElement
    act(() => {
      box.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    })
    expect(onRowClick).toHaveBeenCalledTimes(1)
  })

  it('headerDividers draws a line between header cells only, none after the last and none in the body', () => {
    const c = render(<DataTable aria-label="t" columns={COLUMNS} rows={ROWS} rowKey={(r) => r.id} headerDividers />)
    const ths = Array.from(c.querySelectorAll('th')) as HTMLElement[]
    expect(ths.length).toBeGreaterThan(1)
    ths.slice(0, -1).forEach((th) => expect(th.style.borderRight).toContain('1px solid'))
    expect(ths[ths.length - 1].style.borderRight).toBe('')
    expect((c.querySelector('tbody td') as HTMLElement).style.borderRight).toBe('')
    const plain = render(<DataTable aria-label="u" columns={COLUMNS} rows={ROWS} rowKey={(r) => r.id} />)
    expect((plain.querySelector('th') as HTMLElement).style.borderRight).toBe('')
  })

  it('resize handles report the final width on pointer-up only, clamped to 48px', () => {
    const onColumnResize = vi.fn()
    const cols = COLUMNS.map((col) => ({ ...col, width: 120 }))
    const c = render(
      <DataTable aria-label="t" columns={cols} rows={ROWS} rowKey={(r) => r.id} onColumnResize={onColumnResize} />,
    )
    const handle = c.querySelector<HTMLElement>('[role="separator"][aria-label="Resize Name"]')!
    expect(handle.getAttribute('aria-orientation')).toBe('vertical')
    const Ctor: typeof MouseEvent = typeof PointerEvent === 'function' ? PointerEvent : MouseEvent
    const fire = (type: string, clientX: number) =>
      act(() => {
        handle.dispatchEvent(new Ctor(type, { bubbles: true, cancelable: true, clientX, button: 0 }))
      })
    fire('pointerdown', 100)
    fire('pointermove', 150)
    expect(onColumnResize).not.toHaveBeenCalled()
    // The live width is shown while dragging.
    expect((c.querySelectorAll('col')[1] as HTMLElement).style.width).toBe('170px')
    fire('pointerup', 160)
    expect(onColumnResize).toHaveBeenCalledTimes(1)
    expect(onColumnResize).toHaveBeenCalledWith('name', 180)

    fire('pointerdown', 200)
    fire('pointerup', 0)
    expect(onColumnResize).toHaveBeenLastCalledWith('name', 48)
  })

  it('onRowDoubleClick fires with the row', () => {
    const onRowDoubleClick = vi.fn()
    const c = render(
      <DataTable aria-label="t" columns={COLUMNS} rows={ROWS} rowKey={(r) => r.id} onRowDoubleClick={onRowDoubleClick} />,
    )
    const rows = c.querySelectorAll('tbody tr')
    act(() => {
      rows[2].dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    })
    expect(onRowDoubleClick).toHaveBeenCalledWith(ROWS[2])
  })

  it('virtualises a 1,000-row page with pinning, resizing and manual sort on', () => {
    const many: Row[] = Array.from({ length: 1000 }, (_, i) => ({ id: `r${i}`, name: `n${i}`, speed: i }))
    const c = render(
      <DataTable
        aria-label="t"
        columns={COLUMNS}
        rows={many}
        rowKey={(r) => r.id}
        maxHeight={280}
        manualSort
        sort={{ key: 'speed', direction: 'desc' }}
        pinFirstColumn
        onColumnResize={() => {}}
        onRowDoubleClick={() => {}}
      />,
    )
    const rendered = c.querySelectorAll('tbody tr[data-row-index]')
    expect(rendered.length).toBeGreaterThan(0)
    expect(rendered.length).toBeLessThan(40)
    expect(rendered[0].querySelector('td')!.textContent).toBe('r0')
  })
})
