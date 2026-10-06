// @vitest-environment jsdom
/**
 * ContextMenu tests (91-12, WR-10 regression).
 *
 * Tests use React 19 createRoot + act (matches the rest of the codebase's
 * component test convention — no @testing-library/react dependency, see
 * Toast.test.tsx).
 *
 * What is tested (see 91-12-PLAN.md Task 1 <behavior>):
 *   (a) a mousedown target INSIDE the menu does not close it
 *   (b) a mousedown target on a plain outside element DOES close it
 *   (c) a mousedown target INSIDE an element carrying [data-portal-overlay]
 *       does not close it — this is the WR-10 regression, fails before the fix
 *   (d) a mousedown target that IS the [data-portal-overlay] element itself
 *       (not a descendant) also does not close it
 *   (e) Escape still closes the menu
 *   (f) the role="menu" container's inline zIndex is a number strictly < 5000
 */

import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { ContextMenu } from './ContextMenu'

function renderMenu(onClose: () => void) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(
      <ContextMenu x={10} y={10} onClose={onClose} ariaLabel="Test menu">
        <button>Item one</button>
      </ContextMenu>,
    )
  })
  return {
    container,
    unmount: () => {
      act(() => { root.unmount() })
      container.remove()
    },
  }
}

function dispatchMouseDownOn(target: EventTarget) {
  const evt = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
  Object.defineProperty(evt, 'target', { value: target, enumerable: true })
  act(() => { document.dispatchEvent(evt) })
}

describe('ContextMenu', () => {
  let unmountFns: Array<() => void> = []

  afterEach(() => {
    unmountFns.forEach(fn => fn())
    unmountFns = []
    document.querySelectorAll('[data-portal-overlay]').forEach(el => el.remove())
    vi.clearAllMocks()
  })

  it('does not close when a mousedown target is inside the menu', () => {
    const onClose = vi.fn()
    const { container, unmount } = renderMenu(onClose)
    unmountFns.push(unmount)

    const menuItem = container.querySelector('button')!
    dispatchMouseDownOn(menuItem)

    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes when a mousedown target is a plain outside element', () => {
    const onClose = vi.fn()
    const { unmount } = renderMenu(onClose)
    unmountFns.push(unmount)

    const outside = document.createElement('div')
    document.body.appendChild(outside)
    dispatchMouseDownOn(outside)
    outside.remove()

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not close when a mousedown target is inside a [data-portal-overlay] element (WR-10)', () => {
    const onClose = vi.fn()
    const { unmount } = renderMenu(onClose)
    unmountFns.push(unmount)

    // Reproduce the real bug: a portaled ui/Modal confirm dialog opens as a
    // DIRECT result of a click that began inside the menu.
    const overlay = document.createElement('div')
    overlay.setAttribute('data-portal-overlay', '')
    const dialogButton = document.createElement('button')
    overlay.appendChild(dialogButton)
    document.body.appendChild(overlay)

    dispatchMouseDownOn(dialogButton)

    expect(onClose).not.toHaveBeenCalled()
  })

  it('does not close when the mousedown target IS the [data-portal-overlay] element itself', () => {
    const onClose = vi.fn()
    const { unmount } = renderMenu(onClose)
    unmountFns.push(unmount)

    const overlay = document.createElement('div')
    overlay.setAttribute('data-portal-overlay', '')
    document.body.appendChild(overlay)

    dispatchMouseDownOn(overlay)

    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes on Escape', () => {
    const onClose = vi.fn()
    const { unmount } = renderMenu(onClose)
    unmountFns.push(unmount)

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders the role="menu" container at a zIndex strictly below ui/Modal (5000)', () => {
    const { container, unmount } = renderMenu(vi.fn())
    unmountFns.push(unmount)

    const menu = container.querySelector('[role="menu"]') as HTMLElement
    expect(menu).not.toBeNull()
    const zIndex = Number(menu.style.zIndex)
    expect(Number.isNaN(zIndex)).toBe(false)
    expect(zIndex).toBeLessThan(5000)
  })
})
