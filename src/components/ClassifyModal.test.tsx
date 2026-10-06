// @vitest-environment jsdom
/**
 * ClassifyModal.test.tsx — FGAC #152: the shared classify modal, its Select and MultiSelect, and
 * Escape closing only the topmost modal. React 19 createRoot + act + native DOM events.
 */
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { ClassifyModal, fitsOptions, nextReleasability, NOFORN_MARKING, withDomestic } from './ClassifyModal'
import type { ClassificationMarking, ClassifyOptions } from './ClassifyModal'
import { Modal } from './Modal'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const OPTIONS: ClassifyOptions = {
  levels: [{ id: 'U', name: 'UNCLASSIFIED' }, { id: 'S', name: 'SECRET' }],
  categories: [{ id: 'SCI', name: 'SCI', values: [{ id: 'SI', name: 'SPECIAL INTELLIGENCE' }, { id: 'TK', name: 'TALENT KEYHOLE' }] }],
  releasability: [{ code: 'USA', name: 'United States' }, { code: 'FVEY', name: 'Five Eyes' }],
  noforn: true,
}

const bannerFor = (m: ClassificationMarking) => ({
  banner: m.classification ? [m.classification, ...(m.restrictions ?? []), ...(m.sharing ?? [])].join('/') : null,
  level: m.classification ?? null,
})

let cleanup: (() => void) | null = null
afterEach(() => { cleanup?.(); cleanup = null; document.body.innerHTML = '' })

function render(ui: React.ReactElement) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => { root.render(ui) })
  cleanup = () => act(() => { root.unmount() })
}

function button(label: string) {
  return Array.from(document.body.querySelectorAll('button')).find(b => b.textContent?.trim() === label) as HTMLButtonElement
}

function openList(label: string) {
  const trigger = document.body.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement
  act(() => { trigger.click() })
}

function tick(label: string) {
  const input = Array.from(document.body.querySelectorAll('[role="listbox"] label')).find(l => l.textContent?.includes(label))
    ?.querySelector('input') as HTMLInputElement
  act(() => { input.click() })
}

function chooseLevel(id: string) {
  const select = document.body.querySelector('select[aria-label="Classification level"]') as HTMLSelectElement
  act(() => {
    select.value = id
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

describe('ClassifyModal', () => {
  it('requires a level, previews the banner, and confirms the chosen marking', () => {
    const onConfirm = vi.fn()
    const onClose = vi.fn()
    render(<ClassifyModal options={OPTIONS} value={{}} bannerFor={bannerFor} onConfirm={onConfirm} onClose={onClose} />)
    expect(document.body.textContent).toContain('CLASSIFICATION NOT SET')
    expect(button('Confirm').disabled).toBe(true)

    chooseLevel('S')
    openList('SCI')
    tick('TALENT KEYHOLE')
    openList('Release to')
    tick('Five Eyes')
    expect(document.body.textContent).toContain('S/SCI:TK/FVEY')

    act(() => { button('Confirm').click() })
    expect(onConfirm).toHaveBeenCalledWith({ classification: 'S', restrictions: ['SCI:TK'], sharing: ['FVEY'] })
    expect(onClose).toHaveBeenCalled()
  })

  it('keeps values the options do not offer, locked', () => {
    const onConfirm = vi.fn()
    render(
      <ClassifyModal
        options={OPTIONS}
        value={{ classification: 'S', restrictions: ['SCI:HCS', 'DISSEM:OC'], sharing: ['GBR'] }}
        bannerFor={bannerFor}
        onConfirm={onConfirm}
        onClose={() => {}}
      />,
    )
    openList('SCI')
    tick('SPECIAL INTELLIGENCE')
    act(() => { button('Confirm').click() })
    const confirmed = onConfirm.mock.calls[0][0] as ClassificationMarking
    expect(confirmed.restrictions).toEqual(expect.arrayContaining(['SCI:HCS', 'DISSEM:OC', 'SCI:SI']))
    expect(confirmed.sharing).toEqual(['GBR'])
  })

  it('in a US system REL TO always names USA, first, and USA is not a choice', () => {
    expect(withDomestic(['FVEY'], 'USA')).toEqual(['USA', 'FVEY'])
    expect(withDomestic(['USA'], 'USA')).toEqual([])
    expect(withDomestic([NOFORN_MARKING], 'USA')).toEqual([NOFORN_MARKING])
    expect(withDomestic(['GBR'], null)).toEqual(['GBR'])
    const onConfirm = vi.fn()
    render(
      <ClassifyModal options={{ ...OPTIONS, domestic: 'USA' }} value={{}} bannerFor={bannerFor} onConfirm={onConfirm} onClose={() => {}} />,
    )
    chooseLevel('S')
    openList('Release to')
    expect(Array.from(document.body.querySelectorAll('[role="listbox"] label')).some(l => l.textContent?.includes('(USA)'))).toBe(false)
    tick('Five Eyes')
    act(() => { button('Confirm').click() })
    expect(onConfirm).toHaveBeenCalledWith({ classification: 'S', sharing: ['USA', 'FVEY'] })
  })

  it('NOFORN excludes REL TO entries both ways', () => {
    expect(nextReleasability(['USA', 'FVEY'], ['USA', 'FVEY', NOFORN_MARKING])).toEqual([NOFORN_MARKING])
    expect(nextReleasability([NOFORN_MARKING], [NOFORN_MARKING, 'USA'])).toEqual(['USA'])
    expect(nextReleasability(['USA'], ['USA', 'FVEY'])).toEqual(['USA', 'FVEY'])
  })

  it('a favorite fills every field; one the options cannot express is disabled; save and remove', () => {
    const onToggleFavorite = vi.fn()
    const onConfirm = vi.fn()
    const fits = { classification: 'S', restrictions: ['SCI:SI'], sharing: ['FVEY'] }
    const tooHigh = { classification: 'TS' }
    expect(fitsOptions(OPTIONS, fits)).toBe(true)
    expect(fitsOptions(OPTIONS, tooHigh)).toBe(false)
    render(
      <ClassifyModal
        options={OPTIONS}
        value={{}}
        favorites={[fits, tooHigh]}
        onToggleFavorite={onToggleFavorite}
        bannerFor={bannerFor}
        onConfirm={onConfirm}
        onClose={() => {}}
      />,
    )
    const select = document.body.querySelector('select[aria-label="Favorites"]') as HTMLSelectElement
    expect((select.querySelector('option[value="1"]') as HTMLOptionElement).disabled).toBe(true)
    act(() => {
      select.value = '0'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(button('Remove favorite')).toBeTruthy()
    act(() => { button('Remove favorite').click() })
    expect(onToggleFavorite).toHaveBeenLastCalledWith(fits, false)
    act(() => { button('Confirm').click() })
    expect(onConfirm).toHaveBeenCalledWith(fits)
  })

  it('a favorite keeps the item\'s locked values', () => {
    const onConfirm = vi.fn()
    const value = { classification: 'S', restrictions: ['SCI:HCS'], sharing: ['GBR'] }
    const withGbr = { classification: 'S', sharing: ['GBR'] }
    const withoutGbr = { classification: 'S', sharing: ['FVEY'] }
    render(<ClassifyModal options={OPTIONS} value={value} favorites={[withGbr, withoutGbr]} bannerFor={bannerFor} onConfirm={onConfirm} onClose={() => {}} />)
    const select = document.body.querySelector('select[aria-label="Favorites"]') as HTMLSelectElement
    expect((select.querySelector('option[value="1"]') as HTMLOptionElement).disabled).toBe(true)
    act(() => {
      select.value = '0'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    act(() => { button('Confirm').click() })
    expect(onConfirm).toHaveBeenCalledWith({ classification: 'S', restrictions: ['SCI:HCS'], sharing: ['GBR'] })
  })

  it('Save as favorite adds the current marking', () => {
    const onToggleFavorite = vi.fn()
    render(<ClassifyModal options={OPTIONS} value={{}} favorites={[]} onToggleFavorite={onToggleFavorite} bannerFor={bannerFor} onConfirm={() => {}} onClose={() => {}} />)
    expect(button('Save as favorite').disabled).toBe(true)
    chooseLevel('S')
    act(() => { button('Save as favorite').click() })
    expect(onToggleFavorite).toHaveBeenCalledWith({ classification: 'S' }, true)
  })

  it('Escape closes only the topmost modal', () => {
    const outer = vi.fn()
    const inner = vi.fn()
    render(
      <>
        <Modal title="Outer" onClose={outer}>outer</Modal>
        <Modal title="Inner" onClose={inner}>inner</Modal>
      </>,
    )
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })) })
    expect(inner).toHaveBeenCalledTimes(1)
    expect(outer).not.toHaveBeenCalled()
  })
})
