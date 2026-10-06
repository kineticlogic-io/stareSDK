// @vitest-environment jsdom
/**
 * DockContext.test.tsx — Quick task 260829-cx8, Task 1.
 *
 * Regression coverage for `DockProvider`/`offsetFor`: right-side stacking must stay exactly
 * as it behaves today (Test 1), left-side stacking must work the same way (Test 2), a
 * same-side `order` collision must resolve to distinct, stable offsets instead of silently
 * overlapping (Test 3 — the bug this task fixes), the two sides must total independently
 * (Test 4), and unregistering a panel must return the remaining panel's offset to 0 (Test 5).
 *
 * Drives the REAL `DockProvider` through a minimal consumer that captures the live context
 * value into a module-scoped holder (`WorkspaceStateContext.test.tsx`'s pattern) — React 19
 * `createRoot` + `act`, no `@testing-library/react` (project convention).
 */
import { createRoot } from 'react-dom/client'
import { act, useEffect } from 'react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

// React 19's act() dev-mode check requires this global explicitly in a plain createRoot + act
// test (no @testing-library/react auto-setup — project convention, see ThemeContext.test.tsx).
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

import { DockProvider } from './DockContext'
import { useDock } from './useDock'
import type { DockContextValue } from './DockContext'

// ---------------------------------------------------------------------------
// Render harness
// ---------------------------------------------------------------------------

const holder: { current: DockContextValue | null } = { current: null }

function Consumer() {
  const value = useDock()
  useEffect(() => {
    holder.current = value
  })
  return null
}

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

function renderProvider() {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root.render(
      <DockProvider>
        <Consumer />
      </DockProvider>,
    )
  })
}

function cssVar(name: string): string {
  return document.documentElement.style.getPropertyValue(name)
}

describe('DockContext', () => {
  beforeEach(() => {
    holder.current = null
    // Reset custom properties between tests so assertions never leak across cases.
    document.documentElement.style.removeProperty('--assistant-width')
    document.documentElement.style.removeProperty('--dock-left-width')
    renderProvider()
  })

  afterEach(() => {
    act(() => { root.unmount() })
    container.remove()
  })

  it('Test 1 (right side, no-regression guard): distinct orders stack correctly', () => {
    act(() => {
      holder.current?.setPanel('a', { width: 300, order: 0, side: 'right' })
    })
    act(() => {
      holder.current?.setPanel('b', { width: 380, order: 12, side: 'right' })
    })

    expect(holder.current?.offsetFor('a')).toBe(0)
    expect(holder.current?.offsetFor('b')).toBe(300)
    expect(cssVar('--assistant-width')).toBe('680px')
  })

  it('Test 2 (left side stacking): distinct orders stack correctly', () => {
    act(() => {
      holder.current?.setPanel('a', { width: 280, order: 0, side: 'left' })
    })
    act(() => {
      holder.current?.setPanel('b', { width: 380, order: 1, side: 'left' })
    })

    expect(holder.current?.offsetFor('a')).toBe(0)
    expect(holder.current?.offsetFor('b')).toBe(280)
    expect(cssVar('--dock-left-width')).toBe('660px')
  })

  it('Test 3 (THE BUG — order collision): two same-side, same-order panels resolve to distinct offsets', () => {
    const widths: Record<string, number> = { a: 280, b: 380 }
    act(() => {
      holder.current?.setPanel('a', { width: widths.a, order: 0, side: 'left' })
    })
    act(() => {
      holder.current?.setPanel('b', { width: widths.b, order: 0, side: 'left' })
    })

    const oa = holder.current!.offsetFor('a')
    const ob = holder.current!.offsetFor('b')

    // The two offsets must be distinct — never both 0 (that would be the overlap bug).
    expect(new Set([oa, ob]).size).toBe(2)

    // Whichever panel resolves to offset 0, the OTHER panel's offset must equal that
    // zero-offset panel's own width (i.e. it stacks directly inward of it). Never assert
    // a specific id wins the tiebreak — only that the relationship holds.
    const entries: { id: string; offset: number }[] = [
      { id: 'a', offset: oa },
      { id: 'b', offset: ob },
    ]
    const zero = entries.find(e => e.offset === 0)
    const nonzero = entries.find(e => e.offset !== 0)
    expect(zero).toBeDefined()
    expect(nonzero).toBeDefined()
    expect(nonzero!.offset).toBe(widths[zero!.id])
  })

  it('Test 4 (side isolation): left and right panels sharing order 0 both report offset 0 independently', () => {
    act(() => {
      holder.current?.setPanel('a', { width: 200, order: 0, side: 'left' })
    })
    act(() => {
      holder.current?.setPanel('b', { width: 250, order: 0, side: 'right' })
    })

    expect(holder.current?.offsetFor('a')).toBe(0)
    expect(holder.current?.offsetFor('b')).toBe(0)
    expect(cssVar('--dock-left-width')).toBe('200px')
    expect(cssVar('--assistant-width')).toBe('250px')
  })

  it('Test 5 (unregister): closing the leading left panel returns the remaining panel offset to 0', () => {
    act(() => {
      holder.current?.setPanel('a', { width: 280, order: 0, side: 'left' })
    })
    act(() => {
      holder.current?.setPanel('b', { width: 380, order: 1, side: 'left' })
    })
    expect(holder.current?.offsetFor('b')).toBe(280)

    act(() => {
      holder.current?.setPanel('a', null)
    })

    expect(holder.current?.offsetFor('b')).toBe(0)
    expect(cssVar('--dock-left-width')).toBe('380px')
  })
})
