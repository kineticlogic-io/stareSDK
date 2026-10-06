/**
 * InfoTip — shown on hover and focus, portaled to <body> above ui/Modal, placed beside the icon.
 * React 19 createRoot + act + native DOM events (project convention — no @testing-library/react).
 */
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, it, expect, afterEach } from 'vitest'
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
})
