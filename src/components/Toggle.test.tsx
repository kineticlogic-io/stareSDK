// @vitest-environment jsdom
/**
 * Toggle tests (87-10, D-20/D-21).
 *
 * Tests use React 19 createRoot + act + native DOM event dispatch (project convention —
 * no @testing-library/react dependency; see Tree.test.tsx / Toast.test.tsx).
 *
 * What is tested (one test per <behavior> bullet in 87-10-PLAN.md Task 1):
 *   (a) renders role="switch" with aria-checked reflecting `value`
 *   (b) clicking calls onChange with the negated value
 *   (c) clicking while disabled does not call onChange
 *   (d) the knob's style uses transform: translateX(...); no `left` transition anywhere
 *   (e) track background is var(--color-accent) on / var(--border-strong) off, unless
 *       overridden by `onColor` (Phase 89 D-04/D-14: the off-track dark wash was
 *       rgba(0,0,0,0.4) pre-Phase-89, which read as near-black on a light page — now
 *       tracked as `--border-strong`, see Toggle.tsx's header comment)
 *   (f) aria-label is applied from the required prop
 */

import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { Toggle } from './Toggle.js'

function renderToggle(props: Partial<React.ComponentProps<typeof Toggle>> & { 'aria-label'?: string } = {}) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const onChange = props.onChange ?? vi.fn()
  act(() => {
    root.render(
      <Toggle
        value={props.value ?? false}
        onChange={onChange}
        disabled={props.disabled}
        onColor={props.onColor}
        aria-label={props['aria-label'] ?? 'Test toggle'}
        size={props.size}
      />,
    )
  })
  return {
    container,
    onChange,
    button: container.querySelector('button') as HTMLButtonElement,
    unmount: () => {
      act(() => { root.unmount() })
      container.remove()
    },
  }
}

function click(el: HTMLElement) {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  })
}

describe('Toggle (D-20/D-21)', () => {
  let unmountFns: Array<() => void> = []

  afterEach(() => {
    unmountFns.forEach(fn => fn())
    unmountFns = []
  })

  it('renders role="switch" with aria-checked reflecting value', () => {
    const off = renderToggle({ value: false })
    unmountFns.push(off.unmount)
    expect(off.button.getAttribute('role')).toBe('switch')
    expect(off.button.getAttribute('aria-checked')).toBe('false')

    const on = renderToggle({ value: true })
    unmountFns.push(on.unmount)
    expect(on.button.getAttribute('aria-checked')).toBe('true')
  })

  it('calls onChange with the negated value on click', () => {
    const { button, onChange, unmount } = renderToggle({ value: false })
    unmountFns.push(unmount)
    click(button)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('does not call onChange when disabled', () => {
    const { button, onChange, unmount } = renderToggle({ value: false, disabled: true })
    unmountFns.push(unmount)
    click(button)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('knob uses transform: translateX and never a left transition', () => {
    const { container, unmount } = renderToggle({ value: true })
    unmountFns.push(unmount)
    const knob = container.querySelector('span') as HTMLSpanElement
    expect(knob.style.transform).toBe('translateX(20px)')
    expect(knob.style.transition).toContain('transform')
    expect(knob.style.transition).not.toContain('left')
  })

  it('track background is var(--color-accent) on / var(--border-strong) off, unless onColor overrides', () => {
    const off = renderToggle({ value: false })
    unmountFns.push(off.unmount)
    expect(off.button.style.background).toBe('var(--border-strong)')

    const on = renderToggle({ value: true })
    unmountFns.push(on.unmount)
    expect(on.button.style.background).toBe('var(--color-accent)')

    const overridden = renderToggle({ value: true, onColor: 'var(--color-warning, #ffb000)' })
    unmountFns.push(overridden.unmount)
    expect(overridden.button.style.background).toBe('var(--color-warning, #ffb000)')
  })

  it('applies aria-label from the required prop', () => {
    const { button, unmount } = renderToggle({ 'aria-label': 'Toggle Disconnected Mode' })
    unmountFns.push(unmount)
    expect(button.getAttribute('aria-label')).toBe('Toggle Disconnected Mode')
  })

  // Phase 115 operator UAT feedback (2026-09-02): added `size="sm"`, ~40% smaller than the
  // default `md`, for compact inline label+switch rows (the kebab's Popups/Historic Mode).
  describe('size variant', () => {
    it('defaults to the original md geometry (48px track, 20px knob travel) when size is omitted', () => {
      const { button, container, unmount } = renderToggle({ value: true })
      unmountFns.push(unmount)
      expect(button.style.width).toBe('48px')
      expect(button.style.height).toBe('26px')
      const knob = container.querySelector('span') as HTMLSpanElement
      expect(knob.style.transform).toBe('translateX(20px)')
    })

    it('size="sm" renders a smaller track and knob travel, roughly 40% smaller than md', () => {
      const { button, container, unmount } = renderToggle({ value: true, size: 'sm' })
      unmountFns.push(unmount)
      expect(button.style.width).toBe('29px')
      expect(button.style.height).toBe('16px')
      const knob = container.querySelector('span') as HTMLSpanElement
      expect(knob.style.transform).toBe('translateX(13px)')
    })

    it('size="sm" still fires onChange with the negated value and reflects aria-checked', () => {
      const { button, onChange, unmount } = renderToggle({ value: false, size: 'sm' })
      unmountFns.push(unmount)
      expect(button.getAttribute('aria-checked')).toBe('false')
      click(button)
      expect(onChange).toHaveBeenCalledWith(true)
    })
  })
})
