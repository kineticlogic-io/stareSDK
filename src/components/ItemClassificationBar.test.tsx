// @vitest-environment jsdom
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import {
  CLASSIFICATION_CAVEAT,
  CLASSIFICATION_FALLBACK,
  CLASSIFICATION_NOT_SET,
  CLASSIFICATION_SECRET,
  CLASSIFICATION_UNCLASSIFIED,
  ItemClassificationBar,
  classificationColor,
} from './ItemClassificationBar'
import type { ItemClassificationBarProps } from './ItemClassificationBar'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function render(props: ItemClassificationBarProps): HTMLElement {
  const container = document.createElement('div')
  document.body.appendChild(container)
  act(() => { createRoot(container).render(<ItemClassificationBar {...props} />) })
  return container.firstElementChild as HTMLElement
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('classificationColor', () => {
  it('colours by level, case-insensitively, with caveats above UNCLASSIFIED', () => {
    expect(classificationColor('unclassified', true)).toBe(CLASSIFICATION_UNCLASSIFIED)
    expect(classificationColor('SECRET')).toBe(CLASSIFICATION_SECRET)
    expect(classificationColor('SECRET', true)).toBe(CLASSIFICATION_CAVEAT)
    expect(classificationColor('RESTRICTED')).toBe(CLASSIFICATION_FALLBACK)
    expect(classificationColor(null)).toBe(CLASSIFICATION_FALLBACK)
  })
})

describe('ItemClassificationBar', () => {
  it('shows the marking on the level colour', () => {
    const bar = render({ banner: 'SECRET//NOFORN', level: 'SECRET' })
    expect(bar.textContent).toBe('SECRET//NOFORN')
    expect(bar.style.background).not.toBe('')
  })

  it('shows CLASSIFICATION NOT SET on black when the item has no classification', () => {
    const bar = render({ banner: null, level: 'SECRET' })
    expect(bar.textContent).toBe('CLASSIFICATION NOT SET')
    expect(bar.style.background).toContain('rgb(0, 0, 0)')
    expect(CLASSIFICATION_NOT_SET).toBe('#000000')
  })

  it('lets the caller render the text with the resolved text colour', () => {
    const bar = render({ banner: 'UNCLASSIFIED', level: 'UNCLASSIFIED', renderText: (t, c) => <span data-color={c}>{t}</span> })
    expect(bar.querySelector('span')?.getAttribute('data-color')).toBe('#FFFFFF')
  })
})
