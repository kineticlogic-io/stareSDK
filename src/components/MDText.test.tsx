// @vitest-environment jsdom
/**
 * MDText.test.tsx — Quick task 260828-fgu, Task 2 + the post-UAT D-7 debounce/confirm follow-up.
 *
 * Tests use React 19 `createRoot` + `act` + native DOM (project convention — no
 * @testing-library/react; see `ui/Toggle.test.tsx`).
 *
 * One test per <behavior> bullet in the plan's Task 2, plus two D-7 regression tests:
 *   1. variant -> wrapper class (`wiki-md` / `chat-md` / `tool-result-md`)
 *   2. gfm is always on — a pipe table renders <table>, wrapped in the scrollable div
 *   3. extra `remarkPlugins` apply IN ADDITION to remarkGfm
 *   4. a ```mermaid fence renders the mermaid host container, not raw code (after the D-7 debounce)
 *   5. a rejected mermaid render shows the inline error affordance + surrounding markdown
 *      (after the D-7 debounce + confirm window)
 *   6. a non-mermaid fenced block (```ts) still renders as normal <pre><code>
 *   7. D-7: a rapid "streaming" sequence of code changes never produces an error render at any
 *      point before it settles
 *   8. D-7: a genuinely broken (unchanging) diagram DOES eventually show the error banner, but
 *      only after the confirm window — not immediately on the first failed attempt
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { act } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import type { Root } from 'mdast'
import type { Plugin } from 'unified'
import { findAndReplace } from 'mdast-util-find-and-replace'

// React 19 requires this flag for `act()` to recognize the test environment (established
// pattern — see ToolResultView.timeout.test.tsx).
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// Mirrors MDText.tsx's D-7 `MERMAID_DEBOUNCE_MS`/`MERMAID_ERROR_CONFIRM_MS` (not exported —
// internal implementation detail, not part of MDText's public prop surface).
const DEBOUNCE_MS = 400
const CONFIRM_MS = 600

const mermaidRenderMock = vi.fn(async () => ({ svg: '<svg id="m"><title>diagram</title></svg>' }))

vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: mermaidRenderMock,
  },
}))

import { MDText } from './MDText'

/** A trivial inline remark plugin, independent of the app's own `remarkWikilinks`, proving a
 *  caller-supplied plugin is applied on top of (not instead of) remarkGfm. Uses
 *  `mdast-util-find-and-replace` — the same declared dependency `remarkWikilinks.ts` uses —
 *  rather than `unist-util-visit`, which is a transitive dependency only. */
const testMarkerPlugin: Plugin<[], Root> = () => (tree: Root) => {
  findAndReplace(tree, [
    [
      /TESTMARK/g,
      () => ({
        type: 'link',
        url: '/test-marker',
        children: [{ type: 'text', value: 'TESTMARK' }],
      }),
    ],
  ])
}

function mermaidFence(code: string): string {
  return '```mermaid\n' + code + '\n```\n'
}

async function render(ui: ReactElement) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => {
    root.render(ui)
  })
  return {
    container,
    rerender: async (nextUi: ReactElement) => {
      await act(async () => {
        root.render(nextUi)
      })
    },
    unmount: () => {
      act(() => { root.unmount() })
      container.remove()
    },
  }
}

describe('MDText', () => {
  const unmountFns: Array<() => void> = []

  afterEach(() => {
    unmountFns.splice(0).forEach(fn => fn())
    mermaidRenderMock.mockClear()
    // Safe even when a test never enabled fake timers — vitest no-ops on an already-real clock.
    vi.useRealTimers()
  })

  it('maps variant to the correct wrapper class', async () => {
    const wiki = await render(<MDText variant="wiki" markdown="hello" />)
    unmountFns.push(wiki.unmount)
    expect(wiki.container.querySelector('div.wiki-md')).not.toBeNull()

    const chat = await render(<MDText variant="chat" markdown="hello" />)
    unmountFns.push(chat.unmount)
    expect(chat.container.querySelector('div.chat-md')).not.toBeNull()

    const tool = await render(<MDText variant="tool" markdown="hello" />)
    unmountFns.push(tool.unmount)
    expect(tool.container.querySelector('div.tool-result-md')).not.toBeNull()
  })

  it('always applies gfm — a pipe table renders <table>, wrapped in a scrollable div', async () => {
    const markdown = '| A | B |\n| - | - |\n| 1 | 2 |\n'
    const { container, unmount } = await render(<MDText variant="wiki" markdown={markdown} />)
    unmountFns.push(unmount)

    const table = container.querySelector('table')
    expect(table).not.toBeNull()
    expect(table?.querySelectorAll('td').length).toBe(2)

    const wrapper = table?.parentElement as HTMLElement
    expect(wrapper.style.overflowX).toBe('auto')
  })

  it('applies caller remarkPlugins IN ADDITION to remarkGfm', async () => {
    const markdown = 'Hello TESTMARK world.\n\n| A | B |\n| - | - |\n| 1 | 2 |\n'
    const { container, unmount } = await render(
      <MDText variant="wiki" markdown={markdown} remarkPlugins={[testMarkerPlugin]} />,
    )
    unmountFns.push(unmount)

    // The custom plugin ran (its link is present)...
    const link = container.querySelector('a[href="/test-marker"]')
    expect(link).not.toBeNull()
    expect(link?.textContent).toBe('TESTMARK')
    // ...and gfm still ran too (the table from the SAME document rendered).
    expect(container.querySelector('table')).not.toBeNull()
  })

  it('renders a mermaid fence as the mermaid host container, not raw code, after the debounce', async () => {
    vi.useFakeTimers()
    const markdown = mermaidFence('graph TD; A-->B;')
    const { container, unmount } = await render(<MDText variant="chat" markdown={markdown} />)
    unmountFns.push(unmount)

    // D-7: the render attempt is debounced — nothing has happened yet immediately after mount.
    expect(mermaidRenderMock).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    })

    expect(mermaidRenderMock).toHaveBeenCalledTimes(1)
    expect(container.querySelector('svg#m')).not.toBeNull()
    expect(container.querySelector('pre')).toBeNull()
    expect(container.textContent).not.toContain('graph TD')
    // fix(123-11): the svg host carries `.mermaid-diagram` so global.css's `margin-inline:
    // auto` rule centers it — a future refactor that drops this class would silently
    // un-center the diagram.
    expect(container.querySelector('.mermaid-diagram svg#m')).not.toBeNull()
  })

  it('shows a pending spinner while a mermaid fence is still debouncing/rendering (D-15/D-16)', async () => {
    vi.useFakeTimers()
    const markdown = mermaidFence('graph TD; A-->B;')
    const { container, unmount } = await render(<MDText variant="chat" markdown={markdown} />)
    unmountFns.push(unmount)

    // Before the debounce fires (and thus before renderMermaid ever resolves), the pending
    // indicator must be present — not a silent 1px-tall empty div.
    const pending = container.querySelector('[role="status"]')
    expect(pending).not.toBeNull()
    expect(pending?.getAttribute('aria-label')).toBe('Rendering diagram')
    expect(pending?.querySelector('.mermaid-pending-spinner')).not.toBeNull()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    })

    // Once resolved, the pending indicator is gone.
    expect(container.querySelector('[role="status"]')).toBeNull()
  })

  it('shows an inline error affordance when mermaid.render rejects and stays rejected through the confirm window, without losing surrounding markdown', async () => {
    vi.useFakeTimers()
    mermaidRenderMock.mockRejectedValueOnce(new Error('Parse error on line 1'))
    const markdown = 'Before paragraph.\n\n' + mermaidFence('not valid') + '\nAfter paragraph.\n'
    const { container, unmount } = await render(<MDText variant="chat" markdown={markdown} />)
    unmountFns.push(unmount)

    // The debounced attempt fires and fails, but D-7 does not surface it immediately — it must
    // survive the confirm window unchallenged first.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    })
    expect(mermaidRenderMock).toHaveBeenCalledTimes(1)
    expect(container.textContent).not.toContain('Diagram failed to render')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CONFIRM_MS)
    })

    expect(container.textContent).toContain('Before paragraph.')
    expect(container.textContent).toContain('After paragraph.')
    expect(container.textContent).toContain('Diagram failed to render')
    expect(container.textContent).toContain('Parse error on line 1')
    // The raw source is preserved so the operator never loses their content.
    expect(container.textContent).toContain('not valid')
    expect(container.querySelector('svg#m')).toBeNull()
  })

  it('renders a non-mermaid fenced block as a normal <pre><code>', async () => {
    const markdown = '```ts\nconst x = 1\n```\n'
    const { container, unmount } = await render(<MDText variant="tool" markdown={markdown} />)
    unmountFns.push(unmount)

    const pre = container.querySelector('pre')
    expect(pre).not.toBeNull()
    const code = pre?.querySelector('code')
    expect(code?.className).toContain('language-ts')
    expect(code?.textContent).toContain('const x = 1')
    expect(mermaidRenderMock).not.toHaveBeenCalled()
  })

  it('D-7: a rapid streaming sequence of code changes never produces an error render before it settles', async () => {
    vi.useFakeTimers()
    // Every attempt made DURING the streaming sequence below fails — proving that even though
    // mermaid.render is called against truncated syntax, none of those failures ever reach the
    // screen, because each is superseded by a newer code change before its confirm window fires.
    mermaidRenderMock.mockRejectedValue(new Error('unexpected token'))

    const { container, rerender, unmount } = await render(
      <MDText variant="chat" markdown={mermaidFence('graph T')} />,
    )
    unmountFns.push(unmount)

    // Each successive "token" arrives well inside the 400ms debounce window, so the render
    // attempt keeps getting rescheduled and never actually fires mid-sequence.
    for (const partial of ['graph TD', 'graph TD; A', 'graph TD; A--', 'graph TD; A-->B']) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100)
      })
      await rerender(<MDText variant="chat" markdown={mermaidFence(partial)} />)
      expect(container.textContent).not.toContain('Diagram failed to render')
    }
    expect(mermaidRenderMock).not.toHaveBeenCalled()

    // Streaming stops on a VALID diagram — let the debounce elapse and confirm nothing errored.
    mermaidRenderMock.mockReset()
    mermaidRenderMock.mockResolvedValueOnce({ svg: '<svg id="m2"/>' })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    })

    expect(mermaidRenderMock).toHaveBeenCalledTimes(1)
    expect(container.querySelector('svg#m2')).not.toBeNull()
    expect(container.textContent).not.toContain('Diagram failed to render')
  })

  it('D-7: a genuinely broken diagram that stops changing eventually shows the error banner, but only after the confirm window', async () => {
    vi.useFakeTimers()
    mermaidRenderMock.mockRejectedValue(new Error('Parse error: EOF'))

    const { container, unmount } = await render(
      <MDText variant="chat" markdown={mermaidFence('graph TD; A -->')} />,
    )
    unmountFns.push(unmount)

    // t=400: the debounced attempt fires and fails.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    })
    expect(mermaidRenderMock).toHaveBeenCalledTimes(1)
    expect(container.textContent).not.toContain('Diagram failed to render')

    // t=700: still inside the 600ms confirm window (started at t=400, fires at t=1000) — the
    // code has not changed again, but the window has not elapsed yet either.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })
    expect(container.textContent).not.toContain('Diagram failed to render')

    // t=1000: the confirm window elapses with the code STILL unchanged — now, and only now, the
    // error banner appears.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })
    expect(container.textContent).toContain('Diagram failed to render')
    expect(container.textContent).toContain('Parse error: EOF')
    expect(mermaidRenderMock).toHaveBeenCalledTimes(1)
  })
})
