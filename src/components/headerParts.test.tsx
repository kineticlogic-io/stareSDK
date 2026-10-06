// @vitest-environment jsdom
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { AssistantButton } from './AssistantButton'
import { HomeButton } from './HomeButton'
import { AppCard } from './AppCard'
import { ClassificationBanner, BANNER_HEIGHT_PX } from './ClassificationBanner'
import { ClockBadges } from './ClockBadges'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const cleanups: Array<() => void> = []
afterEach(() => cleanups.splice(0).forEach((f) => f()))

function mount(ui: React.ReactNode) {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = createRoot(el)
  act(() => root.render(ui))
  cleanups.push(() => {
    act(() => root.unmount())
    el.remove()
  })
  return el
}

function click(el: Element, init: MouseEventInit = {}): MouseEvent {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init })
  act(() => { el.dispatchEvent(event) })
  return event
}

describe('AssistantButton (#31: props only)', () => {
  it('reflects `open` as pressed and calls onToggle', () => {
    const onToggle = vi.fn()
    const el = mount(<AssistantButton open onToggle={onToggle} />)
    const button = el.querySelector('button') as HTMLButtonElement
    expect(button.getAttribute('aria-pressed')).toBe('true')
    click(button)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })
})

describe('HomeButton (#31: router-free link)', () => {
  it('is a real link to / by default', () => {
    const el = mount(<HomeButton />)
    expect(el.querySelector('a')?.getAttribute('href')).toBe('/')
  })

  it('hands a plain click to onNavigate instead of a full page load', () => {
    const onNavigate = vi.fn()
    const el = mount(<HomeButton href="/home" onNavigate={onNavigate} />)
    const event = click(el.querySelector('a') as HTMLAnchorElement)
    expect(onNavigate).toHaveBeenCalledWith('/home')
    expect(event.defaultPrevented).toBe(true)
  })

  it('leaves a Ctrl/⌘-click to the browser so it can open a new tab', () => {
    const onNavigate = vi.fn()
    const el = mount(<HomeButton onNavigate={onNavigate} />)
    const a = el.querySelector('a') as HTMLAnchorElement
    for (const mod of [{ ctrlKey: true }, { metaKey: true }]) {
      const event = click(a, mod)
      expect(event.defaultPrevented).toBe(false)
    }
    expect(onNavigate).not.toHaveBeenCalled()
  })
})

describe('AppCard (#31)', () => {
  it('links to its route and routes a plain click through onNavigate', () => {
    const onNavigate = vi.fn()
    const el = mount(<AppCard label="Apex" icon={<i>icon</i>} href="/apex" description="Command map" onNavigate={onNavigate} />)
    const a = el.querySelector('a') as HTMLAnchorElement
    expect(a.getAttribute('href')).toBe('/apex')
    expect(a.textContent).toContain('Apex')
    expect(a.textContent).toContain('Command map')
    click(a)
    expect(onNavigate).toHaveBeenCalledWith('/apex')
  })

  it('a disabled card has no link and explains why', () => {
    const el = mount(<AppCard label="Vantage" icon={<i>icon</i>} href="/vantage" disabled disabledTooltip="No imagery server" />)
    expect(el.querySelector('a')).toBeNull()
    const card = el.firstElementChild as HTMLElement
    expect(card.getAttribute('aria-disabled')).toBe('true')
    expect(card.getAttribute('title')).toBe('No imagery server')
  })
})

describe('ClassificationBanner (#31: props only)', () => {
  it('renders the marking in fixed top and bottom strips', () => {
    const el = mount(<ClassificationBanner enabled text="UNCLASSIFIED" background="green" color="white" />)
    const strips = Array.from(el.children) as HTMLElement[]
    expect(strips).toHaveLength(2)
    expect(strips.map(s => s.textContent)).toEqual(['UNCLASSIFIED', 'UNCLASSIFIED'])
    expect(strips[0].style.top).toBe('0px')
    expect(strips[1].style.bottom).toBe('0px')
    expect(strips[0].style.height).toBe(`${BANNER_HEIGHT_PX}px`)
    expect(strips[0].style.background).toBe('green')
  })

  it('renders nothing when disabled', () => {
    const el = mount(<ClassificationBanner enabled={false} text="SECRET" background="red" color="white" />)
    expect(el.children).toHaveLength(0)
  })
})

describe('ClockBadges (#31: props only)', () => {
  it('renders nothing while the configuration is unknown, or for a deliberate "no clocks"', () => {
    expect(mount(<ClockBadges clocks={null} />).children).toHaveLength(0)
    expect(mount(<ClockBadges clocks={[]} />).children).toHaveLength(0)
  })

  it('renders one badge per clock, using the label in place of the zone abbreviation', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1600 })
    const el = mount(<ClockBadges clocks={[{ timezone: 'UTC', label: 'HQ' }, { timezone: 'UTC' }]} />)
    const badges = Array.from(el.querySelectorAll('[aria-label^="Clock:"]'))
    expect(badges).toHaveLength(2)
    expect(badges[0].textContent).toMatch(/^HQ \d{2}:\d{2}:\d{2}$/)
  })

  it('shows at most 5 badges', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1600 })
    const clocks = Array.from({ length: 7 }, () => ({ timezone: 'UTC' }))
    const el = mount(<ClockBadges clocks={clocks} />)
    expect(el.querySelectorAll('[aria-label^="Clock:"]')).toHaveLength(5)
  })
})
