// @vitest-environment jsdom
/**
 * RadioGroup tests — React 19 createRoot + act + native DOM events (project convention).
 */
import { createRoot } from 'react-dom/client'
import { act, useState } from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { RadioGroup } from './RadioGroup.js'
import type { RadioGroupProps } from './RadioGroup.js'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const cleanups: Array<() => void> = []
afterEach(() => {
  cleanups.splice(0).forEach((f) => f())
})

const OPTIONS = [
  { value: 'existing', label: 'Use an existing layer' },
  { value: 'template', label: 'Create from template', description: 'TPL' },
  { value: 'later', label: 'Decide later', disabled: true },
]

function render(props: Partial<RadioGroupProps>, initial: string | null = null) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  function Host() {
    const [value, setValue] = useState<string | null>(initial)
    return (
      <RadioGroup
        options={OPTIONS}
        ariaLabel="Layer source"
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

const radios = (c: HTMLElement) => Array.from(c.querySelectorAll('input[type="radio"]')) as HTMLInputElement[]

describe('RadioGroup', () => {
  it('is a named radiogroup of real radios sharing one generated name', () => {
    const c = render({})
    const group = c.querySelector('[role="radiogroup"]')!
    expect(group.getAttribute('aria-label')).toBe('Layer source')
    expect(group.getAttribute('aria-orientation')).toBe('vertical')
    const rs = radios(c)
    expect(rs).toHaveLength(3)
    expect(rs[0].name).toBeTruthy()
    expect(new Set(rs.map((r) => r.name)).size).toBe(1)
    expect(rs.every((r) => !r.checked)).toBe(true)
  })

  it('two groups get different generated names; an explicit name is used as given', () => {
    const a = render({})
    const b = render({})
    expect(radios(a)[0].name).not.toBe(radios(b)[0].name)
    expect(radios(render({ name: 'bind-path' }))[0].name).toBe('bind-path')
  })

  it('checks the controlled value and reports a newly chosen one', () => {
    const onChange = vi.fn()
    const c = render({ onChange }, 'existing')
    expect(radios(c)[0].checked).toBe(true)
    act(() => radios(c)[1].click())
    expect(onChange).toHaveBeenLastCalledWith('template')
    expect(radios(c)[1].checked).toBe(true)
    expect(radios(c)[0].checked).toBe(false)
  })

  it('clicking an option label chooses it, and the description renders beside it', () => {
    const onChange = vi.fn()
    const c = render({ onChange })
    const label = c.querySelectorAll('label')[1]
    expect(label.textContent).toBe('Create from templateTPL')
    act(() => label.click())
    expect(onChange).toHaveBeenLastCalledWith('template')
  })

  it('a disabled option cannot be chosen; disabling the group disables every option', () => {
    const onChange = vi.fn()
    const c = render({ onChange })
    expect(radios(c)[2].disabled).toBe(true)
    act(() => radios(c)[2].click())
    expect(onChange).not.toHaveBeenCalled()

    const d = render({ disabled: true, onChange })
    expect(radios(d).every((r) => r.disabled)).toBe(true)
    expect(d.querySelector('[role="radiogroup"]')!.getAttribute('aria-disabled')).toBe('true')
    act(() => radios(d)[0].click())
    expect(onChange).not.toHaveBeenCalled()
  })

  it('lays out in a row when horizontal and shows a visible label', () => {
    const c = render({ orientation: 'horizontal', label: 'Source' })
    const group = c.querySelector('[role="radiogroup"]') as HTMLElement
    expect(group.getAttribute('aria-orientation')).toBe('horizontal')
    expect(group.firstElementChild!.textContent).toBe('Source')
    expect((group.lastElementChild as HTMLElement).style.flexDirection).toBe('row')
  })

  it('tints the radios with the accent token and carries the focus-ring class', () => {
    const r = radios(render({}))[0]
    expect(r.className).toBe('ui-radio')
    expect(r.style.accentColor).toBe('var(--color-accent)')
  })
})
