import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { DockCtx } from './useDock.js'

/**
 * DockContext — coordinates side-docked panels (SideNav / ChatPanel) so they
 * STACK side-by-side instead of overlapping, and so the routed page content shrinks
 * by the combined width of every open panel on that side.
 *
 * Each panel registers `{ width, order, side }` while open. The provider:
 *   - sums the open widths per side into two global layout vars:
 *       --assistant-width (right total) — App.tsx collapses the page from the right,
 *       --dock-left-width  (left total) — App.tsx collapses the page from the left.
 *   - exposes `offsetFor(id)` = the combined width of open panels on the SAME side as
 *     `id` that sit closer to that side's own edge (lower `order`), so each panel can
 *     shift inward to sit next to them.
 *   - dispatches a window resize 280ms after totals change so Leaflet/deck.gl recompute.
 *
 * Order convention (per-side): lower = closer to that side's own edge.
 *   Right side: StyleEditor 0, ToolsPanel 1, TacticalSymbolBuilder 2, LedgerPage 10
 *     (default), ImageryPanel 12.
 *   Left side:  ChatPanel (AI assistant) claims order 0, pinned to the viewport
 *     edge; GisLayerSideNav (Map Layers) is order 1, stacking inward of it. Any future
 *     left panel must pick a HIGHER unused order.
 *
 * Ties are broken deterministically by panel id (see `offsetFor`) ONLY as a defensive
 * backstop -- a same-side order collision is a bug to fix at the call site (give the
 * panel its own order), not a supported configuration to rely on.
 */

interface PanelInfo { width: number; order: number; side: 'left' | 'right' }

export interface DockContextValue {
  /** Register/update a panel while open; pass null to remove it (closed/unmounted). */
  setPanel: (id: string, info: PanelInfo | null) => void
  /** Combined width (px) of open panels on the SAME side as `id`, docked closer to
   *  that side's edge (lower `order`). Panels on the other side are NOT counted. */
  offsetFor: (id: string) => number
  /** Backward-compatible alias for offsetFor (consumed by callers before Task 2 rename). */
  rightOffsetFor: (id: string) => number
}

export function DockProvider({ children }: { children: ReactNode }) {
  const [panels, setPanels] = useState<Record<string, PanelInfo>>({})

  const setPanel = useCallback((id: string, info: PanelInfo | null) => {
    setPanels(prev => {
      if (info === null) {
        if (!(id in prev)) return prev
        const next = { ...prev }
        delete next[id]
        return next
      }
      const cur = prev[id]
      if (
        cur &&
        cur.width === info.width &&
        cur.order === info.order &&
        cur.side === info.side
      ) return prev
      return { ...prev, [id]: info }
    })
  }, [])

  // Compute per-side totals.
  const rightTotal = Object.values(panels)
    .filter(p => p.side === 'right')
    .reduce((sum, p) => sum + p.width, 0)

  const leftTotal = Object.values(panels)
    .filter(p => p.side === 'left')
    .reduce((sum, p) => sum + p.width, 0)

  // Write both layout vars. After the transition settles, nudge a resize so
  // Leaflet/deck.gl recompute their container dimensions.
  useEffect(() => {
    document.documentElement.style.setProperty('--assistant-width', `${rightTotal}px`)
    document.documentElement.style.setProperty('--dock-left-width', `${leftTotal}px`)
    const t = window.setTimeout(() => window.dispatchEvent(new Event('resize')), 280)
    return () => window.clearTimeout(t)
  }, [rightTotal, leftTotal])

  /** Combined width of open panels on the SAME side as `id` with lower order
   *  (i.e. closer to that side's edge). Panels on the other side are excluded.
   *
   *  Ties on `order` are broken by plain string comparison of the panel id
   *  (`useId()` values are stable for a mounted component, so this is deterministic
   *  and stable across re-renders). This is a defensive backstop against a same-side
   *  order collision -- it guarantees two colliding panels resolve to distinct, stable
   *  offsets instead of silently overlapping at the same `left`/`right` position -- not
   *  the intended stacking mechanism. Every call site should still pick a distinct order. */
  const offsetFor = useCallback(
    (id: string): number => {
      const me = panels[id]
      if (!me) return 0
      let offset = 0
      for (const [pid, info] of Object.entries(panels)) {
        if (pid === id || info.side !== me.side) continue
        const closerBySameOrderTiebreak = info.order === me.order && pid < id
        if (info.order < me.order || closerBySameOrderTiebreak) {
          offset += info.width
        }
      }
      return offset
    },
    [panels],
  )

  // Backward-compatible alias so existing callers keep working until they migrate.
  const rightOffsetFor = offsetFor

  return (
    <DockCtx.Provider value={{ setPanel, offsetFor, rightOffsetFor }}>
      {children}
    </DockCtx.Provider>
  )
}
