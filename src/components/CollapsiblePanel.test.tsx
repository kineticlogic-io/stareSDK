// @vitest-environment jsdom
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { CollapsiblePanel } from './CollapsiblePanel'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const cleanups: Array<() => void> = []
afterEach(() => cleanups.splice(0).forEach((f) => f()))
beforeEach(() => localStorage.clear())

function mount(ui: React.ReactNode) {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = createRoot(el)
  act(() => root.render(ui))
  cleanups.push(() => {
    act(() => root.unmount())
    el.remove()
  })
  return el
}

describe('CollapsiblePanel', () => {
  it('shows its body when open and toggles from the header', () => {
    const el = mount(
      <CollapsiblePanel title="Sources" badge="4">
        <p>body</p>
      </CollapsiblePanel>,
    )
    const header = el.querySelector('[role="button"]') as HTMLElement
    expect(header.getAttribute('aria-expanded')).toBe('true')
    expect(el.textContent).toContain('Sources')
    expect(el.textContent).toContain('4')
    expect(el.textContent).toContain('body')
    act(() => header.click())
    expect(header.getAttribute('aria-expanded')).toBe('false')
    expect(el.textContent).not.toContain('body')
    act(() => header.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
    expect(el.textContent).toContain('body')
  })

  it('persists its open state under persistKey', () => {
    const el = mount(
      <CollapsiblePanel title="Registry" persistKey="ot.registry.open">
        <p>body</p>
      </CollapsiblePanel>,
    )
    act(() => (el.querySelector('[role="button"]') as HTMLElement).click())
    expect(localStorage.getItem('ot.registry.open')).toBe('false')
    const again = mount(
      <CollapsiblePanel title="Registry" persistKey="ot.registry.open">
        <p>second</p>
      </CollapsiblePanel>,
    )
    expect(again.textContent).not.toContain('second')
  })
})

describe('CollapsiblePanel actions', () => {
  it('renders header actions that never toggle the panel', () => {
    const el = mount(
      <CollapsiblePanel title="Tracks" actions={<input aria-label="Search tracks" />}>
        <p>body</p>
      </CollapsiblePanel>,
    )
    const input = el.querySelector('input') as HTMLInputElement
    expect(input).not.toBeNull()
    act(() => input.click())
    act(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
    expect(el.textContent).toContain('body')
    // Collapsing hides the actions with the body.
    act(() => (el.querySelector('[role="button"]') as HTMLElement).click())
    expect(el.querySelector('input')).toBeNull()
  })
})

describe('CollapsiblePanel titleActions', () => {
  it('renders right after the title, before the actions', () => {
    const el = mount(
      <CollapsiblePanel title="Tracks" titleActions={<input aria-label="Search" />} actions={<select aria-label="Filter" />}>
        <p>body</p>
      </CollapsiblePanel>,
    )
    const search = el.querySelector('input') as HTMLInputElement
    const filter = el.querySelector('select') as HTMLSelectElement
    expect(search.compareDocumentPosition(filter) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    act(() => search.click())
    expect(el.textContent).toContain('body')
  })
})
