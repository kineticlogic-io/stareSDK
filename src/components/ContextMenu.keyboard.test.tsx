// @vitest-environment jsdom
/**
 * ContextMenu keyboard tests (0.2.11, OpenStare#318): focus moves into the menu on open, arrow
 * keys wrap over enabled items, Home/End, Enter/Space activate, Escape and Tab close, and focus
 * returns to the opener — but not when an item moved focus elsewhere on purpose.
 */
import { createRoot } from 'react-dom/client'
import { act, useState } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { ContextMenu, ContextMenuItem } from './ContextMenu.js'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const cleanups: Array<() => void> = []
afterEach(() => {
  cleanups.splice(0).forEach((f) => f())
})

function setup(opts: { onA?: () => void; onC?: () => void; moveFocusOnC?: boolean } = {}) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const outside = document.createElement('input')
  document.body.appendChild(outside)
  function Host() {
    const [open, setOpen] = useState(false)
    return (
      <>
        <button data-testid="opener" onClick={() => setOpen(true)}>open</button>
        {open && (
          <ContextMenu x={10} y={10} onClose={() => setOpen(false)} ariaLabel="Row actions">
            <ContextMenuItem onClick={() => { opts.onA?.(); setOpen(false) }}>Alpha</ContextMenuItem>
            <ContextMenuItem onClick={() => {}} disabled>Bravo</ContextMenuItem>
            <ContextMenuItem
              onClick={() => {
                opts.onC?.()
                if (opts.moveFocusOnC) outside.focus()
                setOpen(false)
              }}
            >
              Charlie
            </ContextMenuItem>
          </ContextMenu>
        )}
      </>
    )
  }
  act(() => root.render(<Host />))
  cleanups.push(() => {
    act(() => root.unmount())
    container.remove()
    outside.remove()
  })
  const opener = container.querySelector('[data-testid="opener"]') as HTMLButtonElement
  const open = () => {
    opener.focus()
    act(() => opener.click())
  }
  const menu = () => document.querySelector('[role="menu"]') as HTMLElement | null
  const key = (k: string, target: Element = document.activeElement ?? document.body) =>
    act(() => {
      target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }))
    })
  const label = () => (document.activeElement as HTMLElement | null)?.textContent
  return { opener, outside, open, menu, key, label }
}

describe('ContextMenu keyboard', () => {
  it('is a vertical menu that focuses its first enabled item on open', () => {
    const t = setup()
    t.open()
    expect(t.menu()?.getAttribute('aria-orientation')).toBe('vertical')
    expect(t.label()).toBe('Alpha')
  })

  it('arrow keys wrap over enabled items, skipping disabled ones; Home and End jump', () => {
    const t = setup()
    t.open()
    t.key('ArrowDown')
    expect(t.label()).toBe('Charlie')
    t.key('ArrowDown')
    expect(t.label()).toBe('Alpha')
    t.key('ArrowUp')
    expect(t.label()).toBe('Charlie')
    t.key('Home')
    expect(t.label()).toBe('Alpha')
    t.key('End')
    expect(t.label()).toBe('Charlie')
  })

  it('Enter and Space activate the focused item, which closes the menu and returns focus to the opener', () => {
    const onA = vi.fn()
    const onC = vi.fn()
    const t = setup({ onA, onC })
    t.open()
    t.key('Enter')
    expect(onA).toHaveBeenCalledTimes(1)
    expect(t.menu()).toBeNull()
    expect(document.activeElement).toBe(t.opener)
    t.open()
    t.key('End')
    t.key(' ')
    expect(onC).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(t.opener)
  })

  it('Escape and Tab close it and return focus to the opener', () => {
    const t = setup()
    t.open()
    t.key('Escape')
    expect(t.menu()).toBeNull()
    expect(document.activeElement).toBe(t.opener)
    t.open()
    t.key('Tab')
    expect(t.menu()).toBeNull()
    expect(document.activeElement).toBe(t.opener)
  })

  it('does not take focus back when an item moved it elsewhere on purpose', () => {
    const t = setup({ moveFocusOnC: true })
    t.open()
    t.key('End')
    t.key('Enter')
    expect(t.menu()).toBeNull()
    expect(document.activeElement).toBe(t.outside)
  })
})
