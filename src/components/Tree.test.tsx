// @vitest-environment jsdom
/**
 * Tree.test.tsx — Phase 81 Plan 04, Task 2 (D-30).
 *
 * Tests use React 19 createRoot + act + native DOM event dispatch (project convention — no
 * @testing-library/react, see SortableList.test.tsx / TypeaheadPicker.test.tsx /
 * FileDropZone.test.tsx).
 *
 * Fixture: one root with two children — 'child-a' (expandable, one grandchild 'grandchild-a1')
 * and 'child-b' (disabled, with a disabledReason).
 *
 * Every assertion targets a real DOM signal (attribute, text, or handler invocation) — no
 * snapshot-only assertions.
 */
import { createRoot } from 'react-dom/client'
import { act, useState } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { Tree } from './Tree.js'
import type { TreeNode, TreeSelectable } from './Tree.js'

const FIXTURE: TreeNode[] = [
  {
    id: 'root',
    title: 'Root',
    children: [
      {
        id: 'child-a',
        title: 'Child A',
        children: [{ id: 'grandchild-a1', title: 'Grandchild A1' }],
      },
      {
        id: 'child-b',
        title: 'Child B',
        disabled: true,
        disabledReason: 'Not available',
      },
    ],
  },
]

interface HarnessProps {
  selectable: TreeSelectable
  onSelect?: (id: string) => void
  onCheckedChange?: (id: string, checked: boolean) => void
  onExpandedChange?: (id: string, expanded: boolean) => void
  initialExpandedIds?: string[]
  initialCheckedIds?: string[]
  initialSelectedId?: string | null
}

function Harness({
  selectable,
  onSelect,
  onCheckedChange,
  onExpandedChange,
  initialExpandedIds = [],
  initialCheckedIds = [],
  initialSelectedId = null,
}: HarnessProps) {
  const [expandedIds, setExpandedIds] = useState(new Set(initialExpandedIds))
  const [checkedIds, setCheckedIds] = useState(new Set(initialCheckedIds))
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId)

  return (
    <Tree
      nodes={FIXTURE}
      selectable={selectable}
      checkedIds={checkedIds}
      onCheckedChange={(id, checked) => {
        setCheckedIds(prev => {
          const next = new Set(prev)
          if (checked) next.add(id)
          else next.delete(id)
          return next
        })
        onCheckedChange?.(id, checked)
      }}
      expandedIds={expandedIds}
      onExpandedChange={(id, expanded) => {
        setExpandedIds(prev => {
          const next = new Set(prev)
          if (expanded) next.add(id)
          else next.delete(id)
          return next
        })
        onExpandedChange?.(id, expanded)
      }}
      selectedId={selectable === 'single' ? selectedId : undefined}
      onSelect={
        selectable === 'single'
          ? (id: string) => {
              setSelectedId(id)
              onSelect?.(id)
            }
          : undefined
      }
    />
  )
}

function renderHarness(props: HarnessProps) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(<Harness {...props} />)
  })
  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
}

/** The title `<span title="...">` for a node — unique per fixture title. */
function findTitleSpan(container: HTMLElement, title: string): HTMLElement {
  const spans = Array.from(container.querySelectorAll('span'))
  const match = spans.find(s => s.textContent === title && s.getAttribute('title') === title)
  if (!match) throw new Error(`title span not found: ${title}`)
  return match
}

/** The clickable row `<div>` (title span's grandparent) for a node. */
function findRow(container: HTMLElement, title: string): HTMLElement {
  const span = findTitleSpan(container, title)
  const row = span.parentElement?.parentElement
  if (!row) throw new Error(`row not found: ${title}`)
  return row
}

function findExpander(container: HTMLElement, title: string): HTMLElement {
  const el =
    container.querySelector(`[aria-label="Expand ${title}"]`) ??
    container.querySelector(`[aria-label="Collapse ${title}"]`)
  if (!el) throw new Error(`expander not found: ${title}`)
  return el as HTMLElement
}

function findCheckbox(container: HTMLElement, title: string): HTMLElement {
  const el = container.querySelector(`[role="checkbox"][aria-label="${title}"]`)
  if (!el) throw new Error(`checkbox not found: ${title}`)
  return el as HTMLElement
}

function click(el: HTMLElement) {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  })
}

function keydown(el: HTMLElement, key: string) {
  act(() => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  })
}

describe('Tree — selectable="single" (D-30)', () => {
  let unmountFns: Array<() => void> = []

  afterEach(() => {
    unmountFns.forEach(fn => fn())
    unmountFns = []
    vi.restoreAllMocks()
  })

  it('clicking a row calls onSelect exactly once with that node id', () => {
    const onSelect = vi.fn()
    const { container, unmount } = renderHarness({
      selectable: 'single',
      onSelect,
      initialExpandedIds: ['root'],
    })
    unmountFns.push(unmount)

    click(findRow(container, 'Child A'))

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith('child-a')
  })

  it('clicking a row whose node is disabled does NOT call onSelect', () => {
    const onSelect = vi.fn()
    const { container, unmount } = renderHarness({
      selectable: 'single',
      onSelect,
      initialExpandedIds: ['root'],
    })
    unmountFns.push(unmount)

    click(findRow(container, 'Child B'))

    expect(onSelect).not.toHaveBeenCalled()
  })

  it('the row matching selectedId carries aria-selected="true"; other selectable rows carry "false"; the disabled row has no aria-selected at all', () => {
    const { container, unmount } = renderHarness({
      selectable: 'single',
      initialExpandedIds: ['root'],
      initialSelectedId: 'child-a',
    })
    unmountFns.push(unmount)

    expect(findRow(container, 'Root').getAttribute('aria-selected')).toBe('false')
    expect(findRow(container, 'Child A').getAttribute('aria-selected')).toBe('true')
    expect(findRow(container, 'Child B').hasAttribute('aria-selected')).toBe(false)
  })

  it('pressing Enter on a row calls onSelect with that node id', () => {
    const onSelect = vi.fn()
    const { container, unmount } = renderHarness({
      selectable: 'single',
      onSelect,
      initialExpandedIds: ['root'],
    })
    unmountFns.push(unmount)

    keydown(findRow(container, 'Child A'), 'Enter')

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith('child-a')
  })

  it('clicking the expand/collapse chevron of a parent row calls onExpandedChange and does NOT call onSelect', () => {
    const onSelect = vi.fn()
    const onExpandedChange = vi.fn()
    const { container, unmount } = renderHarness({
      selectable: 'single',
      onSelect,
      onExpandedChange,
    })
    unmountFns.push(unmount)

    click(findExpander(container, 'Root'))

    expect(onExpandedChange).toHaveBeenCalledTimes(1)
    expect(onExpandedChange).toHaveBeenCalledWith('root', true)
    expect(onSelect).not.toHaveBeenCalled()
  })
})

describe('Tree — selectable="multi" regression (no selectedId/onSelect passed, D-30 must not affect this path)', () => {
  let unmountFns: Array<() => void> = []

  afterEach(() => {
    unmountFns.forEach(fn => fn())
    unmountFns = []
    vi.restoreAllMocks()
  })

  it('no rendered element has an aria-selected attribute', () => {
    const { container, unmount } = renderHarness({
      selectable: 'multi',
      initialExpandedIds: ['root', 'child-a'],
    })
    unmountFns.push(unmount)

    expect(container.querySelectorAll('[aria-selected]').length).toBe(0)
  })

  it('clicking a row body does not throw and does not toggle any checkbox state', () => {
    const onCheckedChange = vi.fn()
    const { container, unmount } = renderHarness({
      selectable: 'multi',
      onCheckedChange,
      initialExpandedIds: ['root'],
    })
    unmountFns.push(unmount)

    expect(() => click(findRow(container, 'Child A'))).not.toThrow()
    expect(onCheckedChange).not.toHaveBeenCalled()
  })

  it('the single-select onSelect callback, even if a caller supplied one, is never invoked when selectable="multi" (row onClick must stay gated on selectable === "single")', () => {
    const onSelect = vi.fn()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    act(() => {
      root.render(
        <Tree
          nodes={FIXTURE}
          selectable="multi"
          checkedIds={new Set()}
          onCheckedChange={() => {}}
          expandedIds={new Set(['root'])}
          onExpandedChange={() => {}}
          // Deliberately supplied even though real multi-select consumers never pass this —
          // proves the row onClick handler itself is gated, not merely that the prop is absent.
          onSelect={onSelect}
        />,
      )
    })
    unmountFns.push(() => {
      act(() => {
        root.unmount()
      })
      container.remove()
    })

    click(findRow(container, 'Child A'))

    expect(onSelect).not.toHaveBeenCalled()
  })

  it('toggling a leaf checkbox calls onCheckedChange with (id, true)', () => {
    const onCheckedChange = vi.fn()
    const { container, unmount } = renderHarness({
      selectable: 'multi',
      onCheckedChange,
      initialExpandedIds: ['root', 'child-a'],
    })
    unmountFns.push(unmount)

    click(findCheckbox(container, 'Grandchild A1'))

    expect(onCheckedChange).toHaveBeenCalledWith('grandchild-a1', true)
  })

  it('a parent whose children are partially checked renders the tri-state indeterminate signal (aria-checked="mixed")', () => {
    const { container, unmount } = renderHarness({
      selectable: 'multi',
      initialExpandedIds: ['root', 'child-a'],
      initialCheckedIds: ['grandchild-a1'],
    })
    unmountFns.push(unmount)

    expect(findCheckbox(container, 'Child A').getAttribute('aria-checked')).toBe('mixed')
  })

  it('expand/collapse still calls onExpandedChange', () => {
    const onExpandedChange = vi.fn()
    const { container, unmount } = renderHarness({
      selectable: 'multi',
      onExpandedChange,
    })
    unmountFns.push(unmount)

    click(findExpander(container, 'Root'))

    expect(onExpandedChange).toHaveBeenCalledTimes(1)
    expect(onExpandedChange).toHaveBeenCalledWith('root', true)
  })
})

describe('Tree — selectable="none"', () => {
  let unmountFns: Array<() => void> = []

  afterEach(() => {
    unmountFns.forEach(fn => fn())
    unmountFns = []
    vi.restoreAllMocks()
  })

  it('renders no checkbox and no aria-selected attribute on any row', () => {
    const { container, unmount } = renderHarness({
      selectable: 'none',
      initialExpandedIds: ['root', 'child-a'],
    })
    unmountFns.push(unmount)

    expect(container.querySelectorAll('[role="checkbox"]').length).toBe(0)
    expect(container.querySelectorAll('[aria-selected]').length).toBe(0)
  })
})
