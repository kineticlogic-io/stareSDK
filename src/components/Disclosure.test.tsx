// @vitest-environment jsdom
/**
 * Disclosure tests — React 19 createRoot + act + native DOM events (project convention; no
 * @testing-library/react), matching DataTable.test.tsx's harness.
 */
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { Disclosure } from './Disclosure.js'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const cleanups: Array<() => void> = []
afterEach(() => {
  cleanups.splice(0).forEach((f) => f())
})

function render(ui: React.ReactElement) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => root.render(ui))
  cleanups.push(() => {
    act(() => root.unmount())
    container.remove()
  })
  return container
}

describe('Disclosure', () => {
  it('renders closed by default: aria-expanded="false" and children not in the DOM', () => {
    const c = render(
      <Disclosure label="SOURCES">
        <span>aisstream</span>
      </Disclosure>,
    )
    const toggle = c.querySelector('button.ui-disclosure__toggle') as HTMLButtonElement
    expect(toggle).toBeTruthy()
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(c.textContent).not.toContain('aisstream')
  })

  it('clicking the header toggles aria-expanded and mounts/unmounts the children', () => {
    const c = render(
      <Disclosure label="SOURCES">
        <span>aisstream</span>
      </Disclosure>,
    )
    const toggle = c.querySelector('button.ui-disclosure__toggle') as HTMLButtonElement

    act(() => { toggle.click() })
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(c.textContent).toContain('aisstream')

    act(() => { toggle.click() })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(c.textContent).not.toContain('aisstream')
  })

  it('defaultOpen renders open initially', () => {
    const c = render(
      <Disclosure label="SOURCES" defaultOpen>
        <span>aisstream</span>
      </Disclosure>,
    )
    const toggle = c.querySelector('button.ui-disclosure__toggle') as HTMLButtonElement
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(c.textContent).toContain('aisstream')
  })

  it('the header is a native button, so Enter/Space activation (button.click()) toggles it', () => {
    const c = render(
      <Disclosure label="SOURCES">
        <span>aisstream</span>
      </Disclosure>,
    )
    const toggle = c.querySelector('button.ui-disclosure__toggle') as HTMLButtonElement
    expect(toggle.tagName).toBe('BUTTON')
    expect(toggle.type).toBe('button')
    act(() => { toggle.click() })
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
  })

  it('renders the given label node', () => {
    const c = render(
      <Disclosure label="IDENTIFIERS">
        <span>x</span>
      </Disclosure>,
    )
    expect(c.textContent).toContain('IDENTIFIERS')
  })

  it('aria-controls on the button matches the id of the content region', () => {
    const c = render(
      <Disclosure label="SOURCES" defaultOpen>
        <span>aisstream</span>
      </Disclosure>,
    )
    const toggle = c.querySelector('button.ui-disclosure__toggle') as HTMLButtonElement
    const controlsId = toggle.getAttribute('aria-controls')
    expect(controlsId).toBeTruthy()
    const content = document.getElementById(controlsId as string)
    expect(content).toBeTruthy()
    expect(content?.textContent).toContain('aisstream')
  })

  it('the chevron rotates via transform only, closed at 0deg and open at 90deg, with a transform-only transition', () => {
    const c = render(
      <Disclosure label="SOURCES">
        <span>aisstream</span>
      </Disclosure>,
    )
    const toggle = c.querySelector('button.ui-disclosure__toggle') as HTMLButtonElement
    const chevronWrap = toggle.querySelector('span[aria-hidden]') as HTMLSpanElement
    expect(chevronWrap.style.transform).toBe('rotate(0deg)')
    expect(chevronWrap.style.transition).toBe('transform 120ms ease')

    act(() => { toggle.click() })
    expect(chevronWrap.style.transform).toBe('rotate(90deg)')
  })
})
