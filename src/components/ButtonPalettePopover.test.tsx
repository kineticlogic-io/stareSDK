// @vitest-environment jsdom
/**
 * ButtonPalettePopover tests — React 19 createRoot + act + native DOM events (project convention).
 */
import { createRoot } from 'react-dom/client'
import { act, useState } from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { ButtonPalettePopover, paletteBounds, placePalettePopover } from './ButtonPalettePopover.js'
import type { ButtonPalettePopoverProps } from './ButtonPalettePopover.js'
import { BANNER_HEIGHT_PX } from './ClassificationBanner.js'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const cleanups: Array<() => void> = []
afterEach(() => {
  cleanups.splice(0).forEach((f) => f())
})

function Host(props: Partial<ButtonPalettePopoverProps> & { initiallyOpen?: boolean }) {
  const { initiallyOpen = true, onClose, ...rest } = props
  const [open, setOpen] = useState(initiallyOpen)
  return (
    <div>
      <ButtonPalettePopover
        ariaLabel="Measure"
        {...rest}
        open={open}
        onClose={() => {
          onClose?.()
          setOpen(false)
        }}
        trigger={
          <button type="button" onClick={() => setOpen((o) => !o)}>
            Ruler
          </button>
        }
      >
        <button type="button">Distance</button>
        <button type="button">Area</button>
      </ButtonPalettePopover>
      <button type="button">Elsewhere</button>
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

const panel = (c: HTMLElement) => c.querySelector('[aria-label="Measure"]') as HTMLElement | null
const button = (c: HTMLElement, name: string) =>
  Array.from(c.querySelectorAll('button')).find((b) => b.textContent === name) as HTMLButtonElement

describe('placePalettePopover', () => {
  const clear = BANNER_HEIGHT_PX + 8
  // A 1000×800 viewport less the banners and an 8px margin.
  const vp = { top: clear, bottom: 800 - clear, left: 8, right: 992 }
  const trigger = { top: 200, bottom: 232, left: 10, right: 42 }
  const base = { side: 'right' as const, align: 'start' as const, gap: 8 }
  it('opens beside the trigger, lined up with its top', () => {
    expect(placePalettePopover(trigger, { width: 200, height: 150 }, vp, base)).toEqual({
      side: 'right',
      offset: 0,
      max: 800 - 2 * clear,
    })
  })
  it('flips to the other side when there is no room, and not when neither side fits', () => {
    const nearRight = { top: 200, bottom: 232, left: 950, right: 982 }
    expect(placePalettePopover(nearRight, { width: 200, height: 150 }, vp, base).side).toBe('left')
    expect(placePalettePopover(nearRight, { width: 2000, height: 150 }, vp, base).side).toBe('right')
    const nearTop = { top: 30, bottom: 62, left: 400, right: 432 }
    expect(placePalettePopover(nearTop, { width: 200, height: 150 }, vp, { ...base, side: 'top' }).side).toBe('bottom')
  })
  it('centres or end-aligns on the trigger', () => {
    expect(placePalettePopover(trigger, { width: 200, height: 100 }, vp, { ...base, align: 'center' }).offset).toBe(-34)
    expect(placePalettePopover(trigger, { width: 200, height: 100 }, vp, { ...base, align: 'end' }).offset).toBe(-68)
  })
  it('shifts up to stay clear of the bottom banner, and down clear of the top one', () => {
    const low = { top: 750, bottom: 782, left: 10, right: 42 }
    const p = placePalettePopover(low, { width: 200, height: 150 }, vp, base)
    expect(750 + p.offset + 150).toBe(800 - clear)
    const high = { top: 5, bottom: 37, left: 10, right: 42 }
    expect(5 + placePalettePopover(high, { width: 200, height: 150 }, vp, base).offset).toBe(clear)
  })
  it('lines up with another element (alignRect) while the offset stays relative to the trigger', () => {
    const palette = { top: 120, bottom: 400, left: 10, right: 42 }
    const p = placePalettePopover(trigger, { width: 200, height: 150 }, vp, { ...base, alignRect: palette })
    expect(p.side).toBe('right')
    expect(trigger.top + p.offset).toBe(120)
  })
  it('stays inside tighter bounds (a clipping ancestor) and caps its room to them', () => {
    const row = { top: 100, bottom: 500, left: 0, right: 600 }
    const p = placePalettePopover({ top: 420, bottom: 452, left: 10, right: 42 }, { width: 200, height: 150 }, row, base)
    expect(420 + p.offset + 150).toBe(500)
    expect(p.max).toBe(400)
  })
  it('a horizontal palette lines it up along x and clamps to the bounds', () => {
    const t = { top: 100, bottom: 132, left: 900, right: 932 }
    const p = placePalettePopover(t, { width: 200, height: 100 }, vp, { ...base, side: 'bottom' })
    expect(p.side).toBe('bottom')
    expect(900 + p.offset).toBe(992 - 200)
    expect(p.max).toBe(984)
  })
})

describe('paletteBounds', () => {
  it('is the viewport less the banners, cut to an ancestor that clips its overflow', () => {
    const outer = document.createElement('div')
    outer.style.overflow = 'hidden'
    const inner = document.createElement('span')
    outer.appendChild(inner)
    document.body.appendChild(outer)
    const spy = vi.spyOn(outer, 'getBoundingClientRect').mockReturnValue({
      top: 100, bottom: 400, left: 50, right: 450, width: 400, height: 300, x: 50, y: 100, toJSON: () => ({}),
    } as DOMRect)
    expect(paletteBounds(inner)).toEqual({ top: 108, bottom: 392, left: 58, right: 442 })
    spy.mockRestore()
    outer.style.overflow = 'visible'
    expect(paletteBounds(inner)).toEqual({
      top: BANNER_HEIGHT_PX + 8,
      bottom: window.innerHeight - BANNER_HEIGHT_PX - 8,
      left: 8,
      right: window.innerWidth - 8,
    })
    outer.remove()
  })
})

describe('ButtonPalettePopover', () => {
  it('renders the trigger always and the flyout only while open, beside the trigger', () => {
    const c = render(<Host initiallyOpen={false} />)
    expect(button(c, 'Ruler')).toBeTruthy()
    expect(panel(c)).toBeNull()
    act(() => button(c, 'Ruler').click())
    const p = panel(c)!
    expect(p.getAttribute('role')).toBe('dialog')
    expect(p.dataset.side).toBe('right')
    expect(p.style.left).toBe('calc(100% + 8px)')
    expect(p.style.position).toBe('absolute')
    // In place, not portaled: the panel shares the trigger's wrapper.
    expect(p.parentElement).toBe(button(c, 'Ruler').parentElement)
    expect(p.parentElement!.style.position).toBe('relative')
  })

  it('opens on the left or below when asked, and flips when that side has no room', () => {
    const rect = (left: number) =>
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
        top: 200, bottom: 232, left, right: left + 32, width: 32, height: 32, x: left, y: 200, toJSON: () => ({}),
      } as DOMRect)
    const spy = rect(500)
    expect(panel(render(<Host side="left" />))!.style.right).toBe('calc(100% + 8px)')
    expect(panel(render(<Host side="bottom" gap={4} />))!.style.top).toBe('calc(100% + 4px)')
    spy.mockRestore()
    const edge = rect(0)
    const p = panel(render(<Host side="left" />))!
    expect(p.dataset.side).toBe('right')
    expect(p.style.left).toBe('calc(100% + 8px)')
    edge.mockRestore()
  })

  it('wears the glass surface by default and drops it with surface={false}', () => {
    expect(panel(render(<Host />))!.style.background).toBe('var(--color-glass-bg)')
    expect(panel(render(<Host />))!.style.border).toBe('1px solid var(--color-glass-border)')
    expect(panel(render(<Host surface={false} />))!.style.background).toBe('')
  })

  it('shows a title heading when given', () => {
    const p = panel(render(<Host title="Graticule" />))!
    expect(p.firstElementChild!.textContent).toBe('Graticule')
  })

  it('closes on Escape and returns focus to the trigger', () => {
    const onClose = vi.fn()
    const c = render(<Host onClose={onClose} />)
    act(() => button(c, 'Distance').focus())
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(panel(c)).toBeNull()
    expect(document.activeElement).toBe(button(c, 'Ruler'))
  })

  it('closes on a press outside, not on one inside or on the trigger', () => {
    const onClose = vi.fn()
    const c = render(<Host onClose={onClose} />)
    act(() => {
      button(c, 'Area').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
      button(c, 'Ruler').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    })
    expect(onClose).not.toHaveBeenCalled()
    act(() => {
      button(c, 'Elsewhere').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(panel(c)).toBeNull()
  })

  it('a press inside a portal overlay does not close it', () => {
    const onClose = vi.fn()
    render(<Host onClose={onClose} />)
    const overlay = document.createElement('div')
    overlay.setAttribute('data-portal-overlay', '')
    document.body.appendChild(overlay)
    act(() => {
      overlay.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    })
    overlay.remove()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('stays open on outside presses with closeOnOutsideClick={false}, and ignores Escape with closeOnEscape={false}', () => {
    const onClose = vi.fn()
    const c = render(<Host onClose={onClose} closeOnOutsideClick={false} closeOnEscape={false} />)
    act(() => {
      button(c, 'Elsewhere').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(onClose).not.toHaveBeenCalled()
    expect(panel(c)).not.toBeNull()
  })

  it('moves focus to its first control with autoFocus, and leaves it alone otherwise', () => {
    const c = render(<Host autoFocus />)
    expect(document.activeElement).toBe(button(c, 'Distance'))
    const d = render(<Host />)
    expect(document.activeElement).not.toBe(button(d, 'Distance'))
  })

  it('stops pointer events at the flyout only with isolatePointer', () => {
    const below = vi.fn()
    const c = render(
      <div onPointerDown={below}>
        <Host isolatePointer />
      </div>,
    )
    act(() => {
      button(c, 'Area').dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
    })
    expect(below).not.toHaveBeenCalled()
    const d = render(
      <div onPointerDown={below}>
        <Host />
      </div>,
    )
    act(() => {
      button(d, 'Area').dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
    })
    expect(below).toHaveBeenCalledTimes(1)
  })

  it('gives focus back to the trigger when something inside closes it, not when focus is elsewhere', () => {
    function Closer({ withFocus }: { withFocus: boolean }) {
      const [open, setOpen] = useState(true)
      return (
        <div>
          <ButtonPalettePopover open={open} onClose={() => setOpen(false)} ariaLabel="Measure"
            trigger={<button type="button">Ruler</button>}>
            <button type="button" onClick={() => setOpen(false)}>Done</button>
          </ButtonPalettePopover>
          <button type="button" onClick={() => setOpen(false)}>Elsewhere</button>
          <span data-with-focus={String(withFocus)} />
        </div>
      )
    }
    const c = render(<Closer withFocus />)
    act(() => button(c, 'Done').focus())
    act(() => button(c, 'Done').click())
    expect(panel(c)).toBeNull()
    expect(document.activeElement).toBe(button(c, 'Ruler'))

    const d = render(<Closer withFocus={false} />)
    act(() => button(d, 'Elsewhere').focus())
    act(() => button(d, 'Elsewhere').click())
    expect(panel(d)).toBeNull()
    expect(document.activeElement).toBe(button(d, 'Elsewhere'))
  })

  it('hands its panel element to panelRef', () => {
    const ref = { current: null as HTMLDivElement | null }
    const c = render(<Host panelRef={ref} />)
    expect(ref.current).toBe(panel(c))
  })

  it('takes a role, width and zIndex', () => {
    const p = panel(render(<Host role="group" width={220} zIndex={1100} />))!
    expect(p.getAttribute('role')).toBe('group')
    expect(p.style.width).toBe('220px')
    expect(p.style.zIndex).toBe('1100')
  })
})
