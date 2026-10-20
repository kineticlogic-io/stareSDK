import { useCallback, useRef, type CSSProperties, type DragEvent, type KeyboardEvent, type ReactNode } from 'react'
import {
  Background,
  BackgroundVariant,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge,
  type IsValidConnection,
  type Node,
  type NodeTypes,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
  type XYPosition,
} from '@xyflow/react'
import { TbFocusCentered, TbZoomIn, TbZoomOut } from 'react-icons/tb'
import { Button } from './Button.js'

/**
 * FlowCanvas — an editable drag-and-drop flow (stareSDK, operator-approved 2026-10-20; first
 * consumer: LOOM's feed editor, where a feed is Source → Transform → Output steps).
 *
 * A thin, presentational wrapper over React Flow (`@xyflow/react`, an optional peer, which is why it
 * lives behind its own entry point `staresdk/flow-canvas`). The consumer owns the graph: it passes
 * `nodes`/`edges` and its own `nodeTypes` (node renderers), and applies the changes React Flow
 * reports (`onNodesChange`/`onEdgesChange`/`onConnect`; React Flow's `applyNodeChanges`/
 * `applyEdgeChanges`/`addEdge` do the bookkeeping). FlowCanvas adds what every consumer would
 * otherwise rebuild:
 *
 * - **Theme**: every React Flow colour variable (`--xy-*`) points at a design token, so the canvas
 *   follows light and dark like the rest of the chrome. No colour literal anywhere.
 * - **Palette**: `palette` items are listed beside the canvas. Drag one onto the canvas, or focus it
 *   and press Enter (or click it), and `onDropNode(type, position)` reports where the new step goes
 *   (the drop point, or the centre of the view) in flow coordinates. The consumer adds the node.
 * - **Connections**: `isValidConnection` decides which connections may be made (LOOM allows only
 *   source → transform → output); a refused connection is never reported to `onConnect`.
 * - **Controls**: zoom in, zoom out and fit, drawn with stareSDK `Button`s and Tabler icons. A dot
 *   grid, and an optional minimap. Nothing else: the canvas is meant to stay simple.
 * - **Keyboard**: Delete or Backspace removes the selected step or connection (reported through
 *   `onNodesChange`/`onEdgesChange`, so the consumer decides).
 * - **Read only**: `readOnly` shows the flow without dragging, connecting, deleting or a palette.
 *
 * Node renderers receive `isConnectable` (false when `readOnly`) and pass it to their `Handle`s, so a
 * read-only flow shows no connectable handles.
 *
 * Consumers import React Flow's stylesheet once: `import '@xyflow/react/dist/style.css'` (its colour
 * variables are what FlowCanvas overrides with tokens).
 */
export type FlowCanvasNode = Node
export type FlowCanvasEdge = Edge

export interface FlowPaletteItem {
  /** The node type the consumer creates (`onDropNode`'s first argument). */
  type: string
  label: string
  /** One line under the label. */
  description?: string
  /** A react-icons/tb glyph. */
  icon?: ReactNode
}

export interface FlowCanvasProps {
  nodes: FlowCanvasNode[]
  edges: FlowCanvasEdge[]
  /** The consumer's node renderers, keyed by node `type`. */
  nodeTypes?: NodeTypes
  onNodesChange?: OnNodesChange
  onEdgesChange?: OnEdgesChange
  onConnect?: OnConnect
  /** Which connections may be made. Refused ones never reach `onConnect`. */
  isValidConnection?: (connection: Connection | Edge) => boolean
  onNodeClick?: (id: string) => void
  /** The selected steps and connections, whenever the selection changes. */
  onSelectionChange?: (selection: { nodes: string[]; edges: string[] }) => void
  /** Steps that can be added. Listed beside the canvas unless `readOnly`. */
  palette?: FlowPaletteItem[]
  /** A palette item was dropped (or chosen with the keyboard) at `position`, in flow coordinates. */
  onDropNode?: (type: string, position: XYPosition) => void
  /** Show the flow only: no dragging, connecting, deleting or palette. */
  readOnly?: boolean
  /** Fit the flow in view on load (default true). */
  fitView?: boolean
  /** Show a minimap in the corner (default false). */
  minimap?: boolean
  /** Height of the canvas (it fills its container's width). Default 420. */
  height?: number | string
  'aria-label': string
  style?: CSSProperties
}

/** The MIME type a palette drag carries. Exported for consumers that build their own palette. */
export const FLOW_NODE_MIME = 'application/x-staresdk-flow-node'

/** React Flow's colour variables, each pointed at a design token. Exported for tests. */
export function flowCanvasThemeVars(): Record<string, string> {
  return {
    '--xy-background-color': 'var(--color-bg-primary)',
    '--xy-background-pattern-color': 'var(--color-glass-border)',
    '--xy-node-background-color': 'var(--color-bg-secondary)',
    '--xy-node-color': 'var(--color-text-primary)',
    '--xy-node-border': '1px solid var(--border-strong)',
    '--xy-node-border-radius': 'var(--radius-md)',
    '--xy-node-boxshadow-hover': '0 0 0 1px var(--border-strong)',
    '--xy-node-boxshadow-selected': '0 0 0 1px var(--color-accent)',
    '--xy-node-group-background-color': 'var(--color-glass-bg)',
    '--xy-handle-background-color': 'var(--color-text-secondary)',
    '--xy-handle-border-color': 'var(--color-bg-secondary)',
    '--xy-edge-stroke': 'var(--color-text-secondary)',
    '--xy-edge-stroke-selected': 'var(--color-accent)',
    '--xy-edge-stroke-width': '1.25',
    '--xy-connectionline-stroke': 'var(--color-accent)',
    '--xy-connectionline-stroke-width': '1.25',
    '--xy-edge-label-color': 'var(--color-text-secondary)',
    '--xy-edge-label-background-color': 'var(--color-bg-primary)',
    '--xy-selection-background-color': 'var(--brand-subtle)',
    '--xy-selection-border': '1px dashed var(--color-accent)',
    '--xy-minimap-background-color': 'var(--color-bg-secondary)',
    '--xy-minimap-mask-background-color': 'var(--color-glass-bg)',
    '--xy-minimap-mask-stroke-color': 'var(--color-glass-border)',
    '--xy-minimap-node-background-color': 'var(--border-strong)',
    '--xy-minimap-node-stroke-color': 'var(--border-strong)',
    '--xy-resize-background-color': 'var(--color-accent)',
    '--xy-attribution-background-color': 'transparent',
  }
}

const FIT = { padding: 0.2, maxZoom: 1.25 }

function Controls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow()
  return (
    <Panel position="bottom-left">
      <div role="toolbar" aria-label="View" style={{ display: 'flex', gap: 4 }}>
        <Button size="xs" variant="secondary" icon={<TbZoomIn />} aria-label="Zoom in" title="Zoom in" onClick={() => zoomIn()} />
        <Button size="xs" variant="secondary" icon={<TbZoomOut />} aria-label="Zoom out" title="Zoom out" onClick={() => zoomOut()} />
        <Button size="xs" variant="secondary" icon={<TbFocusCentered />} aria-label="Fit to view" title="Fit to view" onClick={() => fitView(FIT)} />
      </div>
    </Panel>
  )
}

function Palette({
  items,
  onChoose,
}: {
  items: FlowPaletteItem[]
  onChoose: (type: string) => void
}) {
  const start = (e: DragEvent<HTMLElement>, type: string) => {
    e.dataTransfer.setData(FLOW_NODE_MIME, type)
    e.dataTransfer.effectAllowed = 'move'
  }
  const key = (e: KeyboardEvent<HTMLElement>, type: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onChoose(type)
    }
  }
  return (
    <div
      role="list"
      aria-label="Steps"
      style={{
        width: 168,
        flexShrink: 0,
        overflowY: 'auto',
        padding: 'var(--space-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-xs)',
        borderRight: '1px solid var(--color-glass-border)',
        background: 'var(--color-bg-secondary)',
      }}
    >
      {items.map((item) => (
        <div
          key={item.type}
          role="listitem"
          tabIndex={0}
          draggable
          aria-label={`Add ${item.label}`}
          title={item.description}
          onDragStart={(e) => start(e, item.type)}
          onKeyDown={(e) => key(e, item.type)}
          onClick={() => onChoose(item.type)}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 6,
            padding: '6px 8px',
            border: '1px solid var(--color-glass-border)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--color-bg-primary)',
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-sans)',
            fontSize: 12,
            cursor: 'grab',
            userSelect: 'none',
          }}
        >
          {item.icon && <span aria-hidden style={{ display: 'flex', color: 'var(--color-text-secondary)', paddingTop: 1 }}>{item.icon}</span>}
          <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span style={{ fontWeight: 600 }}>{item.label}</span>
            {item.description && (
              <span style={{ fontSize: 10, color: 'var(--color-text-secondary)', lineHeight: 1.3 }}>{item.description}</span>
            )}
          </span>
        </div>
      ))}
    </div>
  )
}

function Canvas(props: FlowCanvasProps) {
  const {
    nodes,
    edges,
    nodeTypes,
    onNodesChange,
    onEdgesChange,
    onConnect,
    isValidConnection,
    onNodeClick,
    onSelectionChange,
    palette,
    onDropNode,
    readOnly = false,
    fitView = true,
    minimap = false,
  } = props
  const { screenToFlowPosition } = useReactFlow()
  const pane = useRef<HTMLDivElement>(null)

  const dropAt = useCallback(
    (type: string, clientX: number, clientY: number) => {
      onDropNode?.(type, screenToFlowPosition({ x: clientX, y: clientY }))
    },
    [onDropNode, screenToFlowPosition],
  )
  const centre = useCallback(
    (type: string) => {
      const r = pane.current?.getBoundingClientRect()
      dropAt(type, r ? r.left + r.width / 2 : 0, r ? r.top + r.height / 2 : 0)
    },
    [dropAt],
  )

  const showPalette = !readOnly && !!palette?.length && !!onDropNode
  const validate: IsValidConnection | undefined = isValidConnection

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%' }}>
      {showPalette && <Palette items={palette!} onChoose={centre} />}
      <div
        ref={pane}
        style={{ flex: 1, minWidth: 0, position: 'relative' }}
        onDragOver={showPalette ? (e) => {
          if (e.dataTransfer.types.includes(FLOW_NODE_MIME)) {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'move'
          }
        } : undefined}
        onDrop={showPalette ? (e) => {
          const type = e.dataTransfer.getData(FLOW_NODE_MIME)
          if (!type) return
          e.preventDefault()
          dropAt(type, e.clientX, e.clientY)
        } : undefined}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={readOnly ? undefined : onConnect}
          isValidConnection={validate}
          onNodeClick={onNodeClick ? (_, n) => onNodeClick(n.id) : undefined}
          onSelectionChange={
            onSelectionChange
              ? ({ nodes: ns, edges: es }) => onSelectionChange({ nodes: ns.map((n) => n.id), edges: es.map((e) => e.id) })
              : undefined
          }
          nodesDraggable={!readOnly}
          nodesConnectable={!readOnly}
          elementsSelectable
          deleteKeyCode={readOnly ? null : ['Delete', 'Backspace']}
          fitView={fitView}
          fitViewOptions={FIT}
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          style={{ background: 'var(--xy-background-color)' }}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="var(--xy-background-pattern-color)" />
          <Controls />
          {minimap && <MiniMap pannable zoomable ariaLabel="Overview" />}
        </ReactFlow>
      </div>
    </div>
  )
}

export function FlowCanvas(props: FlowCanvasProps) {
  const { height = 420, 'aria-label': ariaLabel, style } = props
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      style={{
        ...(flowCanvasThemeVars() as CSSProperties),
        height,
        width: '100%',
        background: 'var(--color-bg-primary)',
        border: '1px solid var(--color-glass-border)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        fontFamily: 'var(--font-sans)',
        ...style,
      }}
    >
      <ReactFlowProvider>
        <Canvas {...props} />
      </ReactFlowProvider>
    </div>
  )
}
