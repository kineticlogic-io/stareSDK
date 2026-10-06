import type { CSSProperties, FocusEvent, ReactNode } from 'react'
import { useMemo, useState } from 'react'

/**
 * ui/VirtualList — dependency-free, fixed-row-height virtualization primitive (D-05).
 *
 * Operator-directed this session (139-UI-SPEC.md Component Contract — ui/VirtualList.tsx): a
 * new, first-party, general-purpose primitive for any future large-list surface in the app, not
 * Vantage-specific — hence its home in `ui/*` rather than `vantage/*`. No new npm dependency;
 * this project carries no third-party list-virtualization package today, and none is added here.
 *
 * Behavior:
 * - A short list (`items.length * rowHeight <= maxHeight`) renders every row flat, in natural
 *   document flow, with no scroll chrome at all — virtualization overhead is reserved for
 *   genuinely large lists (e.g. a 427–999-frame MIE4NITF file).
 * - A longer list renders inside a fixed-height (`maxHeight`), `overflow-y: auto` scroll region.
 *   `scrollTop` is tracked via plain React state (no `IntersectionObserver`, no library); the
 *   rendered index window is derived from `scrollTop`/`rowHeight`, padded by `overscan` rows
 *   each side, clamped to `[0, items.length)`.
 * - Each rendered row is absolutely positioned with `transform: translateY(...)` — compositor-
 *   safe, GPU-friendly positioning, consistent with this project's animation convention — even
 *   though nothing here is actually animated: positions are set once per scroll-driven
 *   re-render, never eased.
 * - Focus preservation: if an element inside a row outside the computed window currently holds
 *   DOM focus, that row's index is appended as a single extra render target rather than
 *   widening the window itself — a virtualized list must never unmount the element a keyboard
 *   user is currently on, but a distant focused row also must not blow out the bounded row
 *   count the window exists to guarantee (T-139-13-01). Tracked via focus/blur event state
 *   (never by reading a DOM ref during render, which React disallows).
 * - A11y: the region carries `role="list"` and `aria-label`; each row wrapper carries
 *   `role="listitem"`. The region itself sets no explicit keyboard focus-order attribute —
 *   native Tab order through each row's own interactive controls is sufficient, and a redundant
 *   container stop would be an unrequested control.
 */

export interface VirtualListProps<T> {
  items: T[]
  /** Fixed row height in px. */
  rowHeight: number
  /** The scroll region's height cap in px. */
  maxHeight: number
  /** Rows rendered beyond the visible window, each side. Default 6. */
  overscan?: number
  renderRow: (item: T, index: number) => ReactNode
  getKey: (item: T, index: number) => string
  /** Accessible name for the list region (e.g. "sub-images for {item name}"). */
  ariaLabel: string
  /** Rendered instead of the list when `items.length === 0`. */
  emptyState?: ReactNode
}

const rowBaseStyle: CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
}

export function VirtualList<T>({
  items,
  rowHeight,
  maxHeight,
  overscan = 6,
  renderRow,
  getKey,
  ariaLabel,
  emptyState,
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0)
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null)

  const totalHeight = items.length * rowHeight
  const isVirtualized = items.length > 0 && totalHeight > maxHeight

  // Only computed (and only ever referenced) when isVirtualized — a short, flat list never
  // touches this window math at all.
  const virtualizedIndices = useMemo(() => {
    if (!isVirtualized) return []
    const visibleRowCount = Math.ceil(maxHeight / rowHeight)
    const firstVisible = Math.floor(scrollTop / rowHeight)
    const lastVisible = firstVisible + visibleRowCount - 1
    const start = Math.max(0, firstVisible - overscan)
    const end = Math.min(items.length - 1, lastVisible + overscan)

    const indices: number[] = []
    for (let i = start; i <= end; i++) indices.push(i)

    // See the focus-preservation note in the module doc above. `focusedIndex` is tracked via
    // focus/blur event state (see handleRowFocusCapture / handleContainerBlurCapture below), not
    // by reading a DOM ref during render.
    if (focusedIndex !== null && (focusedIndex < start || focusedIndex > end)) {
      indices.push(focusedIndex)
    }
    return indices
  }, [isVirtualized, items.length, scrollTop, rowHeight, maxHeight, overscan, focusedIndex])

  if (items.length === 0) {
    return <>{emptyState ?? null}</>
  }

  function handleRowFocusCapture(index: number) {
    setFocusedIndex(index)
  }

  // Clears the tracked focused index once focus genuinely leaves the region (never merely moves
  // between two rows inside it) — `relatedTarget` is the element about to receive focus.
  function handleContainerBlurCapture(event: FocusEvent<HTMLDivElement>) {
    const next = event.relatedTarget
    if (!next || !event.currentTarget.contains(next)) {
      setFocusedIndex(null)
    }
  }

  if (!isVirtualized) {
    return (
      <div role="list" aria-label={ariaLabel}>
        {items.map((item, index) => (
          <div key={getKey(item, index)} role="listitem" onFocusCapture={() => handleRowFocusCapture(index)}>
            {renderRow(item, index)}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div
      role="list"
      aria-label={ariaLabel}
      style={{ height: maxHeight, overflowY: 'auto', position: 'relative' }}
      onScroll={event => setScrollTop(event.currentTarget.scrollTop)}
      onBlurCapture={handleContainerBlurCapture}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {virtualizedIndices.map(index => {
          const item = items[index]
          return (
            <div
              key={getKey(item, index)}
              role="listitem"
              style={{ ...rowBaseStyle, height: rowHeight, transform: `translateY(${index * rowHeight}px)` }}
              onFocusCapture={() => handleRowFocusCapture(index)}
            >
              {renderRow(item, index)}
            </div>
          )
        })}
      </div>
    </div>
  )
}
