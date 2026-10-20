// @vitest-environment jsdom
/**
 * TagInput tests — React 19 createRoot + act + native DOM events (project convention; no
 * @testing-library/react), matching MultiSelect.test.tsx's harness.
 */
import { createRoot } from 'react-dom/client'
import { act, useState } from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { TagInput } from './TagInput.js'
import type { TagInputProps } from './TagInput.js'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const cleanups: Array<() => void> = []
afterEach(() => {
  cleanups.splice(0).forEach((f) => f())
})

function render(props: Partial<TagInputProps> & { initial?: string[]; onChange?: (v: string[]) => void } = {}) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const { initial = [], ...rest } = props
  function Host() {
    const [value, setValue] = useState<string[]>(initial)
    return (
      <TagInput
        ariaLabel="ELNOTs"
        {...rest}
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

const input = (c: HTMLElement) => c.querySelector('input') as HTMLInputElement
const chips = (c: HTMLElement) =>
  Array.from(c.querySelectorAll('button[aria-label^="Remove "]')).map((b) => b.getAttribute('aria-label')!.slice(7))

function type(c: HTMLElement, text: string) {
  const el = input(c)
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    setter.call(el, text)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function key(c: HTMLElement, k: string) {
  act(() => {
    input(c).dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }))
  })
}

describe('TagInput', () => {
  it('adds a trimmed value on Enter or comma, and never twice', () => {
    const onChange = vi.fn()
    const c = render({ onChange })
    type(c, '  3E2AA ')
    key(c, 'Enter')
    type(c, '3F1BB')
    key(c, ',')
    type(c, '3E2AA')
    key(c, 'Enter')
    expect(chips(c)).toEqual(['3E2AA', '3F1BB'])
    expect(input(c).value).toBe('')
    expect(onChange).toHaveBeenLastCalledWith(['3E2AA', '3F1BB'])
  })

  it('leaves Enter alone when nothing is typed, so a form can still submit', () => {
    const c = render({ initial: ['A'] })
    const ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    act(() => {
      input(c).dispatchEvent(ev)
    })
    expect(ev.defaultPrevented).toBe(false)
    expect(chips(c)).toEqual(['A'])
  })

  it('removes the last chip on Backspace in the empty input, and any chip with its ×', () => {
    const c = render({ initial: ['A', 'B', 'C'] })
    key(c, 'Backspace')
    expect(chips(c)).toEqual(['A', 'B'])
    act(() => (c.querySelector('button[aria-label="Remove A"]') as HTMLButtonElement).click())
    expect(chips(c)).toEqual(['B'])
    type(c, 'x')
    key(c, 'Backspace')
    expect(chips(c)).toEqual(['B']) // Backspace with text only edits the text
  })

  it('adds what was typed when the field loses focus', () => {
    const c = render()
    type(c, 'Q4')
    act(() => {
      input(c).dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    })
    expect(chips(c)).toEqual(['Q4'])
  })

  it('splits a pasted list on commas and new lines', () => {
    const c = render()
    const ev = new Event('paste', { bubbles: true, cancelable: true }) as Event & { clipboardData: unknown }
    ev.clipboardData = { getData: () => 'A, B\nC, D' }
    act(() => {
      input(c).dispatchEvent(ev)
    })
    expect(chips(c)).toEqual(['A', 'B', 'C'])
    expect(input(c).value).toBe(' D')
  })

  it('ends a value at a comma that arrives without a key press (touch keyboards, autofill)', () => {
    const c = render()
    type(c, 'alpha,')
    expect(chips(c)).toEqual(['alpha'])
    expect(input(c).value).toBe('')
    type(c, 'bravo, charlie, del')
    expect(chips(c)).toEqual(['alpha', 'bravo', 'charlie'])
    expect(input(c).value).toBe(' del')
  })

  it('shows the placeholder only while there are no chips', () => {
    const c = render({ placeholder: 'Add a tag…' })
    expect(input(c).placeholder).toBe('Add a tag…')
    type(c, 'alpha')
    key(c, 'Enter')
    expect(input(c).placeholder).toBe('')
  })

  it('shows the validation message and does not add a rejected value', () => {
    const c = render({ validate: (v) => (/^[0-9A-Z]{5}$/.test(v) ? null : 'An ELNOT is five letters or digits') })
    type(c, 'bad')
    key(c, 'Enter')
    expect(chips(c)).toEqual([])
    expect(c.querySelector('[role="alert"]')?.textContent).toBe('An ELNOT is five letters or digits')
    expect(input(c).getAttribute('aria-invalid')).toBe('true')
    expect(input(c).getAttribute('aria-describedby')).toBe(c.querySelector('[role="alert"]')!.id)
    type(c, '3E2AA')
    expect(c.querySelector('[role="alert"]')).toBeNull()
    key(c, 'Enter')
    expect(chips(c)).toEqual(['3E2AA'])
  })

  it('normalizes each value before it is checked and added', () => {
    const c = render({ normalize: (v) => v.toLowerCase(), initial: ['maritime'] })
    type(c, 'Maritime')
    key(c, 'Enter')
    type(c, 'AIR')
    key(c, 'Enter')
    expect(chips(c)).toEqual(['maritime', 'air'])
  })

  it('stops at maxItems', () => {
    const c = render({ maxItems: 2, initial: ['A'] })
    type(c, 'B')
    key(c, 'Enter')
    expect(chips(c)).toEqual(['A', 'B'])
    expect(input(c).disabled).toBe(true)
  })

  it('offers matching suggestions, picked with the keyboard or a click', () => {
    const c = render({ suggestions: ['alpha', 'alpine', 'bravo'], initial: ['alpine'] })
    type(c, 'AL')
    const options = () => Array.from(c.querySelectorAll('[role="option"]')).map((o) => o.textContent)
    expect(options()).toEqual(['alpha'])
    expect(input(c).getAttribute('aria-expanded')).toBe('true')
    key(c, 'ArrowDown')
    expect(input(c).getAttribute('aria-activedescendant')).toBe(c.querySelector('[role="option"]')!.id)
    key(c, 'Enter')
    expect(chips(c)).toEqual(['alpine', 'alpha'])
    type(c, 'b')
    act(() => (c.querySelector('[role="option"]') as HTMLElement).click())
    expect(chips(c)).toEqual(['alpine', 'alpha', 'bravo'])
    type(c, 'zz')
    expect(c.querySelector('[role="listbox"]')).toBeNull()
  })

  it('closes the suggestions on Escape without adding', () => {
    const c = render({ suggestions: ['alpha'] })
    type(c, 'a')
    key(c, 'Escape')
    expect(c.querySelector('[role="listbox"]')).toBeNull()
    expect(chips(c)).toEqual([])
  })

  it('shows chips only when readOnly, and greys everything when disabled', () => {
    const ro = render({ readOnly: true, initial: ['A', 'B'] })
    expect(ro.querySelector('input')).toBeNull()
    expect(ro.querySelectorAll('button').length).toBe(0)
    expect(ro.textContent).toContain('A')
    const off = render({ disabled: true, initial: ['A'] })
    expect(input(off).disabled).toBe(true)
    expect((off.querySelector('button[aria-label="Remove A"]') as HTMLButtonElement).disabled).toBe(true)
  })

  it('labels each × with removeLabel when given', () => {
    const c = render({ initial: ['alpha'], removeLabel: (v) => `Remove tag ${v}` })
    expect(c.querySelector('button[aria-label="Remove tag alpha"]')).not.toBeNull()
  })

  it('names its input and group for assistive technology and takes an id for a label', () => {
    const c = render({ id: 'elnots', 'aria-describedby': 'hint' })
    expect(input(c).id).toBe('elnots')
    expect(input(c).getAttribute('aria-label')).toBe('ELNOTs')
    expect(input(c).getAttribute('aria-describedby')).toBe('hint')
    expect(c.querySelector('[role="group"]')?.getAttribute('aria-label')).toBe('ELNOTs')
  })
})
