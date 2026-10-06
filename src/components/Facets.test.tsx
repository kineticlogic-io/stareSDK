// @vitest-environment jsdom
/**
 * Facets tests (97-03 addendum, 2026-08-22).
 *
 * Tests use React 19 createRoot + act + native DOM event dispatch (project convention — no
 * @testing-library/react; see Toggle.test.tsx / TypeaheadPicker.test.tsx).
 *
 * What is tested:
 *   (a) renders one option button per entry, each with its label and count
 *   (b) clicking an option calls onToggle with that option's value
 *   (c) an active (selected) option gets aria-pressed="true"; others "false"
 *   (d) the "Clear" affordance only renders when selected.length > 0, and calls onClear
 *   (e) emptyCopy (default 'None') renders when options is empty
 *   (f) the group-level icon renders when provided
 *   (g) role="group" carries an aria-label matching `label`
 */

import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { Facets } from './Facets.js'
import type { FacetsProps, FacetOption } from './Facets.js'

const OPTIONS: FacetOption[] = [
  { value: 'a', label: 'Alpha', count: 3 },
  { value: 'b', label: 'Beta', count: 1 },
]

function renderFacets(props: Partial<FacetsProps> = {}) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const onToggle = props.onToggle ?? vi.fn()
  const onClear = props.onClear ?? vi.fn()
  const defaultProps: FacetsProps = {
    label: 'Type',
    options: OPTIONS,
    selected: [],
    onToggle,
    onClear,
    ...props,
  }
  act(() => {
    root.render(<Facets {...defaultProps} />)
  })
  return {
    container,
    onToggle,
    onClear,
    options: () => Array.from(container.querySelectorAll('button[aria-pressed]')) as HTMLButtonElement[],
    clearButton: () => container.querySelector('button[aria-label="Clear Type filters"]') as HTMLButtonElement | null,
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

describe('Facets', () => {
  let unmountFns: Array<() => void> = []
  afterEach(() => {
    unmountFns.forEach(fn => fn())
    unmountFns = []
  })

  it('renders one option button per entry with its label and count', () => {
    const { container, options, unmount } = renderFacets()
    unmountFns.push(unmount)
    expect(options().length).toBe(2)
    expect(container.textContent).toContain('Alpha')
    expect(container.textContent).toContain('3')
    expect(container.textContent).toContain('Beta')
    expect(container.textContent).toContain('1')
  })

  it('clicking an option calls onToggle with its value', () => {
    const { options, onToggle, unmount } = renderFacets()
    unmountFns.push(unmount)
    click(options()[0])
    expect(onToggle).toHaveBeenCalledWith('a')
  })

  it('marks the selected option aria-pressed=true and others false', () => {
    const { options, unmount } = renderFacets({ selected: ['b'] })
    unmountFns.push(unmount)
    expect(options()[0].getAttribute('aria-pressed')).toBe('false')
    expect(options()[1].getAttribute('aria-pressed')).toBe('true')
  })

  it('renders Clear only when a selection exists, and calls onClear', () => {
    const none = renderFacets({ selected: [] })
    unmountFns.push(none.unmount)
    expect(none.clearButton()).toBeNull()

    const withSelection = renderFacets({ selected: ['a'] })
    unmountFns.push(withSelection.unmount)
    const clearBtn = withSelection.clearButton()
    expect(clearBtn).not.toBeNull()
    click(clearBtn as HTMLButtonElement)
    expect(withSelection.onClear).toHaveBeenCalledOnce()
  })

  it('renders emptyCopy when options is empty, defaulting to "None"', () => {
    const withDefault = renderFacets({ options: [] })
    unmountFns.push(withDefault.unmount)
    expect(withDefault.container.textContent).toContain('None')

    const withCustom = renderFacets({ options: [], emptyCopy: 'No tags' })
    unmountFns.push(withCustom.unmount)
    expect(withCustom.container.textContent).toContain('No tags')
  })

  it('renders the group-level icon when provided', () => {
    const { container, unmount } = renderFacets({ icon: <svg data-testid="group-icon" /> })
    unmountFns.push(unmount)
    expect(container.querySelector('svg[data-testid="group-icon"]')).toBeTruthy()
  })

  it('role="group" carries an aria-label matching the label prop', () => {
    const { container, unmount } = renderFacets({ label: 'Sharing' })
    unmountFns.push(unmount)
    const group = container.querySelector('[role="group"]')
    expect(group?.getAttribute('aria-label')).toBe('Sharing')
  })
})
