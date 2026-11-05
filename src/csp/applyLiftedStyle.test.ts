// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { applyLiftedStyle } from './applyLiftedStyle.js'

describe('applyLiftedStyle', () => {
  it('applies the style through CSSOM', () => {
    const el = document.createElement('b')
    applyLiftedStyle(el, 'color: red')
    expect(el.style.color).toBe('red')
  })

  it('leaves an element with no style object unstyled, where an unguarded write throws', () => {
    // An element as an engine without MathML styling presents it: no `.style` at all.
    const bare = document.createElementNS('http://www.w3.org/1998/Math/MathML', 'mi')
    Object.defineProperty(bare, 'style', { value: undefined, configurable: true })
    const unguarded = (target: Element, css: string) => {
      ;(target as HTMLElement).style.cssText = css
    }
    expect(() => unguarded(bare, 'color: red')).toThrow(TypeError)
    expect(() => applyLiftedStyle(bare, 'color: red')).not.toThrow()
  })
})
