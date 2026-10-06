/**
 * Shared style tokens for the Map Layers pane rows (GisLayerRow, GisImageryRow).
 * One source of truth so vector + imagery rows and their kebab popovers stay
 * visually identical. Design tokens only.
 */
import type { CSSProperties } from 'react'

/** Slim single-line row shell. */
export const layerRowStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  borderRadius: 4,
  border: '1px solid transparent',
  // eslint-disable-next-line no-restricted-syntax -- pre-existing literal with no direct design-token equivalent yet — deferred, see deferred-items.md (would require a new token, a design decision out of this plan's scope) — ultra-faint row wash
  background: 'rgba(255,255,255,0.02)',
  marginBottom: 1,
  position: 'relative',
}

/** The always-visible single line inside a row. */
export const layerRowMainLine: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 2,
  minHeight: 28,
  paddingRight: 2,
}

/** Row name / filename label. */
export const layerRowName: CSSProperties = {
  flex: 1,
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  fontWeight: 500,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  letterSpacing: '0.02em',
  paddingLeft: 2,
}

/** Chevron expander hit area. */
export const layerRowChevron: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 22,
  height: 28,
  flexShrink: 0,
  cursor: 'pointer',
  color: 'var(--color-text-secondary)',
  transition: 'transform 0.15s',
  fontSize: 13,
}

/** Kebab popover container. */
export const popoverContainer: CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 2px)',
  right: 0,
  zIndex: 1100,
  background: 'var(--color-glass-bg)',
  border: '1px solid var(--color-glass-border)',
  borderRadius: 4,
  minWidth: 168,
  fontFamily: 'var(--font-sans)',
  overflow: 'hidden',
}

/**
 * Layer-list kebab popover — PORTALED, `position: fixed` variant (GisLayerRow,
 * GisImageryRow only).
 *
 * History: checkpoint fix (2026-07-12, live UAT item 7) first flipped this
 * popover to open to the RIGHT of the kebab button (anchored `left: 0`
 * instead of the base `popoverContainer`'s `right: 0`) via a `position:
 * absolute` variant nested inside the row.
 *
 * Checkpoint fix (2026-07-12, live UAT item 8 — follow-up): that `absolute`
 * variant was clipped by the Map Layers panel's `overflow-y: auto` scrollable
 * body the instant it crossed the panel's right edge (an `overflow-y: auto`
 * ancestor computes `overflow-x` to `auto` too, per spec) — a clipping bug,
 * not a z-index stacking bug; raising z-index alone could not fix it. Fixed
 * by portaling the popover to `document.body` and positioning it `fixed`
 * from a live `getBoundingClientRect()` anchor (see useKebabPopoverAnchor.ts)
 * so it escapes the scroll container entirely. Visual tokens match
 * `popoverContainer` (background/border/radius/overflow); only the
 * positioning strategy and minWidth differ. zIndex 4500 matches the other
 * floating/portaled popover tier (GisLayerSideNav) — above the map and
 * panel content, below Modal (5000) and the classification banner (9999).
 * Kept as a separate function rather than mutating `popoverContainer`
 * because that base style is also reused by `ui/ColorPicker` inside
 * `StyleEditor` (a different, non-clipped popover surface, out of scope for
 * this change and must not shift).
 *
 * Checkpoint fix (2026-07-12, live UAT item 9): minWidth halved from 168 to
 * 84 — operator feedback that the popover was "way too wide". minWidth is a
 * floor only; PopoverMenuButton's own padding/content (e.g. "Color theme",
 * "Zoom to layer") still sizes the popover wider than 84px as needed, so no
 * label ever clips or mid-word truncates.
 *
 * WR-05 (65.1 review): the anchor now carries exactly one of `top` (opens
 * downward) or `bottom` (flipped above a bottom-of-viewport trigger) — see
 * useKebabPopoverAnchor.ts. `undefined` sides are skipped by React's style
 * serialization, so only the anchored edge is pinned.
 */
export function layerListPopoverFixedStyle(anchor: { top?: number; bottom?: number; left: number }): CSSProperties {
  return {
    position: 'fixed',
    top: anchor.top,
    bottom: anchor.bottom,
    left: anchor.left,
    zIndex: 4500,
    background: 'var(--color-glass-bg)',
    border: '1px solid var(--color-glass-border)',
    borderRadius: 4,
    minWidth: 84,
    fontFamily: 'var(--font-sans)',
    overflow: 'hidden',
  }
}

/** Uppercase caption above a popover control (e.g. OPACITY). */
export const popoverLabel: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 9,
  color: 'var(--color-text-secondary)',
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  marginBottom: 4,
}

/** A clickable popover menu item (Edit, Remove …). */
export const popoverItem: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-sm)',
  width: '100%',
  padding: '6px var(--space-sm)',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
  fontSize: 11,
  fontWeight: 500,
  color: 'var(--color-text-primary)',
  textAlign: 'left',
  letterSpacing: '0.02em',
}

/** Thin divider between popover sections. */
export const popoverDivider: CSSProperties = {
  height: 1,
  background: 'var(--color-glass-border)',
}

/** Leading icon inside a popover item. */
export const popoverItemIcon: CSSProperties = {
  fontSize: 13,
  display: 'inline-flex',
  alignItems: 'center',
}

/**
 * Read-only Categorized/Graduated legend disclosure block (D-15, `GisLayerRow`, Phase 64
 * UI-SPEC §4). `padding: '3px 6px 3px 26px'` is the exact advisory-sub-line indent verbatim
 * inherited from this file's shipped ingesting/failed/repaired/outage blocks (a justified
 * pre-existing exception — see UI-SPEC Spacing Scale exceptions, NOT a new untokenized value).
 * `color-mix` derives a 50%-opacity glass background from the `--color-glass-bg` token (no
 * hardcoded rgba literal) so it stays token-driven if the base token is ever retuned.
 */
export const legendBlock: CSSProperties = {
  padding: '3px 6px 3px 26px',
  background: 'color-mix(in srgb, var(--color-glass-bg) 50%, transparent)',
  borderTop: '1px solid var(--color-glass-border)',
  maxHeight: 160,
  overflowY: 'auto',
}

/** Legend header summary line ("{N} classes · {M} features"). */
export const legendSummary: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 9,
  color: 'var(--color-text-secondary)',
}

/** A single legend row: swatch chip + value label + count badge. */
export const legendSwatchRow: CSSProperties = {
  height: 20,
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-xs)',
}

/** Read-only legend color chip (12x12, matches `RampPicker`/class-row swatch radius). */
export const legendSwatchChip: CSSProperties = {
  width: 12,
  height: 12,
  borderRadius: 'var(--radius-sm)',
  flexShrink: 0,
}

/** Divider set above the No-value/Other bucket rows, separating them from real classified values. */
export const legendBucketDivider: CSSProperties = {
  borderTop: '1px solid var(--color-glass-border)',
}
