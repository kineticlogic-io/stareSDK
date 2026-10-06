import type { CSSProperties, ReactNode } from 'react'

/**
 * Facets — one shared toggle-button facet group (extracted 97-03 addendum, operator directive
 * 2026-08-22, reversing that plan's original "phase-local, extract later" call).
 *
 * Presentational only: `selected` is caller-owned state, `onToggle`/`onClear` are the only
 * mutation paths out. Renders exactly ONE facet group — a rail of several (Type / Sharing /
 * Owner / Tags, or a single Tags group) is the caller's own stacking layout, same as it was
 * before extraction.
 *
 * Shape is unified from the two real call sites that carried this pattern independently:
 *   - LedgerPage.tsx's phase-local `FacetGroup` (Type/Sharing/Owner/Tags, 4x, sans-serif header)
 *   - CatalogModal.tsx's inline tag-facet rail (1x, mono header with a leading `TbTag` icon) —
 *     the ORIGINAL pattern `FacetGroup` was itself generalized from.
 * `icon` (optional, group-level) exists because of the second call site; `size` exists because
 * the two call sites render at genuinely different weights (a full-page sidebar rail vs. a
 * modal's narrower one) — `sm` reproduces CatalogModal's tighter mono header verbatim, `md`
 * reproduces LedgerPage's sans header verbatim, `lg` extends the same scale upward for any
 * future denser or full-height rail.
 */

export type FacetsSize = 'sm' | 'md' | 'lg'

export interface FacetOption {
  value: string
  label: string
  count: number
  /** Optional leading glyph per option (e.g. a sharing-tier icon or an Avatar for an owner). */
  icon?: ReactNode
}

export interface FacetsProps {
  label: string
  /** Optional leading glyph next to the group label (CatalogModal's `TbTag`). */
  icon?: ReactNode
  options: FacetOption[]
  selected: string[]
  onToggle: (value: string) => void
  onClear: () => void
  size?: FacetsSize
  /** Copy shown when `options` is empty. Defaults to 'None'. */
  emptyCopy?: string
  style?: CSSProperties
}

interface SizeStyle {
  headerFont: string
  headerFontSize: number
  headerWeight: number
  headerLetterSpacing: string
  optionFontSize: number
  optionPadding: string
  countFontSize: number
  gap: number
}

const SIZE_STYLES: Record<FacetsSize, SizeStyle> = {
  // Reproduces CatalogModal.tsx's tag rail exactly: mono, bold, 10px header.
  sm: {
    headerFont: 'var(--font-mono)', headerFontSize: 10, headerWeight: 700, headerLetterSpacing: '0.08em',
    optionFontSize: 12, optionPadding: '5px 8px', countFontSize: 10, gap: 6,
  },
  // Reproduces LedgerPage.tsx's FacetGroup exactly: sans, semibold, 11px header.
  md: {
    headerFont: 'var(--font-sans)', headerFontSize: 11, headerWeight: 600, headerLetterSpacing: '0.08em',
    optionFontSize: 12, optionPadding: '5px 8px', countFontSize: 10, gap: 6,
  },
  lg: {
    headerFont: 'var(--font-sans)', headerFontSize: 12, headerWeight: 600, headerLetterSpacing: '0.06em',
    optionFontSize: 13, optionPadding: '7px 10px', countFontSize: 11, gap: 8,
  },
}

export function Facets({
  label,
  icon,
  options,
  selected,
  onToggle,
  onClear,
  size = 'md',
  emptyCopy = 'None',
  style,
}: FacetsProps) {
  const s = SIZE_STYLES[size]

  return (
    <div role="group" aria-label={label} style={{ marginBottom: 'var(--space-md)', ...style }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 'var(--space-sm)',
          fontFamily: s.headerFont, fontSize: s.headerFontSize, fontWeight: s.headerWeight,
          letterSpacing: s.headerLetterSpacing, textTransform: 'uppercase', color: 'var(--color-text-secondary)',
        }}
      >
        {icon != null && (
          <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>{icon}</span>
        )}
        <span style={{ flex: 1 }}>{label}</span>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            aria-label={`Clear ${label} filters`}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--color-accent)', fontFamily: 'var(--font-mono)', fontSize: 9,
              textTransform: 'uppercase', letterSpacing: '0.06em', padding: 0,
            }}
          >
            Clear
          </button>
        )}
      </div>

      {options.length === 0 && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-secondary)' }}>
          {emptyCopy}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {options.map(opt => {
          const active = selected.includes(opt.value)
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onToggle(opt.value)}
              aria-pressed={active}
              style={{
                display: 'flex', alignItems: 'center', gap: s.gap, width: '100%',
                padding: s.optionPadding, borderRadius: 4, cursor: 'pointer', textAlign: 'left',
                background: active ? 'var(--brand-subtle)' : 'transparent',
                border: `1px solid ${active ? 'var(--color-accent)' : 'transparent'}`,
                color: active ? 'var(--color-accent)' : 'var(--color-text-primary)',
                fontFamily: 'var(--font-sans)', fontSize: s.optionFontSize,
                transition: 'background 0.12s, border-color 0.12s',
              }}
            >
              {opt.icon != null && (
                <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>{opt.icon}</span>
              )}
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {opt.label}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: s.countFontSize, color: 'var(--color-text-secondary)' }}>
                {opt.count}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
