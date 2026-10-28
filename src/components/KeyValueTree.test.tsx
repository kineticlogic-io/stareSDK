// @vitest-environment jsdom
/**
 * KeyValueTree.test.tsx — the read-only key/value tree (0.2.34) and its helpers.
 *
 * React 19 createRoot + act + native DOM events (project convention — no @testing-library/react).
 * Every assertion targets a real DOM signal or a helper's return value.
 */
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { act, useState } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { KeyValueTree, KEY_VALUE_INDENT_PX, KEY_VALUE_MAX_INDENT_DEPTH } from './KeyValueTree.js'
import { filterKeyValueTree, jsonToKeyValueNodes, keyValueMatchRanges } from './KeyValueTree.helpers.js'
import type { KeyValueNode } from './KeyValueTree.helpers.js'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const FIXTURE: KeyValueNode[] = [
  {
    id: 'hdr',
    label: 'Header',
    children: [
      { id: 'hdr.ver', label: 'Version', value: '02.10' },
      { id: 'hdr.cls', label: 'Class', value: 'U', interpreted: 'unclassified' },
      { id: 'hdr.none', label: 'Title', value: '(absent)', muted: true },
    ],
  },
  { id: 'raw', label: 'Payload', block: '0123456789abcdef' },
  { id: 'lazy', label: 'Part', expandable: true },
]

let root: Root | null = null
let container: HTMLDivElement | null = null

afterEach(() => {
  act(() => root?.unmount())
  container?.remove()
  root = null
  container = null
})

function Harness(props: { nodes?: KeyValueNode[]; query?: string; initial?: string[]; copyValues?: boolean; onToggle?: (n: KeyValueNode, d: number) => void }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(props.initial ?? []))
  return (
    <KeyValueTree
      aria-label="Metadata"
      nodes={props.nodes ?? FIXTURE}
      expandedIds={expanded}
      query={props.query}
      copyValues={props.copyValues}
      onToggle={(n, d) => {
        props.onToggle?.(n, d)
        setExpanded(prev => {
          const next = new Set(prev)
          if (next.has(n.id)) next.delete(n.id)
          else next.add(n.id)
          return next
        })
      }}
      renderExpanded={n => <div data-testid="lazy-body">{`body of ${n.id}`}</div>}
    />
  )
}

function render(el: React.ReactElement): HTMLDivElement {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root!.render(el))
  return container
}

const item = (c: HTMLElement, label: string) => c.querySelector<HTMLElement>(`[role="treeitem"][aria-label="${label}"]`)!

describe('KeyValueTree', () => {
  it('renders a labelled tree with collapsed expandable rows', () => {
    const c = render(<Harness />)
    const tree = c.querySelector('[role="tree"]')!
    expect(tree.getAttribute('aria-label')).toBe('Metadata')
    expect(item(c, 'Header').getAttribute('aria-expanded')).toBe('false')
    expect(item(c, 'Payload').getAttribute('aria-expanded')).toBe('false')
    expect(item(c, 'Part').getAttribute('aria-expanded')).toBe('false')
    expect(c.querySelector('[aria-label="Version"]')).toBeNull()
  })

  it('toggles on click and on Enter/Space, reporting the depth', () => {
    const onToggle = vi.fn()
    const c = render(<Harness onToggle={onToggle} />)
    act(() => item(c, 'Header').click())
    expect(onToggle).toHaveBeenCalledWith(expect.objectContaining({ id: 'hdr' }), 0)
    expect(item(c, 'Header').getAttribute('aria-expanded')).toBe('true')
    expect(c.querySelector('[role="group"] [aria-label="Version"]')).not.toBeNull()
    act(() => item(c, 'Header').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
    expect(item(c, 'Header').getAttribute('aria-expanded')).toBe('false')
    act(() => item(c, 'Payload').dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true })))
    expect(c.textContent).toContain('0123456789abcdef')
  })

  it('shows the interpreted reading first with the raw value after it, and mutes absent values', () => {
    const c = render(<Harness initial={['hdr']} />)
    const cls = item(c, 'Class')
    expect(cls.textContent).toContain('Class: UNCLASSIFIED (U)')
    expect(cls.getAttribute('aria-expanded')).toBeNull()
    expect(item(c, 'Title').textContent).toContain('Title: (absent)')
  })

  it('renders caller content for an expandable row', () => {
    const c = render(<Harness />)
    act(() => item(c, 'Part').click())
    expect(c.querySelector('[data-testid="lazy-body"]')!.textContent).toBe('body of lazy')
  })

  it('copies the raw value, never the interpreted one, and offers no copy on muted or container rows', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const c = render(<Harness initial={['hdr']} />)
    expect(item(c, 'Title').querySelector('button')).toBeNull()
    expect(item(c, 'Header').querySelector('button')).toBeNull()
    const copy = item(c, 'Class').querySelector<HTMLButtonElement>('button')!
    expect(copy.getAttribute('aria-label')).toBe('Copy Class')
    await act(async () => copy.click())
    expect(writeText).toHaveBeenCalledWith('U')
    expect(item(c, 'Class').querySelector('[role="status"]')!.textContent).toBe('Copied')
  })

  it('omits copy buttons with copyValues={false}', () => {
    const c = render(<Harness initial={['hdr']} copyValues={false} />)
    expect(c.querySelectorAll('.ui-key-value-tree__copy').length).toBe(0)
  })

  it('highlights every occurrence of the query in keys and values, case-insensitively', () => {
    const c = render(<Harness initial={['hdr']} query="Ver" />)
    const marks = Array.from(c.querySelectorAll('.ui-key-value-tree__match')).map(m => m.textContent)
    expect(marks).toEqual(['Ver'])
    act(() => root!.render(<Harness initial={['hdr']} query="0" />))
    expect(c.querySelectorAll('[aria-label="Version"] .ui-key-value-tree__match').length).toBe(2)
  })

  it('caps the indentation depth', () => {
    let nodes: KeyValueNode[] = [{ id: 'leaf', label: 'Leaf', value: 'x' }]
    const ids: string[] = []
    for (let d = 7; d >= 0; d--) {
      nodes = [{ id: `n${d}`, label: `N${d}`, children: nodes }]
      ids.push(`n${d}`)
    }
    const c = render(<Harness nodes={nodes} initial={ids} />)
    expect(item(c, 'N1').style.paddingLeft).toBe(`${KEY_VALUE_INDENT_PX}px`)
    expect(item(c, 'Leaf').style.paddingLeft).toBe(`${KEY_VALUE_MAX_INDENT_DEPTH * KEY_VALUE_INDENT_PX}px`)
  })
})

describe('KeyValueTree helpers', () => {
  it('keyValueMatchRanges finds every non-overlapping occurrence', () => {
    expect(keyValueMatchRanges('abcABCabc', 'abc')).toEqual([[0, 3], [3, 6], [6, 9]])
    expect(keyValueMatchRanges('aaaa', 'aa')).toEqual([[0, 2], [2, 4]])
    expect(keyValueMatchRanges('abc', '')).toEqual([])
  })

  it('filterKeyValueTree prunes to matches, keeps a match whole and lists the ancestors to expand', () => {
    const r = filterKeyValueTree(FIXTURE, '  UNCLASS ')
    expect(r.nodes.map(n => n.id)).toEqual(['hdr'])
    expect(r.nodes[0].children!.map(n => n.id)).toEqual(['hdr.cls'])
    expect(r.matchCount).toBe(1)
    expect([...r.autoExpand]).toEqual(['hdr'])
    const whole = filterKeyValueTree(FIXTURE, 'header')
    expect(whole.nodes[0].children!.length).toBe(3)
    expect(filterKeyValueTree(FIXTURE, '89ab').nodes.map(n => n.id)).toEqual(['raw'])
    expect(filterKeyValueTree(FIXTURE, '').nodes).toBe(FIXTURE)
    expect(filterKeyValueTree(FIXTURE, 'zzz').nodes).toEqual([])
    expect(FIXTURE[0].children!.length).toBe(3)
  })

  it('jsonToKeyValueNodes keeps every key and element in order', () => {
    const nodes = jsonToKeyValueNodes({ b: 1, a: { x: [true, null] }, s: 'text' }, 'm')
    expect(nodes.map(n => [n.id, n.label, n.value])).toEqual([
      ['m.b', 'b', '1'],
      ['m.a', 'a', '{1}'],
      ['m.s', 's', 'text'],
    ])
    const arr = nodes[1].children![0]
    expect([arr.id, arr.value]).toEqual(['m.a.x', '[2]'])
    expect(arr.children!.map(n => [n.id, n.value, n.muted ?? false])).toEqual([
      ['m.a.x.0', 'true', false],
      ['m.a.x.1', 'null', true],
    ])
    expect(jsonToKeyValueNodes([1])).toEqual([{ id: '0', label: '0', value: '1' }])
    expect(jsonToKeyValueNodes(undefined)).toEqual([])
  })
})
