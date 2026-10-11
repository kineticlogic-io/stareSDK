// @vitest-environment jsdom
/**
 * Tree node descriptions (0.2.17, OpenStare#262): a node's `description` shows in a Tooltip while
 * its row is hovered or keyboard-focused, the row points at it with `aria-describedby`, and the
 * label drops its native `title` so the two never show together.
 */
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { Tree } from './Tree.js'
import type { TreeNode } from './Tree.js'

const NODES: TreeNode[] = [
  { id: 'buffer', title: 'Buffer', description: 'Areas within a distance of each feature.' },
  { id: 'plain', title: 'Plain' },
]

let cleanup: (() => void) | null = null
afterEach(() => { cleanup?.(); cleanup = null })

function render(selectable: 'none' | 'single') {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(
      <Tree nodes={NODES} selectable={selectable} checkedIds={new Set()} onCheckedChange={() => {}}
        expandedIds={new Set()} onExpandedChange={() => {}} selectedId={null} onSelect={() => {}} />,
    )
  })
  cleanup = () => { act(() => root.unmount()); container.remove() }
  return container
}

function rowOf(container: HTMLElement, title: string): HTMLElement {
  const span = Array.from(container.querySelectorAll('span')).find(s => s.textContent === title)
  if (!span?.parentElement?.parentElement) throw new Error(`row not found: ${title}`)
  return span.parentElement.parentElement
}

const tooltip = () => document.querySelector('[role="tooltip"]')

describe('Tree descriptions', () => {
  it('shows the description while the row is hovered, and hides it on leave', () => {
    const c = render('none')
    const row = rowOf(c, 'Buffer')
    expect(tooltip()).toBeNull()
    act(() => { row.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 40, clientY: 50 })) })
    expect(tooltip()?.textContent).toBe('Areas within a distance of each feature.')
    expect(row.getAttribute('aria-describedby')).toBe(tooltip()?.id)
    act(() => { row.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body })) })
    expect(tooltip()).toBeNull()
  })

  it('shows the description while a single-select row has keyboard focus', () => {
    const c = render('single')
    const row = rowOf(c, 'Buffer')
    act(() => { row.focus() })
    expect(tooltip()?.textContent).toBe('Areas within a distance of each feature.')
    act(() => { row.blur() })
    expect(tooltip()).toBeNull()
  })

  it('drops the native title only for nodes with a description', () => {
    const c = render('none')
    const titles = Array.from(c.querySelectorAll('span')).filter(s => s.textContent === 'Buffer' || s.textContent === 'Plain')
    expect(titles.find(s => s.textContent === 'Buffer')?.getAttribute('title')).toBeNull()
    expect(titles.find(s => s.textContent === 'Plain')?.getAttribute('title')).toBe('Plain')
  })

  it('a node without a description never shows a tooltip', () => {
    const c = render('none')
    act(() => { rowOf(c, 'Plain').dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 1, clientY: 1 })) })
    expect(tooltip()).toBeNull()
  })
})
