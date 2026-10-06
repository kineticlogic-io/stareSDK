/**
 * Tooltip — deck.gl-display-path hover tooltip (Phase 118, D-13/P-L).
 *
 * Portal-to-`document.body` follows the `ui/DraggablePopup.tsx` precedent for escaping the
 * Leaflet DOM subtree, so this element can never be clipped/offset by a Leaflet pane transform.
 * Unlike `DraggablePopup` (interactive, pointer events enabled), this component deviates in
 * exactly one load-bearing way: pointer events are disabled on the rendered node (see the style
 * object below).
 *
 * Load-bearing invariants — do not "clean these up":
 *   - Pointer events disabled is what keeps the tooltip from intercepting the very `mousemove`
 *     that drives it (a feedback loop) or blocking a click on the feature beneath it.
 *   - The portal to `document.body` is what keeps it out of the Leaflet container's DOM subtree
 *     (the `DraggablePopup` precedent).
 *   - The default `zIndex` (4200) sits above a `DraggablePopup`-based feature popup (4000) and
 *     below `ui/Modal` (5000).
 *   - Content is the RAW value with no `"Field: value"` prefix, matching the Leaflet
 *     permanent-label precedent.
 *   - It animates nothing (mount/unmount only) — compositor-safe by construction.
 *
 * Serves the deck.gl display path ONLY (P-L). The Leaflet edit path uses Leaflet's own
 * non-permanent `bindTooltip` — it already has a per-feature DOM element to bind to and needs no
 * React portal. Do not wire this component into the edit path.
 */
import type { CSSProperties } from 'react'
import { createPortal } from 'react-dom'

export interface TooltipProps {
  /** Viewport x coordinate the tooltip is anchored to (e.g. a pointer event's clientX). */
  x: number
  /** Viewport y coordinate the tooltip is anchored to (e.g. a pointer event's clientY). */
  y: number
  /** Raw text content — rendered verbatim as a plain React text child (React escapes it; this
   *  component never uses an unsafe raw-HTML rendering path). */
  content: string
  /** Stacking order. Default 4200 — above a DraggablePopup (4000), below ui/Modal (5000). */
  zIndex?: number
}

export function Tooltip({ x, y, content, zIndex = 4200 }: TooltipProps) {
  if (!content) return null

  const style: CSSProperties = {
    position: 'fixed',
    left: x + 16,
    top: y - 16,
    zIndex,
    pointerEvents: 'none',
    background: 'var(--color-glass-bg)',
    border: '1px solid var(--color-glass-border)',
    borderRadius: 'var(--radius-sm)',
    padding: '4px 8px',
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    lineHeight: 1.3,
    color: 'var(--color-text-primary)',
    boxShadow: 'var(--shadow-standard)',
    maxWidth: 240,
    wordBreak: 'break-word',
  }

  return createPortal(
    <div role="tooltip" style={style}>
      {content}
    </div>,
    document.body,
  )
}
