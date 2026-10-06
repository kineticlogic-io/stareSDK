// @vitest-environment jsdom
/**
 * TypeaheadPicker.test.tsx — Phase 80 Plan 04, Task 2 (D-27).
 *
 * Tests use React 19 createRoot + act (project convention, no @testing-library/react —
 * zero new dependencies for this plan).
 *
 * What is tested:
 *   (a) The panel renders role="listbox" and rows render role="option".
 *   (b) ArrowDown/ArrowUp (via useTypeaheadKeyboard) clamp the highlight at the list bounds.
 *   (c) Enter commits the highlighted item.
 *   (d) Escape calls onDismiss.
 *   (e) emptyCopy renders when items is empty and loading is false.
 *   (f) useDebouncedQuery: an empty query fires no request; a non-empty query fires the
 *       fetcher after the debounce window and reports the resolved items.
 */
import { createRoot } from 'react-dom/client'
import { act, useEffect, useState } from 'react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { TypeaheadPicker } from './TypeaheadPicker.js'
import type { UseDebouncedQueryResult } from './TypeaheadPicker.js'
import { useTypeaheadKeyboard, useDebouncedQuery } from './TypeaheadPicker.helpers.js'

interface Item {
  id: string
  label: string
}

const ITEMS: Item[] = [
  { id: 'i1', label: 'Item One' },
  { id: 'i2', label: 'Item Two' },
]

interface HarnessProps {
  items: Item[]
  onSelect: (item: Item) => void
  onDismiss: () => void
  emptyCopy?: string
}

function Harness({ items, onSelect, onDismiss, emptyCopy }: HarnessProps) {
  const [open, setOpen] = useState(true)
  const [highlightIndex, setHighlightIndex] = useState(0)

  const commit = () => {
    const picked = items[highlightIndex]
    if (picked) onSelect(picked)
  }
  const dismiss = () => {
    onDismiss()
    setOpen(false)
  }

  const handleKeyDown = useTypeaheadKeyboard({
    open,
    itemCount: items.length,
    highlightIndex,
    onHighlightChange: setHighlightIndex,
    onCommit: commit,
    onDismiss: dismiss,
  })

  return (
    <div style={{ position: 'relative' }}>
      <input aria-label="query" onKeyDown={handleKeyDown} />
      <TypeaheadPicker<Item>
        open={open}
        items={items}
        getKey={i => i.id}
        renderRow={i => <span>{i.label}</span>}
        onSelect={onSelect}
        onDismiss={dismiss}
        highlightIndex={highlightIndex}
        onHighlightChange={setHighlightIndex}
        ariaLabel="test options"
        emptyCopy={emptyCopy}
      />
    </div>
  )
}

function render(props: Partial<HarnessProps> = {}) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const defaultProps: HarnessProps = {
    items: ITEMS,
    onSelect: vi.fn(),
    onDismiss: vi.fn(),
    ...props,
  }
  act(() => {
    root.render(<Harness {...defaultProps} />)
  })
  return {
    container,
    props: defaultProps,
    unmount: () => {
      act(() => { root.unmount() })
      container.remove()
    },
  }
}

function input(container: HTMLElement): HTMLInputElement {
  return container.querySelector('input[aria-label="query"]') as HTMLInputElement
}

function pressKey(el: HTMLElement, key: string) {
  act(() => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  })
}

function options(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('[role="option"]'))
}

describe('TypeaheadPicker + useTypeaheadKeyboard', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders a listbox panel with option rows', () => {
    const { container, unmount } = render()
    expect(container.querySelector('[role="listbox"]')).toBeTruthy()
    expect(options(container).length).toBe(2)
    unmount()
  })

  it('ArrowDown/ArrowUp move the highlight and clamp at both ends', () => {
    const { container, unmount } = render()
    const el = input(container)

    expect(options(container)[0].getAttribute('aria-selected')).toBe('true')

    pressKey(el, 'ArrowDown')
    expect(options(container)[1].getAttribute('aria-selected')).toBe('true')

    // Clamp at the top — a second ArrowDown does not move past the last index.
    pressKey(el, 'ArrowDown')
    expect(options(container)[1].getAttribute('aria-selected')).toBe('true')

    pressKey(el, 'ArrowUp')
    expect(options(container)[0].getAttribute('aria-selected')).toBe('true')

    // Clamp at the bottom — a second ArrowUp does not move below index 0.
    pressKey(el, 'ArrowUp')
    expect(options(container)[0].getAttribute('aria-selected')).toBe('true')

    unmount()
  })

  it('Enter commits the highlighted item', () => {
    const { container, props, unmount } = render()
    const el = input(container)

    pressKey(el, 'ArrowDown')
    pressKey(el, 'Enter')

    expect(props.onSelect).toHaveBeenCalledOnce()
    expect(props.onSelect).toHaveBeenCalledWith(ITEMS[1])

    unmount()
  })

  it('Escape calls onDismiss', () => {
    const { container, props, unmount } = render()
    const el = input(container)

    pressKey(el, 'Escape')

    // Escape on the input bubbles to `document`, so both useTypeaheadKeyboard's own Escape
    // branch (bound to the input) AND TypeaheadPicker's internal document-level Escape listener
    // fire for the same keypress — onDismiss is called at least once (harmless double-fire for
    // an idempotent dismiss handler; not asserting an exact count here).
    expect(props.onDismiss).toHaveBeenCalled()
    expect(container.querySelector('[role="listbox"]')).toBeNull()

    unmount()
  })

  it('renders emptyCopy when items is empty and loading is false', () => {
    const { container, unmount } = render({ items: [], emptyCopy: 'No matches' })
    expect(container.textContent).toContain('No matches')
    expect(options(container).length).toBe(0)
    unmount()
  })
})

// ---------------------------------------------------------------------------
// useDebouncedQuery — minimal harness (no @testing-library/react's renderHook;
// zero new dependencies for this plan).
// ---------------------------------------------------------------------------

const DEBOUNCE_MS = 300

function renderDebounced(fetcher: (q: string, signal: AbortSignal) => Promise<string[]>) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const resultRef: { current: UseDebouncedQueryResult<string> | null } = { current: null }

  function DebouncedHarness({ query }: { query: string }) {
    const result = useDebouncedQuery(query, fetcher)
    useEffect(() => { resultRef.current = result })
    return null
  }

  const setQuery = (query: string) => {
    act(() => { root.render(<DebouncedHarness query={query} />) })
  }
  setQuery('')

  return {
    resultRef,
    setQuery,
    unmount: () => {
      act(() => { root.unmount() })
      container.remove()
    },
  }
}

describe('useDebouncedQuery', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('fires no request for an empty query', async () => {
    const fetcher = vi.fn().mockResolvedValue([])
    const { resultRef, unmount } = renderDebounced(fetcher)

    await act(async () => { await vi.advanceTimersByTimeAsync(DEBOUNCE_MS) })
    expect(fetcher).not.toHaveBeenCalled()
    expect(resultRef.current?.items).toBeNull()

    unmount()
  })

  it('fires the fetcher after the debounce window and reports resolved items', async () => {
    const fetcher = vi.fn().mockResolvedValue(['a', 'b'])
    const { resultRef, setQuery, unmount } = renderDebounced(fetcher)

    setQuery('hello')
    expect(fetcher).not.toHaveBeenCalled()

    await act(async () => { await vi.advanceTimersByTimeAsync(DEBOUNCE_MS) })
    expect(fetcher).toHaveBeenCalledOnce()
    expect(fetcher).toHaveBeenCalledWith('hello', expect.any(AbortSignal))
    expect(resultRef.current?.items).toEqual(['a', 'b'])

    unmount()
  })
})
