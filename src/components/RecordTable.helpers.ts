/**
 * The pure parts of `RecordTable`: records flattened to dotted paths, the columns they make, and
 * how each cell changed from a record's earlier form.
 */

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * A record as `path → value`: nested objects become dotted paths (`position.latitude`); arrays,
 * primitives, `null` and empty objects are values. A record that is not an object is one value at
 * the path `''`.
 */
export function flattenRecord(v: unknown, prefix = ''): Map<string, unknown> {
  const out = new Map<string, unknown>()
  const walk = (x: unknown, at: string) => {
    if (isPlainObject(x) && Object.keys(x).length > 0) {
      for (const [k, child] of Object.entries(x)) walk(child, at ? `${at}.${k}` : k)
    } else {
      out.set(at, x)
    }
  }
  if (v === undefined) return out
  walk(v, prefix)
  return out
}

/**
 * The columns a set of records makes: every path, in the order first met, `pinned` paths first.
 * With `before`, paths only an earlier form had (a field a step removed) are columns too.
 */
export function recordColumns(rows: { value?: unknown; before?: unknown }[], pinned: string[] = [], withBefore = true): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const add = (p: string) => {
    if (!seen.has(p)) {
      seen.add(p)
      out.push(p)
    }
  }
  for (const r of rows) {
    for (const p of flattenRecord(r.value).keys()) add(p)
    if (withBefore) for (const p of flattenRecord(r.before).keys()) add(p)
  }
  const pins = pinned.filter((p) => seen.has(p))
  return [...pins, ...out.filter((p) => !pins.includes(p))]
}

export type CellChange = 'added' | 'changed' | 'removed'

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** How the cell at `path` changed from `before` to `after`; nothing when unchanged or no `before`. */
export function cellChange(path: string, after: Map<string, unknown>, before: Map<string, unknown> | undefined): CellChange | undefined {
  if (!before) return undefined
  const a = after.has(path)
  const b = before.has(path)
  if (a && !b) return 'added'
  if (!a && b) return 'removed'
  if (a && b && !same(after.get(path), before.get(path))) return 'changed'
  return undefined
}

/** A cell's text: strings as they are, other values as compact JSON, nothing for a missing one. */
export function formatCell(v: unknown): string {
  if (v === undefined) return ''
  if (typeof v === 'string') return v
  return JSON.stringify(v) ?? String(v)
}
