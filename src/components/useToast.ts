/**
 * useToast — the `ui/Toast` consumer hook, split from `Toast.tsx` (87-27, D-08) to satisfy
 * `react-refresh/only-export-components` (a component module may only export components). The
 * `createContext(...)` call and the `useToast()` hook live here; `ToastProvider` and all
 * presentational Toast/Confirm UI stay in `Toast.tsx`, which imports `ToastCtx` back to wire its
 * `<ToastCtx.Provider>`. Matches the two-way value/type split pattern 87-25 established for
 * `src/context/*.tsx` — `ToastContextValue` moves here in full since nothing outside this pair
 * ever imported it (it was not even exported from `Toast.tsx` before this split).
 *
 * `useToast()`'s contract is unchanged: throws if called outside a `<ToastProvider>`.
 */
import { createContext, useContext } from 'react'
import type { ToastOptions, ConfirmOptions } from './Toast.js'

interface ToastContextValue {
  /** Raise a toast. Returns the toast id (existing id if `dedupeKey` matched). */
  toast: (options: ToastOptions) => string
  /** Dismiss a toast by id (no-op if already gone). */
  dismiss: (id: string) => void
  /**
   * Raise a app-styled confirm dialog (via `ui/Modal`) in place of native
   * `window.confirm()`. Resolves `true` on Confirm, `false` on Cancel, Esc,
   * or backdrop click. Only one confirm dialog is shown at a time — a second
   * concurrent call queues behind the first (FIFO) rather than stacking
   * overlapping modals.
   */
  confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>
}

export const ToastCtx = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}
