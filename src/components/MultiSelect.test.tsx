// @vitest-environment jsdom
/**
 * MultiSelect tests — React 19 createRoot + act + native DOM events (project convention; no
 * @testing-library/react), matching Disclosure.test.tsx's harness.
 */
import { createRoot } from 'react-dom/client'
import { act, useState } from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { TbMenu2 } from 'react-icons/tb'
import { MultiSelect } from './MultiSelect.js'
import type { MultiSelectProps } from './MultiSelect.js'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const cleanups: Array<() => void> = []
afterEach(() => {
  cleanups.splice(0).forEach((f) => f())
})

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Bravo' },
  { value: 'c', label: 'Charlie', locked: true },
]

function render(props: Partial<MultiSelectProps> & { onChange?: (v: string[]) => void }) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  function Host() {
    const [value, setValue] = useState<string[]>(['a'])
    return (
      <MultiSelect
        ariaLabel="Columns"
        options={OPTIONS}
        {...props}
        value={value}
        onChange={(v) => {
          setValue(v)
          props.onChange?.(v)
        }}
      />
    )
  }
  act(() => root.render(<Host />))
  cleanups.push(() => {
    act(() => root.unmount())
    container.remove()
  })
  return container
}

const trigger = (c: HTMLElement) => c.querySelector('button[aria-label="Columns"]') as HTMLButtonElement

describe('MultiSelect', () => {
  it('summarises the choice and opens its list in flow', () => {
    const c = render({})
    expect(trigger(c).textContent).toContain('Alpha')
    act(() => trigger(c).click())
    const list = c.querySelector('[role="listbox"]') as HTMLElement
    expect(list).not.toBeNull()
    expect(list.style.position).toBe('')
  })

  it('icon mode: an xs icon button, labelled, whose list floats on the chosen edge', () => {
    const onChange = vi.fn()
    const c = render({ icon: <TbMenu2 />, align: 'right', onChange })
    const button = trigger(c)
    expect(button.getAttribute('title')).toBe('Columns')
    expect(button.textContent).toBe('')
    expect(button.getAttribute('aria-expanded')).toBe('false')
    act(() => button.click())
    expect(button.getAttribute('aria-expanded')).toBe('true')
    const list = c.querySelector('[role="listbox"]') as HTMLElement
    expect(list.style.position).toBe('absolute')
    expect(list.style.right).toBe('0px')
    const bravo = Array.from(list.querySelectorAll('label')).find((l) => l.textContent === 'Bravo')!
    act(() => (bravo.querySelector('input') as HTMLInputElement).click())
    expect(onChange).toHaveBeenLastCalledWith(['a', 'b'])
    const locked = Array.from(list.querySelectorAll('input')).find((i) => i.disabled)!
    expect(locked.checked).toBe(true)
  })

  it('closes on Escape and on a pointer down outside', () => {
    const c = render({ icon: <TbMenu2 /> })
    act(() => trigger(c).click())
    act(() => {
      trigger(c).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(c.querySelector('[role="listbox"]')).toBeNull()
    act(() => trigger(c).click())
    act(() => {
      const Ctor: typeof MouseEvent = typeof PointerEvent === 'function' ? PointerEvent : MouseEvent
      document.body.dispatchEvent(new Ctor('pointerdown', { bubbles: true }))
    })
    expect(c.querySelector('[role="listbox"]')).toBeNull()
  })
})
