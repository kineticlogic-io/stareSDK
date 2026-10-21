// @vitest-environment jsdom
/**
 * SearchInput tests — React 19 createRoot + act + native DOM events (project convention).
 */
import { createRoot } from 'react-dom/client'
import { act, useEffect, useState } from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { SearchInput } from './SearchInput.js'
import type { SearchInputProps } from './SearchInput.js'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const cleanups: Array<() => void> = []
afterEach(() => {
  cleanups.splice(0).forEach((f) => f())
  vi.useRealTimers()
})

/** The host's setter, so a test can change `value` the way a parent would. */
const outer: { set: ((v: string) => void) | null } = { set: null }

function render(props: Partial<SearchInputProps> = {}, initial = '') {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  function Host() {
    const [value, setValue] = useState(initial)
    useEffect(() => {
      outer.set = setValue
    }, [])
    return (
      <SearchInput
        aria-label="Search the catalog"
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

const input = (c: HTMLElement) => c.querySelector('input') as HTMLInputElement
const clearButton = (c: HTMLElement) => c.querySelector('button[aria-label="Clear search"]') as HTMLButtonElement | null

/** Types `text` the way React sees it: set the native value, then dispatch `input`. */
function type(el: HTMLInputElement, text: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  act(() => {
    setter.call(el, text)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function key(el: HTMLElement, k: string) {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })
  act(() => {
    el.dispatchEvent(e)
  })
  return e
}

describe('SearchInput', () => {
  it('is a named search field with a decorative leading search icon and no clear button while empty', () => {
    const c = render({ placeholder: 'Search…' })
    const el = input(c)
    expect(el.type).toBe('search')
    expect(el.getAttribute('aria-label')).toBe('Search the catalog')
    expect(el.placeholder).toBe('Search…')
    expect(el.classList.contains('ui-input')).toBe(true)
    expect(c.querySelector('span[aria-hidden] svg')).not.toBeNull()
    expect(clearButton(c)).toBeNull()
  })

  it('reports every change and shows the clear button once it holds text', () => {
    const onChange = vi.fn()
    const c = render({ onChange })
    type(input(c), 'conv')
    expect(onChange).toHaveBeenLastCalledWith('conv')
    expect(input(c).value).toBe('conv')
    expect(clearButton(c)).not.toBeNull()
  })

  it('the clear button empties the field and returns focus to it', () => {
    const onChange = vi.fn()
    const c = render({ onChange }, 'radar')
    act(() => clearButton(c)!.click())
    expect(onChange).toHaveBeenLastCalledWith('')
    expect(input(c).value).toBe('')
    expect(document.activeElement).toBe(input(c))
    expect(clearButton(c)).toBeNull()
  })

  it('Escape clears a non-empty field and stops there', () => {
    const outer = vi.fn()
    const c = render({}, 'radar')
    document.body.addEventListener('keydown', outer)
    cleanups.push(() => document.body.removeEventListener('keydown', outer))
    const e = key(input(c), 'Escape')
    expect(input(c).value).toBe('')
    expect(e.defaultPrevented).toBe(true)
    expect(outer).not.toHaveBeenCalled()
  })

  it('Escape on an empty field is left to bubble (e.g. to close a modal)', () => {
    const outer = vi.fn()
    const c = render({})
    document.body.addEventListener('keydown', outer)
    cleanups.push(() => document.body.removeEventListener('keydown', outer))
    const e = key(input(c), 'Escape')
    expect(e.defaultPrevented).toBe(false)
    expect(outer).toHaveBeenCalledTimes(1)
  })

  it('debounces onDebouncedChange to the last value after debounceMs', () => {
    vi.useFakeTimers()
    const onDebouncedChange = vi.fn()
    const c = render({ onDebouncedChange, debounceMs: 300 })
    type(input(c), 'a')
    type(input(c), 'ab')
    act(() => vi.advanceTimersByTime(299))
    expect(onDebouncedChange).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(onDebouncedChange).toHaveBeenCalledTimes(1)
    expect(onDebouncedChange).toHaveBeenLastCalledWith('ab')
  })

  it('defaults the debounce to 250ms, reports a clear at once and never repeats a value', () => {
    vi.useFakeTimers()
    const onDebouncedChange = vi.fn()
    const c = render({ onDebouncedChange }, 'start')
    // Nothing is reported on mount.
    act(() => vi.advanceTimersByTime(1000))
    expect(onDebouncedChange).not.toHaveBeenCalled()
    type(input(c), 'starts')
    act(() => vi.advanceTimersByTime(250))
    expect(onDebouncedChange).toHaveBeenLastCalledWith('starts')
    act(() => clearButton(c)!.click())
    expect(onDebouncedChange).toHaveBeenLastCalledWith('')
    expect(onDebouncedChange).toHaveBeenCalledTimes(2)
    act(() => vi.advanceTimersByTime(1000))
    expect(onDebouncedChange).toHaveBeenCalledTimes(2)
  })

  it('reports a value the parent sets, once', () => {
    vi.useFakeTimers()
    const onDebouncedChange = vi.fn()
    render({ onDebouncedChange, debounceMs: 100 })
    act(() => outer.set!('from parent'))
    act(() => vi.advanceTimersByTime(100))
    expect(onDebouncedChange).toHaveBeenCalledTimes(1)
    expect(onDebouncedChange).toHaveBeenLastCalledWith('from parent')
  })

  it('takes size sm (28px, 12px text) and md (36px, 13px — Input default)', () => {
    const sm = render({ size: 'sm' })
    expect(input(sm).style.height).toBe('28px')
    expect(input(sm).style.fontSize).toBe('12px')
    const md = render({})
    expect(input(md).style.height).toBe('36px')
    expect(input(md).style.fontSize).toBe('13px')
  })

  it('autoFocus focuses the field on mount', () => {
    const c = render({ autoFocus: true })
    expect(document.activeElement).toBe(input(c))
  })

  it('disabled disables the field and hides the clear button', () => {
    const c = render({ disabled: true }, 'locked')
    expect(input(c).disabled).toBe(true)
    expect(clearButton(c)).toBeNull()
  })
})
