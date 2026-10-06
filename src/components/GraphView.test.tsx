// @vitest-environment jsdom
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, it, expect, afterEach, beforeAll } from 'vitest'
import { GraphView, fixedHandles, layoutGraph, toFlowEdges, type GraphViewEdge, type GraphViewNode } from './GraphView'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

beforeAll(() => {
  // React Flow measures its container; jsdom has no layout engine.
  ;(globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  // Edges render straight away (fixed handles); their labels measure text, which jsdom cannot.
  ;(SVGElement.prototype as unknown as { getBBox: () => DOMRect }).getBBox = () => ({ x: 0, y: 0, width: 40, height: 10 }) as DOMRect
})

const cleanups: Array<() => void> = []
afterEach(() => cleanups.splice(0).forEach((f) => f()))

const nodes: GraphViewNode[] = [
  { id: 'ais/1', label: 'ais/366123456', sublabel: 'source track' },
  { id: 'adsb/1', label: 'adsb/ae1234', sublabel: 'source track', tone: 'muted' },
  { id: 'OTK1', label: 'tms-OTK000000001', sublabel: 'system track', tone: 'accent' },
  { id: 'ent', label: 'ent-1', sublabel: 'card' },
]
const edges: GraphViewEdge[] = [
  { id: 'e1', source: 'ais/1', target: 'OTK1', label: 'REPORTS_FOR' },
  { id: 'e2', source: 'adsb/1', target: 'OTK1', label: 'REPORTS_FOR', ended: true },
  { id: 'e3', source: 'OTK1', target: 'ent', label: 'CARD' },
]

describe('layoutGraph', () => {
  it('puts each edge target in a later layer', () => {
    const p = layoutGraph(nodes, edges, 'LR')
    expect(p['OTK1'].x).toBeGreaterThan(p['ais/1'].x)
    expect(p['ent'].x).toBeGreaterThan(p['OTK1'].x)
    expect(p['ais/1'].x).toBe(p['adsb/1'].x)
    const tb = layoutGraph(nodes, edges, 'TB')
    expect(tb['OTK1'].y).toBeGreaterThan(tb['ais/1'].y)
  })

  it('spaces layers to fit edge labels', () => {
    const p = layoutGraph(nodes, edges, 'LR')
    // Gap between the source column and the system track fits "REPORTS_FOR".
    expect(p['OTK1'].x - (p['ais/1'].x + 200)).toBeGreaterThanOrEqual('REPORTS_FOR'.length * 7.5)
  })

  it('honours node widths and a tighter layer gap', () => {
    const chain: GraphViewNode[] = [
      { id: 'a', label: 'a', width: 100 },
      { id: 'b', label: 'b', width: 100 },
    ]
    const p = layoutGraph(chain, [{ id: 'ab', source: 'a', target: 'b' }], 'LR', 40)
    expect(p['b'].x - (p['a'].x + 100)).toBe(40)
  })

  it('ignores edges to unknown nodes', () => {
    const p = layoutGraph(nodes.slice(0, 1), edges)
    expect(Object.keys(p)).toEqual(['ais/1'])
  })
})

describe('GraphView', () => {
  it('renders every node label inside a labelled group', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const root = createRoot(el)
    act(() => root.render(<GraphView aria-label="Track lineage" nodes={nodes} edges={edges} height={300} />))
    cleanups.push(() => {
      act(() => root.unmount())
      el.remove()
    })
    const group = el.querySelector('[role="group"][aria-label="Track lineage"]') as HTMLElement
    expect(group).toBeTruthy()
    for (const n of nodes) expect(group.textContent).toContain(n.label)
    expect(group.textContent).toContain('system track')
    // Every edge draws without waiting for its handles to be measured.
    expect(group.querySelectorAll('.react-flow__edge')).toHaveLength(edges.length)
  })
})

describe('fixedHandles', () => {
  it('places the target on the leading side and the source on the trailing side, mid-box', () => {
    const [t, s] = fixedHandles(136, true)
    expect(t).toMatchObject({ type: 'target', position: 'left', x: 0 })
    expect(s).toMatchObject({ type: 'source', position: 'right', x: 135 })
    expect(t.y).toBe(s.y)
    const [tt, ss] = fixedHandles(136, false)
    expect(tt).toMatchObject({ type: 'target', position: 'top', y: 0 })
    expect(ss).toMatchObject({ type: 'source', position: 'bottom' })
    expect(tt.x).toBe(ss.x)
  })
})

describe('toFlowEdges', () => {
  const flow: GraphViewEdge[] = [
    { id: 'a', source: 'x', target: 'y', animated: true },
    { id: 'b', source: 'x', target: 'y', animated: true, ended: true },
    { id: 'c', source: 'x', target: 'y' },
  ]
  it('animates flowing edges, never ended ones', () => {
    expect(toFlowEdges(flow).map((e) => e.animated)).toEqual([true, false, false])
  })
  it('draws everything still under reduced motion', () => {
    expect(toFlowEdges(flow, true).map((e) => e.animated)).toEqual([false, false, false])
  })
})
