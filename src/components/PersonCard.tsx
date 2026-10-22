import type { CSSProperties, ReactNode } from 'react'
import { Avatar } from './Avatar.js'
import { CardBanner, ChipList, cardKeyDownHandler, cardShellStyle, ellipsis } from '../internal/cardParts.js'

/**
 * PersonCard (0.2.29) — a person's entry in a directory (OpenStare's user directory,
 * kineticlogic-io/OpenStare#391), in the `ItemCard` family and built on the same card internals:
 * the glass shell, the banner strip, the chip list and the whole-card keyboard activation.
 *
 * A large avatar takes the thumbnail's place, beside (row) or above (tile) the name, position,
 * organization and site, and up to `maxSkills` skills (then "+N", whose tooltip lists the rest).
 *
 * - `row` (default) — a full-width list row: a 48 px avatar at the leading edge.
 * - `tile` — a grid tile: an 80 px avatar centred over centred text; fills its grid cell and clips
 *   with `overflow: clip` (see `ItemCard` for why never `hidden`).
 *
 * Interaction is ItemCard's: `onClick` makes the whole card one control (`role="button"`,
 * focusable, Enter/Space activate); `selected` marks it current (`aria-current`, accent border);
 * with `onSkillClick` each skill is a button whose clicks and keys never reach `onClick`.
 * `banner` is a strip across the top edge in both layouts. Every value is a prop; design tokens
 * only, so it follows the dark and light themes.
 */
export type PersonCardLayout = 'row' | 'tile'

export interface PersonCardProps {
  /** The person's display name. */
  name: string
  /** Resolved avatar URL; missing or failing falls back to `Avatar`'s initials. */
  avatarSrc?: string | null
  /** Passed to `Avatar`'s initials fallback (defaults to `name`). */
  username?: string
  /** Position or role, e.g. "Senior Analyst". */
  position?: string
  organization?: string
  site?: string
  skills?: string[]
  /** How many skills show before a "+N" badge (default 4). */
  maxSkills?: number
  onSkillClick?: (skill: string) => void
  onClick?: () => void
  layout?: PersonCardLayout
  /** Marks the card as the current entry. */
  selected?: boolean
  /** A strip across the card's top edge in both layouts, e.g. an `ItemClassificationBar`. */
  banner?: ReactNode
  /** Accessible name of the card when it is clickable (defaults to `name`). */
  ariaLabel?: string
  id?: string
  style?: CSSProperties
}

export function PersonCard({
  name,
  avatarSrc,
  username,
  position,
  organization,
  site,
  skills = [],
  maxSkills = 4,
  onSkillClick,
  onClick,
  layout = 'row',
  selected = false,
  banner,
  ariaLabel,
  id,
  style,
}: PersonCardProps) {
  const tile = layout === 'tile'
  const interactive = onClick != null
  const affiliation = [organization, site].filter(Boolean).join(' · ')
  const hasSkills = skills.length > 0 && maxSkills > 0

  const avatar = (
    <Avatar
      size={tile ? 80 : 48}
      src={avatarSrc}
      username={username || name}
      alt={name}
      style={tile ? { alignSelf: 'center' } : { alignSelf: 'flex-start' }}
    />
  )

  const line = (text: string, className: string, extra?: CSSProperties) => (
    <div className={className} title={text} style={{ ...ellipsis, fontSize: 12, color: 'var(--color-text-secondary)', ...extra }}>
      {text}
    </div>
  )

  const body = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: tile ? 'center' : 'stretch',
        textAlign: tile ? 'center' : undefined,
        gap: 2,
        flex: 1,
        minWidth: 0,
        width: tile ? '100%' : undefined,
      }}
    >
      <div
        className="ui-person-card__name"
        title={name}
        style={{ ...ellipsis, maxWidth: '100%', fontSize: tile ? 15 : 14, fontWeight: 700, color: 'var(--color-text-primary)' }}
      >
        {name}
      </div>
      {position && line(position, 'ui-person-card__position', { maxWidth: '100%' })}
      {affiliation && line(affiliation, 'ui-person-card__affiliation', { maxWidth: '100%', color: 'var(--text-muted)' })}
      {hasSkills && (
        <ChipList
          chips={skills}
          max={maxSkills}
          onChipClick={onSkillClick}
          listClassName="ui-person-card__skills"
          chipClassName="ui-person-card__skill"
          style={{ marginTop: 'var(--space-xs)', justifyContent: tile ? 'center' : undefined }}
        />
      )}
    </div>
  )

  const className = [
    'ui-person-card',
    `ui-person-card--${layout}`,
    interactive ? 'ui-person-card--interactive' : '',
    selected ? 'ui-person-card--selected' : '',
  ].filter(Boolean).join(' ')

  const cardStyle: CSSProperties = {
    ...cardShellStyle({ tile, column: tile || banner != null, selected, interactive }),
    ...style,
  }

  const content = (
    <div
      style={
        tile
          ? { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-sm)', padding: 'var(--space-lg) var(--space-md)', flex: 1, minWidth: 0 }
          : { display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 'var(--space-md)', minWidth: 0 }
      }
    >
      {avatar}
      {body}
    </div>
  )

  return (
    <div
      id={id}
      className={className}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? (ariaLabel ?? name) : undefined}
      aria-current={selected ? 'true' : undefined}
      data-layout={layout}
      onClick={onClick}
      onKeyDown={cardKeyDownHandler(onClick)}
      style={cardStyle}
    >
      <CardBanner banner={banner} tile={tile} className="ui-person-card__banner" />
      {content}
    </div>
  )
}
