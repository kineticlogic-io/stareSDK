/**
 * @module useDock
 *
 * Consumer hook + context object for DockContext.tsx's `<DockProvider>`.
 * Split out per D-08 (react-refresh/only-export-components) — see AuthContext's
 * sibling module for the pattern this repeats across src/context/.
 */
import { createContext, useContext } from 'react'
import type { DockContextValue } from './DockContext'

export const DockCtx = createContext<DockContextValue | null>(null)

export function useDock(): DockContextValue {
  const ctx = useContext(DockCtx)
  if (!ctx) throw new Error('useDock must be used within a DockProvider')
  return ctx
}
