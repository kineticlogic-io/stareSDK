/**
 * Shared CSS-in-JS constants for forms, panels, and map toolbar buttons.
 * Import from this module rather than defining locally.
 */
import type React from 'react'

/** Solid panel style — used by KnowledgeBasePage and similar page-level containers. */
export const glass: React.CSSProperties = {
  background: 'var(--color-glass-bg)',
  border: '1px solid var(--color-glass-border)',
  borderRadius: 8,
  fontFamily: 'var(--font-sans)',
  boxShadow: 'var(--shadow-standard)',
}

/** Base input style (narrow padding) — used by KnowledgeBasePage. */
export const inputStyle: React.CSSProperties = {
  background: 'var(--color-bg-secondary)',
  border: '1px solid var(--color-glass-border)',
  borderRadius: 4,
  padding: '6px 10px',
  fontFamily: 'var(--font-sans)',
  fontSize: 12,
  color: 'var(--color-text-primary)',
  outline: 'none',
}

/** Full-width input style (wider padding, 100% width) — used by HUD forms (the APEX command-dispatch UI was removed in Phase 102, D-02). */
export const inputStyleFull: React.CSSProperties = {
  width: '100%',
  background: 'var(--color-bg-secondary)',
  border: '1px solid var(--color-glass-border)',
  borderRadius: 4,
  padding: '8px 12px',
  fontFamily: 'var(--font-sans)',
  fontSize: 12,
  color: 'var(--color-text-primary)',
  outline: 'none',
  boxSizing: 'border-box',
}

/** Shared mono textarea style (pasted-data paste boxes, e.g. GeoJSON entry, Phase 80 Plan 09). */
export const TEXTAREA_STYLE: React.CSSProperties = {
  width: '100%',
  minHeight: 90,
  background: 'var(--color-bg-secondary)',
  border: '1px solid var(--color-glass-border)',
  borderRadius: 4,
  padding: 'var(--space-md)',
  fontFamily: 'var(--font-mono)',
  fontSize: 13,
  lineHeight: 1.5,
  color: 'var(--color-text-primary)',
  outline: 'none',
  resize: 'vertical',
  boxSizing: 'border-box',
}

/** Page-level action button style (object constant) — used by KnowledgeBasePage. */
export const btnStyle: React.CSSProperties = {
  background: 'var(--color-accent)',
  border: '1px solid var(--color-accent)',
  borderRadius: 6,
  padding: '6px 14px',
  fontFamily: 'var(--font-sans)',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text-inverse)',
  cursor: 'pointer',
  letterSpacing: '0.06em',
  textTransform: 'uppercase' as const,
}

/** Map toolbar icon button style (function form) — used by SketchToolbar, MeasurementToolbar. */
export function btnStyleFn(active = false): React.CSSProperties {
  return {
    width: 32,
    height: 32,
    background: active ? 'var(--brand-subtle)' : 'var(--color-glass-bg)',
    border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-glass-border)'}`,
    borderRadius: 4,
    color: 'var(--color-text-primary)',
    fontFamily: 'var(--font-sans)',
    fontSize: 14,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'auto',
    transition: 'border-color 0.15s',
    flexShrink: 0,
  }
}
