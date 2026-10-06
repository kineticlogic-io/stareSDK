/**
 * @module ThemeContext
 *
 * Owns the resolved chrome theme ('dark' | 'light') and paints it onto
 * `<html data-theme>` (Phase 89 Light Mode, plan 02, D-06/D-07/D-08).
 *
 * Consumer contract:
 * - `useTheme()` returns `{ theme, setTheme, commitTheme }`.
 * - `theme` is the currently PAINTED theme — always resolved, never null/undefined.
 * - `setTheme(next)` paints only (D-08 live preview) — it does NOT touch the localStorage
 *   mirror, so previewing a theme on the account page never drifts the mirror away from the
 *   last-saved value.
 * - `commitTheme(next)` paints AND writes the localStorage mirror — the one operation that
 *   actually persists a choice client-side. Elasticsearch (via `PUT /api/account`) remains the
 *   system of record; this mirror exists only so `index.html`'s pre-paint script (which cannot
 *   read ES) has something synchronous to read.
 *
 * Initialization is from the localStorage mirror, NOT from `AuthContext` — pre-auth surfaces
 * (the login page, the classification banner) must theme correctly and must not wait on
 * `/api/auth/me` to resolve (D-07). `AuthContext.tsx`'s `refresh()` is the one place that later
 * calls `commitTheme()` with the resolved account's `theme` field, covering both cold-start
 * hydration and the post-Save case.
 *
 * SECURITY (T-89-04): the mirror is untrusted input — it is validated against the exact
 * two-value allowlist `'dark' | 'light'` before it ever reaches `document.documentElement`, and
 * falls back to `'dark'` on anything else (missing, empty, or a hostile payload). Every
 * localStorage access is wrapped in try/catch (T-89-05 — Safari private mode throws).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { ThemeName } from '../styles/chromeTheme.js'
import { themeFor } from '../styles/chromeTheme.js'
import { ThemeCtx } from './useTheme.js'

const STORAGE_KEY = 'theme'

/** T-89-03/T-89-04: the ONE validation gate the mirror must pass through before it reaches the
 * DOM. Anything outside this exact two-value allowlist (null, '', 'system', 'LIGHT', a hostile
 * script payload) resolves to the 'dark' default — the raw string is never trusted. */
function isValidTheme(value: string | null): value is ThemeName {
  return value === 'dark' || value === 'light'
}

/** T-89-05: localStorage access can throw (Safari private mode, storage quota) — wrapped so a
 * throw never prevents the provider from mounting and painting the dark default. */
function readMirror(): ThemeName {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return isValidTheme(raw) ? raw : 'dark'
  } catch {
    return 'dark'
  }
}

function writeMirror(next: ThemeName): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // Safari private mode / storage quota exceeded — the in-memory paint below still succeeds;
    // only cross-session persistence of the mirror is lost.
  }
}

export interface ThemeContextValue {
  /** The currently PAINTED theme. */
  theme: ThemeName
  /** Live preview — paints, does not persist the localStorage mirror. */
  setTheme: (next: ThemeName) => void
  /** Paints AND writes the localStorage mirror. */
  commitTheme: (next: ThemeName) => void
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(() => readMirror())

  // D-08: instant attribute swap on every state change — the CSS engine re-themes the ~1,137
  // existing var(--color-*) call sites for free the instant this attribute changes.
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  // Keep the browser chrome's theme-color meta in sync with the active background so mobile
  // Safari/Chrome status-bar tinting matches the painted theme once React has mounted.
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', themeFor(theme).colorBgPrimary)
  }, [theme])

  const setTheme = useCallback((next: ThemeName) => {
    setThemeState(next)
  }, [])

  const commitTheme = useCallback((next: ThemeName) => {
    setThemeState(next)
    writeMirror(next)
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, commitTheme }),
    [theme, setTheme, commitTheme]
  )

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>
}
