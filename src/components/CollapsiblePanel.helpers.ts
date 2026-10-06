/**
 * Non-component export split out of `CollapsiblePanel.tsx` (87-27, D-08) to satisfy
 * `react-refresh/only-export-components` — `readPanelState` moves here verbatim.
 */

/** Read a persisted panel open/closed boolean from localStorage, falling back when absent or unavailable. */
export function readPanelState(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key)
    return v === null ? fallback : v === 'true'
  } catch {
    return fallback
  }
}
