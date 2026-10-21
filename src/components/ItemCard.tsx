import { useState } from 'react'
import type { CSSProperties, KeyboardEvent, MouseEvent, ReactNode, SyntheticEvent } from 'react'
import { TbStar, TbStarFilled } from 'react-icons/tb'
import { Avatar } from './Avatar.js'
import { Badge } from './Badge.js'
import { Checkbox } from './Checkbox.js'

/**
 * ItemCard — the catalog item card (0.2.25, for OpenStare's LEDGER content-management overhaul,
 * kineticlogic-io/OpenStare#383–#388; later FORGE and LOOM).
 *
 * Generalised from LEDGER's `CatalogCard` (itself ATLAS's layer-catalog card): a glass card with
 * a header (type icon, title over a sub-caption, status/sharing badges, an actions slot), the
 * description clamped to three lines, and a footer (owner avatar and name on the left; tags and a
 * meta line such as "Updated 5m ago" on the right). Every value is a prop — the card never
 * formats a date, resolves an avatar or knows what kind of item it shows.
 *
 * Two layouts:
 * - `row` (default) — the full-width list row LEDGER shows today; a `thumbnailSrc` shows as a
 *   small preview at the leading edge.
 * - `tile` — a grid tile with the thumbnail across the top; without one, the type icon sits in a
 *   neutral placeholder area of the same size.
 *
 * Interaction:
 * - `onClick` makes the whole card one control (`role="button"`, focusable, Enter/Space
 *   activate); `selected` marks it as the current item (`aria-current`) with an accent border.
 * - Clicks and keys inside the `actions` slot (including anything it portals, such as a kebab
 *   menu's popover), the selection checkbox, the favorite star and the tag buttons never reach
 *   `onClick`.
 * - `selectable` adds a `Checkbox` in the corner (leading edge of a row; over the thumbnail's
 *   top-left corner of a tile), labelled `Select <title>` unless `selectLabel` says otherwise.
 * - `onFavoriteChange` adds a star toggle (`TbStar`/`TbStarFilled`, `aria-pressed`).
 * - `tags` show up to `maxTags` (default 4) then a "+N" badge; with `onTagClick` each tag is a
 *   button.
 *
 * Hover and keyboard focus follow the shared tokens (accent border on hover, accent focus ring);
 * design tokens only, so it follows the dark and light themes.
 */
export type ItemCardLayout = 'row' | 'tile'

export interface ItemCardOwner {
  name: string
  /** Resolved avatar URL; missing or failing falls back to `Avatar`'s initials. */
  avatarSrc?: string | null
}

export interface ItemCardProps {
  /** The item type's glyph (a react-icons/tb icon). */
  typeIcon: ReactNode
  /** The item type's name, used as the icon's tooltip and accessible label (e.g. "Layer"). */
  typeLabel?: string
  title: string
  /** The sub-caption under the title (e.g. "Vector layer · 1,204 features"). */
  subtitle?: ReactNode
  /** Clamped to three lines. */
  description?: ReactNode
  thumbnailSrc?: string | null
  thumbnailAlt?: string
  /** Status and sharing badges, shown beside the title (row) or under it (tile). */
  badges?: ReactNode
  owner?: ItemCardOwner
  tags?: string[]
  /** How many tags show before a "+N" badge (default 4). */
  maxTags?: number
  onTagClick?: (tag: string) => void
  /** Footer meta text, formatted by the caller (e.g. "Updated 5m ago"). */
  meta?: ReactNode
  /** Trailing header slot, e.g. a kebab menu. Its clicks never trigger `onClick`. */
  actions?: ReactNode
  onClick?: () => void
  /** Accessible name of the card when it is clickable (defaults to `title`). */
  ariaLabel?: string
  /** Marks the card as the current item. */
  selected?: boolean
  /** Show a selection checkbox in the corner. */
  selectable?: boolean
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  /** Accessible name of the selection checkbox (defaults to `Select <title>`). */
  selectLabel?: string
  favorite?: boolean
  /** Shows the favorite star when provided. */
  onFavoriteChange?: (favorite: boolean) => void
  /** Accessible name of the star toggle (default "Favorite"); its state is `aria-pressed`. */
  favoriteLabel?: string
  layout?: ItemCardLayout
  id?: string
  style?: CSSProperties
}

const stop = (e: SyntheticEvent) => e.stopPropagation()

/** Wraps an interactive slot so neither its clicks nor its keys reach the card's `onClick`. */
function Isolated({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <span onClick={stop} onKeyDown={stop} style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, ...style }}>
      {children}
    </span>
  )
}

const ellipsis: CSSProperties = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }

function Thumbnail({
  src,
  alt,
  typeIcon,
  style,
  iconSize,
}: {
  src?: string | null
  alt?: string
  typeIcon: ReactNode
  style: CSSProperties
  iconSize: number
}) {
  const resolved = src || null
  const [failed, setFailed] = useState(false)
  // A new src deserves a fresh attempt (same render-time reset as Avatar).
  const [tracked, setTracked] = useState(resolved)
  if (resolved !== tracked) {
    setTracked(resolved)
    setFailed(false)
  }
  const box: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
    boxSizing: 'border-box',
    background: 'var(--surface-layer-2)',
    ...style,
  }
  if (resolved && !failed) {
    return (
      <div className="ui-item-card__thumb" style={box}>
        <img
          src={resolved}
          alt={alt ?? ''}
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>
    )
  }
  return (
    <div className="ui-item-card__thumb ui-item-card__thumb--placeholder" aria-hidden style={box}>
      <span style={{ display: 'inline-flex', fontSize: iconSize, color: 'var(--text-muted)' }}>{typeIcon}</span>
    </div>
  )
}

export function ItemCard({
  typeIcon,
  typeLabel,
  title,
  subtitle,
  description,
  thumbnailSrc,
  thumbnailAlt,
  badges,
  owner,
  tags = [],
  maxTags = 4,
  onTagClick,
  meta,
  actions,
  onClick,
  ariaLabel,
  selected = false,
  selectable = false,
  checked = false,
  onCheckedChange,
  selectLabel,
  favorite = false,
  onFavoriteChange,
  favoriteLabel = 'Favorite',
  layout = 'row',
  id,
  style,
}: ItemCardProps) {
  const tile = layout === 'tile'
  const interactive = onClick != null
  const shown = tags.slice(0, Math.max(0, maxTags))
  const hidden = tags.slice(shown.length)

  const onCardKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!onClick || e.target !== e.currentTarget) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick()
    }
  }

  const checkbox = selectable ? (
    <Isolated
      style={
        tile
          ? {
              position: 'absolute',
              top: 'var(--space-sm)',
              left: 'var(--space-sm)',
              padding: 4,
              borderRadius: 'var(--radius-sm)',
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-glass-border)',
              zIndex: 1,
            }
          : { alignSelf: 'flex-start', marginTop: 4 }
      }
    >
      <Checkbox
        checked={checked}
        onChange={(next) => onCheckedChange?.(next)}
        ariaLabel={selectLabel ?? `Select ${title}`}
      />
    </Isolated>
  ) : null

  const star = onFavoriteChange ? (
    <Isolated>
      <button
        type="button"
        className="ui-item-card__icon-button"
        aria-label={favoriteLabel}
        aria-pressed={favorite}
        title={favoriteLabel}
        onClick={() => onFavoriteChange(!favorite)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 24,
          height: 24,
          padding: 0,
          border: 'none',
          borderRadius: 'var(--radius-sm)',
          background: 'transparent',
          fontSize: 16,
          color: favorite ? 'var(--status-warning)' : 'var(--color-text-secondary)',
          cursor: 'pointer',
        }}
      >
        {favorite ? <TbStarFilled aria-hidden /> : <TbStar aria-hidden />}
      </button>
    </Isolated>
  ) : null

  const typeGlyph = (
    <span
      role={typeLabel ? 'img' : undefined}
      aria-label={typeLabel}
      aria-hidden={typeLabel ? undefined : true}
      title={typeLabel}
      style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, fontSize: 18, color: 'var(--color-text-secondary)', marginTop: 1 }}
    >
      {typeIcon}
    </span>
  )

  const titleBlock = (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div
        className="ui-item-card__title"
        title={title}
        style={{ ...ellipsis, fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' }}
      >
        {title}
      </div>
      {subtitle != null && (
        <div style={{ ...ellipsis, fontSize: 12, color: 'var(--color-text-secondary)' }}>{subtitle}</div>
      )}
    </div>
  )

  const badgeRow = badges != null ? (
    <span style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, flexShrink: 0 }}>{badges}</span>
  ) : null

  const header = (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-xs)' }}>
      {typeGlyph}
      {titleBlock}
      {!tile && badgeRow}
      {star}
      {actions != null && <Isolated>{actions}</Isolated>}
    </div>
  )

  const descriptionBlock = description != null ? (
    <div
      className="ui-item-card__description"
      style={{
        fontFamily: 'var(--font-sans)',
        fontSize: 12,
        lineHeight: 1.4,
        color: 'var(--color-text-secondary)',
        overflow: 'hidden',
        display: '-webkit-box',
        WebkitLineClamp: 3,
        WebkitBoxOrient: 'vertical',
      }}
    >
      {description}
    </div>
  ) : null

  const tagList = shown.length > 0 ? (
    <span className="ui-item-card__tags" style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4 }}>
      {shown.map((tag) =>
        onTagClick ? (
          <button
            key={tag}
            type="button"
            className="ui-item-card__tag"
            onClick={(e: MouseEvent) => {
              e.stopPropagation()
              onTagClick(tag)
            }}
            onKeyDown={stop}
            style={{ background: 'none', border: 'none', padding: 0, borderRadius: 999, cursor: 'pointer', display: 'inline-flex' }}
          >
            <Badge color="grey" size="sm">{tag}</Badge>
          </button>
        ) : (
          <Badge key={tag} color="grey" size="sm">{tag}</Badge>
        ),
      )}
      {hidden.length > 0 && (
        <Badge color="grey" size="sm" outline title={hidden.join(', ')}>{`+${hidden.length}`}</Badge>
      )}
    </span>
  ) : null

  const ownerBlock = owner ? (
    <span className="ui-item-card__owner" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
      <Avatar size={18} src={owner.avatarSrc} username={owner.name} alt={owner.name} />
      <span style={{ ...ellipsis, fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--color-text-primary)' }}>{owner.name}</span>
    </span>
  ) : null

  const metaBlock = meta != null ? (
    <span
      className="ui-item-card__meta"
      style={{ ...ellipsis, display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-secondary)' }}
    >
      {meta}
    </span>
  ) : null

  const footer = ownerBlock || tagList || metaBlock ? (
    tile ? (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)', marginTop: 'auto' }}>
        {tagList}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-sm)', minWidth: 0 }}>
          {ownerBlock ?? <span />}
          {metaBlock}
        </div>
      </div>
    ) : (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-sm)', marginTop: 'auto' }}>
        {ownerBlock ?? <span />}
        <span style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 'var(--space-sm)', minWidth: 0 }}>
          {tagList}
          {metaBlock}
        </span>
      </div>
    )
  ) : null

  const className = [
    'ui-item-card',
    `ui-item-card--${layout}`,
    interactive ? 'ui-item-card--interactive' : '',
    selected ? 'ui-item-card--selected' : '',
  ].filter(Boolean).join(' ')

  const cardStyle: CSSProperties = {
    position: 'relative',
    display: 'flex',
    flexDirection: tile ? 'column' : 'row',
    gap: tile ? 0 : 'var(--space-sm)',
    padding: tile ? 0 : 'var(--space-md)',
    borderRadius: 8,
    background: 'var(--color-glass-bg)',
    border: `1px solid ${selected ? 'var(--color-accent)' : 'var(--color-glass-border)'}`,
    boxShadow: selected ? 'inset 0 0 0 1px var(--color-accent)' : undefined,
    overflow: tile ? 'hidden' : undefined,
    height: tile ? '100%' : undefined,
    boxSizing: 'border-box',
    cursor: interactive ? 'pointer' : undefined,
    fontFamily: 'var(--font-sans)',
    ...style,
  }

  const body = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)', flex: 1, minWidth: 0, padding: tile ? 'var(--space-md)' : 0 }}>
      {header}
      {tile && badgeRow}
      {descriptionBlock}
      {footer}
    </div>
  )

  return (
    <div
      id={id}
      className={className}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? (ariaLabel ?? title) : undefined}
      aria-current={selected ? 'true' : undefined}
      data-layout={layout}
      onClick={onClick}
      onKeyDown={onCardKeyDown}
      style={cardStyle}
    >
      {tile ? (
        <>
          {checkbox}
          <Thumbnail
            src={thumbnailSrc}
            alt={thumbnailAlt}
            typeIcon={typeIcon}
            iconSize={36}
            style={{ width: '100%', aspectRatio: '16 / 9', borderBottom: '1px solid var(--color-glass-border)' }}
          />
        </>
      ) : (
        <>
          {checkbox}
          {thumbnailSrc && (
          <Thumbnail
            src={thumbnailSrc}
            alt={thumbnailAlt}
            typeIcon={typeIcon}
            iconSize={24}
            style={{ width: 96, height: 64, borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-glass-border)' }}
          />
          )}
        </>
      )}
      {body}
    </div>
  )
}
