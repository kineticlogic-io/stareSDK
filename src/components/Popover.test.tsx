// @vitest-environment jsdom
/**
 * Popover tests — React 19 createRoot + act + native DOM events (project convention).
 */
import { createRoot } from 'react-dom/client'
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

  it('renders nothing while closed', () => {
    render(<Host initiallyOpen={false} />)
    expect(panel()).toBeNull()
  })
})
