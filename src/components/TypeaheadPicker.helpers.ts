/**
 * Non-component exports split out of `TypeaheadPicker.tsx` (87-27, D-08) to satisfy
 * `react-refresh/only-export-components` — `typeaheadOptionId` (a pure id-formatting helper),
 * `useTypeaheadKeyboard` (keyboard-nav hook), and `useDebouncedQuery` (debounced fetch-on-query
 * hook) all move here verbatim. Types/interfaces and the `SEARCH_DEBOUNCE_MS` primitive constant
 * STAY in `TypeaheadPicker.tsx` (type exports never trip the rule; `SEARCH_DEBOUNCE_MS` is
 * `allowConstantExport`-exempt) and are imported back here where needed — the minimum split that
 * satisfies the lint rule, matching the pattern established in 87-25/87-26.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type React from 'react'
import { SEARCH_DEBOUNCE_MS } from './TypeaheadPicker.js'
import type { UseTypeaheadKeyboardOptions, UseDebouncedQueryResult } from './TypeaheadPicker.js'

/** Deterministic DOM id for a row — shared between this component's own `id` attribute and a
 * consumer's `aria-activedescendant` wiring on the input/textarea it owns (the consumer already
 * has `items`/`highlightIndex`/`getKey`, since it owns that state, so it can compute the same id). */
export function typeaheadOptionId(key: string): string {
  return `typeahead-option-${key}`
}

/**
 * ArrowDown/ArrowUp clamp within [0, itemCount-1], Enter commits the highlighted item, Escape
 * dismisses. `preventDefault` fires only for the keys handled here, so a `[[` picker living
 * inside a `<textarea>` keeps normal typing behavior for every other key.
 */
export function useTypeaheadKeyboard({
  open,
  itemCount,
  highlightIndex,
  onHighlightChange,
  onCommit,
  onDismiss,
}: UseTypeaheadKeyboardOptions): (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void {
  return useCallback(
    (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (!open) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        onHighlightChange(Math.min(highlightIndex + 1, Math.max(itemCount - 1, 0)))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        onHighlightChange(Math.max(highlightIndex - 1, 0))
      } else if (e.key === 'Enter' && itemCount > 0) {
        e.preventDefault()
        onCommit()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onDismiss()
      }
    },
    [open, itemCount, highlightIndex, onHighlightChange, onCommit, onDismiss],
  )
}

/**
 * Debounced fetch-on-query hook. Default `debounceMs` is `SEARCH_DEBOUNCE_MS` (300), matching
 * WikiSearchBar's original behavior exactly. An empty/whitespace query clears items without
 * firing a request. In-flight requests are aborted (via the `AbortSignal` passed to `fetcher`)
 * when a newer request supersedes them, so a slow stale response can never clobber a fresher one.
 */
export function useDebouncedQuery<T>(
  query: string,
  fetcher: (q: string, signal: AbortSignal) => Promise<T[]>,
  opts?: { debounceMs?: number },
): UseDebouncedQueryResult<T> {
  const debounceMs = opts?.debounceMs ?? SEARCH_DEBOUNCE_MS
  const [items, setItems] = useState<T[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retryToken, setRetryToken] = useState(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const trimmed = query.trim()

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (abortRef.current) abortRef.current.abort()
    if (!trimmed) {
      setItems(null)
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(() => {
      const controller = new AbortController()
      abortRef.current = controller
      void (async () => {
        try {
          const data = await fetcherRef.current(trimmed, controller.signal)
          if (controller.signal.aborted) return
          setItems(data)
          setError(null)
        } catch (err) {
          if (controller.signal.aborted) return
          setError(err instanceof Error ? err.message : 'Request failed.')
        } finally {
          if (!controller.signal.aborted) setLoading(false)
        }
      })()
    }, debounceMs)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [trimmed, retryToken, debounceMs])

  const retry = useCallback(() => setRetryToken(t => t + 1), [])

  return { items, loading, error, retry }
}
