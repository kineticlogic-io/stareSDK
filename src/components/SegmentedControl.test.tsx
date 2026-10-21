// @vitest-environment jsdom
/**
 * SegmentedControl tests — React 19 createRoot + act + native DOM events (project convention).
 */
import { createRoot } from 'react-dom/client'
import { act, useState } from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { TbLayoutGrid, TbTable } from 'react-icons/tb'
import { SegmentedControl } from './SegmentedControl.js'
import type { SegmentedControlProps, SegmentedOption } from './SegmentedControl.js'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const cleanups: Array<() => void> = []
afterEach(() => {
  cleanups.splice(0).forEach((f) => f())
})

const VIEWS: SegmentedOption[] = [
  { value: 'grid', icon: <TbLayoutGrid />, ariaLabel: 'Grid' },
  { value: 'table', icon: <TbTable />, ariaLabel: 'Table' },
]

const MODES: SegmentedOption[] = [
  { value: 'all', label: 'All' },
  { value: 'mine', label: 'Mine' },
  { value: 'shared', label: 'Shared', icon: <TbTable /> },
]

function render(props: Partial<SegmentedControlProps> = {}, initial: string | null = 'grid') {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  function Host() {
    const [value, setValue] = useState<string | null>(initial)
    return (
      <SegmentedControl
        options={VIEWS}
        aria-label="View"
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

const radios = (c: HTMLElement) => Array.from(c.querySelectorAll('[role="radio"]')) as HTMLButtonElement[]
const group = (c: HTMLElement) => c.querySelector('[role="radiogroup"]') as HTMLElement

function key(el: HTMLElement, k: string) {
  act(() => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }))
  })
}

describe('SegmentedControl', () => {
  it('is a named radiogroup of radio buttons with aria-checked on the chosen one', () => {
    const c = render()
    expect(group(c).getAttribute('aria-label')).toBe('View')
    const rs = radios(c)
    expect(rs).toHaveLength(2)
    expect(rs.map((r) => r.tagName)).toEqual(['BUTTON', 'BUTTON'])
    expect(rs.map((r) => r.getAttribute('aria-checked'))).toEqual(['true', 'false'])
  })

  it('icon-only options carry their ariaLabel as name and title', () => {
    const c = render()
    const [grid] = radios(c)
    expect(grid.getAttribute('aria-label')).toBe('Grid')
    expect(grid.title).toBe('Grid')
    expect(grid.querySelector('svg')).not.toBeNull()
  })

  it('labelled options show their text (with an optional icon)', () => {
    const c = render({ options: MODES }, 'all')
    expect(radios(c).map((r) => r.textContent)).toEqual(['All', 'Mine', 'Shared'])
    expect(radios(c)[2].querySelector('svg')).not.toBeNull()
  })

  it('the chosen option wears the Button active fill (the ButtonPalette ghost-row look)', () => {
    const c = render()
    const [grid, table] = radios(c)
    expect(grid.style.background).toBe('var(--brand-primary-active)')
    expect(table.style.background).toBe('transparent')
    expect(group(c).style.background).toBe('var(--color-glass-bg)')
  })

  it('only the chosen option is a tab stop; the first is when none is chosen', () => {
    let c = render()
    expect(radios(c).map((r) => r.tabIndex)).toEqual([0, -1])
    c = render({}, null)
    expect(radios(c).map((r) => r.tabIndex)).toEqual([0, -1])
    expect(radios(c).every((r) => r.getAttribute('aria-checked') === 'false')).toBe(true)
  })

  it('clicking an option chooses it; clicking the chosen one reports nothing', () => {
    const onChange = vi.fn()
    const c = render({ onChange })
    act(() => radios(c)[0].click())
    expect(onChange).not.toHaveBeenCalled()
    act(() => radios(c)[1].click())
    expect(onChange).toHaveBeenLastCalledWith('table')
    expect(radios(c)[1].getAttribute('aria-checked')).toBe('true')
  })

  it('arrow keys move, choose and focus, wrapping; Home and End jump', () => {
    const onChange = vi.fn()
    const c = render({ options: MODES, onChange }, 'all')
    act(() => radios(c)[0].focus())
    key(radios(c)[0], 'ArrowRight')
    expect(onChange).toHaveBeenLastCalledWith('mine')
    expect(document.activeElement).toBe(radios(c)[1])
    key(radios(c)[1], 'ArrowDown')
    expect(onChange).toHaveBeenLastCalledWith('shared')
    key(radios(c)[2], 'ArrowRight')
    expect(onChange).toHaveBeenLastCalledWith('all')
    expect(document.activeElement).toBe(radios(c)[0])
    key(radios(c)[0], 'ArrowLeft')
    expect(onChange).toHaveBeenLastCalledWith('shared')
    key(radios(c)[2], 'ArrowUp')
    expect(onChange).toHaveBeenLastCalledWith('mine')
    key(radios(c)[1], 'Home')
    expect(onChange).toHaveBeenLastCalledWith('all')
    key(radios(c)[0], 'End')
    expect(onChange).toHaveBeenLastCalledWith('shared')
    expect(document.activeElement).toBe(radios(c)[2])
  })

  it('disabled disables every option and ignores keys', () => {
    const onChange = vi.fn()
    const c = render({ disabled: true, onChange })
    expect(group(c).getAttribute('aria-disabled')).toBe('true')
    expect(radios(c).every((r) => r.disabled)).toBe(true)
    key(group(c), 'ArrowRight')
    act(() => radios(c)[1].click())
    expect(onChange).not.toHaveBeenCalled()
  })

  it('sizes: sm icon-only is a 28px square, md is 34px', () => {
    const sm = render()
    expect(radios(sm)[0].style.height).toBe('28px')
    expect(radios(sm)[0].style.width).toBe('28px')
    const md = render({ size: 'md' })
    expect(radios(md)[0].style.height).toBe('34px')
    expect(radios(md)[0].style.width).toBe('34px')
  })

  it('surface={false} drops the palette surface', () => {
    const c = render({ surface: false })
    expect(group(c).style.background).toBe('transparent')
  })
})
