// @vitest-environment jsdom
/**
 * VirtualList.test.tsx — Phase 139 Plan 13, Task 1 (D-05).
 *
 * Tests use React 19 createRoot + act + native DOM event dispatch (project convention — no
 * @testing-library/react dependency; see SortableList.test.tsx / Tree.test.tsx /
 * FileDropZone.test.tsx). `scrollTop` is set directly on the scroll-region element before
 * dispatching a real `scroll` event, mirroring how a real browser drives `onScroll`.
 *
 * One test per <behavior> bullet in 139-13-PLAN.md.
 */
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { VirtualList } from './VirtualList.js'
import type { VirtualListProps } from './VirtualList.js'

interface Item {
  id: string
  label: string
}

function makeItems(count: number): Item[] {
  return Array.from({ length: count }, (_, i) => ({ id: `item-${i}`, label: `Item ${i}` }))
}

function renderList<T>(props: VirtualListProps<T>) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(<VirtualList {...props} />)
  })
  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
}

function fireScroll(el: HTMLElement, scrollTop: number) {
  act(() => {
    Object.defineProperty(el, 'scrollTop', { value: scrollTop, writable: true, configurable: true })
    el.dispatchEvent(new Event('scroll', { bubbles: true }))
  })
}

describe('VirtualList (D-05)', () => {
  let unmountFns: Array<() => void> = []

  afterEach(() => {
    unmountFns.forEach(fn => fn())
    unmountFns = []
  })

  it('a short list (4 items) renders every row flat, with no scroll chrome', () => {
    const items = makeItems(4)
    const { container, unmount } = renderList<Item>({
      items,
      rowHeight: 36,
      maxHeight: 300,
      getKey: item => item.id,
      renderRow: item => <span>{item.label}</span>,
      ariaLabel: 'short list',
    })
    unmountFns.push(unmount)

    const region = container.querySelector('[role="list"]') as HTMLElement
    expect(region).toBeTruthy()
    expect(region.getAttribute('aria-label')).toBe('short list')
    expect(region.style.overflowY).toBe('')
    expect(region.style.height).toBe('')
    expect(container.querySelectorAll('[role="listitem"]').length).toBe(4)
  })

  it('a long list (999 items) renders inside a fixed maxHeight overflow-y:auto region with a spacer sized items.length * rowHeight, and mounts only the visible window plus overscan', () => {
    const items = makeItems(999)
    const { container, unmount } = renderList<Item>({
      items,
      rowHeight: 36,
      maxHeight: 300,
      getKey: item => item.id,
      renderRow: item => <span>{item.label}</span>,
      ariaLabel: 'long list',
    })
    unmountFns.push(unmount)

    const region = container.querySelector('[role="list"]') as HTMLElement
    expect(region.style.height).toBe('300px')
    expect(region.style.overflowY).toBe('auto')

    const spacer = region.firstElementChild as HTMLElement
    expect(spacer.style.height).toBe('35964px')

    // ceil(300/36) + overscan(6) = 15 rows (indices 0..14) at scrollTop 0.
    expect(container.querySelectorAll('[role="listitem"]').length).toBe(15)
  })

  it('scrolling to scrollTop 3600 narrows the rendered window and positions the first rendered row via translateY(3384px)', () => {
    const items = makeItems(999)
    const { container, unmount } = renderList<Item>({
      items,
      rowHeight: 36,
      maxHeight: 300,
      getKey: item => item.id,
      renderRow: item => <span>{item.label}</span>,
      ariaLabel: 'scroll list',
    })
    unmountFns.push(unmount)

    const region = container.querySelector('[role="list"]') as HTMLElement
    fireScroll(region, 3600)

    const rows = Array.from(container.querySelectorAll('[role="listitem"]')) as HTMLElement[]
    // start = max(0, floor(3600/36) - 6) = 94; end = min(998, 94 + 20) = 114 -> 21 rows.
    expect(rows.length).toBe(21)
    expect(rows[0].style.transform).toBe('translateY(3384px)')
  })

  it('a row that currently holds DOM focus stays mounted (and remains document.activeElement) even after scrolling it out of the computed window', () => {
    const items = makeItems(999)
    const { container, unmount } = renderList<Item>({
      items,
      rowHeight: 36,
      maxHeight: 300,
      getKey: item => item.id,
      renderRow: (item, index) => <button data-row-index={index}>{item.label}</button>,
      ariaLabel: 'focus list',
    })
    unmountFns.push(unmount)

    const focusedButton = container.querySelector('[data-row-index="2"]') as HTMLButtonElement
    expect(focusedButton).toBeTruthy()
    act(() => {
      focusedButton.focus()
    })
    expect(document.activeElement).toBe(focusedButton)

    const region = container.querySelector('[role="list"]') as HTMLElement
    fireScroll(region, 3600)

    expect(document.activeElement).toBe(focusedButton)
    expect(container.contains(focusedButton)).toBe(true)
  })

  it('the region carries role=list + aria-label, each row wrapper carries role=listitem, and the region has no tab-stop attribute', () => {
    const items = makeItems(999)
    const { container, unmount } = renderList<Item>({
      items,
      rowHeight: 36,
      maxHeight: 300,
      getKey: item => item.id,
      renderRow: item => <span>{item.label}</span>,
      ariaLabel: 'a11y list',
    })
    unmountFns.push(unmount)

    const region = container.querySelector('[role="list"]') as HTMLElement
    expect(region.getAttribute('aria-label')).toBe('a11y list')
    expect(region.hasAttribute('tabindex')).toBe(false)
    expect(container.querySelector('[role="listitem"]')).toBeTruthy()
  })

  it('items=[] renders emptyState instead of the region', () => {
    const { container, unmount } = renderList<Item>({
      items: [],
      rowHeight: 36,
      maxHeight: 300,
      getKey: item => item.id,
      renderRow: item => <span>{item.label}</span>,
      ariaLabel: 'empty list',
      emptyState: <span>none</span>,
    })
    unmountFns.push(unmount)

    expect(container.textContent).toBe('none')
    expect(container.querySelector('[role="list"]')).toBeNull()
  })

  it('a rendered virtualized row style has no transition property', () => {
    const items = makeItems(999)
    const { container, unmount } = renderList<Item>({
      items,
      rowHeight: 36,
      maxHeight: 300,
      getKey: item => item.id,
      renderRow: item => <span>{item.label}</span>,
      ariaLabel: 'no-transition list',
    })
    unmountFns.push(unmount)

    const row = container.querySelector('[role="listitem"]') as HTMLElement
    expect(row.style.transition).toBe('')
  })
})
