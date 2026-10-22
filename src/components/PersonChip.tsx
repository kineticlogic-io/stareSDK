import type { CSSProperties } from 'react'
import { Avatar } from './Avatar.js'
import { ellipsis } from '../internal/cardParts.js'

/**
 * PersonChip (0.2.29) — the one clickable way to show a person anywhere in an app (OpenStare's
 * user directory, kineticlogic-io/OpenStare#391): `Avatar` and display name as ONE control.
 *
 * - With `onClick` it is a single `<button>` named "Show <name>'s profile" (or `ariaLabel`), with
 *   the SDK's link treatment: the text brightens to the accent on hover and keyboard focus gets
 *   the accent ring (colour and outline only, compositor-safe).
 * - Without `onClick` it is plain, non-interactive text: no role, not focusable.
 * - It inherits font family, size and colour, so it sits inline in a sentence ("deleted by
 *   <PersonChip/>"); the avatar is decorative (the name is beside it).
 * - `subtitle` adds a small second line under the name, e.g. a position.
 *
 * Every value is a prop; the chip never resolves an avatar or routes anywhere itself.
 */
export type PersonChipSize = 'sm' | 'md'

export interface PersonChipProps {
  /** The person's display name. */
  name: string
  /** Resolved avatar URL; missing or failing falls back to `Avatar`'s initials. */
  avatarSrc?: string | null
  /** Passed to `Avatar`'s initials fallback (defaults to `name`). */
  username?: string
  /** `sm` a 16 px avatar (default), `md` 20 px. */
  size?: PersonChipSize
  /** Makes the chip a button, e.g. to open the person's profile. */
  onClick?: () => void
  /** Accessible name of the button (default `Show <name>'s profile`). */
  ariaLabel?: string
  /** A small second line under the name, e.g. a position. */
  subtitle?: string
  id?: string
  style?: CSSProperties
}

const AVATAR_PX: Record<PersonChipSize, number> = { sm: 16, md: 20 }
// Avatar's own initials table starts at 28 px; at chip sizes its nearest step (12 px) would crowd
// the circle, so the chip sets a fixed, bounded glyph size per chip size instead.
const INITIALS_PX: Record<PersonChipSize, number> = { sm: 8, md: 10 }

export function PersonChip({
  name,
  avatarSrc,
  username,
  size = 'sm',
  onClick,
  ariaLabel,
  subtitle,
  id,
  style,
}: PersonChipProps) {
  const interactive = onClick != null
  const className = ['ui-person-chip', `ui-person-chip--${size}`, interactive ? 'ui-person-chip--interactive' : '']
    .filter(Boolean)
    .join(' ')

  const rootStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: size === 'md' ? 6 : 4,
    maxWidth: '100%',
    minWidth: 0,
    verticalAlign: 'middle',
    font: 'inherit',
    color: 'inherit',
    textAlign: 'left',
    ...(interactive
      ? { padding: 0, margin: 0, border: 'none', background: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }
      : null),
    ...style,
  }

  const content = (
    <>
      <span aria-hidden style={{ display: 'inline-flex', flexShrink: 0 }}>
        <Avatar
          size={AVATAR_PX[size]}
          src={avatarSrc}
          username={username || name}
          alt=""
          style={{ fontSize: INITIALS_PX[size] }}
        />
      </span>
      {subtitle ? (
        <span style={{ display: 'inline-flex', flexDirection: 'column', minWidth: 0 }}>
          <span className="ui-person-chip__name" style={ellipsis}>{name}</span>
          <span
            className="ui-person-chip__subtitle"
            style={{ ...ellipsis, fontSize: '0.85em', color: 'var(--color-text-secondary)' }}
          >
            {subtitle}
          </span>
        </span>
      ) : (
        <span className="ui-person-chip__name" style={ellipsis}>{name}</span>
      )}
    </>
  )

  if (!interactive) {
    return (
      <span id={id} className={className} style={rootStyle}>
        {content}
      </span>
    )
  }
  return (
    <button
      id={id}
      type="button"
      className={className}
      aria-label={ariaLabel ?? `Show ${name}'s profile`}
      onClick={onClick}
      style={rootStyle}
    >
      {content}
    </button>
  )
}
