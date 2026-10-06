// @vitest-environment jsdom
/**
 * Toast / ToastProvider tests (64-17).
 *
 * Tests use React 19 createRoot + act (matches the rest of the codebase's
 * component test convention — no @testing-library/react dependency).
 *
 * `ToastViewport` is portaled to document.body, so assertions query
 * document.body directly rather than the render container.
 *
 * What is tested:
 *   (a) ToastProvider + useToast render without throwing and stack multiple
 *       simultaneous toasts.
 *   (b) `error` variant NEVER auto-dismisses; `success`/`info`/`warning` do,
 *       on their timer.
 *   (c) Manual dismiss (close button) removes a toast immediately.
 *   (d) `dedupeKey` collapses a repeat call into the existing toast instead
 *       of stacking a duplicate.
 */

import { createRoot } from 'react-dom/client'
import { act, useEffect } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { ToastProvider } from './Toast.js'
import type { ToastOptions } from './Toast.js'
import { useToast } from './useToast.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ToastApi = ReturnType<typeof useToast>

function Harness({ apiRef }: { apiRef: { current: ToastApi | null } }) {
  const api = useToast()
  // Assign in an effect (not during render) — mirrors real consumer usage and
  // avoids the react-hooks/refs "no ref mutation during render" rule.
  useEffect(() => { apiRef.current = api })
  return null
}

function renderProvider() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const apiRef: { current: ToastApi | null } = { current: null }
  act(() => {
    root.render(
      <ToastProvider>
        <Harness apiRef={apiRef} />
      </ToastProvider>,
    )
  })
  return {
    container,
    apiRef,
    unmount: () => {
      act(() => { root.unmount() })
      container.remove()
    },
  }
}

function fireToast(apiRef: { current: ToastApi | null }, options: ToastOptions) {
  act(() => { apiRef.current!.toast(options) })
}

function visibleToasts(): NodeListOf<Element> {
  return document.querySelectorAll('[role="alert"], [role="status"]')
}

/**
 * Waits `ms` of REAL wall-clock time, chunked into repeated short `act()` calls
 * rather than one long sleep. A single long `await act(async () => { await
 * new Promise(r => setTimeout(r, ms)) })` does not reliably let framer-motion's
 * AnimatePresence exit animation (rAF-driven) run to completion under jsdom —
 * chunking forces React to flush + let animation frames advance between each
 * awaited slice. Verified empirically: a single 400ms sleep left the exiting
 * node in the DOM; 20ms chunks reliably let it finish and unmount.
 */
async function pump(ms: number, chunk = 20): Promise<void> {
  let elapsed = 0
  while (elapsed < ms) {
    await act(async () => { await new Promise(r => setTimeout(r, chunk)) })
    elapsed += chunk
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ToastProvider / useToast', () => {
  let unmountFns: Array<() => void> = []

  afterEach(() => {
    unmountFns.forEach(fn => fn())
    unmountFns = []
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('renders without throwing and stacks multiple simultaneous toasts', () => {
    const { apiRef, unmount } = renderProvider()
    unmountFns.push(unmount)

    fireToast(apiRef, { variant: 'info', message: 'first' })
    fireToast(apiRef, { variant: 'success', message: 'second' })
    fireToast(apiRef, { variant: 'error', message: 'third' })

    expect(visibleToasts().length).toBe(3)
  })

  // Real timers (not vi.useFakeTimers()) — framer-motion's AnimatePresence exit
  // animation drives DOM removal via requestAnimationFrame, which does not advance
  // under jsdom + fake timers. A short real-time wait after the dismiss trigger lets
  // the exit transition (≤0.18s, see Toast.tsx motionProps) complete before asserting.
  const ANIMATION_SETTLE_MS = 400

  it('never auto-dismisses an error toast, but auto-dismisses success/info/warning on their timer', async () => {
    const { apiRef, unmount } = renderProvider()
    unmountFns.push(unmount)

    fireToast(apiRef, { variant: 'success', message: 'ingest ready', duration: 30 })
    fireToast(apiRef, { variant: 'error', message: 'ingest failed — 1.5GB payload rejected' })

    expect(visibleToasts().length).toBe(2)

    // Wait past the success toast's (short) duration + exit animation — it should auto-dismiss.
    await pump(ANIMATION_SETTLE_MS)
    const afterSuccessTimeout = visibleToasts()
    expect(afterSuccessTimeout.length).toBe(1)
    expect(afterSuccessTimeout[0].getAttribute('role')).toBe('alert')

    // Wait again — the error must still persist until the operator explicitly acknowledges
    // it (root-cause fix for the missed failure); it has no auto-dismiss timer at all.
    await pump(ANIMATION_SETTLE_MS)
    expect(visibleToasts().length).toBe(1)
    expect(visibleToasts()[0].getAttribute('role')).toBe('alert')
  })

  it('removes a toast when its dismiss (close) button is clicked', async () => {
    const { apiRef, unmount } = renderProvider()
    unmountFns.push(unmount)

    fireToast(apiRef, { variant: 'error', message: 'oops' })
    expect(visibleToasts().length).toBe(1)

    const closeButton = document.querySelector('[aria-label="Dismiss notification"]') as HTMLButtonElement
    expect(closeButton).toBeTruthy()
    act(() => { closeButton.click() })
    await pump(ANIMATION_SETTLE_MS)

    expect(visibleToasts().length).toBe(0)
  })

  it('collapses a repeat call with the same dedupeKey into the existing toast instead of stacking a duplicate', () => {
    const { apiRef, unmount } = renderProvider()
    unmountFns.push(unmount)

    fireToast(apiRef, { variant: 'error', message: 'first delivery', dedupeKey: 'ingest-layer-1:failed' })
    expect(visibleToasts().length).toBe(1)

    // Simulates a duplicate WS delivery of the same terminal ingest_status event.
    fireToast(apiRef, { variant: 'error', message: 'second delivery', dedupeKey: 'ingest-layer-1:failed' })
    const toasts = visibleToasts()
    expect(toasts.length).toBe(1)
    expect(toasts[0].textContent).toContain('second delivery')
  })
})

// ---------------------------------------------------------------------------
// confirm() — 64-19 toast-system consolidation (renders via ui/Modal)
// ---------------------------------------------------------------------------

describe('useToast().confirm', () => {
  let unmountFns: Array<() => void> = []

  afterEach(() => {
    unmountFns.forEach(fn => fn())
    unmountFns = []
  })

  it('resolves true when the Confirm button is clicked', async () => {
    const { apiRef, unmount } = renderProvider()
    unmountFns.push(unmount)

    let result: boolean | null = null
    act(() => {
      apiRef.current!.confirm('Delete this layer?').then(v => { result = v })
    })

    const dialog = document.querySelector('[role="dialog"]')
    expect(dialog).toBeTruthy()
    expect(dialog!.textContent).toContain('Delete this layer?')

    const buttons = Array.from(document.querySelectorAll('[role="dialog"] button'))
    const confirmBtn = buttons.find(b => b.textContent === 'Confirm') as HTMLButtonElement
    expect(confirmBtn).toBeTruthy()
    await act(async () => { confirmBtn.click() })

    expect(result).toBe(true)
    expect(document.querySelector('[role="dialog"]')).toBeFalsy()
  })

  it('resolves false when the Cancel button is clicked', async () => {
    const { apiRef, unmount } = renderProvider()
    unmountFns.push(unmount)

    let result: boolean | null = null
    act(() => {
      apiRef.current!.confirm('Delete this layer?').then(v => { result = v })
    })

    const buttons = Array.from(document.querySelectorAll('[role="dialog"] button'))
    const cancelBtn = buttons.find(b => b.textContent === 'Cancel') as HTMLButtonElement
    expect(cancelBtn).toBeTruthy()
    await act(async () => { cancelBtn.click() })

    expect(result).toBe(false)
  })

  it('honors custom title/confirmLabel/cancelLabel', () => {
    const { apiRef, unmount } = renderProvider()
    unmountFns.push(unmount)

    act(() => {
      void apiRef.current!.confirm('Delete the group?', {
        title: 'Delete group',
        confirmLabel: 'Delete',
        cancelLabel: 'Keep',
      })
    })

    const dialog = document.querySelector('[role="dialog"]')
    expect(dialog!.textContent).toContain('Delete group')
    expect(dialog!.textContent).toContain('Delete the group?')
    const buttons = Array.from(document.querySelectorAll('[role="dialog"] button')).map(b => b.textContent)
    expect(buttons).toContain('Delete')
    expect(buttons).toContain('Keep')
  })

  it('queues a second concurrent confirm() call behind the first (FIFO, never overlapping modals)', async () => {
    const { apiRef, unmount } = renderProvider()
    unmountFns.push(unmount)

    const results: boolean[] = []
    act(() => {
      apiRef.current!.confirm('First?').then(v => results.push(v))
      apiRef.current!.confirm('Second?').then(v => results.push(v))
    })

    // Only ONE dialog visible — never two overlapping confirm modals.
    expect(document.querySelectorAll('[role="dialog"]').length).toBe(1)
    expect(document.querySelector('[role="dialog"]')!.textContent).toContain('First?')

    const confirmBtn1 = Array.from(document.querySelectorAll('[role="dialog"] button'))
      .find(b => b.textContent === 'Confirm') as HTMLButtonElement
    await act(async () => { confirmBtn1.click() })

    // Second dialog now shows.
    expect(document.querySelectorAll('[role="dialog"]').length).toBe(1)
    expect(document.querySelector('[role="dialog"]')!.textContent).toContain('Second?')

    const confirmBtn2 = Array.from(document.querySelectorAll('[role="dialog"] button'))
      .find(b => b.textContent === 'Confirm') as HTMLButtonElement
    await act(async () => { confirmBtn2.click() })

    expect(results).toEqual([true, true])
  })
})
