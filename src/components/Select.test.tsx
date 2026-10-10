// @vitest-environment jsdom
/**
 * Select tests — React 19 createRoot + act + native DOM events (project convention).
 */
import { createRoot } from 'react-dom/client'
import { act, createRef } from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { Select } from './Select.js'
import type { SelectProps } from './Select.js'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const cleanups: Array<() => void> = []
afterEach(() => {
  cleanups.splice(0).forEach((f) => f())
})

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Bravo', disabled: true },
]

function render(props: Partial<SelectProps>) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() =>
    root.render(<Select options={OPTIONS} value={null} onChange={() => {}} ariaLabel="Pick" {...props} />),
  )
  cleanups.push(() => {
    act(() => root.unmount())
    container.remove()
  })
  return container.querySelector('select') as HTMLSelectElement
}

function choose(select: HTMLSelectElement, value: string) {
  act(() => {
    select.value = value
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

describe('Select', () => {
  it('renders labelled options, disabled flags and the accessible name', () => {
    const select = render({})
    expect(select.getAttribute('aria-label')).toBe('Pick')
    const opts = Array.from(select.options)
    expect(opts.map((o) => o.textContent)).toEqual(['Alpha', 'Bravo'])
    expect(opts[1].disabled).toBe(true)
  })

  it('reports the chosen value, and the placeholder as null', () => {
    const onChange = vi.fn()
    const select = render({ onChange, placeholder: 'None', value: 'a' })
    expect(select.options[0].value).toBe('')
    expect(select.options[0].textContent).toBe('None')
    choose(select, '')
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it('passes the form attributes and ref through to the native select', () => {
    const ref = createRef<HTMLSelectElement>()
    const select = render({ id: 'role', name: 'role', required: true, title: 'Role', ref })
    expect(select.id).toBe('role')
    expect(select.name).toBe('role')
    expect(select.required).toBe(true)
    expect(select.title).toBe('Role')
    expect(ref.current).toBe(select)
  })

  it('merges the caller style over the defaults', () => {
    const select = render({ style: { height: 24, width: 'auto' } })
    expect(select.style.height).toBe('24px')
    expect(select.style.width).toBe('auto')
  })
})
