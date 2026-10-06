import type { ReactNode, CSSProperties } from 'react'

/**
 * ButtonPalette — groups related buttons (typically <Button>s) with even spacing,
 * laid out horizontally or vertically. e.g. map tool palettes, layout switchers.
 *
 * - `surface` (default true) draws a grouped glass container around the buttons.
 * - vertical palettes stretch their buttons to equal width.
 */

export type PaletteOrientation = 'horizontal' | 'vertical'

interface ButtonPaletteProps {
  children: ReactNode
  orientation?: PaletteOrientation
  /** Draw the grouped glass surface around the buttons. */
  surface?: boolean
  /** Even spacing between buttons (px). */
  gap?: number
  ariaLabel?: string
  style?: CSSProperties
}

export function ButtonPalette({
  children,
  orientation = 'horizontal',
  surface = true,
  gap = 6,
  ariaLabel,
  style,
}: ButtonPaletteProps) {
  const vertical = orientation === 'vertical'
  return (
    <div
      role="toolbar"
      aria-label={ariaLabel}
      aria-orientation={vertical ? 'vertical' : 'horizontal'}
      style={{
        display: 'inline-flex',
        flexDirection: vertical ? 'column' : 'row',
        alignItems: 'stretch',
        gap,
        padding: surface ? 'var(--space-xs)' : 0,
        background: surface ? 'var(--color-glass-bg)' : 'transparent',
        border: surface ? '1px solid var(--color-glass-border)' : 'none',
        borderRadius: surface ? 6 : 0,
        ...style,
      }}
    >
      {children}
    </div>
  )
}
