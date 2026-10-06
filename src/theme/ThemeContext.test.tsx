// @vitest-environment jsdom
/**
 * ThemeContext tests (Phase 89 Light Mode, plan 02).
 *
 * Tests use React 19 createRoot + act (project convention — no @testing-library/react
 * dependency; see Toggle.test.tsx / Tree.test.tsx / Toast.test.tsx).
 *
 * Drives the provider through a minimal test consumer component (per the plan's Task 3
 * <action>) rather than testing internals like `isValidTheme`/`readMirror` directly.
 *
 * What is tested (one test per <behavior> bullet in 89-02-PLAN.md Task 3):
 *   - localStorage 'light' -> paints light
 *   - localStorage 'dark' -> paints dark
 *   - localStorage absent -> paints dark (SC-1 default)
 *   - localStorage 'system' / '' / 'LIGHT' / a script-injection payload -> all paint dark, and
 *     the hostile payload never reaches the DOM (T-89-03/T-89-04 — the security-relevant case)
 *   - setTheme() paints without touching the mirror (D-08 live preview)
 *   - commitTheme() paints AND writes the mirror (D-08 persist)
 *   - a throwing localStorage.getItem (Safari private mode) still mounts and paints dark (T-89-05)
 */

import { createRoot } from 'react-dom/client'
import { act, useEffect } from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ThemeProvider } from './ThemeContext.js'
import type { ThemeContextValue } from './ThemeContext.js'
import { useTheme } from './useTheme.js'

// Captured via a ref-like holder mutated inside an effect (not during render) so this test
// consumer stays a pure component per react-hooks/globals — see Consumer below.
const holder: { current: ThemeContextValue | null } = { current: null }

function Consumer() {
  const value = useTheme()
  useEffect(() => {
    holder.current = value
  })
  return null
}

function renderProvider() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>,
    )
  })
  return {
    container,
    unmount: () => {
      act(() => { root.unmount() })
      container.remove()
    },
  }
}

describe('ThemeContext (T-89-03/T-89-04/T-89-05)', () => {
  let unmountFns: Array<() => void> = []

  beforeEach(() => {
    window.localStorage.clear()
    delete document.documentElement.dataset.theme
    holder.current = null
  })

  afterEach(() => {
    unmountFns.forEach(fn => fn())
    unmountFns = []
    window.localStorage.clear()
    delete document.documentElement.dataset.theme
    vi.restoreAllMocks()
  })

  it('paints light when the mirror is "light"', () => {
    window.localStorage.setItem('theme', 'light')
    const { unmount } = renderProvider()
    unmountFns.push(unmount)
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(holder.current?.theme).toBe('light')
  })

  it('paints dark when the mirror is "dark"', () => {
    window.localStorage.setItem('theme', 'dark')
    const { unmount } = renderProvider()
    unmountFns.push(unmount)
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(holder.current?.theme).toBe('dark')
  })

  it('paints dark when the mirror is absent (SC-1: dark is the default for a never-chosen user)', () => {
    const { unmount } = renderProvider()
    unmountFns.push(unmount)
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(holder.current?.theme).toBe('dark')
  })

  it('paints dark for the invalid value "system" (not in the allowlist)', () => {
    window.localStorage.setItem('theme', 'system')
    const { unmount } = renderProvider()
    unmountFns.push(unmount)
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('paints dark for an empty string mirror value', () => {
    window.localStorage.setItem('theme', '')
    const { unmount } = renderProvider()
    unmountFns.push(unmount)
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('paints dark for a wrong-case value "LIGHT" (allowlist is exact-match, not case-insensitive)', () => {
    window.localStorage.setItem('theme', 'LIGHT')
    const { unmount } = renderProvider()
    unmountFns.push(unmount)
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('paints dark for a hostile script-injection payload, and the raw value never reaches the DOM', () => {
    window.localStorage.setItem('theme', '"><script>alert(1)</script>')
    const { unmount } = renderProvider()
    unmountFns.push(unmount)
    // This is the security-relevant assertion (T-89-03/T-89-04): both that the allowlist falls
    // back to the safe default AND that the hostile substring never appears anywhere in the
    // painted document — proving the allowlist is a real gate, not just a default value.
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.outerHTML).not.toContain('<script>alert')
  })

  it('setTheme() paints instantly but does not touch the localStorage mirror (D-08 preview)', () => {
    window.localStorage.setItem('theme', 'dark')
    const { unmount } = renderProvider()
    unmountFns.push(unmount)
    act(() => { holder.current?.setTheme('light') })
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(holder.current?.theme).toBe('light')
    expect(window.localStorage.getItem('theme')).toBe('dark')
  })

  it('commitTheme() paints AND writes the localStorage mirror (D-08 persist)', () => {
    window.localStorage.setItem('theme', 'dark')
    const { unmount } = renderProvider()
    unmountFns.push(unmount)
    act(() => { holder.current?.commitTheme('light') })
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(window.localStorage.getItem('theme')).toBe('light')
  })

  it('mounts and paints the dark default when localStorage.getItem throws (T-89-05, Safari private mode)', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError: localStorage is disabled')
    })
    const { unmount } = renderProvider()
    unmountFns.push(unmount)
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(holder.current?.theme).toBe('dark')
    spy.mockRestore()
  })

  it('mounts even when localStorage.setItem throws — commitTheme still paints (T-89-05)', () => {
    const { unmount } = renderProvider()
    unmountFns.push(unmount)
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    act(() => { holder.current?.commitTheme('light') })
    expect(document.documentElement.dataset.theme).toBe('light')
    spy.mockRestore()
  })
})
