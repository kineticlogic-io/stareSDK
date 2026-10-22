import type { CSSProperties, KeyboardEvent, MouseEvent, ReactNode, SyntheticEvent } from 'react'
import { Badge } from '../components/Badge.js'

/**
 * The card internals `ItemCard` and `PersonCard` share (0.2.29): one implementation of the
 * click-isolated slot, the chip list with its "+N" overflow, the whole-card keyboard activation,
 * the glass card shell and the banner strip, so the two cards cannot drift apart.
 */

export const stopPropagation = (e: SyntheticEvent) => e.stopPropagation()

/** Wraps an interactive slot so neither its clicks nor its keys reach the card's `onClick`. */
export function Isolated({ children, style, className }: { children: ReactNode; style?: CSSProperties; className?: string }) {
  return (
    <span
      className={className}
      onClick={stopPropagation}
      onKeyDown={stopPropagation}
      style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, ...style }}
    >
      {children}
    </span>
  )
}

export const ellipsis: CSSProperties = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }

/**
 * Enter/Space on the card itself (never on a control inside it) activates `onClick`, the same
 * keys a native button answers to.
 */
export function cardKeyDownHandler(onClick: (() => void) | undefined) {
  return (e: KeyboardEvent<HTMLDivElement>) => {
    if (!onClick || e.target !== e.currentTarget) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick()
    }
  }
}

/**
 * Up to `max` chips, then an outline "+N" badge whose tooltip names the rest. With `onChipClick`
 * each chip is a button whose clicks and keys never reach the card.
 */
export function ChipList({
  chips,
  max,
  onChipClick,
  listClassName,
  chipClassName,
  style,
}: {
  chips: string[]
  max: number
  onChipClick?: (chip: string) => void
  listClassName: string
  chipClassName: string
  style?: CSSProperties
}) {
  const shown = chips.slice(0, Math.max(0, max))
  const hidden = chips.slice(shown.length)
  if (shown.length === 0) return null
  return (
    <span className={listClassName} style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4, ...style }}>
      {shown.map((chip) =>
        onChipClick ? (
          <button
            key={chip}
            type="button"
            className={chipClassName}
            onClick={(e: MouseEvent) => {
              e.stopPropagation()
              onChipClick(chip)
            }}
            onKeyDown={stopPropagation}
            style={{ background: 'none', border: 'none', padding: 0, borderRadius: 999, cursor: 'pointer', display: 'inline-flex' }}
          >
            <Badge color="grey" size="sm">{chip}</Badge>
          </button>
        ) : (
          <Badge key={chip} color="grey" size="sm">{chip}</Badge>
        ),
      )}
      {hidden.length > 0 && (
        <Badge color="grey" size="sm" outline title={hidden.join(', ')}>{`+${hidden.length}`}</Badge>
      )}
    </span>
  )
}

/** The glass card shell: accent border when selected, a clipped full-height column as a tile. */
export function cardShellStyle({
  tile,
  column,
  selected,
  interactive,
}: {
  tile: boolean
  column: boolean
  selected: boolean
  interactive: boolean
}): CSSProperties {
  return {
    position: 'relative',
    display: 'flex',
    flexDirection: column ? 'column' : 'row',
    gap: tile ? 0 : 'var(--space-sm)',
    padding: tile ? 0 : 'var(--space-md)',
    borderRadius: 8,
    background: 'var(--color-glass-bg)',
    border: `1px solid ${selected ? 'var(--color-accent)' : 'var(--color-glass-border)'}`,
    boxShadow: selected ? 'inset 0 0 0 1px var(--color-accent)' : undefined,
    // `clip`, never `hidden`: `hidden` makes a tile a scroll container whose automatic minimum
    // height is zero, so a grid of auto rows in a height-limited scroller squeezes every tile.
    overflow: tile ? 'clip' : undefined,
    height: tile ? '100%' : undefined,
    boxSizing: 'border-box',
    cursor: interactive ? 'pointer' : undefined,
    fontFamily: 'var(--font-sans)',
  }
}

/** The strip across a card's top edge (a tile pads and rules it off; a row sets it flush). */
export function CardBanner({ banner, tile, className }: { banner: ReactNode; tile: boolean; className: string }) {
  if (banner == null) return null
  return (
    <div
      className={className}
      style={{ flexShrink: 0, padding: tile ? 'var(--space-sm) var(--space-md)' : 0, borderBottom: tile ? '1px solid var(--color-glass-border)' : undefined }}
    >
      {banner}
    </div>
  )
}
