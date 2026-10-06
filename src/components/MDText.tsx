/**
 * MDText — the single markdown-render surface for CODEX (wiki) and the AI Assistant
 * (Quick task 260828-fgu).
 *
 * WHY: before this file, `wiki/ArticleBody.tsx`, `wiki/ArticleEditor.tsx`,
 * `analysis/ChatMessage.tsx`, and `analysis/ToolResultView.tsx` each hand-instantiated
 * `ReactMarkdown` with their own plugin list and their own table override — four places to
 * keep the XSS policy, the gfm plugin, and now the mermaid renderer in sync. One component,
 * one policy.
 *
 * SECURITY (T-78-30 / T-FGU-01): this component NEVER accepts or applies a `rehypePlugins`
 * prop and NEVER imports `rehype-raw`. Markdown renders through react-markdown's default safe
 * AST pipeline only — raw HTML embedded in source markdown is never interpreted. Do not add a
 * `rehypePlugins` prop "for convenience" — that reopens the stored-XSS hole this component
 * exists to close across all four call sites at once.
 *
 * D-1 — `variant` is a closed union (`'wiki' | 'chat' | 'tool'`), not a free-form `className`.
 * The three prose skins are genuinely different (15px serif-ish wiki prose vs 12px chat vs 12px
 * mono tool output) and were tuned by prior UAT rounds; collapsing them into one look would be
 * a visual regression, not a simplification.
 *
 * D-2 — MDText moves ZERO style rules. It calls `ensureWikiMdStyle()` (imported from
 * `../internal/wikiMdStyle`, which is NOT moved or deleted — `ArticleGallery.tsx` and
 * `ArticleSources.tsx` still import it directly) for the `.wiki-md` class it emits.
 * `ChatMessage.tsx`'s `.chat-md` rules and `ToolResultView.tsx`'s `.tool-result-md` rules stay
 * exactly where they are, because those style blobs also carry non-markdown rules
 * (`.chat-thinking-dot` + its `@keyframes`, `@keyframes spin`). Splitting three style blobs
 * apart was assessed as pure regression risk for zero functional gain. Consequence, stated
 * plainly: MDText emits `className="chat-md"` / `className="tool-result-md"` while the CSS
 * rules for those classes live in the CONSUMER file, not here — this coupling is deliberate.
 *
 * D-4 — mermaid is loaded lazily; see `mermaidRender.ts`'s header comment for the full
 * rationale (bundle size + jsdom test isolation).
 *
 * D-5 — mermaid dispatch happens on the `pre` override, not the `code` override. Overriding
 * `code` would leave the diagram wrapped in the active skin's `<pre>` (background, border,
 * `overflow-x`), which looks broken. `mermaidPre` inspects its single React child element for a
 * `className` matching `language-mermaid` and swaps the whole block for `<MermaidBlock>`.
 *
 * D-6 — caller `components` are merged UNDER MDText's `pre` override:
 * `{ ...defaults, ...props.components, pre: mermaidPre }` — a caller can never accidentally
 * disable mermaid dispatch by supplying its own `pre` override. No current caller does.
 *
 * D-7 (post-UAT follow-up) — `MermaidBlock` debounces its render trigger and confirms failures
 * before surfacing them, to fix an error-flash bug found in live UAT: while an AI Assistant
 * message streams token-by-token, `code` mutates on nearly every token, so calling
 * `renderMermaid` synchronously on every change ran mermaid's parser against truncated/invalid
 * syntax dozens of times per second, each failure/success immediately swapping the error UI in
 * and out. Fix: (1) a `MERMAID_DEBOUNCE_MS` quiet period before attempting a render at all, and
 * (2) on a FAILED attempt, a longer `MERMAID_ERROR_CONFIRM_MS` window before the error banner is
 * shown — cancelled if `code`/`theme` changes again first (a mid-stream truncated snapshot, not
 * a genuinely broken diagram). A SUCCESSFUL attempt always displays immediately, no debounce,
 * since there is nothing wrong to potentially avoid flashing.
 */
import { isValidElement, useEffect, useRef, useState, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'
import type { PluggableList } from 'unified'

// Re-exported so every `components` override a caller builds (table wrappers, heading
// anchors, link overrides, footnote-section suppression) can type against MDText's own prop
// shape without importing `react-markdown` directly — keeps `ui/MDText.tsx` (and
// `notebook/MarkdownCell.tsx`, the one deliberately unmigrated call site, D-3) as the only two
// files in `src` importing from `'react-markdown'`.
export type { Components } from 'react-markdown'
import { TbAlertTriangle, TbLoader2 } from 'react-icons/tb'
import { useTheme } from '../theme/useTheme.js'
import { renderMermaid, type MermaidResult } from './mermaidRender.js'
import { ensureWikiMdStyle } from '../internal/wikiMdStyle.js'

// Injects the shared `.wiki-md` scoped style tag once, idempotently (D-2). Safe to call even
// when MDText is only ever used at `chat`/`tool` variants in a given bundle — the rule set only
// ever matches elements carrying the `.wiki-md` class.
ensureWikiMdStyle()

export type MDTextVariant = 'wiki' | 'chat' | 'tool'

const VARIANT_CLASS: Record<MDTextVariant, string> = {
  wiki: 'wiki-md',
  chat: 'chat-md',
  tool: 'tool-result-md',
}

// Table wrapper margin-bottom per variant — matches each surface's pre-existing override
// byte-for-byte so no call site shifts by so much as 2px (wiki 0.6em, chat/tool 0.4em).
const TABLE_MARGIN: Record<MDTextVariant, string> = {
  wiki: '0.6em',
  chat: '0.4em',
  tool: '0.4em',
}

const MERMAID_LANG_RE = /(^|\s)language-mermaid(\s|$)/

function extractText(node: ReactNode): string {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractText).join('')
  return ''
}

/** D-5: inspects the single React child of `<pre>`; if it is a `<code className="language-
 *  mermaid">` element, dispatches to `<MermaidBlock>` instead of the default `<pre><code>`. */
function mermaidPre({ children }: { children?: ReactNode }) {
  const child = Array.isArray(children) ? children[0] : children
  if (isValidElement<{ className?: string; children?: ReactNode }>(child)) {
    const className = child.props.className
    if (className && MERMAID_LANG_RE.test(className)) {
      return <MermaidBlock code={extractText(child.props.children)} />
    }
  }
  return <pre>{children}</pre>
}

// D-7: quiet period before attempting a render at all (debounces streaming's per-token churn).
const MERMAID_DEBOUNCE_MS = 400
// D-7: how long a FAILED attempt must remain uncontradicted by a newer code/theme change before
// its error banner is actually shown — a mid-stream truncated fence resolves within this window.
const MERMAID_ERROR_CONFIRM_MS = 600

function MermaidBlock({ code }: { code: string }) {
  const { theme } = useTheme()
  const [result, setResult] = useState<MermaidResult | null>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false

    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null
      renderMermaid(code, theme).then(r => {
        if (cancelled) return

        if (r.ok) {
          // Success displays immediately — no debounce needed — and supersedes any
          // still-pending "confirm this failure" timer left over from an earlier attempt
          // against older code (e.g. an editor user fixing an already-broken diagram).
          if (confirmTimerRef.current !== null) {
            clearTimeout(confirmTimerRef.current)
            confirmTimerRef.current = null
          }
          setResult(r)
          return
        }

        // A failure is NOT surfaced immediately — it may be a mid-stream truncated snapshot.
        // Start the longer confirm window; this cleanup function clears it (below) the moment
        // `code`/`theme` changes again, so it only ever fires if the code was STILL this same
        // (broken) value for the full window — i.e. it is genuinely, not just momentarily, bad.
        confirmTimerRef.current = setTimeout(() => {
          confirmTimerRef.current = null
          if (!cancelled) setResult(r)
        }, MERMAID_ERROR_CONFIRM_MS)
      })
    }, MERMAID_DEBOUNCE_MS)

    // Runs before the NEXT effect invocation on every code/theme change, and on unmount.
    // Clearing both timers here — not just setting `cancelled` — is what makes a newer
    // code/theme change cancel a still-pending confirm timer from a stale failed attempt, and
    // guards against a late resolve after unmount or a theme flip racing a still-pending render
    // for the PREVIOUS theme — the stale result must never overwrite a fresher one.
    return () => {
      cancelled = true
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
      if (confirmTimerRef.current !== null) {
        clearTimeout(confirmTimerRef.current)
        confirmTimerRef.current = null
      }
    }
  }, [code, theme])

  if (result === null) {
    // D-16 (corrects the prior "diagrams resolve in ms, no spinner needed" assumption):
    // `renderMermaid` is debounced (`MERMAID_DEBOUNCE_MS`) and mermaid's own parse/layout is not
    // instantaneous for large diagrams, so the pending window is user-visible and gets an honest
    // indicator rather than a silent 1px placeholder.
    return (
      <div
        role="status"
        aria-label="Rendering diagram"
        style={{
          minHeight: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-text-secondary)',
          margin: '0.6em 0',
        }}
      >
        <TbLoader2 size={14} className="mermaid-pending-spinner" />
      </div>
    )
  }

  if (result.ok) {
    return (
      <div
        role="img"
        aria-label="Mermaid diagram"
        // `.mermaid-diagram` (global.css) centers the injected svg via `margin-inline: auto`
        // without breaking horizontal-scroll access to diagrams wider than the wrapper
        // (fix 123-11) — same mechanism as `DiagramToolResult.tsx`.
        className="mermaid-diagram"
        // Safe: mermaidRender.ts's `securityLevel: 'strict'` + `htmlLabels: false` sanitize
        // mermaid's own SVG output (label content, click/script directives) before it ever
        // reaches this line — this dangerouslySetInnerHTML is the only way to mount that SVG.
        dangerouslySetInnerHTML={{ __html: result.svg }}
      />
    )
  }

  // A malformed diagram never blanks the surrounding document — this renders in place of just
  // the one fence, and the operator's original source is preserved directly below the warning.
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '8px 10px',
        border: '1px solid var(--color-glass-border)',
        borderRadius: 4,
        margin: '0.6em 0',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          color: 'var(--color-destructive)',
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        <TbAlertTriangle />
        <span>Diagram failed to render: {result.message}</span>
      </div>
      <pre style={{ margin: 0, color: 'var(--color-text-secondary)' }}>{code}</pre>
    </div>
  )
}

function buildDefaultComponents(variant: MDTextVariant): Components {
  return {
    table: ({ children }) => (
      <div style={{ overflowX: 'auto', marginBottom: TABLE_MARGIN[variant] }}>
        <table>{children}</table>
      </div>
    ),
    pre: mermaidPre,
  }
}

export interface MDTextProps {
  markdown: string
  /** Defaults to `'wiki'`. */
  variant?: MDTextVariant
  /** Applied IN ADDITION to `remarkGfm`, which is always first and non-negotiable. */
  remarkPlugins?: PluggableList
  /** Merged UNDER MDText's own defaults per D-6 — a caller can override `table` but never
   *  disable the mermaid `pre` dispatcher. */
  components?: Components
}

export function MDText({ markdown, variant = 'wiki', remarkPlugins, components }: MDTextProps) {
  const merged: Components = {
    ...buildDefaultComponents(variant),
    ...components,
    pre: mermaidPre,
  }

  return (
    <div className={VARIANT_CLASS[variant]}>
      <ReactMarkdown remarkPlugins={[remarkGfm, ...(remarkPlugins ?? [])]} components={merged}>
        {markdown}
      </ReactMarkdown>
    </div>
  )
}
