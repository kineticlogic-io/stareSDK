// @vitest-environment jsdom
/**
 * RampPicker (operator, 2026-11-10): every picker lists every ramp, grouped Sequential / Diverging /
 * Qualitative, whatever (deprecated) `kind` it is given; previews draw the ramp's own stops.
 */
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { RampPicker } from './RampPicker.js'
import { RAMPS, rampGroupOf } from '../internal/colorRamps.js'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let host: HTMLDivElement | null = null
afterEach(() => { host?.remove(); host = null })

function open(kind?: 'sequential-diverging' | 'qualitative', onChange = vi.fn()) {
  host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  act(() => {
    root.render(<RampPicker rampId="seq-blues" onChange={onChange} reversed={false} onReverseChange={() => {}} kind={kind} />)
  })
  act(() => { (host!.querySelector('button[aria-label="Color ramp"]') as HTMLButtonElement).click() })
  return { onChange }
}

describe('RampPicker', () => {
  for (const kind of [undefined, 'sequential-diverging', 'qualitative'] as const) {
    it(`lists every ramp, grouped, with kind=${String(kind)}`, () => {
      open(kind)
      const groups = [...host!.querySelectorAll('[role="group"]')]
      expect(groups.map(g => g.getAttribute('aria-label'))).toEqual(['Sequential', 'Diverging', 'Qualitative'])
      for (const g of groups) {
        const labels = [...g.querySelectorAll('button[aria-label]')].map(b => b.getAttribute('aria-label'))
        expect(labels).toEqual(RAMPS.filter(r => rampGroupOf(r) === g.getAttribute('aria-label')).map(r => r.label))
      }
    })
  }

  it('previews a ramp with its own stops and selects by id', () => {
    const { onChange } = open()
    const heat = host!.querySelector('button[aria-label="Heat"]') as HTMLButtonElement
    const swatch = heat.firstElementChild as HTMLElement
    for (const stop of ['#000080', '#00ffff', '#ff0000']) expect(swatch.style.background).toContain(hexToRgbCss(stop))
    act(() => heat.click())
    expect(onChange).toHaveBeenCalledWith('seq-heat')
  })
})

/** jsdom serialises gradient colours as rgb(); match either form. */
function hexToRgbCss(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`
}
