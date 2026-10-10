// @vitest-environment jsdom
/**
 * Checkbox tests — React 19 createRoot + act + native DOM events (project convention).
 */
import { createRoot } from 'react-dom/client'
import { act, useState } from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { Checkbox } from './Checkbox.js'
import type { CheckboxProps } from './Checkbox.js'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const cleanups: Array<() => void> = []
afterEach(() => {
  cleanups.splice(0).forEach((f) => f())
})

function render(props: Partial<CheckboxProps>, initial = false) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  function Host() {
    const [checked, setChecked] = useState(initial)
    return (
      <Checkbox
        {...props}
        checked={checked}
        onChange={(v, e) => {
          setChecked(v)
          props.onChange?.(v, e)
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

const box = (c: HTMLElement) => c.querySelector('input[type="checkbox"]') as HTMLInputElement

describe('Checkbox', () => {
  it('is a real checkbox inside its label; clicking the label toggles it', () => {
    const onChange = vi.fn()
    const c = render({ label: 'Show empty fields', onChange })
    expect(c.querySelector('label')!.textContent).toBe('Show empty fields')
    act(() => c.querySelector('label')!.click())
    expect(onChange).toHaveBeenLastCalledWith(true, expect.anything())
    expect(box(c).checked).toBe(true)
  })

  it('without a label it carries an accessible name', () => {
    const c = render({ ariaLabel: 'Visible' })
    expect(c.querySelector('label')).toBeNull()
    expect(box(c).getAttribute('aria-label')).toBe('Visible')
  })

  it('shows the indeterminate state and reports it as mixed', () => {
    const c = render({ ariaLabel: 'All rows', indeterminate: true })
    expect(box(c).indeterminate).toBe(true)
    expect(box(c).getAttribute('aria-checked')).toBe('mixed')
  })

  it('never reports a change while disabled', () => {
    const onChange = vi.fn()
    const c = render({ label: 'Locked', disabled: true, onChange })
    act(() => box(c).click())
    expect(onChange).not.toHaveBeenCalled()
    expect(box(c).disabled).toBe(true)
  })
})
