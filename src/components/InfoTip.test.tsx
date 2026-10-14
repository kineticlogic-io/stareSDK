/**
 * InfoTip — shown on hover and focus, portaled to <body> above ui/Modal, placed beside the icon.
 * React 19 createRoot + act + native DOM events (project convention — no @testing-library/react).
 */
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { InfoTip, infoTipPosition } from './InfoTip.js'

let cleanup: (() => void) | null = null
afterEach(() => {
  cleanup?.()
  cleanup = null
})

function mount(node: React.ReactNode) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => root.render(node))
  cleanup = () => {
    act(() => root.unmount())
    container.remove()
  }
  const icon = container.querySelector('[role="button"]') as HTMLElement
  const tip = () => document.querySelector('[role="tooltip"]') as HTMLElement | null
  return { container, icon, tip }
}

describe('InfoTip', () => {
  it('names the icon for assistive technology and shows nothing at rest', () => {
    const { icon, tip } = mount(<InfoTip label="Idle timeout">Minutes without use.</InfoTip>)
    expect(icon.getAttribute('aria-label')).toBe('About Idle timeout')
    expect(icon.tabIndex).toBe(0)
    expect(tip()).toBeNull()
  })

  it('shows on hover, portaled to body above a Modal, and hides on leave', () => {
    const { container, icon, tip } = mount(<InfoTip label="Gate">Chi-square gate.</InfoTip>)
    act(() => {
      icon.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    })
    const t = tip()
    expect(t?.textContent).toBe('Chi-square gate.')
    expect(t?.parentElement).toBe(document.body)
    expect(container.contains(t)).toBe(false)
    expect(Number(t?.style.zIndex)).toBeGreaterThan(5000)
    expect(t?.style.pointerEvents).toBe('none')
    act(() => {
      icon.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }))
    })
    expect(tip()).toBeNull()
  })

  it('shows on keyboard focus too', () => {
    const { icon, tip } = mount(<InfoTip label="Stale">Seconds.</InfoTip>)
    act(() => icon.focus())
    expect(tip()?.textContent).toBe('Seconds.')
    act(() => icon.blur())
    expect(tip()).toBeNull()
  })

  it('takes a zIndex', () => {
    const { icon, tip } = mount(
      <InfoTip label="x" zIndex={6000}>
        y
      </InfoTip>,
    )
    act(() => icon.focus())
    expect(tip()?.style.zIndex).toBe('6000')
  })

  it('goes right of the icon when it fits, else left, and stays on screen', () => {
    expect(infoTipPosition({ left: 100, right: 114, top: 50 }, 320, 1200)).toEqual({ left: 122, top: 44 })
    expect(infoTipPosition({ left: 1000, right: 1014, top: 50 }, 320, 1200)).toEqual({ left: 672, top: 44 })
    expect(infoTipPosition({ left: 100, right: 114, top: 2 }, 320, 300)).toEqual({ left: 8, top: 8 })
  })

  describe('interactive (0.2.19)', () => {
    const dialog = () => document.querySelector('[role="dialog"]') as HTMLElement | null
    const linkTip = (onClick = vi.fn()) =>
      mount(
        <InfoTip label="OpenStare" interactive>
          About.{' '}
          <a href="/docs" onClick={(e) => { e.preventDefault(); onClick() }}>
            API Docs
          </a>
        </InfoTip>,
      )

    it('takes pointer input, reports aria-expanded, and is a dialog named by its label', () => {
      const { icon } = linkTip()
      expect(icon.getAttribute('aria-expanded')).toBe('false')
      act(() => icon.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })))
      const d = dialog()
      expect(d?.getAttribute('aria-label')).toBe('OpenStare')
      expect(d?.style.pointerEvents).toBe('auto')
      expect(icon.getAttribute('aria-expanded')).toBe('true')
      expect(document.querySelector('[role="tooltip"]')).toBeNull()
    })

    it('stays open while the pointer crosses from the icon into the bubble, and its link clicks', () => {
      vi.useFakeTimers()
      try {
        const onClick = vi.fn()
        const { icon } = linkTip(onClick)
        act(() => icon.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })))
        act(() => icon.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: dialog() })))
        act(() => dialog()!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })))
        act(() => { vi.advanceTimersByTime(1000) })
        expect(dialog()).not.toBeNull()
        const link = dialog()!.querySelector('a') as HTMLAnchorElement
        expect(link.getAttribute('href')).toBe('/docs')
        act(() => link.click())
        expect(onClick).toHaveBeenCalledTimes(1)
        // A click inside the bubble does not pin it (it is not a click on the icon).
        expect(icon.getAttribute('aria-expanded')).toBe('true')
        act(() => dialog()!.dispatchEvent(new MouseEvent('mouseout', { bubbles: true })))
        act(() => { vi.advanceTimersByTime(1000) })
        expect(dialog()).toBeNull()
      } finally {
        vi.useRealTimers()
      }
    })

    it('a click pins it open; Escape closes it', () => {
      vi.useFakeTimers()
      try {
        const { icon } = linkTip()
        act(() => icon.click())
        act(() => icon.dispatchEvent(new MouseEvent('mouseout', { bubbles: true })))
        act(() => { vi.advanceTimersByTime(1000) })
        expect(dialog()).not.toBeNull()
        act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
        expect(dialog()).toBeNull()
        expect(icon.getAttribute('aria-expanded')).toBe('false')
      } finally {
        vi.useRealTimers()
      }
    })

    it('Enter pins it from the keyboard; a press outside closes it', () => {
      const { icon } = linkTip()
      act(() => icon.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
      expect(dialog()).not.toBeNull()
      act(() => dialog()!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })))
      expect(dialog()).not.toBeNull()
      act(() => document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })))
      expect(dialog()).toBeNull()
    })

    it('without interactive, a click does nothing and the bubble stays a pointer-transparent tooltip', () => {
      const { icon, tip } = mount(<InfoTip label="x">y</InfoTip>)
      expect(icon.getAttribute('aria-expanded')).toBeNull()
      act(() => icon.click())
      expect(tip()).toBeNull()
    })
  })
})
