// @vitest-environment jsdom
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { CodeEditor, toCompletionResult, toDiagnostics } from './CodeEditor.js'

const cleanups: Array<() => void> = []
afterEach(() => {
  cleanups.splice(0).forEach((f) => f())
})

describe('CodeEditor', () => {
  it('adapts a completion source: span start clamped to the cursor, apply defaults to the label', () => {
    const source = vi.fn(({ text, pos }: { text: string; pos: number }) => {
      const open = text.lastIndexOf('{', pos - 1)
      return open < 0 ? null : { from: open + 1, options: [{ label: 'name', detail: 'keyword' }, { label: 'speed', apply: 'speed}' }] }
    })
    const r = toCompletionResult(source, '<p>{na', 6)!
    expect(source).toHaveBeenCalledWith({ text: '<p>{na', pos: 6 })
    expect(r.from).toBe(4)
    expect(r.options).toEqual([
      { label: 'name', detail: 'keyword', apply: 'name' },
      { label: 'speed', detail: undefined, apply: 'speed}' },
    ])
    expect(toCompletionResult(source, '<p>', 3)).toBeNull()
    expect(toCompletionResult(undefined, '{', 1)).toBeNull()
    expect(toCompletionResult(() => ({ from: 99, options: [{ label: 'x' }] }), 'ab', 2)!.from).toBe(2)
    expect(toCompletionResult(() => ({ from: 0, options: [] }), 'ab', 2)).toBeNull()
  })

  it('renders HTML with highlighting and keeps a typed template exactly as written', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    act(() => root.render(<CodeEditor aria-label="Template" language="html" value={'<b>{name}</b>'} completions={() => null} />))
    cleanups.push(() => {
      act(() => root.unmount())
      container.remove()
    })
    expect(container.querySelector('.cm-content')!.textContent).toBe('<b>{name}</b>')
    expect(container.querySelector('.cm-content span')).not.toBeNull()
  })

  it('maps line and offset diagnostics, dropping out-of-range lines', () => {
    const state = EditorState.create({ doc: '{\n  "a": 1\n}' })
    const d = toDiagnostics(state, [
      { line: 2, message: 'bad key' },
      { from: 0, to: 1, message: 'brace', severity: 'warning' },
      { line: 9, message: 'nope' },
    ])
    expect(d).toEqual([
      { from: 2, to: 10, message: 'bad key', severity: 'error' },
      { from: 0, to: 1, message: 'brace', severity: 'warning' },
    ])
  })

  it('renders the value, reports edits and accepts external value changes', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    const onChange = vi.fn()
    const el = (v: string) => <CodeEditor aria-label="Spec" value={v} onChange={onChange} />
    act(() => root.render(el('{"a": 1}')))
    cleanups.push(() => {
      act(() => root.unmount())
      container.remove()
    })
    const content = container.querySelector('.cm-content')!
    expect(content.getAttribute('aria-label')).toBe('Spec')
    expect(content.textContent).toBe('{"a": 1}')

    const view = EditorView.findFromDOM(container.querySelector('.cm-editor') as HTMLElement)!
    act(() => {
      view.dispatch({ changes: { from: 7, insert: '2' } })
    })
    expect(onChange).toHaveBeenLastCalledWith('{"a": 12}')

    act(() => root.render(el('[]')))
    expect(container.querySelector('.cm-content')!.textContent).toBe('[]')
  })
})
