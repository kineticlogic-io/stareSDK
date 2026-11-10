/**
 * The one ramp registry (operator, 2026-11-10): unique ids, valid stops, stored ids unchanged, the
 * approved new ramps present with their exact labels, and sampling over the full stops.
 */
import { describe, it, expect } from 'vitest'
import { RAMPS, RAMP_GROUPS, rampById, rampGroupOf, sampleRamp, DEFAULT_HEATMAP_RAMP_ID, DEFAULT_GRADUATED_RAMP_ID, DEFAULT_CATEGORIZED_RAMP_ID } from './colorRamps.js'

const HEX = /^#[0-9a-fA-F]{6}$/

describe('the ramp registry', () => {
  it('every ramp has a unique id and only valid #rrggbb stops (at least two; qualitative at least eight)', () => {
    const ids = RAMPS.map(r => r.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const r of RAMPS) {
      expect(r.anchors.length).toBeGreaterThanOrEqual(r.kind === 'qualitative' ? 8 : 2)
      for (const a of r.anchors) expect(a, `${r.id} ${a}`).toMatch(HEX)
    }
  })

  it('keeps every id stored styles may reference', () => {
    const existing = ['seq-blues', 'seq-greens', 'seq-oranges', 'seq-reds', 'seq-purples', 'seq-greys', 'seq-viridis', 'seq-ylorrd', 'seq-bugn',
      'div-rdbu', 'div-rdylgn', 'div-puor', 'qual-category10', 'qual-set1', 'qual-set2', 'qual-dark2']
    for (const id of existing) expect(rampById(id), id).toBeDefined()
    for (const id of [DEFAULT_GRADUATED_RAMP_ID, DEFAULT_CATEGORIZED_RAMP_ID, DEFAULT_HEATMAP_RAMP_ID]) expect(rampById(id), id).toBeDefined()
  })

  it('carries the approved new ramps with their exact labels, in their groups', () => {
    const expected: Array<[string, string, string]> = [
      ['seq-heat', 'Heat', 'Sequential'], ['seq-magma', 'Magma', 'Sequential'], ['seq-inferno', 'Inferno', 'Sequential'],
      ['seq-plasma', 'Plasma', 'Sequential'], ['seq-cividis', 'Cividis', 'Sequential'], ['seq-turbo', 'Turbo', 'Sequential'],
      ['seq-ylgnbu', 'YlGnBu', 'Sequential'], ['seq-ylgn', 'YlGn', 'Sequential'], ['seq-gnbu', 'GnBu', 'Sequential'],
      ['seq-pubu', 'PuBu', 'Sequential'], ['seq-orrd', 'OrRd', 'Sequential'], ['seq-rdpu', 'RdPu', 'Sequential'],
      ['div-spectral', 'Spectral', 'Diverging'], ['div-rdylbu', 'RdYlBu', 'Diverging'], ['div-brbg', 'BrBG', 'Diverging'], ['div-piyg', 'PiYG', 'Diverging'],
      ['qual-paired', 'Paired', 'Qualitative'], ['qual-pastel', 'Pastel', 'Qualitative'], ['qual-accent', 'Accent', 'Qualitative'],
    ]
    for (const [id, label, group] of expected) {
      const r = rampById(id)
      expect(r?.label, id).toBe(label)
      expect(rampGroupOf(r!), id).toBe(group)
    }
    expect(RAMP_GROUPS).toEqual(['Sequential', 'Diverging', 'Qualitative'])
  })

  it('Heat runs dark blue → blue → cyan → green → yellow → red', () => {
    expect(rampById('seq-heat')!.anchors).toEqual(['#000080', '#0000ff', '#00ffff', '#00ff00', '#ffff00', '#ff0000'])
  })

  it('samples the full published stops: a 9-stop ramp sampled at 9 returns its stops exactly', () => {
    const blues = rampById('seq-blues')!
    expect(sampleRamp(blues, 9)).toEqual(blues.anchors.map(a => a.toLowerCase()))
    expect(sampleRamp(blues, 2)).toEqual(['#f7fbff', '#08306b'])
    expect(sampleRamp(blues, 2, true)).toEqual(['#08306b', '#f7fbff'])
  })
})
