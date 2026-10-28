/**
 * KeyValueTree — a read-only, collapsible tree of `key: value` rows for browsing structured
 * metadata: file headers, decoded telemetry, any nested record (0.2.34; moved from OpenStare
 * VANTAGE's NITF metadata tree so its KLV telemetry view can share it).
 *
 * - **Read-only.** No selection, no checkboxes, no editing — unlike `Tree`, which is a picker.
 * - **Controlled expansion.** `expandedIds` is owned by the caller; `onToggle` reports a row's
 *   toggle with its depth. A row expands when it has `children`, a `block`, or is `expandable`
 *   (its body comes from `renderExpanded`, e.g. a part fetched on demand).
 * - **Values.** `label: value`; a row with `interpreted` shows `INTERPRETED (value)`. `muted`
 *   values (absent, sentinel) are dimmed. A `block` shows in a bounded, scrollable monospace box.
 * - **Copy.** Each leaf value row reveals a copy button on hover or keyboard focus (always
 *   Tab-reachable); it copies the raw `value`, never the interpreted reading. `copyValues={false}`
 *   turns it off.
 * - **Highlight.** `query` highlights every occurrence in keys and values (filtering is the
 *   caller's, with `filterKeyValueTree`, so it can keep its own expansion state). Built from React
 *   children only, never markup.
 * - **Indent cap.** Indentation stops growing past depth 5, so deep trees keep their width.
 * - **ARIA.** `role="tree"` with `treeitem` rows (`aria-expanded` on expandable ones) and `group`
 *   children; Enter/Space toggles.
 */
import type { CSSProperties, KeyboardEvent, MouseEvent, ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { TbChevronRight, TbCopy, TbCopyCheck } from 'react-icons/tb'
import { keyValueMatchRanges } from './KeyValueTree.helpers.js'
import type { KeyValueNode } from './KeyValueTree.helpers.js'

export const KEY_VALUE_INDENT_PX = 10
export const KEY_VALUE_MAX_INDENT_DEPTH = 5
const EXPANDER_WIDTH = 14
const COPIED_MS = 1200

export interface KeyValueTreeProps {
  nodes: KeyValueNode[]
  'aria-label': string
  expandedIds: ReadonlySet<string>
  onToggle: (node: KeyValueNode, depth: number) => void
  /** Highlight this text (case-insensitive) in keys and values. */
  query?: string
  /** The expanded body of an `expandable` row. */
  renderExpanded?: (node: KeyValueNode, depth: number) => ReactNode
  /** Show the copy button on leaf value rows (default true). */
  copyValues?: boolean
  /** The depth of the first level (a tree nested under another tree's row). Default 0. */
  depthOffset?: number
  /** Render only the rows, without the `role="tree"` wrapper (for a subtree inside another). */
  asGroup?: boolean
  style?: CSSProperties
}

const ROOT_STYLE: CSSProperties = {
  width: '100%',
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  lineHeight: 1.5,
  color: 'var(--color-text-primary)',
  textAlign: 'left',
}
const ROW_STYLE: CSSProperties = { position: 'relative', display: 'flex', alignItems: 'flex-start', gap: 2, borderRadius: 3 }
const EXPANDER_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: EXPANDER_WIDTH,
  flexShrink: 0,
  height: 16,
  color: 'var(--color-text-secondary)',
  fontSize: 11,
  transition: 'transform 0.12s ease',
}
const CONTENT_STYLE: CSSProperties = { flex: 1, minWidth: 0, overflowWrap: 'anywhere' }
const KEY_STYLE: CSSProperties = { color: 'var(--color-text-secondary)' }
const SEPARATOR_STYLE: CSSProperties = { color: 'var(--text-muted)' }
const VALUE_STYLE: CSSProperties = { color: 'var(--color-text-primary)' }
const MUTED_STYLE: CSSProperties = { color: 'var(--text-muted)' }
const INTERPRETED_STYLE: CSSProperties = { color: 'var(--color-text-secondary)' }
const HIGHLIGHT_STYLE: CSSProperties = { background: 'var(--brand-subtle)', color: 'var(--color-text-primary)', borderRadius: 2 }
const BLOCK_STYLE: CSSProperties = {
  display: 'block',
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  color: 'var(--color-text-primary)',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
  maxHeight: 200,
  overflow: 'auto',
  background: 'var(--color-bg-secondary)',
  border: '1px solid var(--color-glass-border)',
  borderRadius: 4,
  padding: 'var(--space-sm)',
  marginLeft: EXPANDER_WIDTH,
}
const COPY_STYLE: CSSProperties = {
  position: 'absolute',
  right: 'var(--space-xs)',
  top: '50%',
  transform: 'translateY(-50%)',
  width: 16,
  height: 16,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  background: 'transparent',
  padding: 0,
  cursor: 'pointer',
  color: 'var(--color-text-secondary)',
}
const LIVE_REGION_STYLE: CSSProperties = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }

function highlighted(text: string, lowerQuery: string): ReactNode {
  const ranges = keyValueMatchRanges(text, lowerQuery)
  if (ranges.length === 0) return text
  const parts: ReactNode[] = []
  let at = 0
  ranges.forEach(([s, e], i) => {
    if (s > at) parts.push(text.slice(at, s))
    parts.push(
      <span key={i} className="ui-key-value-tree__match" style={HIGHLIGHT_STYLE}>
        {text.slice(s, e)}
      </span>,
    )
    at = e
  })
  if (at < text.length) parts.push(text.slice(at))
  return parts
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])
  const copy = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    void navigator.clipboard?.writeText(value).then(() => {
      setCopied(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), COPIED_MS)
    })
  }
  return (
    <>
      <button
        type="button"
        className="ui-key-value-tree__copy"
        aria-label={`Copy ${label}`}
        title={`Copy ${label}`}
        onClick={copy}
        onKeyDown={(e: KeyboardEvent) => e.stopPropagation()}
        style={COPY_STYLE}
      >
        {copied ? <TbCopyCheck /> : <TbCopy />}
      </button>
      <span role="status" style={LIVE_REGION_STYLE}>
        {copied ? 'Copied' : ''}
      </span>
    </>
  )
}

interface RowProps {
  node: KeyValueNode
  depth: number
  tree: KeyValueTreeProps
  lowerQuery: string
}

function Row({ node, depth, tree, lowerQuery }: RowProps) {
  const [hovered, setHovered] = useState(false)
  const children = node.children ?? []
  const expandable = children.length > 0 || node.block !== undefined || node.expandable === true
  const expanded = expandable && tree.expandedIds.has(node.id)
  const copy = (tree.copyValues ?? true) && !expandable && !node.muted && node.value !== undefined
  const toggle = () => {
    if (expandable) tree.onToggle(node, depth)
  }
  return (
    <div role="none">
      <div
        role="treeitem"
        aria-label={node.label}
        aria-expanded={expandable ? expanded : undefined}
        tabIndex={expandable ? 0 : -1}
        onClick={toggle}
        onKeyDown={e => {
          if (expandable && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            toggle()
          }
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={copy ? 'ui-key-value-tree__row ui-key-value-tree__row--copy' : 'ui-key-value-tree__row'}
        style={{
          ...ROW_STYLE,
          paddingLeft: Math.min(depth, KEY_VALUE_MAX_INDENT_DEPTH) * KEY_VALUE_INDENT_PX,
          paddingRight: copy ? 20 : 0,
          background: hovered && expandable ? 'var(--color-glass-bg)' : 'transparent',
          cursor: expandable ? 'pointer' : 'default',
        }}
      >
        <span aria-hidden style={{ ...EXPANDER_STYLE, transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', opacity: expandable ? 1 : 0 }}>
          <TbChevronRight />
        </span>
        <div style={CONTENT_STYLE}>
          <span style={KEY_STYLE}>{highlighted(node.label, lowerQuery)}</span>
          {node.value !== undefined && (
            <>
              <span style={SEPARATOR_STYLE}>: </span>
              {node.interpreted !== undefined ? (
                <>
                  <span style={node.muted ? MUTED_STYLE : VALUE_STYLE}>{highlighted(node.interpreted.toUpperCase(), lowerQuery)}</span>
                  <span style={INTERPRETED_STYLE}> ({highlighted(node.value, lowerQuery)})</span>
                </>
              ) : (
                <span style={node.muted ? MUTED_STYLE : VALUE_STYLE}>{highlighted(node.value, lowerQuery)}</span>
              )}
            </>
          )}
        </div>
        {copy && <CopyButton value={node.value as string} label={node.label} />}
      </div>
      {expanded && node.block !== undefined && <div style={BLOCK_STYLE}>{node.block}</div>}
      {expanded && node.block === undefined && children.length === 0 && tree.renderExpanded && tree.renderExpanded(node, depth + 1)}
      {expanded && children.length > 0 && (
        <div role="group">
          {children.map(child => (
            <Row key={child.id} node={child} depth={depth + 1} tree={tree} lowerQuery={lowerQuery} />
          ))}
        </div>
      )}
    </div>
  )
}

export function KeyValueTree(props: KeyValueTreeProps) {
  const lowerQuery = (props.query ?? '').trim().toLowerCase()
  const depth = props.depthOffset ?? 0
  const rows = props.nodes.map(node => <Row key={node.id} node={node} depth={depth} tree={props} lowerQuery={lowerQuery} />)
  if (props.asGroup) {
    return (
      <div role="group" style={props.style}>
        {rows}
      </div>
    )
  }
  return (
    <div role="tree" aria-label={props['aria-label']} className="ui-key-value-tree" style={{ ...ROOT_STYLE, ...props.style }}>
      {rows}
    </div>
  )
}
