// @vitest-environment jsdom
/**
 * ColorPicker.test.tsx — T-VOV quick task, Task 2 (the `placement` prop).
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

function firstNonCustomSwatch(): HTMLButtonElement {
  // The first swatch button rendered inside the popover grid (not the trigger, not "Custom").
  return Array.from(container.querySelectorAll('button'))[1]
}

afterEach(async () => {
  await act(async () => { root.unmount() })
  container.remove()
})

describe('ColorPicker placement', () => {
  it('default render keeps top: calc(100% + 2px) and no bottom anchor', async () => {
    let value = '#0faf73'
    render(<ColorPicker value={value} onChange={v => { value = v }} />)
    await act(async () => { swatchTrigger().click() })
    const popover = container.querySelectorAll('div')[2] as HTMLDivElement
    expect(popover.style.top).toBe('calc(100% + 2px)')
    expect(popover.style.bottom).toBe('')
  })

  it('placement="top" renders with bottom: calc(100% + 2px) and top: auto', async () => {
    let value = '#0faf73'
    render(<ColorPicker value={value} onChange={v => { value = v }} placement="top" />)
    await act(async () => { swatchTrigger().click() })
    const popover = container.querySelectorAll('div')[2] as HTMLDivElement
    expect(popover.style.bottom).toBe('calc(100% + 2px)')
    expect(popover.style.top).toBe('auto')
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
      expect(container.querySelectorAll('div').length).toBeGreaterThan(0)

      const swatch = firstNonCustomSwatch()
      await act(async () => { swatch.click() })

      expect(onChangeArg).toMatch(/^#[0-9a-f]{6}$/)
      // Popover closed — the "Swatches" label and its backdrop are gone.
      expect(container.textContent).not.toContain('Swatches')
      expect(container.querySelectorAll('div').length).toBe(1)
    },
  )
})
