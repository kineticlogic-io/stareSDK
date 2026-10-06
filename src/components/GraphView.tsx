import { useEffect, useMemo, useRef, type CSSProperties, type RefObject } from 'react'
import dagre from '@dagrejs/dagre'
import {
  Handle,
  MarkerType,
  Position,
  type NodeHandle,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeProps,
  useNodesInitialized,
  useReactFlow,
} from '@xyflow/react'

/**
 * GraphView — a directed graph (lineage, provenance, dependencies) laid out in layers
 * (stareSDK, operator-approved 2026-09-25; first consumer: OpenTrack track lineage).
 *
 * Rendering is React Flow (`@xyflow/react`), layout is dagre (`@dagrejs/dagre`); both are optional
 * peers, which is why this component lives behind its own entry point (`staresdk/graph-view`).
 * Consumers import React Flow's structural stylesheet once: `import '@xyflow/react/dist/base.css'`
 * (base, not style: every colour here comes from tokens).
 *
 * Nodes are compact token-styled boxes: a mono id-like label, an optional secondary line, and a
 * `tone` that picks the border (accent for the subject of the graph, neutral otherwise, muted for
 * things that are no longer current, warning/danger for things that need attention). Ended edges
 * are dashed and dimmed. `animated` edges carry moving dashes from source to target, for flows
 * (data moving through a pipeline); under `prefers-reduced-motion` they are drawn solid instead.
 * The view fits the graph on load, again whenever its box changes size (a tab shown, a drawer
 * opened beside it) and when nodes are added or removed, but not when only their text changes, so
 * a live graph does not jump under the user. The user pans and zooms with the pointer. It adds no controls
 * of its own.
 */
export interface GraphViewNode {
  id: string
  label: string
  /** Second line, e.g. the node's kind or a name. */
  sublabel?: string
  /**
   * `accent`: the graph's subject; `muted`: no longer current or switched off; `warning` /
   * `danger`: needs attention (degraded / failing). Default `neutral`.
   */
  tone?: 'accent' | 'neutral' | 'muted' | 'warning' | 'danger'
  /** Box width in pixels (default 200); narrow boxes suit short labels such as pipeline stages. */
  width?: number
}

export interface GraphViewEdge {
  id: string
  source: string
  target: string
  label?: string
  /** No longer current: drawn dashed and dimmed. */
  ended?: boolean
  /** Data is flowing along this edge: moving dashes, source to target. */
  animated?: boolean
}

export interface GraphViewProps {
  nodes: GraphViewNode[]
  edges: GraphViewEdge[]
  /** Layout direction: left to right (default) or top to bottom. */
  direction?: 'LR' | 'TB'
  /** Height of the view (it fills its container's width). Default 280. */
  height?: number | string
  /** Minimum gap between layers in pixels (default 72); edge labels widen it to fit. */
  layerGap?: number
  selectedId?: string | null
  onNodeClick?: (id: string) => void
  'aria-label': string
  style?: CSSProperties
}

const NODE_W = 200
const NODE_H = 46

/** Layered positions for every node (top-left corners), from dagre. Exported for tests. */
export function layoutGraph(
  nodes: GraphViewNode[],
  edges: GraphViewEdge[],
  direction: 'LR' | 'TB' = 'LR',
  layerGap = 72,
): Record<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph()
  // Leave room between layers for the longest edge label (10px uppercase, ~7px per character).
  const longest = Math.max(0, ...edges.map((e) => e.label?.length ?? 0))
  const ranksep = direction === 'LR' && longest > 0 ? Math.max(layerGap, longest * 7.5 + 40) : layerGap
  g.setGraph({ rankdir: direction, nodesep: 24, ranksep, marginx: 8, marginy: 8 })
  g.setDefaultEdgeLabel(() => ({}))
  for (const n of nodes) g.setNode(n.id, { width: n.width ?? NODE_W, height: NODE_H })
  for (const e of edges) {
    if (g.hasNode(e.source) && g.hasNode(e.target)) g.setEdge(e.source, e.target)
  }
  dagre.layout(g)
  const out: Record<string, { x: number; y: number }> = {}
  for (const n of nodes) {
    const p = g.node(n.id)
    out[n.id] = { x: p.x - (n.width ?? NODE_W) / 2, y: p.y - NODE_H / 2 }
  }
  return out
}

// A type alias (not an interface) so it satisfies React Flow's `Record<string, unknown>` data bound.
type BoxData = {
  label: string
  sublabel?: string
  tone?: GraphViewNode['tone']
  width: number
  selected: boolean
  horizontal: boolean
}

const BORDER: Record<NonNullable<GraphViewNode['tone']>, string> = {
  accent: 'var(--color-accent)',
  neutral: 'var(--border-strong)',
  muted: 'var(--color-glass-border)',
  warning: 'var(--status-warning)',
  danger: 'var(--color-destructive)',
}

/** True when the user asked the system for less motion. */
function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

function Box({ data }: NodeProps<Node<BoxData>>) {
  const tone = data.tone ?? 'neutral'
  const handle: CSSProperties = { opacity: 0, width: 1, height: 1, minWidth: 0, minHeight: 0, border: 0 }
  return (
    <div
      style={{
        boxSizing: 'border-box',
        width: data.width,
        height: NODE_H,
        padding: '5px 10px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 2,
        background: 'var(--color-bg-secondary)',
        border: `1px solid ${data.selected ? 'var(--color-accent)' : BORDER[tone]}`,
        boxShadow: data.selected ? '0 0 0 1px var(--color-accent)' : 'none',
        borderRadius: 'var(--radius-md)',
        opacity: tone === 'muted' ? 0.6 : 1,
        fontFamily: 'var(--font-sans)',
        cursor: 'pointer',
      }}
    >
      <Handle type="target" position={data.horizontal ? Position.Left : Position.Top} style={handle} isConnectable={false} />
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: tone === 'accent' ? 'var(--color-accent)' : 'var(--color-text-primary)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
        title={data.label}
      >
        {data.label}
      </span>
      {data.sublabel && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--color-text-secondary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={data.sublabel}
        >
          {data.sublabel}
        </span>
      )}
      <Handle type="source" position={data.horizontal ? Position.Right : Position.Bottom} style={handle} isConnectable={false} />
    </div>
  )
}

/** Where Box draws its two 1px handles, so edges never wait on measuring them. Exported for tests. */
export function fixedHandles(width: number, horizontal: boolean): NodeHandle[] {
  return horizontal
    ? [
        { type: 'target', position: Position.Left, x: 0, y: NODE_H / 2 - 0.5, width: 1, height: 1 },
        { type: 'source', position: Position.Right, x: width - 1, y: NODE_H / 2 - 0.5, width: 1, height: 1 },
      ]
    : [
        { type: 'target', position: Position.Top, x: width / 2 - 0.5, y: 0, width: 1, height: 1 },
        { type: 'source', position: Position.Bottom, x: width / 2 - 0.5, y: NODE_H - 1, width: 1, height: 1 },
      ]
}

const NODE_TYPES = { box: Box }
const FIT = { padding: 0.15, maxZoom: 1.25 }

/** Re-fit when the container resizes or the set of nodes changes (inside `<ReactFlow>`). */
function AutoFit({ box, shape }: { box: RefObject<HTMLDivElement | null>; shape: string }) {
  const { fitView } = useReactFlow()
  const ready = useNodesInitialized()
  useEffect(() => {
    if (ready) fitView(FIT)
  }, [ready, shape, fitView])
  useEffect(() => {
    const el = box.current
    if (!el || typeof ResizeObserver === 'undefined') return
    let last = ''
    const ro = new ResizeObserver(([e]) => {
      const size = `${Math.round(e.contentRect.width)}x${Math.round(e.contentRect.height)}`
      if (size !== last && e.contentRect.width > 0) {
        last = size
        fitView(FIT)
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [box, fitView])
  return null
}

/** React Flow edges for `edges`; `still` (reduced motion) draws animated edges solid. Exported for tests. */
export function toFlowEdges(edges: GraphViewEdge[], still = false): Edge[] {
  return edges.map((e) => {
    const stroke = e.ended ? 'var(--color-glass-border)' : 'var(--color-text-secondary)'
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      type: 'smoothstep',
      // React Flow's base.css draws `animated` edges with moving dashes, source to target.
      animated: !!e.animated && !e.ended && !still,
      label: e.label,
      style: { stroke, strokeWidth: 1.25, strokeDasharray: e.ended ? '4 4' : undefined },
      markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: stroke },
      labelStyle: {
        fill: 'var(--color-text-secondary)',
        fontFamily: 'var(--font-sans)',
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.08em',
      },
      labelBgStyle: { fill: 'var(--color-bg-primary)' },
      labelBgPadding: [4, 2] as [number, number],
    }
  })
}

export function GraphView({
  nodes,
  edges,
  direction = 'LR',
  height = 280,
  layerGap = 72,
  selectedId,
  onNodeClick,
  'aria-label': ariaLabel,
  style,
}: GraphViewProps) {
  const layout = useMemo(() => layoutGraph(nodes, edges, direction, layerGap), [nodes, edges, direction, layerGap])
  const flowNodes: Node<BoxData>[] = useMemo(
    () =>
      nodes.map((n) => ({
        id: n.id,
        type: 'box',
        position: layout[n.id] ?? { x: 0, y: 0 },
        // Fixed dimensions and handles: React Flow hides a node until it has a size and draws
        // an edge only between measured handles. A measurement dropped on a refresh or remount
        // is never retaken, since the boxes do not change size, so the graph went dark.
        width: n.width ?? NODE_W,
        height: NODE_H,
        handles: fixedHandles(n.width ?? NODE_W, direction === 'LR'),
        data: {
          label: n.label,
          sublabel: n.sublabel,
          tone: n.tone,
          width: n.width ?? NODE_W,
          selected: n.id === selectedId,
          horizontal: direction === 'LR',
        },
        draggable: false,
        connectable: false,
      })),
    [nodes, layout, selectedId, direction],
  )
  const flowEdges = useMemo(() => toFlowEdges(edges, prefersReducedMotion()), [edges])
  const box = useRef<HTMLDivElement>(null)
  const shape = useMemo(() => nodes.map((n) => n.id).join('|'), [nodes])

  return (
    <div
      ref={box}
      role="group"
      aria-label={ariaLabel}
      style={{
        height,
        width: '100%',
        background: 'var(--color-bg-primary)',
        border: '1px solid var(--color-glass-border)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        ...style,
      }}
    >
      <ReactFlowProvider>
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={NODE_TYPES}
          fitView
          fitViewOptions={FIT}
          minZoom={0.2}
          maxZoom={2}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={!!onNodeClick}
          onNodeClick={onNodeClick ? (_, n) => onNodeClick(n.id) : undefined}
          proOptions={{ hideAttribution: true }}
          colorMode="system"
          style={{ background: 'transparent' }}
        >
          <AutoFit box={box} shape={shape} />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  )
}
