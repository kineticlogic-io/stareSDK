import type { CSSProperties } from 'react'
import { useEffect, useRef } from 'react'
import { autocompletion, completionKeymap, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { html } from '@codemirror/lang-html'
import { json, jsonParseLinter } from '@codemirror/lang-json'
import { HighlightStyle, bracketMatching, foldGutter, indentOnInput, syntaxHighlighting } from '@codemirror/language'
import { type Diagnostic, forceLinting, linter, lintGutter } from '@codemirror/lint'
import { Compartment, EditorState, type Extension } from '@codemirror/state'
import { EditorView, highlightActiveLine, keymap, lineNumbers, placeholder as placeholderExt } from '@codemirror/view'
import { tags } from '@lezer/highlight'

/**
 * CodeEditor — compact code/JSON editor (stareSDK, operator-approved 2026-09-25), built on
 * CodeMirror 6. Import it from the `staresdk/code-editor` subpath: CodeMirror is an optional
 * peer dependency, so apps that never edit code do not pay for it and the main barrel stays
 * dependency-light.
 *
 * Styling is entirely design tokens (CLAUDE.md "Look"): CodeMirror emits real CSS, so `var()`
 * works in its theme and the editor follows light/dark mode with no JS theme switch. Text is
 * `--font-mono` at 12px, gutters are muted and narrow, and the default height clamps between
 * `minHeight` and `maxHeight` (then scrolls) so an editor never balloons a panel.
 *
 * `language="json"` adds JSON highlighting and a parse linter (inline marker + gutter).
 * `language="html"` (0.2.10) adds HTML highlighting (no auto-closing of tags, so typed templates
 * stay exactly as written).
 * `completions` (0.2.10) offers caller-supplied completions as the user types (e.g. field tokens
 * after `{`): the function gets the text and cursor offset and returns where the replaced span
 * starts and the options, or `null` for none. Uses `@codemirror/autocomplete` (optional peer).
 * `diagnostics` adds caller-supplied markers (e.g. server-side validation errors), addressed by
 * 1-based line or by character offsets.
 *
 * Controlled: `value` is the source of truth. External changes replace the document; typing
 * calls `onChange` and never resets the cursor.
 */

export interface CodeEditorDiagnostic {
  /** 1-based line to mark (whole line), or use `from`/`to`. */
  line?: number
  from?: number
  to?: number
  message: string
  severity?: 'error' | 'warning' | 'info'
}

export interface CodeEditorProps {
  value: string
  onChange?: (value: string) => void
  language?: 'json' | 'text' | 'html'
  readOnly?: boolean
  diagnostics?: CodeEditorDiagnostic[]
  minHeight?: number
  maxHeight?: number
  placeholder?: string
  /** Completions as the user types; see the component doc. */
  completions?: CodeEditorCompletionSource
  'aria-label': string
  style?: CSSProperties
}

export interface CodeEditorCompletionOption {
  /** Shown in the list and, without `apply`, inserted. */
  label: string
  /** Quiet text beside the label (e.g. a field type). */
  detail?: string
  /** Text inserted instead of `label`. */
  apply?: string
}

export type CodeEditorCompletionSource = (context: { text: string; pos: number }) =>
  | { from: number; options: CodeEditorCompletionOption[] }
  | null

/** Adapt a caller completion source to CodeMirror's. Exported for tests. */
export function toCompletionResult(
  source: CodeEditorCompletionSource | undefined,
  text: string,
  pos: number,
): CompletionResult | null {
  const result = source?.({ text, pos })
  if (!result || result.options.length === 0) return null
  return {
    from: Math.max(0, Math.min(result.from, pos)),
    options: result.options.map((o) => ({ label: o.label, detail: o.detail, apply: o.apply ?? o.label })),
    validFor: /^[^\s{}|]*$/,
  }
}

const theme = EditorView.theme({
  '&': {
    fontSize: '12px',
    color: 'var(--color-text-primary)',
    backgroundColor: 'var(--color-bg-primary)',
    border: '1px solid var(--color-glass-border)',
    borderRadius: 'var(--radius-md)',
  },
  '&.cm-focused': { outline: 'none', borderColor: 'var(--color-accent)' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '18px' },
  '.cm-content': { padding: '4px 0', caretColor: 'var(--color-text-primary)' },
  '.cm-line': { padding: '0 8px' },
  '.cm-gutters': {
    backgroundColor: 'var(--color-bg-secondary)',
    color: 'var(--text-muted)',
    border: 'none',
    borderRight: '1px solid var(--color-glass-border)',
  },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 6px 0 8px', minWidth: '24px' },
  '.cm-activeLine': { backgroundColor: 'var(--color-glass-bg)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--color-glass-bg)', color: 'var(--color-text-secondary)' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--brand-subtle) !important',
  },
  '.cm-cursor': { borderLeftColor: 'var(--color-text-primary)' },
  '.cm-matchingBracket': { backgroundColor: 'var(--surface-layer-2)', outline: '1px solid var(--border-strong)' },
  '.cm-placeholder': { color: 'var(--text-muted)' },
  '.cm-tooltip': {
    backgroundColor: 'var(--surface-layer-2)',
    color: 'var(--color-text-primary)',
    border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '12px',
  },
  '.cm-diagnostic-error': { borderLeftColor: 'var(--color-destructive)' },
  '.cm-diagnostic-warning': { borderLeftColor: 'var(--status-warning)' },
  '.cm-diagnostic-info': { borderLeftColor: 'var(--status-info)' },
  '.cm-lintRange-error': { backgroundImage: 'none', textDecoration: 'underline wavy var(--color-destructive)' },
  '.cm-lintRange-warning': { backgroundImage: 'none', textDecoration: 'underline wavy var(--status-warning)' },
  '.cm-foldGutter .cm-gutterElement': { padding: '0 4px', cursor: 'pointer' },
  '.cm-tooltip-autocomplete ul li[aria-selected]': {
    backgroundColor: 'var(--color-glass-bg)',
    color: 'var(--color-text-primary)',
  },
  '.cm-completionDetail': { color: 'var(--text-muted)', fontStyle: 'normal', marginLeft: '8px' },
})

/**
 * Token colours: keys cyan, literals purple, strings in plain primary text. Green text is
 * deliberately avoided (operator direction 2026-09-25: green text reads as abrasive), so no
 * token uses the lime/accent hues.
 */
const highlight = HighlightStyle.define([
  { tag: tags.propertyName, color: 'var(--intel-cyan)' },
  { tag: tags.string, color: 'var(--color-text-primary)' },
  { tag: [tags.number, tags.bool, tags.null], color: 'var(--intel-purple)' },
  { tag: [tags.punctuation, tags.separator, tags.bracket], color: 'var(--color-text-secondary)' },
  { tag: tags.invalid, color: 'var(--color-destructive)' },
  // HTML (0.2.10): tag names cyan, attribute names purple, attribute values plain.
  { tag: tags.tagName, color: 'var(--intel-cyan)' },
  { tag: tags.attributeName, color: 'var(--intel-purple)' },
  { tag: tags.attributeValue, color: 'var(--color-text-primary)' },
  { tag: [tags.angleBracket, tags.comment], color: 'var(--color-text-secondary)' },
])

/** Convert caller diagnostics to CodeMirror's offsets. Exported for tests. */
export function toDiagnostics(state: EditorState, items: CodeEditorDiagnostic[]): Diagnostic[] {
  return items.flatMap((d) => {
    let from = d.from
    let to = d.to
    if (d.line !== undefined) {
      if (d.line < 1 || d.line > state.doc.lines) return []
      const line = state.doc.line(d.line)
      from = line.from
      to = line.to
    }
    if (from === undefined) return []
    const max = state.doc.length
    const f = Math.max(0, Math.min(from, max))
    return [{ from: f, to: Math.max(f, Math.min(to ?? f, max)), message: d.message, severity: d.severity ?? 'error' }]
  })
}

export function CodeEditor({
  value,
  onChange,
  language = 'json',
  readOnly = false,
  diagnostics,
  minHeight = 80,
  maxHeight = 320,
  placeholder,
  completions,
  'aria-label': ariaLabel,
  style,
}: CodeEditorProps) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const readOnlyConf = useRef(new Compartment())
  const diagnosticsRef = useRef(diagnostics)
  diagnosticsRef.current = diagnostics
  const completionsRef = useRef(completions)
  completionsRef.current = completions

  // Create once; props below are applied through effects.
  useEffect(() => {
    if (!host.current) return
    const extensions: Extension[] = [
      lineNumbers(),
      foldGutter(),
      history(),
      indentOnInput(),
      bracketMatching(),
      highlightActiveLine(),
      keymap.of([...completionKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab]),
      autocompletion({
        // Only the caller's source (read through a ref, so a new list never recreates the editor).
        override: [
          (ctx: CompletionContext) =>
            completionsRef.current ? toCompletionResult(completionsRef.current, ctx.state.doc.toString(), ctx.pos) : null,
        ],
        activateOnTyping: true,
        icons: false,
      }),
      syntaxHighlighting(highlight),
      theme,
      EditorView.theme({
        '&': { minHeight: `${minHeight}px`, maxHeight: `${maxHeight}px` },
        '.cm-scroller': { overflow: 'auto' },
      }),
      EditorView.contentAttributes.of({ 'aria-label': ariaLabel }),
      readOnlyConf.current.of([EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)]),
      lintGutter(),
      EditorView.updateListener.of((u) => {
        if (u.docChanged) onChangeRef.current?.(u.state.doc.toString())
      }),
    ]
    // One lint source for both the JSON parser and caller diagnostics, so neither overwrites
    // the other.
    const parse = language === 'json' ? jsonParseLinter() : null
    extensions.push(
      linter((v) => [...(parse ? parse(v) : []), ...toDiagnostics(v.state, diagnosticsRef.current ?? [])], {
        delay: 300,
      }),
    )
    if (language === 'json') extensions.push(json())
    if (language === 'html') extensions.push(html({ autoCloseTags: false }))
    if (placeholder) extensions.push(placeholderExt(placeholder))
    const v = new EditorView({ state: EditorState.create({ doc: value, extensions }), parent: host.current })
    view.current = v
    return () => {
      v.destroy()
      view.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the editor is created once per language
  }, [language])

  // External value changes replace the document (typing never takes this path: equal values).
  useEffect(() => {
    const v = view.current
    if (v && v.state.doc.toString() !== value) {
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } })
    }
  }, [value])

  useEffect(() => {
    view.current?.dispatch({
      effects: readOnlyConf.current.reconfigure([EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)]),
    })
  }, [readOnly])

  useEffect(() => {
    if (view.current) forceLinting(view.current)
  }, [diagnostics])

  return <div ref={host} className="ui-code-editor" style={style} />
}
