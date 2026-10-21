// @vitest-environment jsdom
/**
 * EmptyState tests — React 19 createRoot + act + native DOM events (project convention).
 */
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import type { ReactElement } from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { TbDatabase } from 'react-icons/tb'
import { EmptyState } from './EmptyState.js'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const cleanups: Array<() => void> = []
afterEach(() => {
  cleanups.splice(0).forEach((f) => f())
})

function render(el: ReactElement) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => root.render(el))
  cleanups.push(() => {
    act(() => root.unmount())
    container.remove()
  })
  return container
}

describe('EmptyState', () => {
  it('renders the title alone when nothing else is given', () => {
    const c = render(<EmptyState title="No items yet" />)
    const root = c.querySelector('.ui-empty-state') as HTMLElement
    expect(root.textContent).toBe('No items yet')
    expect(root.style.textAlign).toBe('center')
    expect(root.querySelector('svg')).toBeNull()
    expect(root.querySelector('button')).toBeNull()
  })

  it('renders a decorative icon, the description and the action', () => {
    const onClick = vi.fn()
    const c = render(
      <EmptyState
        icon={<TbDatabase />}
        title="No sources"
        description="Add one to start onboarding a feed."
        action={<button type="button" onClick={onClick}>Add source</button>}
      />,
    )
    const icon = c.querySelector('svg')!.parentElement!
    expect(icon.getAttribute('aria-hidden')).toBe('true')
    expect(c.textContent).toContain('No sources')
    expect(c.textContent).toContain('Add one to start onboarding a feed.')
    act(() => c.querySelector('button')!.click())
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('uses the quiet text tokens: secondary title, muted description and icon', () => {
    const c = render(<EmptyState icon={<TbDatabase />} title="Nothing" description="Try again" />)
    const icon = c.querySelector('svg')!.parentElement as HTMLElement
    expect(icon.style.color).toBe('var(--text-muted)')
    const [title, description] = Array.from(c.querySelectorAll('.ui-empty-state > div')) as HTMLElement[]
    expect(title.style.color).toBe('var(--color-text-secondary)')
    expect(description.style.color).toBe('var(--text-muted)')
  })

  it('has a compact sm size and merges style', () => {
    const c = render(<EmptyState title="Empty" size="sm" style={{ minHeight: 80 }} />)
    const root = c.querySelector('.ui-empty-state') as HTMLElement
    expect((root.firstElementChild as HTMLElement).style.fontSize).toBe('12px')
    expect(root.style.minHeight).toBe('80px')
  })
})
