/**
 * mermaidRender.ts — lazy mermaid loader + theme-derived render helper for `ui/MDText.tsx`
 * (Quick task 260828-fgu).
 *
 * Non-component module (kept separate from MDText.tsx so `react-refresh/only-export-components`
 * stays satisfied — a component file may only export components).
 *
 * D-4 (lazy import): mermaid is loaded via a dynamic `import('mermaid')`, never a static import.
 * It is a multi-megabyte dependency; a static import would put it in the main bundle for every
 * route. The dynamic import keeps it in its own lazily-fetched chunk that only loads when a
 * document actually contains a mermaid fence, and keeps mermaid out of jsdom during any test
 * that does not explicitly mock it.
 *
 * ZERO raw color literals in this file — the D-15 lint gate (`eslint.config.js`
 * `no-restricted-syntax`) is not allowlisted for this file and must not be. All theme colors
 * come from `chromeTheme.ts`'s `themeFor()` scalars.
 */
import { themeFor, type ThemeName } from '../styles/chromeTheme.js'

export type MermaidResult = { ok: true; svg: string } | { ok: false; message: string }

// Module-level incrementing counter for mermaid's internal render-id — deliberately NOT
// React's `useId()`, which emits `:r1:`, not a valid CSS/DOM id for mermaid's internal selectors.
let renderCounter = 0

/**
 * Renders `code` (mermaid diagram source) to an SVG string themed for `theme`. Never throws —
 * a parse/render failure is returned as `{ ok: false, message }` so the caller can show an
 * inline error affordance instead of losing the surrounding document. Emits NO console output —
 * the failure is surfaced in the UI, and a streaming chat transcript would otherwise spam the
 * console on every partially-typed fence.
 */
export async function renderMermaid(code: string, theme: ThemeName): Promise<MermaidResult> {
  try {
    const mermaid = (await import('mermaid')).default
    const t = themeFor(theme)

    // mermaid's config is a GLOBAL, module-singleton — there is no per-render config argument.
    // `initialize()` is therefore called on EVERY invocation, immediately before `render()`, so
    // a theme flip (dark <-> light) is picked up on the diagram's very next render. Do NOT
    // "optimize" this into a one-shot module-load init — that would freeze every diagram at
    // whatever theme happened to be active when the first one ever rendered.
    mermaid.initialize({
      startOnLoad: false,
      // T-FGU-01: 'strict' sanitizes label content and refuses click/script directives.
      securityLevel: 'strict',
      // T-FGU-02: stops mermaid appending its own error SVG directly to `document.body`,
      // bypassing React's tree and the error fallback entirely.
      suppressErrorRendering: true,
      // Pairs with securityLevel: 'strict' for T-FGU-01 — labels render as SVG <text>, not HTML.
      htmlLabels: false,
      fontFamily: 'var(--font-sans)',
      theme: 'base',
      themeVariables: {
        background: t.colorBgSecondary,
        mainBkg: t.colorBgSecondary,
        primaryColor: t.surfaceLayer2,
        primaryBorderColor: t.colorGlassBorder,
        lineColor: t.colorGlassBorder,
        primaryTextColor: t.colorTextPrimary,
        textColor: t.colorTextPrimary,
        secondaryColor: t.brandSubtle,
        tertiaryColor: t.colorBgPrimary,
      },
    })

    renderCounter += 1
    const id = `mermaid-diagram-${renderCounter}`
    const { svg } = await mermaid.render(id, code)
    return { ok: true, svg }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, message: message.slice(0, 300) }
  }
}
