/**
 * Shared `.wiki-md` scoped prose style — sibling to `ChatMessage.tsx`'s `.chat-md`, same
 * inject-once pattern. Extracted into its own (non-component) module rather than living inside
 * `ReadingPane.tsx` so both `ReadingPane` (reading view) and `ArticleEditor` (live preview pane,
 * D-08) can import `ensureWikiMdStyle()` without violating `react-refresh/only-export-components`
 * (a component file may only export components).
 *
 * Headings render at a discernible visual step above body text (Phase 79 operator revision:
 * the earlier flat 15px/600 headings "blended into the text"): H1 24px, H2 20px, H3 16px, all
 * 700-weight. H2/H3 use the grey `--color-text-secondary` (a few shades off the near-white body
 * `--color-text-primary`) — size + weight + grey give the hierarchy without an accent color
 * (operator: no green headers). Body prose stays 15px/`--color-text-primary`.
 *
 * List items (including the `## Sources` citation list) render at 13px — the Body/Label step of
 * the 4-size scale — deliberately smaller than running prose (UAT round-3: "fine print" for
 * citations; there's no markdown-level way to scope this to Sources alone, so it applies to all
 * `.wiki-md li` uniformly, per 78-UAT round-3 guidance). Link color/underline is NOT set here —
 * it comes from the canonical `.wiki-md a` rule in `global.css` (single permanent reference).
 */
import { DARK_THEME, LIGHT_THEME } from '../styles/chromeTheme.js'
import { hexToRgb } from './color.js'

/** Format a themed hex color plus a CSS alpha fraction (0-1) as an `rgba()` string
 *  (D-14 pattern, see notebook/CellOutput.tsx's severityRgba). Computed rather than
 *  hand-transcribed so no raw accent-green literal is duplicated in this module. */
function accentRgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// The `.wiki-md code` chip border — --color-accent at 0.25 alpha, no matching CSS custom
// property exists for this alpha-composited role, so both themes' values are computed here
// from chromeTheme.ts's already-authored scalars (dark is byte-identical to the pre-Phase-89
// literal: rgb(15,175,115) at 0.25 alpha).
const CODE_CHIP_BORDER_DARK = accentRgba(DARK_THEME.colorAccent, 0.25)
const CODE_CHIP_BORDER_LIGHT = accentRgba(LIGHT_THEME.colorAccent, 0.25)

const WIKI_STYLE = `
.wiki-md { font-family: var(--font-sans); font-size: 15px; line-height: 1.6; color: var(--color-text-primary); }
.wiki-md p { margin: 0 0 0.75em; }
.wiki-md p:last-child { margin-bottom: 0; }
.wiki-md ul, .wiki-md ol { margin: 0.25em 0 0.75em 1.4em; padding: 0; }
.wiki-md li { margin: 0.15em 0; font-size: 13px; }
.wiki-md h1 {
  font-size: 24px; font-weight: 700; color: var(--color-text-primary);
  margin: 0 0 0.5em; letter-spacing: -0.01em;
}
.wiki-md h1:first-child { margin-top: 0; }
.wiki-md h2 {
  font-size: 20px; font-weight: 700; color: var(--color-text-secondary);
  border-bottom: 1px solid var(--color-glass-border);
  margin: 1.4em 0 0.5em; padding-bottom: 0.25em; letter-spacing: -0.01em;
}
.wiki-md h2:first-child { margin-top: 0; }
.wiki-md h3 { font-size: 16px; font-weight: 700; color: var(--color-text-secondary); margin: 1.1em 0 0.4em; }
.wiki-md code {
  font-family: var(--font-mono); font-size: 13px;
  /* --brand-subtle's dark declaration is byte-identical to the previous hand-written
     0.12-alpha accent-green literal (D-11); the border alpha is computed above
     (CODE_CHIP_BORDER_DARK/_LIGHT). */
  background: var(--brand-subtle); border: 1px solid ${CODE_CHIP_BORDER_DARK};
  border-radius: 3px; padding: 1px 4px;
}
.wiki-md pre {
  font-family: var(--font-mono); font-size: 13px;
  background: var(--surface-layer-2); border: 1px solid var(--color-glass-border);
  border-radius: 4px; padding: 10px 12px; overflow-x: auto; margin: 0.6em 0;
}
.wiki-md pre code { background: none; border: none; padding: 0; }
.wiki-md table { border-collapse: collapse; width: 100%; margin: 0.6em 0; font-size: 13px; }
.wiki-md th, .wiki-md td { border: 1px solid var(--color-glass-border); padding: 3px 8px; text-align: left; }
.wiki-md th { background: none; color: var(--color-text-secondary); font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; }
.wiki-md hr { border: none; border-top: 1px solid var(--color-glass-border); margin: 0.75em 0; }
.wiki-md blockquote {
  border-left: 2px solid var(--color-accent); margin: 0.4em 0; padding-left: 10px;
  color: var(--color-text-secondary);
}
[data-theme="light"] .wiki-md code { border-color: ${CODE_CHIP_BORDER_LIGHT}; }
`

let styleInjected = false

/** Injects the `.wiki-md` scoped style tag once, idempotently. Safe to call from any component. */
export function ensureWikiMdStyle() {
  // No DOM (a Node test environment, a worker): nothing to inject into. Browsers always load this
  // module with a document present.
  if (styleInjected || typeof document === 'undefined') return
  const el = document.createElement('style')
  el.textContent = WIKI_STYLE
  document.head.appendChild(el)
  styleInjected = true
}
