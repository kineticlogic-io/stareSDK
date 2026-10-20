// @vitest-environment jsdom
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { FlowCanvas, FLOW_NODE_MIME, flowCanvasThemeVars, type FlowCanvasEdge, type FlowCanvasNode, type FlowCanvasProps } from './FlowCanvas.js'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

beforeAll(() => {
  // React Flow measures its container and nodes; jsdom has no layout engine.
  ;(globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  ;(SVGElement.prototype as unknown as { getBBox: () => DOMRect }).getBBox = () => ({ x: 0, y: 0, width: 40, height: 10 }) as DOMRect
})

const cleanups: Array<() => void> = []
afterEach(() => cleanups.splice(0).forEach((f) => f()))

function Step({ data, isConnectable }: NodeProps) {
  return (
    <div>
      <Handle type="target" position={Position.Left} isConnectable={isConnectable} />
      {String((data as { label: string }).label)}
      <Handle type="source" position={Position.Right} isConnectable={isConnectable} />
    </div>
  )
}
const nodeTypes = { step: Step }

const nodes: FlowCanvasNode[] = [
  { id: 'src', type: 'step', position: { x: 0, y: 0 }, data: { label: 'UDP source' }, width: 120, height: 40 },
  { id: 'tx', type: 'step', position: { x: 200, y: 0 }, data: { label: 'Rename fields' }, width: 120, height: 40 },
  { id: 'out', type: 'step', position: { x: 400, y: 0 }, data: { label: 'Track output' }, width: 120, height: 40 },
]
const edges: FlowCanvasEdge[] = [
  { id: 'e1', source: 'src', target: 'tx' },
  { id: 'e2', source: 'tx', target: 'out' },
]

function render(props: Partial<FlowCanvasProps> = {}) {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = createRoot(el)
  act(() => root.render(<FlowCanvas aria-label="Feed" nodes={nodes} edges={edges} nodeTypes={nodeTypes} {...props} />))
  cleanups.push(() => {
    act(() => root.unmount())
    el.remove()
  })
  return el
}

/** A drag event jsdom can carry: a plain Event with a minimal DataTransfer. */
function dragEvent(type: string, data: Record<string, string>, x: number, y: number) {
  const ev = new Event(type, { bubbles: true, cancelable: true }) as Event & {
    dataTransfer: unknown
    clientX: number
    clientY: number
  }
  Object.defineProperty(ev, 'dataTransfer', {
    value: {
      types: Object.keys(data),
      getData: (k: string) => data[k] ?? '',
      setData: (k: string, v: string) => {
        data[k] = v
      },
      dropEffect: 'none',
      effectAllowed: 'all',
    },
  })
  Object.defineProperty(ev, 'clientX', { value: x })
  Object.defineProperty(ev, 'clientY', { value: y })
  return ev
}

describe('flowCanvasThemeVars', () => {
  it('points every React Flow colour variable at a design token, with no colour literal', () => {
    const vars = flowCanvasThemeVars()
    expect(Object.keys(vars).length).toBeGreaterThan(15)
    for (const [k, v] of Object.entries(vars)) {
      expect(k.startsWith('--xy-')).toBe(true)
      expect(v).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i)
    }
    expect(vars['--xy-edge-stroke-selected']).toBe('var(--color-accent)')
    expect(vars['--xy-node-background-color']).toBe('var(--color-bg-secondary)')
  })

  it('applies the token variables on the canvas', () => {
    const el = render()
    const group = el.querySelector('[role="group"][aria-label="Feed"]') as HTMLElement
    expect(group.style.getPropertyValue('--xy-edge-stroke')).toBe('var(--color-text-secondary)')
    expect(group.style.getPropertyValue('--xy-background-color')).toBe('var(--color-bg-primary)')
  })
})

describe('FlowCanvas', () => {
  it('renders every step with the consumer’s node renderer, and the view controls', () => {
    const el = render()
    const group = el.querySelector('[role="group"][aria-label="Feed"]') as HTMLElement
    for (const label of ['UDP source', 'Rename fields', 'Track output']) expect(group.textContent).toContain(label)
    expect(el.querySelector('[aria-label="Zoom in"]')).toBeTruthy()
    expect(el.querySelector('[aria-label="Zoom out"]')).toBeTruthy()
    expect(el.querySelector('[aria-label="Fit to view"]')).toBeTruthy()
  })

  it('lists the palette and reports a dropped step in flow coordinates', () => {
    const onDropNode = vi.fn()
    const el = render({
      palette: [
        { type: 'source', label: 'Source', description: 'A transport and a codec' },
        { type: 'output', label: 'Output' },
      ],
      onDropNode,
    })
    const item = el.querySelector('[aria-label="Add Source"]') as HTMLElement
    expect(item).toBeTruthy()
    expect(item.getAttribute('draggable')).toBe('true')
    const data: Record<string, string> = {}
    act(() => {
      item.dispatchEvent(dragEvent('dragstart', data, 0, 0))
    })
    expect(data[FLOW_NODE_MIME]).toBe('source')
    const pane = el.querySelector('.react-flow')!.parentElement as HTMLElement
    act(() => {
      pane.dispatchEvent(dragEvent('drop', { [FLOW_NODE_MIME]: 'source' }, 120, 80))
    })
    expect(onDropNode).toHaveBeenCalledTimes(1)
    const [type, pos] = onDropNode.mock.calls[0]
    expect(type).toBe('source')
    expect(typeof pos.x).toBe('number')
    expect(typeof pos.y).toBe('number')
  })

  it('adds a step from the keyboard: Enter on a palette item', () => {
    const onDropNode = vi.fn()
    const el = render({ palette: [{ type: 'output', label: 'Output' }], onDropNode })
    const item = el.querySelector('[aria-label="Add Output"]') as HTMLElement
    act(() => {
      item.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
    expect(onDropNode).toHaveBeenCalledWith('output', expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }))
  })

  it('ignores drops that are not palette steps', () => {
    const onDropNode = vi.fn()
    const el = render({ palette: [{ type: 'output', label: 'Output' }], onDropNode })
    const pane = el.querySelector('.react-flow')!.parentElement as HTMLElement
    act(() => {
      pane.dispatchEvent(dragEvent('drop', { 'text/plain': 'hello' }, 10, 10))
    })
    expect(onDropNode).not.toHaveBeenCalled()
  })

  it('removes the selected step with Delete', async () => {
    const onNodesChange = vi.fn()
    render({ nodes: nodes.map((n) => (n.id === 'tx' ? { ...n, selected: true } : n)), onNodesChange })
    // React Flow listens on the document and deletes asynchronously (onBeforeDelete is awaited).
    // Key down and key up in separate turns: React Flow acts on the pressed state.
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', code: 'Delete', bubbles: true }))
      await new Promise((r) => setTimeout(r, 0))
    })
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Delete', code: 'Delete', bubbles: true }))
      await new Promise((r) => setTimeout(r, 0))
    })
    const removed = onNodesChange.mock.calls.flatMap((c) => c[0]).filter((ch: { type: string }) => ch.type === 'remove')
    expect(removed.map((ch: { id: string }) => ch.id)).toContain('tx')
  })

  it('read only: no palette, no dragging or connecting, and Delete removes nothing', async () => {
    const onNodesChange = vi.fn()
    const onDropNode = vi.fn()
    const el = render({
      readOnly: true,
      palette: [{ type: 'output', label: 'Output' }],
      onDropNode,
      onNodesChange,
      nodes: nodes.map((n) => (n.id === 'tx' ? { ...n, selected: true } : n)),
    })
    expect(el.querySelector('[aria-label="Add Output"]')).toBeNull()
    // Key down and key up in separate turns: React Flow acts on the pressed state.
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', code: 'Delete', bubbles: true }))
      await new Promise((r) => setTimeout(r, 0))
    })
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Delete', code: 'Delete', bubbles: true }))
      await new Promise((r) => setTimeout(r, 0))
    })
    const removed = onNodesChange.mock.calls.flatMap((c) => c[0]).filter((ch: { type: string }) => ch.type === 'remove')
    expect(removed).toHaveLength(0)
    const node = el.querySelector('.react-flow__node') as HTMLElement
    expect(node.classList.contains('draggable')).toBe(false)
    expect(el.querySelector('.react-flow__handle.connectable')).toBeNull()
  })

  it('passes the connection rule through to React Flow', () => {
    const isValidConnection = vi.fn(() => false)
    const el = render({ isValidConnection })
    // Handles are connectable (the rule decides per connection, not per handle).
    expect(el.querySelector('.react-flow__handle.connectable')).toBeTruthy()
  })

  it('shows a minimap only when asked', () => {
    expect(render().querySelector('.react-flow__minimap')).toBeNull()
    expect(render({ minimap: true }).querySelector('.react-flow__minimap')).toBeTruthy()
  })
})
