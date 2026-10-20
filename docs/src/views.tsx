// The optional-entry-point examples: TimeSeriesChart (uplot), GraphView (React Flow + dagre),
// FlowCanvas (React Flow),
// MapView (MapLibre) and CodeEditor (CodeMirror). Loaded on demand from demos.tsx, the way an app
// imports them from their own subpaths.
import 'uplot/dist/uPlot.min.css'
import '@xyflow/react/dist/style.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useCallback, useMemo, useState } from 'react'
import { setWorkerUrl } from 'maplibre-gl'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { TbArrowsShuffle, TbFocusCentered, TbPlugConnected, TbStack2 } from 'react-icons/tb'
import { addEdge, applyEdgeChanges, applyNodeChanges, Handle, Position, type Connection, type EdgeChange, type NodeChange, type NodeProps } from '@xyflow/react'
import { Badge, Button } from '../../src/index'
import { TimeSeriesChart } from '../../src/chart'
import { GraphView, type GraphViewEdge, type GraphViewNode } from '../../src/graph-view'
import { FlowCanvas, type FlowCanvasEdge, type FlowCanvasNode, type FlowPaletteItem } from '../../src/flow-canvas'
import { MapView, type MapLine, type MapPoint } from '../../src/map-view'
import { CodeEditor, type CodeEditorDiagnostic } from '../../src/code-editor'

setWorkerUrl(maplibreWorkerUrl)

// ---------------------------------------------------------------- TimeSeriesChart

export function TimeSeriesChartDemo() {
  const { times, contacts, rejected, lag } = useMemo(() => {
    const start = 1_791_302_400
    const times: number[] = []
    const contacts: (number | null)[] = []
    const rejected: (number | null)[] = []
    const lag: (number | null)[] = []
    for (let i = 0; i < 120; i++) {
      times.push(start + i * 60)
      const base = 420 + 160 * Math.sin(i / 14) + 40 * Math.sin(i / 3)
      contacts.push(i >= 70 && i < 76 ? null : Math.round(base))
      rejected.push(i >= 70 && i < 76 ? null : Math.round(18 + 12 * Math.abs(Math.sin(i / 7))))
      lag.push(Math.round(4 + 3 * Math.abs(Math.sin(i / 11)) + (i > 90 ? (i - 90) * 0.9 : 0)))
    }
    return { times, contacts, rejected, lag }
  }, [])
  return (
    <div className="stack">
      <TimeSeriesChart
        aria-label="Ingest rate over the last two hours"
        times={times}
        unit="/min"
        series={[{ label: 'Contacts', values: contacts, tone: 'accent' }, { label: 'Rejected', values: rejected, tone: 'danger' }]}
      />
      <TimeSeriesChart aria-label="Feed lag" times={times} unit=" s" height={90} series={[{ label: 'Lag', values: lag, tone: 'warning' }]} />
    </div>
  )
}

// ---------------------------------------------------------------- GraphView

const PIPELINE_NODES: GraphViewNode[] = [
  { id: 'radar', label: 'Radar', sublabel: 'source', width: 120 },
  { id: 'ais', label: 'AIS', sublabel: 'source', width: 120 },
  { id: 'adsb', label: 'ADS-B', sublabel: 'source', tone: 'warning', width: 120 },
  { id: 'eo', label: 'EO tower', sublabel: 'switched off', tone: 'muted', width: 120 },
  { id: 'normalise', label: 'Normalise', sublabel: 'stage', width: 120 },
  { id: 'fuse', label: 'Fuse', sublabel: 'tracker', tone: 'accent', width: 120 },
  { id: 'store', label: 'Track DB', sublabel: 'sink', width: 120 },
  { id: 'nats', label: 'NATS out', sublabel: 'failing', tone: 'danger', width: 120 },
]

const PIPELINE_EDGES: GraphViewEdge[] = [
  { id: 'e1', source: 'radar', target: 'normalise', animated: true },
  { id: 'e2', source: 'ais', target: 'normalise', animated: true },
  { id: 'e3', source: 'adsb', target: 'normalise', animated: true, label: 'lagging' },
  { id: 'e4', source: 'eo', target: 'normalise', ended: true },
  { id: 'e5', source: 'normalise', target: 'fuse', animated: true },
  { id: 'e6', source: 'fuse', target: 'store', animated: true },
  { id: 'e7', source: 'fuse', target: 'nats' },
]

export function GraphViewDemo() {
  const [selected, setSelected] = useState<string | null>('fuse')
  const node = PIPELINE_NODES.find(n => n.id === selected)
  return (
    <div className="stack" style={{ gap: 'var(--space-sm)' }}>
      <GraphView aria-label="Ingest pipeline" nodes={PIPELINE_NODES} edges={PIPELINE_EDGES} height={300} layerGap={48}
        selectedId={selected} onNodeClick={setSelected} />
      <span className="caption">
        {node ? <>Selected <strong>{node.label}</strong> ({node.sublabel}). </> : null}
        Animated edges carry data; the dashed edge has ended. Click a node to select it.
      </span>
    </div>
  )
}

// ---------------------------------------------------------------- FlowCanvas

type StepKind = 'source' | 'transform' | 'output'
const STEP_RANK: Record<StepKind, number> = { source: 0, transform: 1, output: 2 }

function StepNode({ data, selected }: NodeProps) {
  const d = data as { label: string; kind: StepKind }
  return (
    <div style={{
      minWidth: 128, padding: '6px 10px', borderRadius: 'var(--radius-md)', fontSize: 12,
      background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)',
      border: `1px solid ${selected ? 'var(--color-accent)' : 'var(--border-strong)'}`,
    }}>
      {d.kind !== 'source' && <Handle type="target" position={Position.Left} />}
      <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>{d.kind}</div>
      {d.label}
      {d.kind !== 'output' && <Handle type="source" position={Position.Right} />}
    </div>
  )
}
const STEP_TYPES = { step: StepNode }

const PALETTE: FlowPaletteItem[] = [
  { type: 'source', label: 'Source', description: 'A transport and a codec', icon: <TbPlugConnected /> },
  { type: 'transform', label: 'Transform', description: 'Rename, remap, classify', icon: <TbArrowsShuffle /> },
  { type: 'output', label: 'Output', description: 'A feature or track layer', icon: <TbStack2 /> },
]

const START_NODES: FlowCanvasNode[] = [
  { id: 'n1', type: 'step', position: { x: 0, y: 40 }, data: { kind: 'source', label: 'UDP · JSON' } },
  { id: 'n2', type: 'step', position: { x: 220, y: 40 }, data: { kind: 'transform', label: 'Rename fields' } },
  { id: 'n3', type: 'step', position: { x: 440, y: 40 }, data: { kind: 'output', label: 'Tracks · TRACK' } },
]
const START_EDGES: FlowCanvasEdge[] = [
  { id: 'n1-n2', source: 'n1', target: 'n2' },
  { id: 'n2-n3', source: 'n2', target: 'n3' },
]

export function FlowCanvasDemo() {
  const [nodes, setNodes] = useState<FlowCanvasNode[]>(START_NODES)
  const [edges, setEdges] = useState<FlowCanvasEdge[]>(START_EDGES)
  const [readOnly, setReadOnly] = useState(false)
  const kindOf = useCallback((id: string) => (nodes.find(n => n.id === id)?.data as { kind: StepKind } | undefined)?.kind, [nodes])
  return (
    <div className="stack" style={{ gap: 'var(--space-sm)' }}>
      <FlowCanvas
        aria-label="Feed" height={320} nodes={nodes} edges={edges} nodeTypes={STEP_TYPES}
        palette={PALETTE} readOnly={readOnly} minimap
        onNodesChange={(ch: NodeChange[]) => setNodes(ns => applyNodeChanges(ch, ns))}
        onEdgesChange={(ch: EdgeChange[]) => setEdges(es => applyEdgeChanges(ch, es))}
        onConnect={(c: Connection) => setEdges(es => addEdge(c, es))}
        isValidConnection={c => {
          const a = kindOf(c.source), b = kindOf(c.target)
          if (!a || !b) return false
          return STEP_RANK[b] === STEP_RANK[a] + 1 || (a === 'transform' && b === 'transform')
        }}
        onDropNode={(type, position) => setNodes(ns => [...ns, {
          id: `n${Date.now()}`, type: 'step', position, data: { kind: type as StepKind, label: `New ${type}` },
        }])}
      />
      <span className="caption">
        Drag a step from the palette (or focus it and press Enter), connect source → transform → output, select and press
        Delete to remove. <Button size="sm" variant="ghost" onClick={() => setReadOnly(r => !r)}>{readOnly ? 'Edit' : 'Read only'}</Button>
      </span>
    </div>
  )
}

// ---------------------------------------------------------------- MapView

const COUNTRIES = 'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@v5.1.2/geojson/ne_110m_admin_0_countries.geojson'

// Data colours are theme-invariant by design (they are not chrome), so they are literal here.
const POINTS: MapPoint[] = [
  { id: 'viper', latitude: 36.2, longitude: -5.6, color: '#1FCFE8', label: 'TRK-0412 · VIPER 21' },
  { id: 'ever', latitude: 35.9, longitude: 14.5, color: '#FF6A3D', label: 'TRK-0419 · EVER GIVEN' },
  { id: 'raven', latitude: 37.9, longitude: 23.7, color: '#9FE870', label: 'TRK-0426 · RAVEN 04' },
  { id: 'maersk', latitude: 31.3, longitude: 32.3, color: '#7C5CFA', label: 'TRK-0433 · MAERSK OHIO' },
  { id: 'hawk', latitude: 41.0, longitude: 28.9, color: '#1FCFE8', label: 'TRK-0440 · HAWK 11' },
]

const LINES: MapLine[] = [
  { id: 'ever-trail', color: '#FF6A3D', coordinates: [[3.0, 37.4], [8.5, 37.6], [11.4, 36.9], [14.5, 35.9]] },
  { id: 'maersk-trail', color: '#7C5CFA', dashed: true, coordinates: [[25.0, 34.0], [28.6, 32.8], [32.3, 31.3]] },
]

export function MapViewDemo() {
  const [selected, setSelected] = useState<string | null>(null)
  const [fit, setFit] = useState(0)
  const point = POINTS.find(p => p.id === selected)
  return (
    <div className="stack" style={{ gap: 'var(--space-sm)' }}>
      <MapView aria-label="Tracks in the Mediterranean" height={340} outlines={COUNTRIES} points={POINTS} lines={LINES}
        selectedId={selected} onSelect={setSelected} fitKey={fit} />
      <div className="row">
        <Button size="sm" variant="secondary" icon={<TbFocusCentered />} onClick={() => setFit(f => f + 1)}>Fit to tracks</Button>
        {point ? <Badge size="sm" color="blue">{point.label}</Badge> : <span className="caption">Click a point to select it.</span>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- CodeEditor

const CONFIG = `{
  "name": "ais-coastal",
  "kind": "udp",
  "port": 80,
  "format": "nmea",
  "gate_m": 2500
}`

export function CodeEditorDemo() {
  const [value, setValue] = useState(CONFIG)
  const diagnostics = useMemo<CodeEditorDiagnostic[]>(() => {
    const line = value.split('\n').findIndex(l => /"port":\s*80\b/.test(l))
    return line >= 0 ? [{ line: line + 1, message: 'Port 80 needs root on most hosts', severity: 'warning' }] : []
  }, [value])
  const [template, setTemplate] = useState(POPUP_TEMPLATE)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      <CodeEditor aria-label="Source config" language="json" value={value} onChange={setValue} diagnostics={diagnostics} minHeight={160} maxHeight={320} />
      <CodeEditor aria-label="Popup template" language="html" value={template} onChange={setTemplate} completions={fieldCompletions} minHeight={96} maxHeight={200} />
    </div>
  )
}

const POPUP_TEMPLATE = `<h4>{callsign}</h4>
<p>Speed {speed} kn · heading {heading}°</p>`

const FIELDS = [
  { label: 'callsign', detail: 'keyword' },
  { label: 'speed', detail: 'float' },
  { label: 'heading', detail: 'float' },
  { label: 'updated', detail: 'date' },
]

/** Offers the layer's fields after a `{`, the way a popup-template editor would. */
function fieldCompletions({ text, pos }: { text: string; pos: number }) {
  const m = /\{(\w*)$/.exec(text.slice(0, pos))
  if (!m) return null
  return { from: pos - m[1].length, options: FIELDS.map(f => ({ ...f, apply: `${f.label}}` })) }
}
