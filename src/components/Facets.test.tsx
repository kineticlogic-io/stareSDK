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
 *   (h) subOptions render nested directly beneath their own option, not after the list (0.2.27)
 *   (i) a sub-option toggles through onToggleSub and reads subSelected
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

  it('children replace the option list under the same header and Clear', () => {
    const { container, unmount, onClear } = renderFacets({
      label: 'Owner',
      options: undefined,
      onToggle: undefined,
      selected: ['u1'],
      children: <input aria-label="Search owners" />,
    })
    unmountFns.push(unmount)
    expect(container.querySelector('input[aria-label="Search owners"]')).not.toBeNull()
    expect(container.querySelectorAll('button[aria-pressed]').length).toBe(0)
    expect(container.textContent).not.toContain('None')
    expect(container.textContent).toContain('Owner')
    click(container.querySelector('button[aria-label="Clear Owner filters"]') as HTMLButtonElement)
    expect(onClear).toHaveBeenCalledOnce()
  })
})

describe('Facets subOptions (0.2.27)', () => {
  const NESTED: FacetOption[] = [
    { value: 'layer', label: 'Layer', count: 5, subLabel: 'Layer type', subOptions: [
      { value: 'layer:point', label: 'Point', count: 2 },
      { value: 'layer:polygon', label: 'Polygon', count: 3 },
    ] },
    { value: 'workspace', label: 'Workspace', count: 4 },
  ]

  it('nests sub-options directly beneath their own option', () => {
    const h = renderFacets({ options: NESTED, selected: ['layer'] })
    const labels = Array.from(h.container.querySelectorAll('button[aria-pressed]')).map(b => b.textContent)
    expect(labels).toEqual(['Layer5', 'Point2', 'Polygon3', 'Workspace4'])
    const sub = h.container.querySelector('[role="group"][aria-label="Layer type"]')!
    expect(sub.textContent).toContain('Point')
    expect(sub.textContent).not.toContain('Workspace')
    h.unmount()
  })

  it('toggles a sub-option through onToggleSub and marks it from subSelected', () => {
    const onToggleSub = vi.fn()
    const onToggle = vi.fn()
    const h = renderFacets({ options: NESTED, selected: ['layer'], subSelected: ['layer:polygon'], onToggleSub, onToggle })
    const buttons = Array.from(h.container.querySelectorAll('button[aria-pressed]')) as HTMLButtonElement[]
    const point = buttons.find(b => b.textContent === 'Point2')!
    const polygon = buttons.find(b => b.textContent === 'Polygon3')!
    expect(point.getAttribute('aria-pressed')).toBe('false')
    expect(polygon.getAttribute('aria-pressed')).toBe('true')
    click(point)
    expect(onToggleSub).toHaveBeenCalledWith('layer:point')
    expect(onToggle).not.toHaveBeenCalled()
    h.unmount()
  })
})
