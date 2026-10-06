// @vitest-environment jsdom
import { createRoot } from 'react-dom/client'
import { act, useState } from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { TabPanel, Tabs } from './Tabs'

const cleanups: Array<() => void> = []
afterEach(() => {
  cleanups.splice(0).forEach((f) => f())
})

function Harness() {
  const [v, setV] = useState('a')
  return (
    <>
      <Tabs
        aria-label="Views"
        idPrefix="t"
        value={v}
        onChange={setV}
        tabs={[
          { id: 'a', label: 'Sources', count: 3 },
          { id: 'b', label: 'Schema', disabled: true },
          { id: 'c', label: 'Registry' },
        ]}
      />
      <TabPanel id={v} idPrefix="t">
        panel {v}
      </TabPanel>
    </>
  )
}

function render() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => root.render(<Harness />))
  cleanups.push(() => {
    act(() => root.unmount())
    container.remove()
  })
  return container
}

describe('Tabs', () => {
  it('wires tabs to panels and keeps one tab in the tab order', () => {
    const c = render()
    const tabs = c.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    expect(tabs[0].getAttribute('aria-selected')).toBe('true')
    expect(tabs[0].tabIndex).toBe(0)
    expect(tabs[2].tabIndex).toBe(-1)
    expect(tabs[0].textContent).toBe('Sources3')
    const panel = c.querySelector('[role="tabpanel"]')!
    expect(panel.getAttribute('aria-labelledby')).toBe(tabs[0].id)
    expect(tabs[0].getAttribute('aria-controls')).toBe(panel.id)
  })

  it('arrow keys skip disabled tabs and wrap; clicking selects', () => {
    const c = render()
    const list = c.querySelector('[role="tablist"]')!
    act(() => {
      list.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    })
    expect(c.querySelector('[role="tabpanel"]')!.textContent).toBe('panel c')
    act(() => {
      list.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    })
    expect(c.querySelector('[role="tabpanel"]')!.textContent).toBe('panel a')
    const tabs = c.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    act(() => tabs[1].click())
    expect(c.querySelector('[role="tabpanel"]')!.textContent).toBe('panel a')
    act(() => tabs[2].click())
    expect(c.querySelector('[role="tabpanel"]')!.textContent).toBe('panel c')
  })

  it('bar variant is the page tab bar: glass, 40px, uppercase accent selection', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const root = createRoot(el)
    act(() =>
      root.render(
        <Tabs
          aria-label="Workspaces"
          variant="bar"
          value="a"
          onChange={() => {}}
          tabs={[
            { id: 'a', label: 'Sources' },
            { id: 'b', label: 'Schema' },
          ]}
        />,
      ),
    )
    const list = el.querySelector('[role="tablist"]') as HTMLElement
    expect(list.style.height).toBe('40px')
    expect(list.style.background).toBe('var(--color-glass-bg)')
    const [a, b] = Array.from(el.querySelectorAll('[role="tab"]')) as HTMLElement[]
    expect(a.style.textTransform).toBe('uppercase')
    expect(a.style.color).toBe('var(--color-accent)')
    expect(a.style.fontWeight).toBe('600')
    expect(b.style.color).toBe('var(--color-text-secondary)')
    expect(b.style.fontWeight).toBe('400')
    act(() => root.unmount())
    el.remove()
  })

  it('shows a notification bubble only when something waits, capped at 99+', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const root = createRoot(el)
    const draw = (badge: number | undefined) =>
      act(() =>
        root.render(
          <Tabs
            aria-label="Workspaces"
            value="a"
            onChange={() => {}}
            tabs={[
              { id: 'a', label: 'Sources' },
              { id: 'b', label: 'Correlation', badge, badgeLabel: badge ? `${badge} pending` : undefined },
            ]}
          />,
        ),
      )
    draw(3)
    let bubble = el.querySelector('.ui-tabs__badge') as HTMLElement
    expect(bubble.textContent).toBe('3')
    expect(bubble.getAttribute('aria-label')).toBe('3 pending')
    expect(bubble.style.background).toBe('var(--color-accent)')
    draw(250)
    bubble = el.querySelector('.ui-tabs__badge') as HTMLElement
    expect(bubble.textContent).toBe('99+')
    draw(0)
    expect(el.querySelector('.ui-tabs__badge')).toBeNull()
    draw(undefined)
    expect(el.querySelector('.ui-tabs__badge')).toBeNull()
    act(() => root.unmount())
    el.remove()
  })
})
