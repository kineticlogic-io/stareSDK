/**
 * KeyValueTree helpers — the pure parts of `KeyValueTree`: the node shape, a filter that prunes
 * (never dims), the substring ranges the highlight is built from, and a JSON-to-nodes builder.
 */

/** One row of a key/value tree. */
export interface KeyValueNode {
  /** Unique within the tree (a path such as `st0601.platform_heading_angle`). */
  id: string
  /** The key, shown first. */
  label: string
  /** The raw value, shown after the key (`label: value`). Absent on a pure container row. */
  value?: string
  /**
   * A derived reading of `value` (e.g. a code's meaning). Shown first, upper-cased, with the raw
   * value after it in parentheses; `value` is never replaced by it, and copying a row copies the
   * raw value.
   */
  interpreted?: string
  /** An absent or sentinel value: shown muted, never copied. */
  muted?: boolean
  children?: KeyValueNode[]
  /** A long raw payload, shown when the row is expanded in a bounded, scrollable monospace block. */
  block?: string
  /**
   * The row expands to content the caller renders (`KeyValueTree`'s `renderExpanded`) — e.g. a
   * part fetched on demand — even though it has no `children`.
   */
  expandable?: boolean
}

/** Every case-insensitive occurrence of `lowerQuery` in `text` as `[start, end)` pairs.
 *  `lowerQuery` must already be lower-cased. */
export function keyValueMatchRanges(text: string, lowerQuery: string): Array<[number, number]> {
  if (lowerQuery.length === 0) return []
  const lowerText = text.toLowerCase()
  const ranges: Array<[number, number]> = []
  let from = 0
  while (from <= lowerText.length) {
    const i = lowerText.indexOf(lowerQuery, from)
    if (i === -1) break
    ranges.push([i, i + lowerQuery.length])
    from = i + lowerQuery.length
  }
  return ranges
}

export interface KeyValueFilterResult {
  /** The pruned tree. */
  nodes: KeyValueNode[]
  /** How many rows matched themselves (not counting pass-through ancestors). */
  matchCount: number
  /** Every ancestor of every match: expand these so no match is hidden. */
  autoExpand: Set<string>
  matchedIds: Set<string>
}

function matches(node: KeyValueNode, q: string): boolean {
  return [node.label, node.value, node.block, node.interpreted].some(t => t !== undefined && t.toLowerCase().includes(q))
}

/**
 * Prune `nodes` to the rows whose key, value, interpreted reading or block contains `query`
 * (case-insensitive, plain substring — never a pattern). A matching row keeps all its children; a
 * row with a matching descendant stays with only its surviving children; everything else is
 * removed. An empty query returns the input unchanged. Does not mutate the input.
 */
export function filterKeyValueTree(nodes: KeyValueNode[], query: string): KeyValueFilterResult {
  const q = query.trim().toLowerCase()
  if (q.length === 0) return { nodes, matchCount: 0, autoExpand: new Set(), matchedIds: new Set() }
  const matchedIds = new Set<string>()
  const autoExpand = new Set<string>()
  function walk(node: KeyValueNode, ancestors: string[]): KeyValueNode | null {
    const kept: KeyValueNode[] = []
    for (const child of node.children ?? []) {
      const r = walk(child, [...ancestors, node.id])
      if (r) kept.push(r)
    }
    if (matches(node, q)) {
      matchedIds.add(node.id)
      ancestors.forEach(a => autoExpand.add(a))
      return { ...node }
    }
    return kept.length > 0 ? { ...node, children: kept } : null
  }
  const out: KeyValueNode[] = []
  for (const n of nodes) {
    const r = walk(n, [])
    if (r) out.push(r)
  }
  return { nodes: out, matchCount: matchedIds.size, autoExpand, matchedIds }
}

/** A scalar as row text: strings as they are, numbers and booleans in JSON form. */
function scalarText(v: unknown): string {
  return typeof v === 'string' ? v : JSON.stringify(v)
}

/**
 * Nodes for a JSON value — every key of every object and every element of every array, at any
 * depth, in order (array elements labelled by index). `null` is a muted `null`. Nothing is
 * trimmed or reordered; ids are `idPrefix` plus the path (`a.b.0.c`).
 */
export function jsonToKeyValueNodes(value: unknown, idPrefix = ''): KeyValueNode[] {
  const node = (label: string, v: unknown, id: string): KeyValueNode => {
    if (v === null || v === undefined) return { id, label, value: 'null', muted: true }
    if (Array.isArray(v)) return { id, label, value: `[${v.length}]`, children: v.map((x, i) => node(String(i), x, `${id}.${i}`)) }
    if (typeof v === 'object') {
      const entries = Object.entries(v as Record<string, unknown>)
      return { id, label, value: `{${entries.length}}`, children: entries.map(([k, x]) => node(k, x, `${id}.${k}`)) }
    }
    return { id, label, value: scalarText(v) }
  }
  if (Array.isArray(value)) return value.map((x, i) => node(String(i), x, idPrefix ? `${idPrefix}.${i}` : String(i)))
  if (value !== null && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).map(([k, x]) => node(k, x, idPrefix ? `${idPrefix}.${k}` : k))
  }
  return value === undefined ? [] : [node(idPrefix || 'value', value, idPrefix || 'value')]
}
