import { useId, useState } from 'react'
import type { ReactNode, CSSProperties } from 'react'
import { TbChevronRight } from 'react-icons/tb'

/**
 * Shared inline expander — closed by default, labeled with a key, arbitrary children.
 *
 * D-GAP3-1 (operator, 2026-09-27, LOCKED): asked per the shared-UI-first HARD RULE
 * (`feedback-reuse-ui-components.md`) whether an existing `components/ui/*` primitive fit GAP-3's
 * array-attribute expander (134.1-UAT.md). `ui/Tree` is a title-only checkbox/selection tree and
 * `hud/CollapsiblePanel` is panel-scale chrome outside `ui/` — neither fits an inline, no-selection,
 * arbitrary-children disclosure. The operator explicitly authorized ONE new shared primitive here;
 * this is it. A future stareSDK port target, same arrangement as `ui/DataTable` (D-GAP2-2).
 *
 * Uncontrolled `open` state (default closed) — the only consumer (`FeatureAttributePopup`'s
 * array-valued attribute rows) needs no controlled mode. The header is a native
 * `<button type="button">` so Enter/Space activation is free (native button semantics, no keydown
 * handler needed). The chevron rotates via `transform` only — compositor-safe animation (CLAUDE.md
 * hard rule) — closed at `rotate(0deg)`, open at `rotate(90deg)`, with a `transform`-only
 * transition. Tokens only (the eslint color-literal gate): `--color-text-secondary` (matches the
 * popup's existing row-label color), `--color-accent` (focus ring, `.ui-disclosure__toggle:focus-visible`
 * in global.css next to `.ui-toggle`'s own rule — an inline style can't express `:focus-visible`).
 */

export interface DisclosureProps {
  /** Rendered next to the chevron — the array field's key (or any other label). */
  label: ReactNode
  /** Renders open initially. Defaults to closed (`false`). */
  defaultOpen?: boolean
  /** Rendered inside the content region, ONLY while open. Callers indent their own content. */
  children: ReactNode
  style?: CSSProperties
}

export function Disclosure({ label, defaultOpen = false, children, style }: DisclosureProps) {
  const [open, setOpen] = useState(defaultOpen)
  const contentId = useId()

  return (
    <div style={style}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        className="ui-disclosure__toggle"
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          cursor: 'pointer',
          width: '100%',
          color: 'var(--color-text-secondary)',
        }}
      >
        <span
          aria-hidden
          style={{
            display: 'inline-flex',
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 120ms ease',
          }}
        >
          <TbChevronRight size={12} />
        </span>
        <span>{label}</span>
      </button>
      {open && <div id={contentId}>{children}</div>}
    </div>
  )
}
