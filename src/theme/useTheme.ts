/**
 * @module useTheme
 *
 * Consumer hook + context object for ThemeContext.tsx's `<ThemeProvider>`.
 * Split out per react-refresh/only-export-components — see BannerContext.tsx's sibling
 * `useBanner.ts` for the pattern this repeats across src/context/.
 *
 * Carries a real default value (never `null`) — `theme: 'dark'` matches SC-1 (dark is the
 * default for any user who has never chosen) and lets a component degrade gracefully if it is
 * ever rendered outside a provider, instead of throwing.
 */
import { createContext, useContext } from 'react'
import type { ThemeContextValue } from './ThemeContext'

export const ThemeCtx = createContext<ThemeContextValue>({
  theme: 'dark',
  setTheme: () => {},
  commitTheme: () => {},
})

export function useTheme() {
  return useContext(ThemeCtx)
}
