/**
 * ClassifyModal — the one modal every classifiable item opens to choose its classification
 * marking (FGAC #152, operator direction 2026-10-01; D-9). Props only: the app passes the
 * options it may offer, the current marking, and how to compose a banner line.
 *
 * Layout: a live banner preview at the top, then a Level dropdown (single select, required), one
 * multi-select per category, and RELEASE TO (multi-select; NOFORN excludes every REL TO entry).
 * Favorites (D-9, #190): a dropdown under the preview fills every field from a saved marking; a
 * favorite the options cannot express (above the user's grants or the item's ceiling) is listed
 * but disabled. "Save as favorite" stores the current marking, or "Remove favorite" drops it.
 * Confirm hands the marking back and closes; Cancel discards. A value already on the item that the
 * options do not offer is kept, shown checked and locked, so confirming never silently drops part
 * of a marking.
 */
import { useState } from 'react'
import type { CSSProperties } from 'react'
import { Modal } from './Modal.js'
import { Button } from './Button.js'
import { ItemClassificationBar } from './ItemClassificationBar.js'
import { Select } from './Select.js'
import { MultiSelect } from './MultiSelect.js'
import type { MultiSelectOption } from './MultiSelect.js'

/** The releasability entry meaning "no foreign nationals". */
export const NOFORN_MARKING = 'NOFORN'

/** A classification marking: a level id, `<category>:<value>` tokens, releasability codes. */
export interface ClassificationMarking {
  classification?: string | null
  restrictions?: string[]
  sharing?: string[]
}

/** What the user may choose from — for OpenStare, their own grants only. */
export interface ClassifyOptions {
  levels: { id: string; name: string }[]
  categories: { id: string; name: string; values: { id: string; name: string }[] }[]
  releasability: { code: string; name: string }[]
  /** Whether NOFORN may be chosen. */
  noforn: boolean
  /**
   * The domestic country (e.g. `USA` in a US system). Every REL TO list names it, first (ISM:
   * `REL TO USA, FVEY`), so it is implied rather than offered.
   */
  domestic?: string | null
}

export interface ClassifyModalProps {
  options: ClassifyOptions
  value: ClassificationMarking
  /** The user's favorite markings; omit to show no favorites. */
  favorites?: ClassificationMarking[]
  /** Add (`add: true`) or remove the given marking from the user's favorites. */
  onToggleFavorite?: (marking: ClassificationMarking, add: boolean) => void
  /** A failed favorites save, shown in the modal. */
  favoritesError?: string | null
  /** The banner line and level word for a marking (the preview). */
  bannerFor: (marking: ClassificationMarking) => { banner: string | null; level: string | null }
  onConfirm: (marking: ClassificationMarking) => void
  onClose: () => void
}

const fieldStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 }

const labelStyle: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--color-text-secondary)',
}

const requiredStyle: CSSProperties = { color: 'var(--color-destructive)', marginLeft: 2 }

/** Apply a Release To change: choosing NOFORN clears every REL TO entry, and choosing a REL TO
 *  entry clears NOFORN. */
export function nextReleasability(previous: string[], next: string[], domestic?: string | null): string[] {
  const addedNoforn = next.includes(NOFORN_MARKING) && !previous.includes(NOFORN_MARKING)
  if (addedNoforn) return [NOFORN_MARKING]
  const rel = next.includes(NOFORN_MARKING) && next.length > 1 ? next.filter(v => v !== NOFORN_MARKING) : next
  return withDomestic(rel, domestic)
}

/** A REL TO list always names the domestic country, first; a list of only the domestic country
 *  releases to no one else, so it is no list at all. NOFORN and an empty list are unchanged. */
export function withDomestic(sharing: string[], domestic?: string | null): string[] {
  if (!domestic || sharing.includes(NOFORN_MARKING)) return sharing
  const foreign = sharing.filter(v => v !== domestic)
  return foreign.length > 0 ? [domestic, ...foreign] : []
}

/** Two markings name the same classification (order-insensitive). */
export function sameMarking(a: ClassificationMarking, b: ClassificationMarking): boolean {
  const key = (m: ClassificationMarking) =>
    JSON.stringify([m.classification ?? null, [...(m.restrictions ?? [])].sort(), [...(m.sharing ?? [])].sort()])
  return key(a) === key(b)
}

/** Whether `options` can express `marking`: its level, every restriction and every releasability
 *  entry is on offer (the domestic country and, when allowed, NOFORN included). */
export function fitsOptions(options: ClassifyOptions, marking: ClassificationMarking): boolean {
  if (!marking.classification || !options.levels.some(l => l.id === marking.classification)) return false
  const tokens = new Set(options.categories.flatMap(c => c.values.map(v => `${c.id}:${v.id}`)))
  if (!(marking.restrictions ?? []).every(t => tokens.has(t))) return false
  const codes = new Set(options.releasability.map(r => r.code))
  if (options.domestic) codes.add(options.domestic)
  if (options.noforn) codes.add(NOFORN_MARKING)
  return (marking.sharing ?? []).every(c => codes.has(c))
}

export function ClassifyModal({ options, value, favorites, onToggleFavorite, favoritesError, bannerFor, onConfirm, onClose }: ClassifyModalProps) {
  // An existing REL TO list without the domestic country is shown, and confirmed, with it (ISM).
  const [marking, setMarking] = useState<ClassificationMarking>(() =>
    value.sharing ? { ...value, sharing: withDomestic(value.sharing, options.domestic) } : value,
  )
  const restrictions = marking.restrictions ?? []
  const sharing = marking.sharing ?? []
  const { banner, level } = bannerFor(marking)

  // Values already on the item that the options do not offer: kept, locked.
  const offeredTokens = new Set(options.categories.flatMap(c => c.values.map(v => `${c.id}:${v.id}`)))
  const offeredCategories = new Set(options.categories.map(c => c.id))
  const kept = (value.restrictions ?? []).filter(t => !offeredTokens.has(t))
  const keptIn = (categoryId: string) => kept.filter(t => t.startsWith(`${categoryId}:`))
  const keptElsewhere = kept.filter(t => !offeredCategories.has(t.split(':')[0]))

  const categoryOptions = (c: ClassifyOptions['categories'][number]): MultiSelectOption[] => [
    ...c.values.map(v => ({ value: `${c.id}:${v.id}`, label: `${v.name} (${v.id})` })),
    ...keptIn(c.id).map(t => ({ value: t, label: t.split(':')[1], locked: true })),
  ]

  const domestic = options.domestic ?? null
  const offeredCodes = new Set(options.releasability.map(r => r.code))
  const keptCodes = (value.sharing ?? []).filter(c => c !== NOFORN_MARKING && c !== domestic && !offeredCodes.has(c))
  const nofornKeptOnly = (value.sharing ?? []).includes(NOFORN_MARKING) && !options.noforn
  const releaseOptions: MultiSelectOption[] = [
    ...(options.noforn || nofornKeptOnly ? [{ value: NOFORN_MARKING, label: 'NOFORN', locked: nofornKeptOnly }] : []),
    ...options.releasability
      .filter(r => r.code !== domestic)
      .map(r => ({ value: r.code, label: `${r.name} (${r.code})` })),
    ...keptCodes.map(c => ({ value: c, label: c, locked: true })),
  ]

  const setCategory = (categoryId: string, chosen: string[]) =>
    setMarking(m => ({
      ...m,
      restrictions: [...(m.restrictions ?? []).filter(t => !t.startsWith(`${categoryId}:`)), ...chosen],
    }))

  const complete = typeof marking.classification === 'string' && marking.classification.length > 0
  const isFavorite = (favorites ?? []).some(f => sameMarking(f, marking))
  const toggleFavorite = () => onToggleFavorite?.(marking, !isFavorite)

  // A favorite fills every field but never drops a value the item carries that the options cannot
  // offer (kept, locked): restrictions are merged in, and a favorite that would lose a locked
  // releasability entry is disabled.
  const lockedSharing = [...keptCodes, ...(nofornKeptOnly ? [NOFORN_MARKING] : [])]
  const keepsLocked = (f: ClassificationMarking) => lockedSharing.every(c => (f.sharing ?? []).includes(c))
  const applyFavorite = (f: ClassificationMarking) =>
    setMarking({ ...f, restrictions: [...new Set([...(f.restrictions ?? []), ...kept])] })

  return (
    <Modal title="CLASSIFY" onClose={onClose} width={460} resizable={false}>
      <ItemClassificationBar banner={banner} level={level} />

      {favorites && favorites.length > 0 && (
        <div style={fieldStyle}>
          <span style={labelStyle}>FAVORITES</span>
          <Select
            ariaLabel="Favorites"
            placeholder="Choose a favorite"
            options={favorites.map((f, i) => ({
              value: String(i),
              label: bannerFor(f).banner ?? 'CLASSIFICATION NOT SET',
              disabled: !fitsOptions(options, f) || !keepsLocked(f),
            }))}
            value={null}
            onChange={i => { if (i !== null) applyFavorite(favorites[Number(i)]) }}
          />
        </div>
      )}

      <div style={fieldStyle}>
        <span style={labelStyle}>
          LEVEL<span style={requiredStyle} aria-hidden>*</span>
        </span>
        <Select
          ariaLabel="Classification level"
          placeholder="Choose a level"
          options={options.levels.map(l => ({ value: l.id, label: l.name }))}
          value={marking.classification ?? null}
          onChange={id => setMarking(m => ({ ...m, classification: id }))}
        />
      </div>

      {options.categories.map(c => (
        <div key={c.id} style={fieldStyle}>
          <span style={labelStyle}>{c.name}</span>
          <MultiSelect
            ariaLabel={c.name}
            options={categoryOptions(c)}
            value={restrictions.filter(t => t.startsWith(`${c.id}:`))}
            onChange={chosen => setCategory(c.id, chosen)}
          />
        </div>
      ))}

      {keptElsewhere.length > 0 && (
        <div style={fieldStyle}>
          <span style={labelStyle}>OTHER MARKINGS</span>
          <MultiSelect
            ariaLabel="Other markings"
            options={keptElsewhere.map(t => ({ value: t, label: t, locked: true }))}
            value={keptElsewhere}
            onChange={() => {}}
          />
        </div>
      )}

      <div style={fieldStyle}>
        <span style={labelStyle}>RELEASE TO</span>
        <MultiSelect
          ariaLabel="Release to"
          options={releaseOptions}
          value={sharing.filter(c => c !== domestic)}
          onChange={next => setMarking(m => ({ ...m, sharing: nextReleasability(m.sharing ?? [], next, domestic) }))}
        />
      </div>

      {favoritesError && (
        <div role="alert" style={{ fontSize: 12, color: 'var(--color-destructive)' }}>{favoritesError}</div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-sm)' }}>
        {onToggleFavorite && (
          <Button variant="ghost" disabled={!complete} onClick={toggleFavorite} style={{ marginRight: 'auto' }}>
            {isFavorite ? 'Remove favorite' : 'Save as favorite'}
          </Button>
        )}
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" disabled={!complete} onClick={() => { onConfirm(marking); onClose() }}>
          Confirm
        </Button>
      </div>
    </Modal>
  )
}
