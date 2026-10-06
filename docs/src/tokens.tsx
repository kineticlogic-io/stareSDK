// Colour swatches, type, spacing, radii and shadows. Swatch values are read from chromeTheme.ts
// (the TS mirror of styles.css, drift-tested against it), so the guide cannot disagree with the
// stylesheet; the chip itself paints the live token.
import { useState, type CSSProperties } from 'react'
import { DARK_THEME, LIGHT_THEME, type ChromeTheme } from '../../src/index'

type ScalarKey = { [K in keyof ChromeTheme]: ChromeTheme[K] extends string ? K : never }[keyof ChromeTheme]

interface Token {
  name: string
  role: string
  /** chromeTheme field holding the per-theme values. */
  field?: ScalarKey
  /** A fixed value for theme-invariant tokens. */
  fixed?: string
}

function CopyName({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className="swatch-copy swatch-name"
      title={`Copy ${text}`}
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1200)
        }, () => {})
      }}
    >
      {copied ? 'Copied' : label}
    </button>
  )
}

function Swatch({ token }: { token: Token }) {
  const dark = token.field ? DARK_THEME[token.field] : token.fixed
  const light = token.field ? LIGHT_THEME[token.field] : token.fixed
  return (
    <div className="swatch">
      <div className="swatch-chip" style={{ background: `var(${token.name})` }} />
      <div className="swatch-body">
        <CopyName text={`var(${token.name})`} label={token.name} />
        <span className="swatch-role">{token.role}</span>
        <span className="swatch-hex">
          {token.field ? (<><span>dark {dark}</span><span>light {light}</span></>) : <span>{dark} · both themes</span>}
        </span>
      </div>
    </div>
  )
}

function Swatches({ tokens }: { tokens: Token[] }) {
  return <div className="swatches">{tokens.map(t => <Swatch key={t.name} token={t} />)}</div>
}

/** A JS-only colour (no CSS custom property): both themes shown side by side. */
function PairSwatch({ name, role, dark, light }: { name: string; role: string; dark: string; light: string }) {
  return (
    <div className="swatch">
      <div className="swatch-chip swatch-chip--split">
        <div style={{ background: dark }} title={`dark ${dark}`} />
        <div style={{ background: light }} title={`light ${light}`} />
      </div>
      <div className="swatch-body">
        <CopyName text={name} label={name} />
        <span className="swatch-role">{role}</span>
        <span className="swatch-hex"><span>dark {dark}</span><span>light {light}</span></span>
      </div>
    </div>
  )
}

const CANONICAL: Token[] = [
  { name: '--color-bg-primary', field: 'colorBgPrimary', role: 'Page background' },
  { name: '--color-bg-secondary', field: 'colorBgSecondary', role: 'Inputs, recessed surfaces' },
  { name: '--color-glass-bg', field: 'colorGlassBg', role: 'Header, tab bar, panels, drawers' },
  { name: '--color-glass-border', field: 'colorGlassBorder', role: 'Panel and divider borders' },
  { name: '--color-text-primary', field: 'colorTextPrimary', role: 'Body text, table cells' },
  { name: '--color-text-secondary', field: 'colorTextSecondary', role: 'Labels, headers, hints' },
  { name: '--color-accent', field: 'colorAccent', role: 'Interaction and structure titles, focus' },
  { name: '--color-destructive', field: 'colorDestructive', role: 'Destructive actions, errors' },
]

const EXTENDED: Token[] = [
  { name: '--surface-layer-2', field: 'surfaceLayer2', role: 'Raised layer, code blocks, popups' },
  { name: '--border-strong', field: 'borderStrong', role: 'Emphasised borders, slider tracks' },
  { name: '--text-muted', field: 'textMuted', role: 'Placeholders, de-emphasised text' },
  { name: '--text-inverse', field: 'textInverse', role: 'Text on accent fills' },
  { name: '--brand-primary-hover', field: 'brandPrimaryHover', role: 'Primary button hover' },
  { name: '--brand-primary-active', field: 'brandPrimaryActive', role: 'Primary button pressed' },
  { name: '--brand-subtle', field: 'brandSubtle', role: 'Accent wash (code chips, selection)' },
]

const STATUS: Token[] = [
  { name: '--status-success', field: 'statusSuccess', role: 'Success, live' },
  { name: '--status-warning', field: 'statusWarning', role: 'Warning, degraded' },
  { name: '--status-info', field: 'statusInfo', role: 'Information' },
  { name: '--color-destructive', field: 'colorDestructive', role: 'Critical, failed' },
  { name: '--color-link', field: 'statusInfo', role: 'Every inline link (underlined)' },
  { name: '--color-link-hover', field: 'colorLinkHover', role: 'Link hover' },
]

const INTEL: Token[] = [
  { name: '--intel-cyan', fixed: '#1FCFE8', role: 'Data-viz series' },
  { name: '--intel-purple', fixed: '#7C5CFA', role: 'Data-viz series' },
  { name: '--intel-lime', fixed: '#9FE870', role: 'Data-viz series' },
  { name: '--intel-heat', fixed: '#FF6A3D', role: 'Heat, hot spots' },
]

const CLASSIFICATION = [
  { level: 'unclassified', label: 'UNCLASSIFIED', bg: '#006400', fg: '#ffffff' },
  { level: 'cui', label: 'CUI', bg: '#502b85', fg: '#ffffff' },
]

export function CanonicalSwatches() { return <Swatches tokens={CANONICAL} /> }
export function ExtendedSwatches() { return <Swatches tokens={EXTENDED} /> }
export function StatusSwatches() { return <Swatches tokens={STATUS} /> }
export function IntelSwatches() { return <Swatches tokens={INTEL} /> }

export function BadgeSwatches() {
  const keys = Object.keys(DARK_THEME.badgeBg) as (keyof ChromeTheme['badgeBg'])[]
  return (
    <div className="swatches">
      {keys.map(k => (
        <PairSwatch key={k} name={`BADGE_BG.${k}`} role={`Badge color="${k}"`} dark={DARK_THEME.badgeBg[k]} light={LIGHT_THEME.badgeBg[k]} />
      ))}
    </div>
  )
}

export function SeveritySwatches() {
  const keys = Object.keys(DARK_THEME.severityRamp) as (keyof ChromeTheme['severityRamp'])[]
  return (
    <div className="swatches">
      {keys.map(k => (
        <PairSwatch key={k} name={`severityRamp.${k}`} role={k[0].toUpperCase() + k.slice(1)} dark={DARK_THEME.severityRamp[k]} light={LIGHT_THEME.severityRamp[k]} />
      ))}
    </div>
  )
}

export function ClassificationSwatches() {
  return (
    <div className="swatches">
      {CLASSIFICATION.map(c => (
        <div className="swatch" key={c.level}>
          <div
            className="swatch-chip"
            style={{
              background: `var(--classification-${c.level}-bg)`,
              color: `var(--classification-${c.level}-text)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
            }}
          >
            {c.label}
          </div>
          <div className="swatch-body">
            <CopyName text={`var(--classification-${c.level}-bg)`} label={`--classification-${c.level}-bg`} />
            <span className="swatch-role">Text <span className="mono">--classification-{c.level}-text</span></span>
            <span className="swatch-hex"><span>{c.bg} / {c.fg} · both themes</span></span>
          </div>
        </div>
      ))}
    </div>
  )
}

const TYPE: { role: string; spec: string; style: CSSProperties; sample: string }[] = [
  { role: 'Wordmark', spec: '--font-header · 18 / 600', style: { fontFamily: 'var(--font-header)', fontSize: 18, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }, sample: 'OpenStare' },
  { role: 'Page title', spec: '14 / 600 · 0.08em · accent', style: { fontSize: 14, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-accent)' }, sample: 'Track database' },
  { role: 'Panel title, active tab', spec: '12 / 600 · 0.08em · accent', style: { fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-accent)' }, sample: 'Sources' },
  { role: 'Inactive tab', spec: '12 / 400 · 0.08em · secondary', style: { fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }, sample: 'Schema' },
  { role: 'Label, table header', spec: '11 / 600 · 0.08em · secondary', style: { fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }, sample: 'Callsign' },
  { role: 'Body, table cells', spec: '12 / 400 · primary', style: { fontSize: 12 }, sample: 'Contacts further than the gate distance start a new track.' },
  { role: 'Supporting text', spec: '11–12 / 400 · secondary', style: { fontSize: 11, color: 'var(--color-text-secondary)' }, sample: 'Last updated 4 minutes ago' },
  { role: 'Empty / loading state', spec: '12 / 400 · uppercase · secondary', style: { fontSize: 12, textTransform: 'uppercase', color: 'var(--color-text-secondary)' }, sample: 'No sources' },
  { role: 'Data values', spec: '--font-mono · 12', style: { fontFamily: 'var(--font-mono)', fontSize: 12 }, sample: 'TRK-0412  38.8895, -77.0353  2026-10-06T14:02:11Z' },
]

export function Typography() {
  return (
    <div>
      {TYPE.map(t => (
        <div className="type-row" key={t.role}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{t.role}</div>
            <div className="caption mono">{t.spec}</div>
          </div>
          <div style={{ ...t.style, minWidth: 0, overflowWrap: 'anywhere' }}>{t.sample}</div>
        </div>
      ))}
    </div>
  )
}

const SPACE = [['xs', 4], ['sm', 8], ['md', 16], ['lg', 24], ['xl', 32], ['2xl', 48], ['3xl', 64]] as const
const RADII = [['sm', 4], ['md', 6], ['lg', 8], ['xl', 10]] as const

export function Scales() {
  return (
    <div className="stack" style={{ gap: 'var(--space-lg)' }}>
      <div>
        <h4 style={{ marginTop: 0 }}>Spacing</h4>
        <div className="scale">
          {SPACE.map(([k, px]) => (
            <div className="scale-item" key={k}>
              <div style={{ width: `var(--space-${k})`, height: `var(--space-${k})`, background: 'var(--color-accent)', borderRadius: 2 }} />
              <span className="mono">--space-{k}</span>
              <span>{px}px</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h4>Radii</h4>
        <div className="scale">
          {RADII.map(([k, px]) => (
            <div className="scale-item" key={k}>
              <div style={{ width: 56, height: 40, background: 'var(--color-glass-bg)', border: '1px solid var(--border-strong)', borderRadius: `var(--radius-${k})` }} />
              <span className="mono">--radius-{k}</span>
              <span>{px}px</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h4>Shadows</h4>
        <div className="scale" style={{ gap: 'var(--space-xl)' }}>
          {(['standard', 'deep'] as const).map(k => (
            <div className="scale-item" key={k}>
              <div style={{ width: 120, height: 64, background: 'var(--color-glass-bg)', border: '1px solid var(--color-glass-border)', borderRadius: 'var(--radius-lg)', boxShadow: `var(--shadow-${k})` }} />
              <span className="mono">--shadow-{k}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
