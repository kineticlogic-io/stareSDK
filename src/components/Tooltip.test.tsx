// @vitest-environment jsdom
/**
 * Tooltip.test.tsx — Phase 118 Plan 03, Task 3.
 *
 * Tests use React 19 createRoot + act + native DOM (project convention — no
 * @testing-library/react dependency; see Toggle.test.tsx / Tree.test.tsx).
 */
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { Tooltip } from './Tooltip'

function renderTooltip(props: Partial<React.ComponentProps<typeof Tooltip>> = {}) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(
      <Tooltip
        x={props.x ?? 100}
        y={props.y ?? 200}
        content={props.content ?? 'Hello'}
        zIndex={props.zIndex}
      />,
    )
  })
  return {
    container,
    unmount: () => { act(() => { root.unmount() }); container.remove() },
  }
}

describe('Tooltip (Phase 118 D-13/P-L)', () => {
  let unmountFns: Array<() => void> = []
  afterEach(() => {
    unmountFns.forEach(fn => fn())
    unmountFns = []
  })

  it('renders nothing for an empty content string', () => {
    const { container, unmount } = renderTooltip({ content: '' })
    unmountFns.push(unmount)
    expect(container.innerHTML).toBe('')
    expect(document.querySelector('[role="tooltip"]')).toBeNull()
  })

  it('renders exactly one role="tooltip" element containing the content verbatim', () => {
    const { unmount } = renderTooltip({ content: 'Runway 27L' })
    unmountFns.push(unmount)
    const nodes = document.querySelectorAll('[role="tooltip"]')
    expect(nodes.length).toBe(1)
    expect(nodes[0].textContent).toBe('Runway 27L')
  })

  it('renders as a child of document.body, not the component container', () => {
    const { container, unmount } = renderTooltip()
    unmountFns.push(unmount)
    const node = document.querySelector('[role="tooltip"]') as HTMLElement
    expect(node.parentElement).toBe(document.body)
    expect(container.contains(node)).toBe(false)
  })

  it('sets pointerEvents: none and position: fixed inline', () => {
    const { unmount } = renderTooltip()
    unmountFns.push(unmount)
    const node = document.querySelector('[role="tooltip"]') as HTMLElement
    expect(node.style.pointerEvents).toBe('none')
    expect(node.style.position).toBe('fixed')
  })

  it('offsets the rendered position by +16 horizontally and -16 vertically from x/y', () => {
    const { unmount } = renderTooltip({ x: 100, y: 200 })
    unmountFns.push(unmount)
    const node = document.querySelector('[role="tooltip"]') as HTMLElement
    expect(node.style.left).toBe('116px')
    expect(node.style.top).toBe('184px')
  })

  it('defaults zIndex to 4200', () => {
    const { unmount } = renderTooltip()
    unmountFns.push(unmount)
    const defaultNode = document.querySelector('[role="tooltip"]') as HTMLElement
    expect(defaultNode.style.zIndex).toBe('4200')
  })

  it('a supplied zIndex overrides the default', () => {
    const { unmount } = renderTooltip({ zIndex: 100 })
    unmountFns.push(unmount)
    const overriddenNode = document.querySelector('[role="tooltip"]') as HTMLElement
    expect(overriddenNode.style.zIndex).toBe('100')
  })
})
