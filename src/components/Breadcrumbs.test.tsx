// @vitest-environment jsdom
/**
 * Breadcrumbs tests — React 19 createRoot + act + native DOM events (project convention).
 */
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { TbHome } from 'react-icons/tb'
import { Breadcrumbs } from './Breadcrumbs.js'
import type { BreadcrumbsProps } from './Breadcrumbs.js'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const cleanups: Array<() => void> = []
afterEach(() => {
  cleanups.splice(0).forEach((f) => f())
})

function render(props: BreadcrumbsProps) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => root.render(<Breadcrumbs {...props} />))
  cleanups.push(() => {
    act(() => root.unmount())
    container.remove()
  })
  return container
}

const TRAIL: BreadcrumbsProps['items'] = [
  { label: 'Home', href: '/', icon: <TbHome />, hideLabel: true },
  { label: 'LEDGER', href: '/ledger' },
  { label: 'Port of Rotterdam AIS — a very long layer name that will not fit', href: '/ignored' },
]

describe('Breadcrumbs', () => {
  it('is a named nav landmark around an ordered list, one item per crumb', () => {
    const c = render({ items: TRAIL })
    const nav = c.querySelector('nav') as HTMLElement
    expect(nav.getAttribute('aria-label')).toBe('Breadcrumb')
    expect(nav.querySelectorAll('ol > li').length).toBe(3)
  })

  it('renders nothing for an empty trail', () => {
    expect(render({ items: [] }).querySelector('nav')).toBeNull()
  })

  it('links every crumb but the last; the last is the current page', () => {
    const c = render({ items: TRAIL })
    const links = Array.from(c.querySelectorAll('a')) as HTMLAnchorElement[]
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/', '/ledger'])
    const current = c.querySelector('[aria-current="page"]') as HTMLElement
    expect(current.tagName).toBe('SPAN')
    expect(current.textContent).toBe(TRAIL[2].label)
    expect(c.querySelectorAll('[aria-current]').length).toBe(1)
  })

  it('an icon-only crumb is named by its label, with the label as its tooltip', () => {
    const c = render({ items: TRAIL })
    const home = c.querySelector('a[href="/"]') as HTMLAnchorElement
    expect(home.getAttribute('aria-label')).toBe('Home')
    expect(home.title).toBe('Home')
    expect(home.textContent).toBe('')
    expect(home.querySelector('svg')).not.toBeNull()
  })

  it('separates crumbs with hidden TbArrowBadgeRight separators, none after the last', () => {
    const c = render({ items: TRAIL })
    const seps = c.querySelectorAll('svg[data-separator]')
    expect(seps.length).toBe(2)
    seps.forEach((s) => expect(s.getAttribute('aria-hidden')).toBe('true'))
    expect((c.querySelectorAll('li')[2] as HTMLElement).querySelector('svg[data-separator]')).toBeNull()
  })

  it('truncates a long middle label with an ellipsis and keeps the full label as a tooltip', () => {
    const long = 'A workspace with a name long enough to need truncating in the header'
    const c = render({ items: [{ label: 'Home', href: '/' }, { label: long, href: '/x' }, { label: 'Here' }], maxItemWidth: 160 })
    const link = c.querySelector('a[href="/x"]') as HTMLAnchorElement
    expect(link.title).toBe(long)
    expect(link.style.maxWidth).toBe('160px')
    const label = link.querySelector('.ui-breadcrumbs__label') as HTMLElement
    expect(label.style.textOverflow).toBe('ellipsis')
    expect(label.style.whiteSpace).toBe('nowrap')
  })

  it('routes a plain click through onNavigate; an item handler wins over the trail one', () => {
    const trail = vi.fn()
    const own = vi.fn()
    const c = render({
      items: [{ label: 'Home', href: '/' }, { label: 'ADMIN', href: '/admin', onNavigate: own }, { label: 'Settings' }],
      onNavigate: trail,
    })
    const home = c.querySelector('a[href="/"]') as HTMLAnchorElement
    const plain = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    act(() => {
      home.dispatchEvent(plain)
    })
    expect(trail).toHaveBeenCalledWith('/')
    expect(plain.defaultPrevented).toBe(true)
    act(() => (c.querySelector('a[href="/admin"]') as HTMLAnchorElement).click())
    expect(own).toHaveBeenCalledWith('/admin')
    expect(trail).toHaveBeenCalledTimes(1)
  })

  it('leaves a modified click to the browser (open in a new tab)', () => {
    const onNavigate = vi.fn()
    const c = render({ items: TRAIL, onNavigate })
    const e = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ctrlKey: true })
    act(() => {
      ;(c.querySelector('a[href="/ledger"]') as HTMLAnchorElement).dispatchEvent(e)
    })
    expect(onNavigate).not.toHaveBeenCalled()
    expect(e.defaultPrevented).toBe(false)
  })

  it('links are reachable by keyboard (real anchors with href)', () => {
    const c = render({ items: TRAIL })
    const links = Array.from(c.querySelectorAll('a')) as HTMLAnchorElement[]
    links.forEach((a) => expect(a.tabIndex).toBe(0))
  })
})
