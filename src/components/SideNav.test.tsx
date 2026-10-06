// @vitest-environment jsdom
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { SideNav } from './SideNav'
import { DockProvider } from '../context/DockContext'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const cleanups: Array<() => void> = []
afterEach(() => cleanups.splice(0).forEach((f) => f()))
beforeEach(() => localStorage.clear())

function mount(open: boolean, extra: Partial<React.ComponentProps<typeof SideNav>> = {}) {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = createRoot(el)
  const render = (o: boolean) =>
    act(() =>
      root.render(
        <DockProvider>
          <SideNav open={o} ariaLabel="Source detail" width={400} storageKey="t.detail" {...extra}>
            <p>detail</p>
          </SideNav>
        </DockProvider>,
      ),
    )
  render(open)
  cleanups.push(() => {
    act(() => root.unmount())
    el.remove()
  })
  return render
}

const aside = () => document.body.querySelector('aside[aria-label="Source detail"]') as HTMLElement

describe('SideNav', () => {
  it('portals to body, slides by transform and reserves page width while open', () => {
    const render = mount(false)
    expect(aside().parentElement).toBe(document.body)
    expect(aside().getAttribute('aria-hidden')).toBe('true')
    expect(aside().style.transform).toBe('translateX(100%)')
    render(true)
    expect(aside().getAttribute('aria-hidden')).toBe('false')
    expect(aside().style.transform).toBe('translateX(-0px)')
    expect(aside().style.width).toBe('400px')
    expect(document.documentElement.style.getPropertyValue('--assistant-width')).toBe('400px')
    expect(localStorage.getItem('t.detail.open')).toBe('1')
    render(false)
    expect(document.documentElement.style.getPropertyValue('--assistant-width')).toBe('0px')
  })

  it('docks left when asked', () => {
    mount(true, { side: 'left' })
    expect(aside().style.left).toBe('0px')
    expect(document.documentElement.style.getPropertyValue('--dock-left-width')).toBe('400px')
  })
})
