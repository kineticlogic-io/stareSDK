// @vitest-environment jsdom
/**
 * Flyout tests (127-14, Task 1). Follows this codebase's established component-test convention
 * — React 19 `createRoot` + `act`, no `@testing-library/react` (see `ContextMenu.test.tsx`,
 * `TypeaheadPicker.test.tsx`) — and `ContextMenu.test.tsx`'s WR-10
 * `[data-portal-overlay]`-exemption test shape for the outside-click cases.
 */
import { createRoot, type Root } from 'react-dom/client'
import { act, useRef } from 'react'
import type { ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Flyout } from './Flyout'
import type { FlyoutItem } from './Flyout'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function makeItems(): FlyoutItem[] {
  return [
    { id: 'alpha', label: 'Alpha tool', hint: 'Does alpha things.', shortcut: 'A' },
    { id: 'bravo', label: 'Bravo tool', hint: 'Does bravo things.', disabled: true, disabledReason: 'Not yet available.' },
    { id: 'charlie', label: 'Charlie tool', hint: 'Does charlie things.' },
  ]
}

interface HarnessProps {
  open: boolean
  items: FlyoutItem[]
  onSelect: (id: string) => void
  onClose: () => void
  filterable?: boolean
  footer?: ReactNode
  onToggleFavourite?: (id: string) => void
}

function Harness({ open, items, onSelect, onClose, filterable, footer, onToggleFavourite }: HarnessProps) {
  const anchorRef = useRef<HTMLButtonElement | null>(null)
  return (
    <div>
      <button ref={anchorRef} type="button">Trigger</button>
      <Flyout
        open={open}
        onClose={onClose}
        anchorRef={anchorRef}
        items={items}
        onSelect={onSelect}
        ariaLabel="Test flyout"
        filterable={filterable}
        footer={footer}
        onToggleFavourite={onToggleFavourite}
      />
    </div>
  )
}

function setValue(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  setter.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

let container: HTMLDivElement
let root: Root

function anchor(): HTMLButtonElement {
  return container.querySelector('button')!
}
function panel(): HTMLElement | null {
  return document.querySelector('[data-portal-overlay]')
}
function filterInput(): HTMLInputElement | null {
  return document.querySelector('[data-portal-overlay] input')
}
function options(): HTMLElement[] {
  return Array.from(document.querySelectorAll('[data-portal-overlay] [role="option"]'))
}

describe('Flyout', () => {
  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => { root.unmount() })
    container.remove()
    document.querySelectorAll('[data-portal-overlay]').forEach(el => el.remove())
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('renders nothing when closed', () => {
    act(() => {
      root.render(<Harness open={false} items={makeItems()} onSelect={vi.fn()} onClose={vi.fn()} />)
    })
    expect(panel()).toBeNull()
  })

  it('renders a portaled panel anchored to the trigger when open', () => {
    act(() => {
      root.render(<Harness open items={makeItems()} onSelect={vi.fn()} onClose={vi.fn()} />)
    })
    const p = panel()
    expect(p).not.toBeNull()
    expect(p!.parentElement).toBe(document.body)
    expect(p!.style.position).toBe('fixed')
  })

  it('flips to stay within the viewport when the trigger is near the right edge', () => {
    Object.defineProperty(window, 'innerWidth', { value: 300, configurable: true })
    const originalGetRect = HTMLButtonElement.prototype.getBoundingClientRect
    HTMLButtonElement.prototype.getBoundingClientRect = () =>
      ({ left: 280, right: 296, top: 10, bottom: 30, width: 16, height: 20, x: 280, y: 10, toJSON() {} }) as DOMRect
    try {
      act(() => {
        root.render(<Harness open items={makeItems()} onSelect={vi.fn()} onClose={vi.fn()} />)
      })
      const p = panel()!
      const left = Number(p.style.left.replace('px', ''))
      // Default width is 260 — anchored to the right of a trigger at x=296 would overflow a
      // 300px-wide viewport, so the panel must flip to the LEFT of the trigger instead.
      expect(left).toBeLessThan(280)
    } finally {
      HTMLButtonElement.prototype.getBoundingClientRect = originalGetRect
      Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true })
    }
  })

  it('closes on Escape', () => {
    const onClose = vi.fn()
    act(() => {
      root.render(<Harness open items={makeItems()} onSelect={vi.fn()} onClose={onClose} />)
    })
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on an outside click but not a click inside the panel or on the trigger', () => {
    const onClose = vi.fn()
    act(() => {
      root.render(<Harness open items={makeItems()} onSelect={vi.fn()} onClose={onClose} />)
    })

    // Inside the panel — does not close.
    act(() => {
      const evt = new MouseEvent('mousedown', { bubbles: true })
      options()[0].dispatchEvent(evt)
    })
    expect(onClose).not.toHaveBeenCalled()

    // On the trigger itself — does not close (the trigger owns its own toggle).
    act(() => {
      const evt = new MouseEvent('mousedown', { bubbles: true })
      anchor().dispatchEvent(evt)
    })
    expect(onClose).not.toHaveBeenCalled()

    // A plain outside element — closes.
    const outside = document.createElement('div')
    document.body.appendChild(outside)
    act(() => {
      const evt = new MouseEvent('mousedown', { bubbles: true })
      outside.dispatchEvent(evt)
    })
    outside.remove()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not close on a mousedown inside a [data-portal-overlay] element opened from within (WR-10)', () => {
    const onClose = vi.fn()
    act(() => {
      root.render(<Harness open items={makeItems()} onSelect={vi.fn()} onClose={onClose} />)
    })
    const overlay = document.createElement('div')
    overlay.setAttribute('data-portal-overlay', '')
    const dialogButton = document.createElement('button')
    overlay.appendChild(dialogButton)
    document.body.appendChild(overlay)
    act(() => {
      dialogButton.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    })
    expect(onClose).not.toHaveBeenCalled()
    overlay.remove()
  })

  it('filterable: renders and focuses a filter box on open, and narrows the list after the debounce', () => {
    vi.useFakeTimers()
    act(() => {
      root.render(<Harness open items={makeItems()} onSelect={vi.fn()} onClose={vi.fn()} filterable />)
    })
    act(() => { vi.advanceTimersByTime(10) })
    const input = filterInput()
    expect(input).not.toBeNull()
    expect(document.activeElement).toBe(input)

    expect(options()).toHaveLength(3)
    act(() => { setValue(input!, 'char') })
    act(() => { vi.advanceTimersByTime(310) })
    const remaining = options()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].textContent).toContain('Charlie tool')
  })

  it('arrow navigation skips disabled items, and a disabled item does not fire onSelect on click or Enter', () => {
    const onSelect = vi.fn()
    act(() => {
      root.render(<Harness open items={makeItems()} onSelect={onSelect} onClose={vi.fn()} />)
    })
    const p = panel()!

    // Click on the disabled row — no-op.
    act(() => { options()[1].dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    expect(onSelect).not.toHaveBeenCalled()

    // ArrowDown from nothing active should land on the first ENABLED item (alpha), then skip
    // bravo (disabled) and land on charlie on the next ArrowDown.
    act(() => { p.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })) })
    expect(p.getAttribute('aria-activedescendant')).toMatch(/alpha/)
    act(() => { p.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })) })
    expect(p.getAttribute('aria-activedescendant')).toMatch(/charlie/)

    act(() => { p.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })) })
    expect(onSelect).toHaveBeenCalledWith('charlie')
  })

  it('renders the disabled item dimmed with its reason as title and aria-label', () => {
    act(() => {
      root.render(<Harness open items={makeItems()} onSelect={vi.fn()} onClose={vi.fn()} />)
    })
    const bravo = options()[1]
    expect(bravo.title).toBe('Not yet available.')
    expect(bravo.getAttribute('aria-label')).toContain('Not yet available.')
    expect((bravo as HTMLElement).style.opacity).toBe('0.5')
  })

  it('always renders the footer, including when the filtered item list is empty', () => {
    vi.useFakeTimers()
    act(() => {
      root.render(
        <Harness
          open
          items={makeItems()}
          onSelect={vi.fn()}
          onClose={vi.fn()}
          filterable
          footer={<div data-testid="flyout-footer">Add … tool…</div>}
        />,
      )
    })
    act(() => { vi.advanceTimersByTime(10) })
    expect(panel()!.querySelector('[data-testid="flyout-footer"]')).not.toBeNull()

    act(() => { setValue(filterInput()!, 'zzz-no-match') })
    act(() => { vi.advanceTimersByTime(310) })
    expect(options()).toHaveLength(0)
    expect(panel()!.querySelector('[data-testid="flyout-footer"]')).not.toBeNull()
  })

  it('returns focus to the trigger when the flyout closes', () => {
    act(() => {
      root.render(<Harness open items={makeItems()} onSelect={vi.fn()} onClose={vi.fn()} />)
    })
    expect(panel()).not.toBeNull()
    act(() => {
      root.render(<Harness open={false} items={makeItems()} onSelect={vi.fn()} onClose={vi.fn()} />)
    })
    expect(document.activeElement).toBe(anchor())
  })

  it('renders a bookmark-pin favourite affordance and calls onToggleFavourite', () => {
    const onToggleFavourite = vi.fn()
    act(() => {
      root.render(<Harness open items={makeItems()} onSelect={vi.fn()} onClose={vi.fn()} onToggleFavourite={onToggleFavourite} />)
    })
    const pin = options()[0].querySelector('button')!
    act(() => { pin.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    expect(onToggleFavourite).toHaveBeenCalledWith('alpha')
  })

  it('groups favourited items into a leading Favourites section', () => {
    const items = makeItems()
    items[2].favourite = true // charlie
    act(() => {
      root.render(<Harness open items={items} onSelect={vi.fn()} onClose={vi.fn()} onToggleFavourite={vi.fn()} />)
    })
    const rows = options()
    expect(rows[0].textContent).toContain('Charlie tool')
  })
})
