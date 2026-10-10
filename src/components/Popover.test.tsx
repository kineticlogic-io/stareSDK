// @vitest-environment jsdom
/**
 * Popover tests — React 19 createRoot + act + native DOM events (project convention).
 */
import { createRoot } from 'react-dom/client'
import { createPortal } from 'react-dom'
import { act, useRef, useState } from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { Popover, placePopover } from './Popover.js'
import { BANNER_HEIGHT_PX } from './ClassificationBanner.js'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const cleanups: Array<() => void> = []
afterEach(() => {
  cleanups.splice(0).forEach((f) => f())
})

function Host({ onClose, initiallyOpen = true }: { onClose?: () => void; initiallyOpen?: boolean }) {
  const anchor = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(initiallyOpen)
  return (
    <div>
      <button ref={anchor} type="button" onClick={() => setOpen((o) => !o)}>
        Options
      </button>
      <button type="button">Elsewhere</button>
      <Popover
        open={open}
        onClose={() => {
          onClose?.()
          setOpen(false)
        }}
        anchorRef={anchor}
        ariaLabel="Layer options"
        role="menu"
      >
        <button type="button">First</button>
        <button type="button">Second</button>
      </Popover>
    </div>
  )
}

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

const panel = () => document.body.querySelector('[aria-label="Layer options"]') as HTMLElement | null

describe('placePopover', () => {
  const vp = { width: 1000, height: 800 }
  const opts = { align: 'start' as const, gap: 2, minWidth: 168, estimatedHeight: 240 }
  it('opens below the anchor with the room down to the banner as its max height', () => {
    const p = placePopover({ top: 100, bottom: 120, left: 50, right: 80 }, vp, opts)
    expect(p.top).toBe(122)
    expect(p.bottom).toBeUndefined()
    expect(p.left).toBe(50)
    expect(p.maxHeight).toBe(800 - 120 - 2 - BANNER_HEIGHT_PX - 8)
  })
  it('flips above near the bottom when there is more room above, pinned by its bottom edge', () => {
    const p = placePopover({ top: 700, bottom: 720, left: 50, right: 80 }, vp, opts)
    expect(p.top).toBeUndefined()
    expect(p.bottom).toBe(800 - 700 + 2)
    expect(p.maxHeight).toBe(700 - 2 - BANNER_HEIGHT_PX - 8)
  })
  it('clamps inside the viewport and can line up with the anchor end', () => {
    expect(placePopover({ top: 0, bottom: 20, left: 990, right: 1000 }, vp, opts).left).toBe(1000 - 168 - 8)
    expect(placePopover({ top: 0, bottom: 20, left: 400, right: 500 }, vp, { ...opts, align: 'end' }).left).toBe(500 - 168)
    expect(placePopover({ top: 0, bottom: 20, left: 2, right: 10 }, vp, opts).left).toBe(8)
  })
})

describe('Popover', () => {
  it('portals to the body with its role and name, and focuses the first item', () => {
    render(<Host />)
    const p = panel()
    expect(p).not.toBeNull()
    expect(p!.parentElement).toBe(document.body)
    expect(p!.getAttribute('role')).toBe('menu')
    expect(p!.style.position).toBe('fixed')
    expect(document.activeElement?.textContent).toBe('First')
  })

  it('closes on Escape and gives focus back to the anchor', () => {
    const onClose = vi.fn()
    const c = render(<Host onClose={onClose} />)
    act(() => {
      document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(panel()).toBeNull()
    expect(document.activeElement).toBe(c.querySelector('button'))
  })

  it('closes on a press outside, but not inside it or on its anchor', () => {
    const onClose = vi.fn()
    const c = render(<Host onClose={onClose} />)
    act(() => {
      panel()!.querySelector('button')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    })
    act(() => {
      c.querySelector('button')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    })
    expect(onClose).not.toHaveBeenCalled()
    act(() => {
      c.querySelectorAll('button')[1].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes when something the anchor sits in scrolls, not when its own content scrolls', () => {
    const onClose = vi.fn()
    const c = render(<Host onClose={onClose} />)
    act(() => {
      panel()!.dispatchEvent(new Event('scroll'))
    })
    expect(onClose).not.toHaveBeenCalled()
    act(() => {
      c.dispatchEvent(new Event('scroll'))
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not close on a press inside something its children portal elsewhere', () => {
    const onClose = vi.fn()
    const outside = document.createElement('div')
    document.body.appendChild(outside)
    cleanups.push(() => outside.remove())
    render(
      <Popover open onClose={onClose} point={{ x: 10, y: 10 }} ariaLabel="Nested">
        {createPortal(<button type="button">Swatch</button>, outside)}
      </Popover>,
    )
    act(() => {
      outside.querySelector('button')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    })
    expect(onClose).not.toHaveBeenCalled()
    act(() => {
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('keeps its measured width inside the viewport', () => {
    const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const width = this.getAttribute('aria-label') === 'Wide' ? 300 : 0
      return { x: 0, y: 0, top: 0, left: 0, bottom: 0, right: width, width, height: 0, toJSON: () => ({}) } as DOMRect
    })
    cleanups.push(() => spy.mockRestore())
    render(
      <Popover open onClose={() => {}} point={{ x: window.innerWidth - 10, y: 10 }} ariaLabel="Wide">
        <button type="button">Item</button>
      </Popover>,
    )
    const wide = document.body.querySelector('[aria-label="Wide"]') as HTMLElement
    expect(wide.style.left).toBe(`${window.innerWidth - 300 - 8}px`)
  })

  it('lines an end-aligned popover up with the anchor by its measured width', () => {
    const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const width = this.getAttribute('aria-label') === 'End' ? 250 : 0
      return { x: 0, y: 0, top: 0, left: 0, bottom: 0, right: width, width, height: 0, toJSON: () => ({}) } as DOMRect
    })
    cleanups.push(() => spy.mockRestore())
    render(
      <Popover open onClose={() => {}} point={{ x: 600, y: 10 }} ariaLabel="End" align="end">
        <button type="button">Item</button>
      </Popover>,
    )
    const end = document.body.querySelector('[aria-label="End"]') as HTMLElement
    expect(end.style.left).toBe('350px')
  })

  it('caps its height at maxHeight, never above the room to the banner', () => {
    render(
      <Popover open onClose={() => {}} point={{ x: 10, y: 10 }} ariaLabel="Capped" maxHeight={100}>
        <button type="button">Item</button>
      </Popover>,
    )
    const capped = document.body.querySelector('[aria-label="Capped"]') as HTMLElement
    expect(capped.style.maxHeight).toBe('100px')
  })

  it('renders nothing while closed', () => {
    render(<Host initiallyOpen={false} />)
    expect(panel()).toBeNull()
  })
})
