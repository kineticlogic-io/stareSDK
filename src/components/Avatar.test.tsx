// @vitest-environment jsdom
/**
 * Avatar fallback-chain and font-size-lookup regression tests (88-10).
 *
 * Tests use React 19 createRoot + act + native DOM event dispatch (project convention — no
 * @testing-library/react dependency; see Toggle.test.tsx / Badge.test.tsx). One `it` per
 * behavior in 88-10-PLAN.md Task 1's <behavior> block.
 *
 * Test 3 (broken-image never shows a broken glyph) and test 8 (never a novel font size) are
 * the load-bearing ones — see 88-10-PLAN.md's acceptance criteria for both.
 */

import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { Avatar } from './Avatar'
import type { AvatarProps } from './Avatar'

function renderAvatar(props: AvatarProps) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(<Avatar {...props} />)
  })
  return {
    container,
    unmount: () => {
      act(() => { root.unmount() })
      container.remove()
    },
  }
}

function dispatchImgError(container: HTMLElement) {
  const img = container.querySelector('img') as HTMLImageElement
  act(() => {
    img.dispatchEvent(new Event('error', { bubbles: true }))
  })
}

describe('Avatar (88-10)', () => {
  let unmountFns: Array<() => void> = []

  afterEach(() => {
    unmountFns.forEach(fn => fn())
    unmountFns = []
  })

  it('renders an <img> with the expected width/height/border-radius given src', () => {
    const { container, unmount } = renderAvatar({ size: 40, src: '/blob/abc.png', username: 'phornstein' })
    unmountFns.push(unmount)
    const img = container.querySelector('img') as HTMLImageElement
    expect(img).not.toBeNull()
    expect(img.style.width).toBe('40px')
    expect(img.style.height).toBe('40px')
    expect(img.style.borderRadius).toBe('50%')
  })

  it('an empty src falls back to initials, never a broken <img>', () => {
    const { container, unmount } = renderAvatar({ size: 28, src: '', username: 'phornstein' })
    unmountFns.push(unmount)
    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toBe('P')
  })

  it('swaps to the initials branch on img error, with no <img> left in the DOM', () => {
    const { container, unmount } = renderAvatar({ size: 40, src: '/blob/broken.png', username: 'phornstein' })
    unmountFns.push(unmount)
    expect(container.querySelector('img')).not.toBeNull()
    dispatchImgError(container)
    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toBe('P')
  })

  it('produces two uppercase initials from firstName + lastName', () => {
    const { container, unmount } = renderAvatar({
      size: 40,
      firstName: 'Parker',
      lastName: 'Hornstein',
      username: 'phornstein',
    })
    unmountFns.push(unmount)
    expect(container.textContent).toBe('PH')
  })

  it('produces one initial from firstName alone', () => {
    const { container, unmount } = renderAvatar({ size: 40, firstName: 'Parker', username: 'phornstein' })
    unmountFns.push(unmount)
    expect(container.textContent).toBe('P')
  })

  it('falls back to username[0] uppercased when neither name is present', () => {
    const { container, unmount } = renderAvatar({ size: 40, username: 'phornstein' })
    unmountFns.push(unmount)
    expect(container.textContent).toBe('P')
  })

  it('font size is 12 at size=28, 16 at size=40, 32 at size=96', () => {
    const a = renderAvatar({ size: 28, username: 'phornstein' })
    unmountFns.push(a.unmount)
    expect((a.container.firstElementChild as HTMLElement).style.fontSize).toBe('12px')

    const b = renderAvatar({ size: 40, username: 'phornstein' })
    unmountFns.push(b.unmount)
    expect((b.container.firstElementChild as HTMLElement).style.fontSize).toBe('16px')

    const c = renderAvatar({ size: 96, username: 'phornstein' })
    unmountFns.push(c.unmount)
    expect((c.container.firstElementChild as HTMLElement).style.fontSize).toBe('32px')
  })

  it('size=33 (not in the table) snaps to the nearest listed key (28 -> 12px)', () => {
    const { container, unmount } = renderAvatar({ size: 33, username: 'phornstein' })
    unmountFns.push(unmount)
    expect((container.firstElementChild as HTMLElement).style.fontSize).toBe('12px')
  })
})
