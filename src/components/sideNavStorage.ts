/**
 * sideNavStorage — pure-values helper for persisting a SideNav's open/closed state.
 *
 * Sibling pure-values module for `SideNav.tsx` (112-03 Rule per interfaces, same class of
 * deviation as `badgeTokens.ts` sitting beside `Badge.tsx`, 87-10 Rule 3): `SideNav.tsx` is a
 * component module subject to the `react-refresh/only-export-components` lint rule, so a
 * non-component export (these three functions) cannot live inside it without tripping that rule.
 *
 * The `.open` suffix deliberately namespaces under each SideNav instance's EXISTING `storageKey`
 * (the same key already used to persist that instance's user-resized width) — no new key
 * vocabulary is introduced. This keeps open/closed persistence and width persistence as ONE
 * storage mechanism (D-17) keyed off the same identifier, rather than a second, parallel key
 * space (D-18).
 */

const OPEN_VALUE = '1'
const CLOSED_VALUE = '0'

/** Returns the localStorage key an instance's open/closed state is stored under. */
export function sideNavOpenKey(storageKey: string): string {
  return `${storageKey}.open`
}

/**
 * Reads the persisted open/closed value for `storageKey`. Returns `fallback` when `storageKey`
 * is undefined, when the key is absent, when the stored value is anything other than the two
 * exact sentinels ('1' / '0'), or when `localStorage` access throws (private mode, disabled
 * storage, etc.). Deliberately does NOT parse/coerce the stored value — a legacy numeric width
 * value accidentally read from the wrong key can never be mistaken for a boolean.
 */
export function readSideNavOpen(storageKey: string | undefined, fallback: boolean): boolean {
  if (!storageKey) return fallback
  try {
    const raw = localStorage.getItem(sideNavOpenKey(storageKey))
    if (raw === OPEN_VALUE) return true
    if (raw === CLOSED_VALUE) return false
    return fallback
  } catch {
    return fallback
  }
}

/**
 * Persists the open/closed value for `storageKey`. No-op when `storageKey` is undefined —
 * matching width persistence's existing opt-in-by-storageKey-presence behavior. Every call is
 * wrapped in try/catch so a throwing `localStorage` (private mode, quota exceeded, disabled
 * storage) never propagates into a render.
 */
export function writeSideNavOpen(storageKey: string | undefined, open: boolean): void {
  if (!storageKey) return
  try {
    localStorage.setItem(sideNavOpenKey(storageKey), open ? OPEN_VALUE : CLOSED_VALUE)
  } catch {
    /* ignore */
  }
}
