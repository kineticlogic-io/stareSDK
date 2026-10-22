// @vitest-environment jsdom
/**
 * PersonChip tests — React 19 createRoot + act + native DOM events (project convention).
 */
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { PersonChip } from './PersonChip.js'
import type { PersonChipProps } from './PersonChip.js'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const cleanups: Array<() => void> = []
afterEach(() => {
  cleanups.splice(0).forEach((f) => f())
})

function render(props: Partial<PersonChipProps> = {}) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => root.render(<PersonChip name="Dana Ellis" {...props} />))
  cleanups.push(() => {
    act(() => root.unmount())
    container.remove()
  })
  return container
}

const chip = (c: HTMLElement) => c.querySelector('.ui-person-chip') as HTMLElement
const avatar = (c: HTMLElement) => chip(c).firstElementChild!.firstElementChild as HTMLElement

describe('PersonChip', () => {
  it('without onClick it is plain text: no button, no role, not focusable', () => {
    const c = render()
    expect(c.querySelector('button')).toBeNull()
    expect(chip(c).tagName).toBe('SPAN')
    expect(chip(c).getAttribute('role')).toBeNull()
    expect(chip(c).hasAttribute('tabindex')).toBe(false)
    expect(chip(c).hasAttribute('aria-label')).toBe(false)
    expect(chip(c).classList.contains('ui-person-chip--interactive')).toBe(false)
    expect(chip(c).textContent).toBe('D' + 'Dana Ellis')
  })

  it('with onClick it is ONE button holding the avatar and the name, and a click calls onClick', () => {
    const onClick = vi.fn()
    const c = render({ onClick })
    const buttons = c.querySelectorAll('button')
    expect(buttons).toHaveLength(1)
    const button = buttons[0]
    expect(button).toBe(chip(c))
    expect(button.type).toBe('button')
    expect(button.classList.contains('ui-person-chip--interactive')).toBe(true)
    expect(button.querySelector('.ui-person-chip__name')!.textContent).toBe('Dana Ellis')
    expect(button.querySelector('[role="img"]')).not.toBeNull()
    act(() => button.click())
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('the button is named "Show <name>\'s profile" by default; ariaLabel overrides it', () => {
    expect(render({ onClick: () => {} }).querySelector('button')!.getAttribute('aria-label')).toBe("Show Dana Ellis's profile")
    expect(render({ onClick: () => {}, ariaLabel: 'Open Dana' }).querySelector('button')!.getAttribute('aria-label')).toBe('Open Dana')
  })

  it('the avatar is decorative (the name is beside it)', () => {
    const c = render({ onClick: () => {} })
    expect(chip(c).firstElementChild!.getAttribute('aria-hidden')).toBe('true')
  })

  it('sm (default) is a 16 px avatar, md a 20 px avatar, each with a fitting initials size', () => {
    const sm = render()
    expect(avatar(sm).style.width).toBe('16px')
    expect(avatar(sm).style.fontSize).toBe('8px')
    expect(chip(sm).classList.contains('ui-person-chip--sm')).toBe(true)
    const md = render({ size: 'md' })
    expect(avatar(md).style.width).toBe('20px')
    expect(avatar(md).style.height).toBe('20px')
    expect(avatar(md).style.fontSize).toBe('10px')
    expect(chip(md).classList.contains('ui-person-chip--md')).toBe(true)
  })

  it('renders the avatar image when given, and username drives the initials fallback', () => {
    const img = render({ avatarSrc: '/avatars/dana.png' }).querySelector('img') as HTMLImageElement
    expect(img.getAttribute('src')).toBe('/avatars/dana.png')
    expect(avatar(render({ username: 'xavier' })).textContent).toBe('X')
  })

  it('inherits typography so it sits inline in a sentence', () => {
    for (const c of [render(), render({ onClick: () => {} })]) {
      expect(chip(c).style.font).toBe('inherit')
      expect(chip(c).style.color).toBe('inherit')
      expect(chip(c).style.display).toBe('inline-flex')
    }
  })

  it('subtitle adds a small secondary second line', () => {
    const c = render({ subtitle: 'Senior Analyst' })
    const sub = c.querySelector('.ui-person-chip__subtitle') as HTMLElement
    expect(sub.textContent).toBe('Senior Analyst')
    expect(sub.style.color).toBe('var(--color-text-secondary)')
    expect(render().querySelector('.ui-person-chip__subtitle')).toBeNull()
  })

  it('style is applied to the chip', () => {
    expect(chip(render({ style: { fontSize: 12 } })).style.fontSize).toBe('12px')
  })
})
