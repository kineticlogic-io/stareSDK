// @vitest-environment jsdom
/**
 * Pagination tests (97-03 addendum, 2026-08-22).
 *
 * Tests use React 19 createRoot + act + native DOM event dispatch (project convention — no
 * @testing-library/react; see Toggle.test.tsx / TypeaheadPicker.test.tsx).
 *
 * What is tested:
 *   (a) renders an "X-Y of Z" range label from offset/itemCount/total
 *   (b) prev disabled at offset 0, enabled otherwise; clicking prev calls onOffsetChange
 *   (c) next disabled when the known total is exhausted; clicking next calls onOffsetChange
 *   (d) zero results renders "No results" and disables both buttons
 *   (e) a single page (total <= limit) disables next
 *   (f) unknown total (null): next stays enabled while a full page came back, disables once a
 *       short page comes back, and the label omits "of N"
 *   (g) the MAX_OFFSET ceiling disables next even though more known rows remain
 *   (h) loading disables both buttons regardless of offset/total
 *   (i) a single-item page (limit=1, itemCount=1) collapses the label to "N of Z" / "N"
 *       (quick-260828-mab: map popup multi-hit "1 of N" stepper)
 */

import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { Pagination } from './Pagination'
import type { PaginationProps } from './Pagination'

function renderPagination(props: Partial<PaginationProps> = {}) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const onOffsetChange = props.onOffsetChange ?? vi.fn()
  const defaultProps: PaginationProps = {
    offset: 0,
    limit: 30,
    total: 100,
    itemCount: 30,
    onOffsetChange,
    ...props,
  }
  act(() => {
    root.render(<Pagination {...defaultProps} />)
  })
  return {
    container,
    onOffsetChange,
    prevButton: () => container.querySelector('button[aria-label="Previous page"]') as HTMLButtonElement,
    nextButton: () => container.querySelector('button[aria-label="Next page"]') as HTMLButtonElement,
    unmount: () => {
      act(() => { root.unmount() })
      container.remove()
    },
  }
}

function click(el: HTMLElement) {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  })
}

describe('Pagination', () => {
  let unmountFns: Array<() => void> = []
  afterEach(() => {
    unmountFns.forEach(fn => fn())
    unmountFns = []
  })

  it('renders an "X-Y of Z" range label', () => {
    const { container, unmount } = renderPagination({ offset: 30, itemCount: 30, total: 100 })
    unmountFns.push(unmount)
    expect(container.textContent).toContain('31-60 of 100')
  })

  it('disables prev at offset 0 and enables it otherwise; clicking calls onOffsetChange', () => {
    const first = renderPagination({ offset: 0 })
    unmountFns.push(first.unmount)
    expect(first.prevButton().disabled).toBe(true)

    const later = renderPagination({ offset: 30, limit: 30 })
    unmountFns.push(later.unmount)
    expect(later.prevButton().disabled).toBe(false)
    click(later.prevButton())
    expect(later.onOffsetChange).toHaveBeenCalledWith(0)
  })

  it('disables next once the known total is exhausted; clicking calls onOffsetChange', () => {
    const exhausted = renderPagination({ offset: 90, limit: 30, itemCount: 10, total: 100 })
    unmountFns.push(exhausted.unmount)
    expect(exhausted.nextButton().disabled).toBe(true)

    const midway = renderPagination({ offset: 0, limit: 30, itemCount: 30, total: 100 })
    unmountFns.push(midway.unmount)
    expect(midway.nextButton().disabled).toBe(false)
    click(midway.nextButton())
    expect(midway.onOffsetChange).toHaveBeenCalledWith(30)
  })

  it('renders "No results" and disables both buttons for zero results', () => {
    const { container, prevButton, nextButton, unmount } = renderPagination({ offset: 0, itemCount: 0, total: 0 })
    unmountFns.push(unmount)
    expect(container.textContent).toContain('No results')
    expect(prevButton().disabled).toBe(true)
    expect(nextButton().disabled).toBe(true)
  })

  it('disables next for a single page (total <= limit)', () => {
    const { nextButton, unmount } = renderPagination({ offset: 0, limit: 30, itemCount: 12, total: 12 })
    unmountFns.push(unmount)
    expect(nextButton().disabled).toBe(true)
  })

  it('unknown total: next stays enabled on a full page, disables on a short page, label omits "of N"', () => {
    const full = renderPagination({ offset: 0, limit: 30, itemCount: 30, total: null })
    unmountFns.push(full.unmount)
    expect(full.nextButton().disabled).toBe(false)
    expect(full.container.textContent).toContain('1-30')
    expect(full.container.textContent).not.toContain('of')

    const short = renderPagination({ offset: 30, limit: 30, itemCount: 12, total: null })
    unmountFns.push(short.unmount)
    expect(short.nextButton().disabled).toBe(true)
  })

  it('MAX_OFFSET ceiling disables next even with known rows remaining', () => {
    const { nextButton, unmount } = renderPagination({
      offset: 990, limit: 30, itemCount: 30, total: 5000, maxOffset: 1000,
    })
    unmountFns.push(unmount)
    expect(nextButton().disabled).toBe(true)
  })

  it('loading disables both buttons regardless of offset/total', () => {
    const { prevButton, nextButton, unmount } = renderPagination({
      offset: 30, limit: 30, itemCount: 30, total: 100, loading: true,
    })
    unmountFns.push(unmount)
    expect(prevButton().disabled).toBe(true)
    expect(nextButton().disabled).toBe(true)
  })

  it('single-item page (limit=1) renders "3 of 7", not "3-3 of 7"', () => {
    const { container, unmount } = renderPagination({ offset: 2, limit: 1, itemCount: 1, total: 7 })
    unmountFns.push(unmount)
    expect(container.textContent).toContain('3 of 7')
    expect(container.textContent).not.toContain('3-3')
  })

  it('single-item page with unknown total renders "3" (no "of N")', () => {
    const { container, unmount } = renderPagination({ offset: 2, limit: 1, itemCount: 1, total: null })
    unmountFns.push(unmount)
    expect(container.textContent).toContain('3')
    expect(container.textContent).not.toContain('of')
  })

  it('existing multi-row and zero-row label cases are unchanged', () => {
    const multi = renderPagination({ offset: 30, itemCount: 30, total: 100 })
    unmountFns.push(multi.unmount)
    expect(multi.container.textContent).toContain('31-60 of 100')

    const zero = renderPagination({ offset: 0, itemCount: 0, total: 0 })
    unmountFns.push(zero.unmount)
    expect(zero.container.textContent).toContain('No results')
  })

  it('single-item page: prev disabled at offset 0, next disabled at offset total-1, both enabled in the middle', () => {
    const atStart = renderPagination({ offset: 0, limit: 1, itemCount: 1, total: 7 })
    unmountFns.push(atStart.unmount)
    expect(atStart.prevButton().disabled).toBe(true)
    expect(atStart.nextButton().disabled).toBe(false)

    const atEnd = renderPagination({ offset: 6, limit: 1, itemCount: 1, total: 7 })
    unmountFns.push(atEnd.unmount)
    expect(atEnd.prevButton().disabled).toBe(false)
    expect(atEnd.nextButton().disabled).toBe(true)

    const middle = renderPagination({ offset: 3, limit: 1, itemCount: 1, total: 7 })
    unmountFns.push(middle.unmount)
    expect(middle.prevButton().disabled).toBe(false)
    expect(middle.nextButton().disabled).toBe(false)
  })
})
