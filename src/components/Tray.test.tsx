// @vitest-environment jsdom
/**
 * Tray tests — React 19 createRoot + act + native DOM events (project convention).
 */
import { createRoot } from 'react-dom/client'
import { act, useState } from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { Tray } from './Tray.js'
import type { TrayProps } from './Tray.js'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const cleanups: Array<() => void> = []
afterEach(() => {
  cleanups.splice(0).forEach((f) => f())
  localStorage.clear()
})

function render(props: Partial<TrayProps> = {}, initiallyOpen = true) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  function Host() {
    const [open, setOpen] = useState(initiallyOpen)
    return (
      <Tray aria-label="Samples" title="Samples" open={open} onOpenChange={setOpen} {...props}>
        <p>rows</p>
      </Tray>
    )
  }
  act(() => root.render(<Host />))
  cleanups.push(() => {
    act(() => root.unmount())
    container.remove()
  })
  return container
}

const key = (el: Element, k: string) => act(() => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })))
const body = (c: HTMLElement) => c.querySelector<HTMLElement>('.ui-tray-body')!

describe('Tray', () => {
  it('opens and closes from its title and its chevron', () => {
    const c = render({}, false)
    expect(body(c).hidden).toBe(true)
    expect(c.querySelector('p')).toBeNull()
    const toggle = c.querySelector<HTMLButtonElement>('.ui-tray-toggle')!
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    act(() => toggle.click())
    expect(body(c).hidden).toBe(false)
    expect(c.querySelector('p')?.textContent).toBe('rows')
    act(() => c.querySelector<HTMLButtonElement>('button[aria-label="Close Samples"]')!.click())
    expect(body(c).hidden).toBe(true)
  })

  it('is resized with the keys on its edge, within its limits, and remembers it', () => {
    const c = render({ height: 200, minHeight: 120, maxHeight: 300, storageKey: 'tray.h' })
    const handle = c.querySelector<HTMLElement>('[role="separator"]')!
    expect(handle.getAttribute('aria-valuenow')).toBe('200')
    key(handle, 'ArrowUp')
    expect(body(c).style.height).toBe('224px')
    key(handle, 'Home')
    expect(body(c).style.height).toBe('300px')
    key(handle, 'End')
    expect(body(c).style.height).toBe('120px')
    expect(localStorage.getItem('tray.h')).toBe('120')
  })

  it('starts at the height it was left at', () => {
    localStorage.setItem('tray.h', '250')
    const c = render({ storageKey: 'tray.h' })
    expect(body(c).style.height).toBe('250px')
  })

  it('keeps clicks on its actions from toggling it', () => {
    const c = render({ actions: <button type="button">Table</button> })
    act(() => [...c.querySelectorAll('button')].find((b) => b.textContent === 'Table')!.click())
    expect(body(c).hidden).toBe(false)
  })
})
