// The guide's live examples, keyed by the `data-demo` slot they render into. Each one uses the real
// component from `src/` with sample data. The optional views (map, graph, chart, code editor) load
// lazily so their peer dependencies only download when the reader reaches them.
import { lazy, useMemo, useRef, useState, type ComponentType, type CSSProperties } from 'react'
import {
  TbAlertTriangle, TbBell, TbBolt, TbChartLine, TbDatabase, TbDownload, TbFilter, TbFocus2, TbHome,
  TbInfoCircle, TbLayersSubtract, TbMap2, TbPencil, TbPhoto, TbPlus, TbPointer, TbPolygon, TbRadar2,
  TbMenu2, TbRefresh, TbRuler2, TbSearch, TbSettings, TbShare, TbTag, TbTool, TbTrash, TbUpload, TbUsers, TbX,
} from 'react-icons/tb'
import {
  AdminModal, AppCard, AssistantButton, Avatar, Badge, Button, ButtonPalette, ClassificationBanner,
  ClassifyModal, ClockBadges, CollapsiblePanel, ColorPicker, ContextMenu, ContextMenuItem, DataTable,
  Disclosure, DraggablePopup, Facets, FieldSelect, FileDropZone, Flyout, HomeButton, InfoTip,
  Input, ItemClassificationBar, Label, MDText, Modal, MultiSelect, OpacitySlider, PageHeader,
  Pagination, PopoverMenuButton, ProfileChart, RampPicker, SaveButton, Select, SideNav, Slider,
  SortableList, Stepper, TabPanel, Tabs, Toggle, Tooltip, Tree, TypeaheadPicker, UnitSelect,
  VirtualList, ZoomRangeSlider, distanceToMeters, sortRows, useTheme, useToast, useTypeaheadKeyboard,
  type BadgeColor, type ClassificationMarking, type ClassifyOptions, type DataTableColumn,
  type DataTableSort,
  type DistanceUnit, type FlyoutItem, type StepItem, type TreeNode,
} from '../../src/index'
import {
  BadgeSwatches, CanonicalSwatches, ClassificationSwatches, ExtendedSwatches, IntelSwatches, Scales,
  SeveritySwatches, StatusSwatches, Typography,
} from './tokens'

const narrow: CSSProperties = { maxWidth: 320 }

// ---------------------------------------------------------------- sample data

interface Track {
  id: string
  callsign: string
  domain: 'Air' | 'Sea' | 'Land'
  status: 'live' | 'lagging' | 'stale'
  speed: number | null
  updated: number
}

const STATUS_COLOR: Record<Track['status'], BadgeColor> = { live: 'success', lagging: 'warning', stale: 'danger' }
const CALLSIGNS = ['VIPER 21', 'EVER GIVEN', 'RAVEN 04', 'MAERSK OHIO', 'HAWK 11', 'CONVOY 3', 'GHOST 7', 'NORDIC STAR', 'TALON 2', 'PATROL 9']

const TRACKS: Track[] = Array.from({ length: 48 }, (_, i) => ({
  id: `TRK-${String(400 + i * 7).padStart(4, '0')}`,
  callsign: `${CALLSIGNS[i % CALLSIGNS.length]}${i >= CALLSIGNS.length ? ` ·${Math.floor(i / CALLSIGNS.length)}` : ''}`,
  domain: (['Air', 'Sea', 'Land'] as const)[i % 3],
  status: (['live', 'live', 'lagging', 'live', 'stale'] as const)[i % 5],
  speed: i % 9 === 4 ? null : Math.round(((i * 37) % 480) + 8),
  updated: 1_791_302_400 - i * 113,
}))

const TRACK_COLUMNS: DataTableColumn<Track>[] = [
  { key: 'id', header: 'Track', mono: true, width: 110, sortValue: t => t.id },
  { key: 'callsign', header: 'Callsign', sortValue: t => t.callsign },
  { key: 'domain', header: 'Domain', width: 90, sortValue: t => t.domain },
  { key: 'status', header: 'Status', width: 100, render: t => <Badge size="sm" uppercase color={STATUS_COLOR[t.status]}>{t.status}</Badge>, sortValue: t => t.status },
  { key: 'speed', header: 'Speed (kn)', width: 110, align: 'right', mono: true, render: t => t.speed ?? '—', sortValue: t => t.speed },
  { key: 'updated', header: 'Updated', width: 110, mono: true, render: t => new Date(t.updated * 1000).toISOString().slice(11, 19), sortValue: t => t.updated },
]

// ---------------------------------------------------------------- foundations

function ThemeDemo() {
  const { theme, commitTheme } = useTheme()
  return (
    <div className="row" style={{ gap: 'var(--space-md)' }}>
      <span className="muted">Current theme</span>
      <Badge size="sm" uppercase color="brand">{theme}</Badge>
      <ButtonPalette ariaLabel="Theme">
        <Button size="sm" variant="secondary" active={theme === 'dark'} icon={<TbBolt />} onClick={() => commitTheme('dark')}>Dark</Button>
        <Button size="sm" variant="secondary" active={theme === 'light'} icon={<TbBolt />} onClick={() => commitTheme('light')}>Light</Button>
      </ButtonPalette>
    </div>
  )
}

function IconsDemo() {
  const icons = [TbHome, TbMap2, TbRadar2, TbLayersSubtract, TbDatabase, TbChartLine, TbPolygon, TbRuler2, TbSearch, TbFilter, TbBell, TbUsers, TbSettings, TbShare, TbDownload, TbUpload, TbTool, TbTag]
  return (
    <div className="row" style={{ gap: 'var(--space-md)', color: 'var(--color-text-secondary)' }}>
      {icons.map((Icon, i) => <Icon key={i} size={20} aria-hidden />)}
    </div>
  )
}

// ---------------------------------------------------------------- actions

function ButtonDemo() {
  return (
    <div className="stack">
      <div className="row">
        <Button variant="primary" icon={<TbPlus />}>Add source</Button>
        <Button variant="secondary">Cancel</Button>
        <Button variant="danger" icon={<TbTrash />}>Delete</Button>
        <Button variant="ghost" size="xs" icon={<TbRefresh />} aria-label="Refresh" title="Refresh" />
        <Button variant="secondary" active>Selected</Button>
        <Button variant="primary" disabled>Disabled</Button>
      </div>
      <div className="row">
        {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map(s =>
          s === 'xs'
            ? <Button key={s} size="xs" variant="secondary" icon={<TbSettings />} aria-label="Settings" title="Settings" />
            : <Button key={s} size={s} variant="secondary" icon={<TbSettings />}>Size {s}</Button>,
        )}
      </div>
    </div>
  )
}

function ButtonPaletteDemo() {
  const [tool, setTool] = useState('select')
  const tools = [
    { id: 'select', label: 'Select', icon: <TbPointer /> },
    { id: 'measure', label: 'Measure', icon: <TbRuler2 /> },
    { id: 'draw', label: 'Draw area', icon: <TbPolygon /> },
    { id: 'layers', label: 'Layers', icon: <TbLayersSubtract /> },
  ]
  return (
    <div className="row" style={{ gap: 'var(--space-xl)', alignItems: 'flex-start' }}>
      <ButtonPalette ariaLabel="Map tools">
        {tools.map(t => (
          <Button key={t.id} variant="ghost" size="xs" icon={t.icon} aria-label={t.label} title={t.label} active={tool === t.id} onClick={() => setTool(t.id)} />
        ))}
      </ButtonPalette>
      <ButtonPalette ariaLabel="Layout" orientation="vertical" style={{ width: 160 }}>
        <Button size="sm" variant="secondary" active={tool === 'select'} onClick={() => setTool('select')}>Map</Button>
        <Button size="sm" variant="secondary" active={tool === 'measure'} onClick={() => setTool('measure')}>Split</Button>
        <Button size="sm" variant="secondary" active={tool === 'draw'} onClick={() => setTool('draw')}>Table</Button>
      </ButtonPalette>
    </div>
  )
}

function SaveButtonDemo() {
  const [value, setValue] = useState('AIS — Channel')
  const [baseline, setBaseline] = useState(value)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const dirty = value !== baseline
  return (
    <div className="row" style={{ alignItems: 'flex-end' }}>
      <div className="field" style={{ width: 240 }}>
        <Label htmlFor="demo-save-name">Source name</Label>
        <Input id="demo-save-name" value={value} onChange={e => { setValue(e.target.value); setSaved(false) }} />
      </div>
      <SaveButton
        dirty={dirty}
        saving={saving}
        saved={saved}
        onSave={() => {
          setSaving(true)
          setTimeout(() => { setSaving(false); setSaved(true); setBaseline(value) }, 900)
        }}
      />
      <span className="caption">Edit the name to enable Save.</span>
    </div>
  )
}

function PopoverMenuButtonDemo() {
  const { toast } = useToast()
  const say = (message: string) => () => toast({ variant: 'info', message })
  return (
    <div
      role="menu"
      aria-label="Source actions"
      style={{ width: 200, padding: 4, display: 'flex', flexDirection: 'column', gap: 2, background: 'var(--surface-layer-2)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-standard)' }}
    >
      <PopoverMenuButton role="menuitem" icon={<TbPencil />} onClick={say('Rename chosen.')}>Rename</PopoverMenuButton>
      <PopoverMenuButton role="menuitem" icon={<TbShare />} onClick={say('Share chosen.')}>Share</PopoverMenuButton>
      <PopoverMenuButton role="menuitem" icon={<TbDownload />} disabled title="Nothing to export yet" onClick={() => {}}>Export</PopoverMenuButton>
      <PopoverMenuButton role="menuitem" icon={<TbTrash />} style={{ color: 'var(--color-destructive)' }} onClick={say('Delete chosen.')}>Delete</PopoverMenuButton>
    </div>
  )
}

// ---------------------------------------------------------------- forms

function InputDemo() {
  const [value, setValue] = useState('')
  return (
    <div className="grid-2">
      <div className="field">
        <Label htmlFor="demo-callsign">Callsign</Label>
        <Input id="demo-callsign" value={value} onChange={e => setValue(e.target.value)} placeholder="e.g. VIPER 21" />
      </div>
      <div className="field">
        <Label htmlFor="demo-ip">Address</Label>
        <Input id="demo-ip" defaultValue="12.3.4" error aria-invalid />
        <span className="caption" style={{ color: 'var(--color-destructive)', marginTop: 4 }}>Enter a full IPv4 address.</span>
      </div>
      <div className="field">
        <Label htmlFor="demo-large" size="sm">Large · small label</Label>
        <Input id="demo-large" size="lg" placeholder="size=&quot;lg&quot;" />
      </div>
      <div className="field">
        <Label htmlFor="demo-disabled">Disabled</Label>
        <Input id="demo-disabled" disabled value="Read only" readOnly />
      </div>
    </div>
  )
}

function SelectDemo() {
  const [value, setValue] = useState<string | null>(null)
  return (
    <div className="row">
      <Select
        ariaLabel="Domain"
        placeholder="Any domain"
        value={value}
        onChange={setValue}
        style={{ width: 200 }}
        options={[{ value: 'air', label: 'Air' }, { value: 'sea', label: 'Sea' }, { value: 'land', label: 'Land' }, { value: 'space', label: 'Space', disabled: true }]}
      />
      <span className="caption mono">value: {JSON.stringify(value)}</span>
    </div>
  )
}

function FieldSelectDemo() {
  const [value, setValue] = useState<string | null>('callsign')
  return (
    <div className="row">
      <FieldSelect
        ariaLabel="Label field"
        allowNone
        value={value}
        onChange={setValue}
        style={{ width: 200 }}
        fields={[{ name: 'callsign' }, { name: 'mmsi' }, { name: 'flag' }, { name: 'geometry', disabled: true, disabledReason: 'Not a text field' }]}
      />
      <span className="caption mono">value: {JSON.stringify(value)}</span>
    </div>
  )
}

function MultiSelectDemo() {
  const [value, setValue] = useState(['viewer', 'operator'])
  return (
    <div style={narrow}>
      <MultiSelect
        ariaLabel="Roles"
        value={value}
        onChange={setValue}
        options={[
          { value: 'viewer', label: 'Viewer', locked: true },
          { value: 'operator', label: 'Operator' },
          { value: 'analyst', label: 'Analyst' },
          { value: 'admin', label: 'Administrator' },
        ]}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-md)' }}>
        <MultiSelect
          ariaLabel="Columns"
          icon={<TbMenu2 />}
          align="right"
          value={value}
          onChange={setValue}
          options={[
            { value: 'viewer', label: 'Viewer', locked: true },
            { value: 'operator', label: 'Operator' },
            { value: 'analyst', label: 'Analyst' },
            { value: 'admin', label: 'Administrator' },
          ]}
        />
      </div>
    </div>
  )
}

function UnitSelectDemo() {
  const [unit, setUnit] = useState('nmi')
  const [elev, setElev] = useState('ft')
  const [conf, setConf] = useState('0.95')
  return (
    <div className="stack">
      <div className="row">
        <UnitSelect family="distance" value={unit} onChange={setUnit} ariaLabel="Distance unit" style={{ width: 160 }} />
        <span className="caption mono">12 {unit} = {Math.round(distanceToMeters(12, unit as DistanceUnit)).toLocaleString()} m</span>
      </div>
      <div className="row">
        <UnitSelect family="elevation" value={elev} onChange={setElev} ariaLabel="Elevation unit" style={{ width: 160 }} />
        <UnitSelect family="confidence" value={conf} onChange={setConf} ariaLabel="Confidence level" style={{ width: 160 }} />
      </div>
    </div>
  )
}

function ToggleDemo() {
  const [labels, setLabels] = useState(true)
  const [airgap, setAirgap] = useState(false)
  return (
    <div className="stack" style={{ gap: 'var(--space-sm)' }}>
      <label className="row" style={{ gap: 'var(--space-md)' }}>
        <Toggle value={labels} onChange={setLabels} aria-label="Show labels" />
        <span>Show labels</span>
      </label>
      <label className="row" style={{ gap: 'var(--space-md)' }}>
        <Toggle size="sm" value={airgap} onChange={setAirgap} onColor="var(--status-warning)" aria-label="Disconnected mode" />
        <span>Disconnected mode <span className="caption">(size="sm", warning colour)</span></span>
      </label>
      <label className="row" style={{ gap: 'var(--space-md)' }}>
        <Toggle value={false} onChange={() => {}} disabled aria-label="Unavailable" />
        <span className="muted">Disabled</span>
      </label>
    </div>
  )
}

function SliderDemo() {
  const [scale, setScale] = useState(1.5)
  return <div style={narrow}><Slider min={0.5} max={4} step={0.25} value={scale} onChange={setScale} aria-label="Symbol scale" formatValue={v => `${v}×`} /></div>
}

function OpacitySliderDemo() {
  const [opacity, setOpacity] = useState(70)
  return (
    <div className="row" style={narrow}>
      <OpacitySlider value={opacity} onChange={setOpacity} aria-label="Layer opacity" />
      <span className="caption mono" style={{ minWidth: 36 }}>{opacity}%</span>
    </div>
  )
}

function ZoomRangeSliderDemo() {
  const [range, setRange] = useState<[number, number]>([4, 14])
  return (
    <div style={narrow}>
      <ZoomRangeSlider minValue={range[0]} maxValue={range[1]} currentZoom={9} onChange={(lo, hi) => setRange([lo, hi])} />
    </div>
  )
}

function ColorPickerDemo() {
  const [hex, setHex] = useState('#0faf73')
  return (
    <div className="row">
      <ColorPicker value={hex} onChange={setHex} aria-label="Track colour" />
      <span className="caption mono">{hex}</span>
    </div>
  )
}

function RampPickerDemo() {
  const [ramp, setRamp] = useState('seq-viridis')
  const [reversed, setReversed] = useState(false)
  const [qual, setQual] = useState('qual-category10')
  const [qualRev, setQualRev] = useState(false)
  return (
    <div className="grid-2" style={{ maxWidth: 640 }}>
      <div className="field">
        <Label>Graduated</Label>
        <RampPicker kind="sequential-diverging" rampId={ramp} onChange={setRamp} reversed={reversed} onReverseChange={setReversed} />
      </div>
      <div className="field">
        <Label>Categorized</Label>
        <RampPicker kind="qualitative" rampId={qual} onChange={setQual} reversed={qualRev} onReverseChange={setQualRev} />
      </div>
    </div>
  )
}

function FileDropZoneDemo() {
  const { toast } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  return (
    <div className="stack" style={{ maxWidth: 480 }}>
      <FileDropZone
        inputId="demo-layer-file"
        label="Layer file"
        accept=".geojson,.json,.kml"
        acceptedExtensions={['geojson', 'json', 'kml']}
        file={file}
        onFileChange={f => { setFile(f); setProgress(null) }}
        onReject={message => toast({ variant: 'error', message })}
        hint="GeoJSON or KML, up to 50 MB. Nothing is uploaded from this page."
        progress={progress}
      />
      <div className="row">
        <Button
          size="sm"
          disabled={!file || progress !== null}
          icon={<TbUpload />}
          onClick={() => {
            let p = 0
            setProgress(0)
            const t = setInterval(() => {
              p += 10
              setProgress(Math.min(p, 100))
              if (p >= 100) { clearInterval(t); toast({ variant: 'success', message: `${file?.name} ingested (demo).` }) }
            }, 150)
          }}
        >
          Ingest
        </Button>
      </div>
    </div>
  )
}

const SITES = ['Andersen AFB', 'Aviano AB', 'Camp Lemonnier', 'Diego Garcia', 'Fort Liberty', 'Joint Base Lewis-McChord', 'Kadena AB', 'Naval Station Norfolk', 'Naval Station Rota', 'Pearl Harbor', 'Ramstein AB', 'RAF Lakenheath', 'Thule (Pituffik)', 'Yokosuka']

function TypeaheadDemo() {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const items = query.trim() ? SITES.filter(s => s.toLowerCase().includes(query.trim().toLowerCase())) : SITES
  const commit = (s: string) => { setPicked(s); setQuery(s); setOpen(false) }
  const onKeyDown = useTypeaheadKeyboard({
    open,
    itemCount: items.length,
    highlightIndex: hi,
    onHighlightChange: setHi,
    onCommit: () => items[hi] && commit(items[hi]),
    onDismiss: () => setOpen(false),
  })
  return (
    <div className="stack" style={{ maxWidth: 360 }}>
      <div style={{ position: 'relative' }}>
        <Label htmlFor="demo-site">Site</Label>
        <Input
          id="demo-site"
          value={query}
          placeholder="Search sites"
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onChange={e => { setQuery(e.target.value); setOpen(true); setHi(0) }}
          onKeyDown={onKeyDown}
        />
        <TypeaheadPicker
          open={open}
          items={items}
          getKey={s => s}
          renderRow={s => <span style={{ fontSize: 12 }}>{s}</span>}
          onSelect={commit}
          onDismiss={() => setOpen(false)}
          highlightIndex={hi}
          onHighlightChange={setHi}
          emptyCopy="No matching sites"
          ariaLabel="Sites"
        />
      </div>
      <span className="caption mono">picked: {JSON.stringify(picked)}</span>
    </div>
  )
}

// ---------------------------------------------------------------- status & display

function BadgeDemo() {
  const colors: BadgeColor[] = ['grey', 'brand', 'blue', 'success', 'warning', 'danger']
  return (
    <div className="stack">
      <div className="row">{colors.map(c => <Badge key={c} color={c} size="sm" uppercase>{c}</Badge>)}</div>
      <div className="row">{colors.map(c => <Badge key={c} color={c} size="sm" outline>{c}</Badge>)}</div>
      <div className="row">
        <Badge size="sm" uppercase color="success">Live</Badge>
        <Badge size="sm" uppercase color="warning" icon={<TbAlertTriangle />}>Lagging</Badge>
        <Badge size="md" color="blue">12 tracks</Badge>
        <Badge size="lg" color="grey">size lg</Badge>
      </div>
    </div>
  )
}

function AvatarDemo() {
  return (
    <div className="row" style={{ gap: 'var(--space-md)' }}>
      <Avatar size={40} username="jdoe" firstName="Jane" lastName="Doe" />
      <Avatar size={32} username="mkowalski" firstName="Marek" lastName="Kowalski" />
      <Avatar size={28} username="operator7" />
      <Avatar size={24} username="broken" firstName="Image" lastName="Failed" src="https://invalid.example/avatar.png" />
      <span className="caption">Initials fallback, including a failed image.</span>
    </div>
  )
}

function InfoTipDemo() {
  return (
    <div className="field" style={narrow}>
      <Label htmlFor="demo-gate" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        Gate distance
        <InfoTip label="Gate distance">Contacts further than this from a track's predicted position start a new track instead of updating it.</InfoTip>
      </Label>
      <Input id="demo-gate" defaultValue="2.5" />
    </div>
  )
}

function TooltipDemo() {
  const [hover, setHover] = useState<{ x: number; y: number; name: string } | null>(null)
  const features = [
    { name: 'TRK-0412 · VIPER 21', left: '18%', top: '40%' },
    { name: 'TRK-0419 · EVER GIVEN', left: '52%', top: '62%' },
    { name: 'TRK-0426 · RAVEN 04', left: '78%', top: '28%' },
  ]
  return (
    <div className="frame" style={{ height: 140 }}>
      {features.map(f => (
        <span
          key={f.name}
          onPointerMove={e => setHover({ x: e.clientX, y: e.clientY, name: f.name })}
          onPointerLeave={() => setHover(null)}
          style={{ position: 'absolute', left: f.left, top: f.top, width: 14, height: 14, borderRadius: '50%', background: 'var(--intel-cyan)', border: '2px solid var(--color-bg-primary)', cursor: 'pointer' }}
        />
      ))}
      <span className="caption" style={{ position: 'absolute', left: 8, bottom: 6 }}>Hover a point</span>
      {hover && <Tooltip x={hover.x} y={hover.y} content={hover.name} />}
    </div>
  )
}

function ItemClassificationBarDemo() {
  return (
    <div className="stack" style={{ gap: 'var(--space-sm)', maxWidth: 520 }}>
      <ItemClassificationBar banner="UNCLASSIFIED" level="UNCLASSIFIED" />
      <ItemClassificationBar banner="UNCLASSIFIED//REL TO USA, FVEY" level="UNCLASSIFIED" />
      <ItemClassificationBar banner={null} />
    </div>
  )
}

function ClassificationBannerDemo() {
  return (
    <div className="frame" style={{ height: 120 }}>
      <ClassificationBanner enabled text="UNCLASSIFIED" background="var(--classification-unclassified-bg)" color="var(--classification-unclassified-text)" />
      <div style={{ position: 'absolute', inset: 19, display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="caption">
        Application content
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- page structure

function HeaderActions() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <AssistantButton open={open} onToggle={() => setOpen(o => !o)} />
      <Avatar size={28} username="jdoe" firstName="Jane" lastName="Doe" />
    </>
  )
}

function PageHeaderDemo() {
  return (
    <PageHeader
      title="Track database"
      appName="OpenTrack"
      leading={<HomeButton href="#pageheader" onNavigate={() => {}} />}
      center={<ClockBadges clocks={[{ timezone: 'UTC', label: 'Zulu' }, { timezone: 'America/New_York', label: 'HQ' }]} />}
      actions={<HeaderActions />}
    >
      <Badge size="sm" uppercase color="success">Live</Badge>
    </PageHeader>
  )
}

function TabsDemo() {
  const [view, setView] = useState('tracks')
  const [tab, setTab] = useState('summary')
  return (
    <div className="stack" style={{ gap: 'var(--space-lg)' }}>
      <div className="frame" style={{ borderStyle: 'solid', borderColor: 'var(--color-glass-border)' }}>
        <Tabs variant="bar" aria-label="Workspaces" value={view} onChange={setView}
          tabs={[{ id: 'sources', label: 'Sources' }, { id: 'tracks', label: 'Tracks' }, { id: 'schema', label: 'Schema' }, { id: 'audit', label: 'Audit', disabled: true }]} />
      </div>
      <div>
        <Tabs aria-label="Track detail" idPrefix="demo-detail" value={tab} onChange={setTab}
          tabs={[
            { id: 'summary', label: 'Summary', icon: <TbInfoCircle /> },
            { id: 'contacts', label: 'Contacts', count: 214 },
            { id: 'reviews', label: 'Reviews', badge: 3, badgeLabel: '3 pending' },
          ]} />
        <TabPanel id={tab} idPrefix="demo-detail" style={{ padding: 'var(--space-md) 0 0' }}>
          {tab === 'summary' && <span>VIPER 21 · air · last contact 14:02:11Z</span>}
          {tab === 'contacts' && <span className="mono">214 contacts from 3 sources</span>}
          {tab === 'reviews' && <span>3 associations wait for review.</span>}
        </TabPanel>
      </div>
    </div>
  )
}

function CollapsiblePanelDemo() {
  const [q, setQ] = useState('')
  const rows = TRACKS.filter(t => t.callsign.toLowerCase().includes(q.toLowerCase())).slice(0, 5)
  return (
    <div className="stack">
      <CollapsiblePanel
        title="Sources"
        badge={String(rows.length)}
        titleActions={<Input aria-label="Search tracks" placeholder="Search" value={q} onChange={e => setQ(e.target.value)} style={{ width: 180, height: 26 }} />}
        actions={<Button size="sm" variant="secondary" icon={<TbPlus />}>Add</Button>}
      >
        <DataTable aria-label="Tracks" rows={rows} rowKey={t => t.id} columns={TRACK_COLUMNS.slice(0, 4)} empty="No tracks match the search." />
      </CollapsiblePanel>
      <CollapsiblePanel title="Retention" defaultOpen={false}>
        <span>Tracks are kept for 30 days.</span>
      </CollapsiblePanel>
    </div>
  )
}

function DisclosureDemo() {
  return (
    <div className="stack" style={{ gap: 'var(--space-xs)' }}>
      <Disclosure label={<span className="mono">sensors (3)</span>}>
        <div className="mono" style={{ paddingLeft: 20, color: 'var(--color-text-secondary)' }}>
          <div>0: radar-north</div><div>1: ais-coastal</div><div>2: eo-tower-4</div>
        </div>
      </Disclosure>
      <Disclosure label={<span className="mono">tags (2)</span>} defaultOpen>
        <div className="mono" style={{ paddingLeft: 20, color: 'var(--color-text-secondary)' }}>
          <div>0: "fishing"</div><div>1: "dark-ship"</div>
        </div>
      </Disclosure>
    </div>
  )
}

function StepperDemo() {
  const ids = ['connect', 'map', 'review', 'start']
  const labels = ['Connect', 'Map fields', 'Review', 'Start']
  const [current, setCurrent] = useState(1)
  const steps: StepItem[] = ids.map((id, i) => ({ id, label: labels[i], status: i < current ? 'complete' : i === current ? 'current' : 'upcoming' }))
  return (
    <div className="stack">
      <Stepper aria-label="Onboard a source" steps={steps} onStepClick={id => setCurrent(ids.indexOf(id))} />
      <div className="row">
        <Button size="sm" variant="secondary" disabled={current === 0} onClick={() => setCurrent(c => c - 1)}>Back</Button>
        <Button size="sm" disabled={current === ids.length - 1} onClick={() => setCurrent(c => c + 1)}>Next</Button>
        <Stepper aria-label="Failed import" steps={[{ id: 'a', label: 'Upload', status: 'complete' }, { id: 'b', label: 'Validate', status: 'error' }, { id: 'c', label: 'Import', status: 'upcoming' }]} style={{ marginLeft: 'auto' }} />
      </div>
    </div>
  )
}

function SideNavDemo() {
  const [open, setOpen] = useState(false)
  const [left, setLeft] = useState(false)
  return (
    <div className="row">
      <Button size="sm" onClick={() => setOpen(o => !o)}>{open ? 'Close' : 'Open'} right drawer</Button>
      <Button size="sm" variant="secondary" onClick={() => setLeft(o => !o)}>{left ? 'Close' : 'Open'} left drawer</Button>
      <span className="caption">Drag the inner edge to resize. Both stack with each other.</span>
      <SideNav open={open} side="right" ariaLabel="Track detail" storageKey="staresdk-docs:sidenav-right">
        <DrawerBody title="TRK-0412 · VIPER 21" onClose={() => setOpen(false)} />
      </SideNav>
      <SideNav open={left} side="left" width={300} ariaLabel="Layers" storageKey="staresdk-docs:sidenav-left">
        <DrawerBody title="Layers" onClose={() => setLeft(false)} />
      </SideNav>
    </div>
  )
}

function DrawerBody({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div style={{ fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: '1px solid var(--color-glass-border)' }}>
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-accent)', flex: 1 }}>{title}</span>
        <Button variant="ghost" size="xs" icon={<TbX />} aria-label="Close" title="Close" onClick={onClose} />
      </div>
      <div style={{ padding: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', fontSize: 12 }}>
        <ItemClassificationBar banner="UNCLASSIFIED" level="UNCLASSIFIED" />
        <div className="field"><Label htmlFor="drawer-name">Name</Label><Input id="drawer-name" defaultValue={title} /></div>
        <Disclosure label="Details">
          <div className="mono" style={{ paddingLeft: 20, color: 'var(--color-text-secondary)' }}>lat 38.8895 · lon -77.0353</div>
        </Disclosure>
      </div>
    </div>
  )
}

function ModalDemo() {
  const [open, setOpen] = useState<'modal' | 'admin' | null>(null)
  const { toast } = useToast()
  return (
    <div className="row">
      <Button size="sm" onClick={() => setOpen('modal')}>Open modal</Button>
      <Button size="sm" variant="secondary" onClick={() => setOpen('admin')}>Open admin modal</Button>
      {open === 'modal' && (
        <Modal title="Rename source" onClose={() => setOpen(null)} width={420}>
          <div className="stack" style={{ padding: 'var(--space-md)' }}>
            <div className="field"><Label htmlFor="modal-name">Name</Label><Input id="modal-name" defaultValue="AIS — Channel" autoFocus /></div>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <Button size="sm" variant="secondary" onClick={() => setOpen(null)}>Cancel</Button>
              <Button size="sm" onClick={() => { setOpen(null); toast({ variant: 'success', message: 'Source renamed.' }) }}>Save</Button>
            </div>
          </div>
        </Modal>
      )}
      {open === 'admin' && (
        <AdminModal title="Create user" onClose={() => setOpen(null)}>
          <div className="stack" style={{ padding: 'var(--space-md)' }}>
            <div className="field"><Label htmlFor="admin-email">Email</Label><Input id="admin-email" type="email" placeholder="name@example.mil" /></div>
            <div className="field"><Label>Role</Label><Select ariaLabel="Role" value="operator" onChange={() => {}} options={[{ value: 'operator', label: 'Operator' }, { value: 'admin', label: 'Administrator' }]} /></div>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <Button size="sm" variant="secondary" onClick={() => setOpen(null)}>Cancel</Button>
              <Button size="sm" onClick={() => setOpen(null)}>Create</Button>
            </div>
          </div>
        </AdminModal>
      )}
    </div>
  )
}

const CLASSIFY_OPTIONS: ClassifyOptions = {
  levels: [{ id: 'U', name: 'UNCLASSIFIED' }],
  categories: [],
  releasability: [
    { code: 'FVEY', name: 'Five Eyes' },
    { code: 'GBR', name: 'United Kingdom' },
    { code: 'CAN', name: 'Canada' },
    { code: 'AUS', name: 'Australia' },
    { code: 'NZL', name: 'New Zealand' },
  ],
  noforn: true,
  domestic: 'USA',
}

function bannerFor(m: ClassificationMarking): { banner: string | null; level: string | null } {
  const level = CLASSIFY_OPTIONS.levels.find(l => l.id === m.classification)?.name ?? null
  if (!level) return { banner: null, level: null }
  const controls = (m.restrictions ?? []).map(r => r.split(':')[1] ?? r)
  const sharing = m.sharing ?? []
  const dissem = sharing.includes('NOFORN') ? ['NOFORN'] : sharing.length ? [`REL TO ${sharing.join(', ')}`] : []
  return { banner: [level, ...controls, ...dissem].join('//'), level }
}

function ClassifyModalDemo() {
  const [open, setOpen] = useState(false)
  const [marking, setMarking] = useState<ClassificationMarking>({ classification: 'U', restrictions: [], sharing: ['USA', 'FVEY'] })
  const [favorites, setFavorites] = useState<ClassificationMarking[]>([{ classification: 'U', restrictions: [], sharing: [] }])
  const { banner, level } = bannerFor(marking)
  return (
    <div className="stack" style={{ maxWidth: 520 }}>
      <ItemClassificationBar banner={banner} level={level} />
      <div className="row"><Button size="sm" onClick={() => setOpen(true)}>Classify…</Button></div>
      {open && (
        <ClassifyModal
          options={CLASSIFY_OPTIONS}
          value={marking}
          favorites={favorites}
          onToggleFavorite={(m, add) => setFavorites(f => (add ? [...f, m] : f.filter(x => JSON.stringify(x) !== JSON.stringify(m))))}
          bannerFor={bannerFor}
          onConfirm={m => { setMarking(m); setOpen(false) }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}

function DraggablePopupDemo() {
  const [open, setOpen] = useState(false)
  return (
    <div className="row">
      <Button size="sm" onClick={() => setOpen(o => !o)}>{open ? 'Close' : 'Open'} popup</Button>
      <span className="caption">Drag it by its header; resize from the corner.</span>
      {open && (
        <DraggablePopup
          storageKey="staresdk-docs:popup"
          title="TRK-0412"
          getDefaultPos={() => ({ x: Math.max(16, window.innerWidth - 380), y: 120 })}
          headerRight={<Button variant="ghost" size="xs" icon={<TbX />} aria-label="Close" title="Close" onClick={() => setOpen(false)} />}
        >
          <div style={{ padding: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
            <div className="row"><Badge size="sm" uppercase color="success">Live</Badge><Badge size="sm" color="blue">Air</Badge></div>
            <div className="mono">38.8895, -77.0353 · 412 kn</div>
            <div className="muted">Last contact 14:02:11Z from radar-north.</div>
          </div>
        </DraggablePopup>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- app shell

function AppCardDemo() {
  const { toast } = useToast()
  const go = (href: string) => toast({ variant: 'info', message: `Would navigate to ${href}` })
  return (
    <div className="row" style={{ gap: 'var(--space-md)' }}>
      <AppCard label="Track DB" icon={<TbRadar2 />} href="#appcard" description="Fused tracks and their sources" onNavigate={go} />
      <AppCard label="Atlas" icon={<TbMap2 />} href="#appcard" description="Maps, layers and terrain analysis" onNavigate={go} />
      <AppCard label="Imagery" icon={<TbPhoto />} href="#appcard" description="Search and exploit imagery" disabled disabledTooltip="Ask an administrator for access" />
    </div>
  )
}

// ---------------------------------------------------------------- data

function DataTableDemo() {
  const [selected, setSelected] = useState<string | null>(null)
  return (
    <div className="stack" style={{ gap: 'var(--space-sm)' }}>
      <DataTable
        aria-label="Tracks"
        rows={TRACKS}
        rowKey={t => t.id}
        columns={TRACK_COLUMNS}
        maxHeight={260}
        selectedKey={selected}
        onRowClick={t => setSelected(t.id)}
        defaultSort={{ key: 'updated', direction: 'desc' }}
        empty="No tracks yet."
      />
      <span className="caption">48 rows · click a header to sort · click or press Enter on a row to select{selected ? ` · selected ${selected}` : ''}</span>
    </div>
  )
}

function PaginationDemo() {
  const [offset, setOffset] = useState(0)
  const total = 1284
  const limit = 50
  const [pageOffset, setPageOffset] = useState(0)
  const [pageLimit, setPageLimit] = useState(100)
  return (
    <div className="stack" style={{ gap: 'var(--space-sm)' }}>
      <Pagination offset={offset} limit={limit} total={total} itemCount={Math.min(limit, total - offset)} onOffsetChange={setOffset} />
      <Pagination offset={0} limit={25} total={null} itemCount={25} onOffsetChange={() => {}} size="sm" />
      <Pagination
        offset={pageOffset}
        limit={pageLimit}
        total={total}
        itemCount={Math.min(pageLimit, total - pageOffset)}
        onOffsetChange={setPageOffset}
        showEnds
        label="page"
        pageSizes={[50, 100, 250]}
        onLimitChange={l => { setPageLimit(l); setPageOffset(0) }}
      />
    </div>
  )
}

function AttributeTableDemo() {
  const [sort, setSort] = useState<DataTableSort | null>({ key: 'speed', direction: 'desc' })
  const [widths, setWidths] = useState<Record<string, number>>({})
  const [opened, setOpened] = useState<string | null>(null)
  // The caller sorts (here locally, standing in for a server-side sort).
  const rows = useMemo(() => {
    const col = TRACK_COLUMNS.find(c => c.key === sort?.key)
    return sort && col?.sortValue ? sortRows(TRACKS, col.sortValue, sort.direction) : TRACKS
  }, [sort])
  const columns = useMemo(
    () => TRACK_COLUMNS.map(c => ({
      ...c,
      width: widths[c.key] ?? (typeof c.width === 'number' ? c.width : 180),
      ...(c.key === 'status' ? { sortable: false, sortDisabledReason: 'Status cannot be sorted' } : null),
    })),
    [widths],
  )
  return (
    <div className="stack" style={{ gap: 'var(--space-sm)' }}>
      <DataTable
        aria-label="Track attributes"
        rows={rows}
        rowKey={t => t.id}
        columns={columns}
        maxHeight={220}
        manualSort
        sort={sort}
        onSortChange={setSort}
        pinFirstColumn
        onColumnResize={(key, width) => setWidths(w => ({ ...w, [key]: width }))}
        onRowDoubleClick={t => setOpened(t.id)}
        style={{ maxWidth: 520 }}
      />
      <span className="caption">manualSort · pinned first column · drag a header edge to resize · double-click a row{opened ? ` · opened ${opened}` : ''}</span>
    </div>
  )
}

const TREE: TreeNode[] = [
  { id: 'base', title: 'Basemaps', children: [{ id: 'base-osm', title: 'OpenStreetMap' }, { id: 'base-sat', title: 'Satellite', disabled: true, disabledReason: 'Needs an imagery licence' }] },
  { id: 'ops', title: 'Operations', children: [
    { id: 'ops-tracks', title: 'Tracks' },
    { id: 'ops-areas', title: 'Areas of interest', children: [{ id: 'aoi-north', title: 'North sector' }, { id: 'aoi-south', title: 'South sector' }] },
  ] },
  { id: 'ref', title: 'Reference', children: [{ id: 'ref-ports', title: 'Ports' }, { id: 'ref-airfields', title: 'Airfields' }] },
]

function TreeDemo() {
  const [checked, setChecked] = useState(new Set(['ops-tracks', 'base-osm']))
  const [expanded, setExpanded] = useState(new Set(['base', 'ops']))
  const [selected, setSelected] = useState<string | null>('ops-tracks')
  const toggle = (set: Set<string>, id: string, on: boolean) => { const n = new Set(set); if (on) n.add(id); else n.delete(id); return n }
  return (
    <div className="grid-2">
      <div>
        <h4 style={{ marginTop: 0 }}>selectable="multi"</h4>
        <Tree nodes={TREE} selectable="multi" checkedIds={checked} onCheckedChange={(id, on) => setChecked(s => toggle(s, id, on))}
          expandedIds={expanded} onExpandedChange={(id, open) => setExpanded(s => toggle(s, id, open))} />
      </div>
      <div>
        <h4 style={{ marginTop: 0 }}>selectable="single"</h4>
        <Tree nodes={TREE} selectable="single" checkedIds={new Set()} onCheckedChange={() => {}} selectedId={selected} onSelect={setSelected}
          expandedIds={expanded} onExpandedChange={(id, open) => setExpanded(s => toggle(s, id, open))} />
      </div>
    </div>
  )
}

function FacetsDemo() {
  const [domain, setDomain] = useState<string[]>(['air'])
  const [owner, setOwner] = useState<string[]>([])
  const flip = (set: (f: (v: string[]) => string[]) => void) => (v: string) => set(s => (s.includes(v) ? s.filter(x => x !== v) : [...s, v]))
  return (
    <div className="grid-2">
      <Facets label="Domain" icon={<TbTag />} selected={domain} onToggle={flip(setDomain)} onClear={() => setDomain([])}
        options={[{ value: 'air', label: 'Air', count: 412 }, { value: 'sea', label: 'Sea', count: 1288 }, { value: 'land', label: 'Land', count: 97 }]} />
      <Facets label="Owner" selected={owner} onToggle={flip(setOwner)} onClear={() => setOwner([])}
        options={[
          { value: 'jdoe', label: 'Jane Doe', count: 31, icon: <Avatar size={16} username="jdoe" firstName="Jane" lastName="Doe" /> },
          { value: 'mk', label: 'Marek Kowalski', count: 12, icon: <Avatar size={16} username="mk" firstName="Marek" lastName="Kowalski" /> },
        ]} />
    </div>
  )
}

function SortableListDemo() {
  const [layers, setLayers] = useState([
    { id: 'tracks', name: 'Tracks', color: 'var(--intel-cyan)' },
    { id: 'aoi', name: 'Areas of interest', color: 'var(--intel-purple)' },
    { id: 'heat', name: 'Contact density', color: 'var(--intel-heat)' },
    { id: 'ports', name: 'Ports', color: 'var(--intel-lime)' },
  ])
  return (
    <div style={{ maxWidth: 360 }}>
      <SortableList
        items={layers}
        getId={l => l.id}
        onReorder={setLayers}
        itemLabel="layer"
        renderItem={l => (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: 'var(--color-glass-bg)', border: '1px solid var(--color-glass-border)', borderRadius: 'var(--radius-sm)', flex: 1 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} />
            <span>{l.name}</span>
          </div>
        )}
      />
    </div>
  )
}

const CONTACTS = Array.from({ length: 5000 }, (_, i) => ({ id: `C-${String(i + 1).padStart(5, '0')}`, t: 1_791_302_400 + i * 7, src: ['radar-north', 'ais-coastal', 'eo-tower-4'][i % 3] }))

function VirtualListDemo() {
  return (
    <div style={{ maxWidth: 480, border: '1px solid var(--color-glass-border)', borderRadius: 'var(--radius-md)' }}>
      <VirtualList
        items={CONTACTS}
        rowHeight={28}
        maxHeight={200}
        ariaLabel="Contacts"
        getKey={c => c.id}
        emptyState="No contacts."
        renderRow={c => (
          <div className="mono" style={{ height: 28, display: 'flex', alignItems: 'center', gap: 16, padding: '0 10px', borderBottom: '1px solid var(--color-glass-border)', fontSize: 12 }}>
            <span>{c.id}</span>
            <span className="muted">{new Date(c.t * 1000).toISOString().slice(11, 19)}Z</span>
            <span className="muted">{c.src}</span>
          </div>
        )}
      />
      <div className="caption" style={{ padding: '4px 10px' }}>5,000 rows, only the visible window rendered.</div>
    </div>
  )
}

// ---------------------------------------------------------------- menus & feedback

function ContextMenuDemo() {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const { toast } = useToast()
  const act = (message: string) => () => { setMenu(null); toast({ variant: 'info', message }) }
  return (
    <div
      className="frame"
      style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'context-menu' }}
      onContextMenu={e => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY }) }}
    >
      <span className="caption">Right-click here (long-press on touch)</span>
      {menu && (
        <ContextMenu x={menu.x} y={menu.y} onClose={() => setMenu(null)} ariaLabel="Track actions" header="TRK-0412">
          <ContextMenuItem onClick={act('Following TRK-0412.')}><TbFocus2 /> Follow</ContextMenuItem>
          <ContextMenuItem onClick={act('Copied coordinates.')}><TbMap2 /> Copy coordinates</ContextMenuItem>
          <ContextMenuItem disabled onClick={() => {}}><TbShare /> Share (no recipients)</ContextMenuItem>
          <ContextMenuItem danger onClick={act('Dropped TRK-0412.')}><TbTrash /> Drop track</ContextMenuItem>
        </ContextMenu>
      )}
    </div>
  )
}

function FlyoutDemo() {
  const ref = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [favs, setFavs] = useState(new Set(['measure']))
  const { toast } = useToast()
  const items: FlyoutItem[] = [
    { id: 'measure', label: 'Measure', icon: <TbRuler2 />, shortcut: 'M', hint: 'Distance and bearing' },
    { id: 'draw', label: 'Draw area', icon: <TbPolygon />, shortcut: 'A', hint: 'Polygon or circle' },
    { id: 'los', label: 'Line of sight', icon: <TbChartLine />, hint: 'Terrain profile between two points' },
    { id: 'export', label: 'Export view', icon: <TbDownload />, disabled: true, disabledReason: 'Select at least one layer' },
  ].map(i => ({ ...i, favourite: favs.has(i.id) }))
  return (
    <div ref={ref} style={{ display: 'inline-block' }}>
      <Button size="sm" variant="secondary" icon={<TbTool />} onClick={() => setOpen(o => !o)} aria-expanded={open}>Tools</Button>
      <Flyout
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={ref}
        items={items}
        ariaLabel="Tools"
        filterable
        filterPlaceholder="Filter tools"
        onSelect={id => { setOpen(false); toast({ variant: 'info', message: `Selected ${id}.` }) }}
        onToggleFavourite={id => setFavs(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })}
      />
    </div>
  )
}

function ToastDemo() {
  const { toast, confirm } = useToast()
  return (
    <div className="row">
      <Button size="sm" variant="secondary" onClick={() => toast({ variant: 'success', message: 'Source saved.' })}>Success</Button>
      <Button size="sm" variant="secondary" onClick={() => toast({ variant: 'info', message: 'A new schema version is available.', action: { label: 'View', onClick: () => {} } })}>Info</Button>
      <Button size="sm" variant="secondary" onClick={() => toast({ variant: 'warning', message: 'Feed lag is above 30 seconds.' })}>Warning</Button>
      <Button size="sm" variant="secondary" onClick={() => toast({ variant: 'error', title: 'Layer ingest failed', message: 'The file has no geometry column.' })}>Error</Button>
      <Button
        size="sm"
        variant="danger"
        icon={<TbTrash />}
        onClick={async () => {
          const ok = await confirm('Delete source "AIS — Channel"? Its tracks stay in the database.', { title: 'Delete source', confirmLabel: 'Delete' })
          toast({ variant: ok ? 'success' : 'info', message: ok ? 'Source deleted (demo).' : 'Kept the source.' })
        }}
      >
        Confirm…
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------- content & views

const ARTICLE = `# Track association

A **contact** joins a track when it falls inside the track's *gate*. Read more in the [operator guide](#mdtext).

## Inputs

| Field | Unit | Notes |
|---|---|---|
| \`gate_m\` | metres | distance from the predicted position |
| \`max_age_s\` | seconds | older tracks are closed |

- [x] Radar and AIS sources
- [ ] EO cueing
- ~~Manual association~~ (retired)

> Associations below 0.6 confidence wait for review.

\`\`\`json
{ "gate_m": 2500, "max_age_s": 300 }
\`\`\`

\`\`\`mermaid
flowchart LR
  C[Contact] --> G{Inside gate?}
  G -- yes --> U[Update track]
  G -- no --> N[New track]
\`\`\`
`

function MDTextDemo() {
  return <div style={{ maxWidth: 720 }}><MDText markdown={ARTICLE} /></div>
}

const PROFILE = Array.from({ length: 91 }, (_, i) => {
  const d = i * 200
  const h = 180 + 120 * Math.sin(i / 9) + 70 * Math.sin(i / 3.3) + (i > 40 && i < 52 ? 90 * Math.sin(((i - 40) / 12) * Math.PI) : 0)
  return { distance_m: d, height_m: i >= 66 && i <= 69 ? null : Math.round(h) }
})

function ProfileChartDemo() {
  return (
    <div style={{ maxWidth: 760 }}>
      <ProfileChart
        aria-label="Terrain profile from the observer to the target"
        samples={PROFILE}
        sightLine={[{ distance_m: 0, height_m: 330 }, { distance_m: 18000, height_m: 240 }]}
        obstruction={{ distance_m: 9200, height_m: 284 }}
        height={180}
      />
      <span className="caption">The gap between 13.2 and 13.8 km is a run of <code>null</code> heights (no data).</span>
    </div>
  )
}

const TimeSeriesChartDemo = lazy(() => import('./views').then(m => ({ default: m.TimeSeriesChartDemo })))
const GraphViewDemo = lazy(() => import('./views').then(m => ({ default: m.GraphViewDemo })))
const MapViewDemo = lazy(() => import('./views').then(m => ({ default: m.MapViewDemo })))
const CodeEditorDemo = lazy(() => import('./views').then(m => ({ default: m.CodeEditorDemo })))

// ---------------------------------------------------------------- page anatomy

function AnatomyDemo() {
  const [view, setView] = useState('tracks')
  const [selected, setSelected] = useState<string | null>(null)
  return (
    <div className="frame" style={{ height: 460, border: 'none', borderRadius: 0, display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-sans)' }}>
      <PageHeader title="OpenTrack" appName="OpenTrack" actions={<Avatar size={28} username="jdoe" firstName="Jane" lastName="Doe" />} />
      <Tabs variant="bar" aria-label="Workspaces" value={view} onChange={setView}
        tabs={[{ id: 'sources', label: 'Sources' }, { id: 'tracks', label: 'Tracks' }, { id: 'schema', label: 'Schema' }]} />
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', minWidth: 0 }}>
          {view === 'tracks' ? (
            <>
              <CollapsiblePanel title="Tracks" badge={String(TRACKS.length)}>
                <DataTable aria-label="Tracks" rows={TRACKS} rowKey={t => t.id} columns={TRACK_COLUMNS.slice(0, 5)} maxHeight={200}
                  selectedKey={selected} onRowClick={t => setSelected(t.id)} />
              </CollapsiblePanel>
              <CollapsiblePanel title="Retention" defaultOpen={false}><span>Tracks are kept for 30 days.</span></CollapsiblePanel>
            </>
          ) : (
            <CollapsiblePanel title={view === 'sources' ? 'Sources' : 'Schema'}>
              <span className="muted" style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>{view === 'sources' ? 'No sources' : 'Loading…'}</span>
            </CollapsiblePanel>
          )}
        </div>
        {selected && (
          <aside aria-label="Track detail" style={{ width: 260, flexShrink: 0, background: 'var(--color-glass-bg)', borderLeft: '1px solid var(--color-glass-border)', boxShadow: 'var(--shadow-deep)' }}>
            <DrawerBody title={selected} onClose={() => setSelected(null)} />
          </aside>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- registry

export const DEMOS: Record<string, ComponentType> = {
  theme: ThemeDemo,
  anatomy: AnatomyDemo,
  'swatches-canonical': CanonicalSwatches,
  'swatches-extended': ExtendedSwatches,
  'swatches-status': StatusSwatches,
  'swatches-intel': IntelSwatches,
  'swatches-badge': BadgeSwatches,
  'swatches-severity': SeveritySwatches,
  'swatches-classification': ClassificationSwatches,
  typography: Typography,
  scales: Scales,
  icons: IconsDemo,
  button: ButtonDemo,
  buttonpalette: ButtonPaletteDemo,
  savebutton: SaveButtonDemo,
  popovermenubutton: PopoverMenuButtonDemo,
  input: InputDemo,
  select: SelectDemo,
  fieldselect: FieldSelectDemo,
  multiselect: MultiSelectDemo,
  unitselect: UnitSelectDemo,
  toggle: ToggleDemo,
  slider: SliderDemo,
  opacityslider: OpacitySliderDemo,
  zoomrangeslider: ZoomRangeSliderDemo,
  colorpicker: ColorPickerDemo,
  ramppicker: RampPickerDemo,
  filedropzone: FileDropZoneDemo,
  typeahead: TypeaheadDemo,
  badge: BadgeDemo,
  avatar: AvatarDemo,
  infotip: InfoTipDemo,
  tooltip: TooltipDemo,
  itemclassificationbar: ItemClassificationBarDemo,
  classificationbanner: ClassificationBannerDemo,
  pageheader: PageHeaderDemo,
  tabs: TabsDemo,
  collapsiblepanel: CollapsiblePanelDemo,
  disclosure: DisclosureDemo,
  stepper: StepperDemo,
  sidenav: SideNavDemo,
  modal: ModalDemo,
  classifymodal: ClassifyModalDemo,
  draggablepopup: DraggablePopupDemo,
  appcard: AppCardDemo,
  datatable: DataTableDemo,
  pagination: PaginationDemo,
  attributetable: AttributeTableDemo,
  tree: TreeDemo,
  facets: FacetsDemo,
  sortablelist: SortableListDemo,
  virtuallist: VirtualListDemo,
  contextmenu: ContextMenuDemo,
  flyout: FlyoutDemo,
  toast: ToastDemo,
  mdtext: MDTextDemo,
  profilechart: ProfileChartDemo,
  timeserieschart: TimeSeriesChartDemo,
  graphview: GraphViewDemo,
  mapview: MapViewDemo,
  codeeditor: CodeEditorDemo,
}
