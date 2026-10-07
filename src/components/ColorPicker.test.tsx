// @vitest-environment jsdom
/**
 * ColorPicker.test.tsx — T-VOV quick task, Task 2 (the `placement` prop); 0.2.4: the popover is
 * portaled to `document.body`, fixed, placed from the trigger's rect.
 */
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { ColorPicker } from './ColorPicker.js'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

function render(el: React.ReactElement) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => { root.render(el) })
}

function swatchTrigger(): HTMLButtonElement {
  return container.querySelector('button')!
}

function popover(): HTMLDivElement | null {
  return document.body.querySelector('[data-color-picker-popover]')
}

function firstNonCustomSwatch(): HTMLButtonElement {
  // The first swatch button rendered inside the popover grid (not "Custom").
  return popover()!.querySelector('button')!
}

/** Places the trigger's wrapper at a fixed on-screen rect for the positioning assertions. */
function anchorAt(rect: { left: number; top: number; width: number; height: number }) {
  const wrapper = container.firstElementChild as HTMLElement
  wrapper.getBoundingClientRect = () => ({
    ...rect, right: rect.left + rect.width, bottom: rect.top + rect.height, x: rect.left, y: rect.top, toJSON: () => ({}),
  }) as DOMRect
}

afterEach(async () => {
  await act(async () => { root.unmount() })
  container.remove()
})

describe('ColorPicker placement', () => {
  it('opens portaled to the body, fixed below the trigger with right edges aligned, above the map', async () => {
    let value = '#0faf73'
    render(<ColorPicker value={value} onChange={v => { value = v }} />)
    anchorAt({ left: 500, top: 100, width: 28, height: 28 })
    await act(async () => { swatchTrigger().click() })
    const p = popover()!
    expect(container.contains(p)).toBe(false)
    expect(p.style.position).toBe('fixed')
    expect(p.style.top).toBe('130px')
    expect(p.style.left).toBe('328px')
    expect(Number(p.style.zIndex)).toBe(4500)
  })

  it('placement="top" opens above the trigger', async () => {
    let value = '#0faf73'
    render(<ColorPicker value={value} onChange={v => { value = v }} placement="top" />)
    anchorAt({ left: 500, top: 600, width: 28, height: 28 })
    await act(async () => { swatchTrigger().click() })
    const p = popover()!
    expect(p.style.top).toBe('auto')
    expect(p.style.bottom).toBe(`${window.innerHeight - 600 + 2}px`)
  })

  it('stays inside the window near its left edge', async () => {
    let value = '#0faf73'
    render(<ColorPicker value={value} onChange={v => { value = v }} />)
    anchorAt({ left: 10, top: 100, width: 28, height: 28 })
    await act(async () => { swatchTrigger().click() })
    expect(popover()!.style.left).toBe('4px')
  })

  it.each(['bottom', 'top'] as const)(
    'selecting a swatch calls onChange with lowercase hex and closes the popover (placement=%s)',
    async (placement) => {
      let value = '#0faf73'
      let onChangeArg: string | null = null
      render(
        <ColorPicker
          value={value}
          onChange={v => { onChangeArg = v; value = v }}
          placement={placement}
        />,
      )
      await act(async () => { swatchTrigger().click() })
      expect(popover()).not.toBeNull()

      const swatch = firstNonCustomSwatch()
      await act(async () => { swatch.click() })

      expect(onChangeArg).toMatch(/^#[0-9a-f]{6}$/)
      // Popover closed — the "Swatches" label and its backdrop are gone.
      expect(document.body.textContent).not.toContain('Swatches')
      expect(popover()).toBeNull()
    },
  )
})
