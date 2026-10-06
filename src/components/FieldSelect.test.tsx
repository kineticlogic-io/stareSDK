// @vitest-environment jsdom
/**
 * FieldSelect.test.tsx — Phase 118 Plan 03, Task 2.
 *
 * Tests use React 19 createRoot + act + native DOM event dispatch (project convention — no
 * @testing-library/react dependency; see Toggle.test.tsx / Tree.test.tsx).
 */
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { FieldSelect, type FieldSelectOption } from './FieldSelect.js'

const FIELDS: FieldSelectOption[] = [
  { name: 'name' },
  { name: 'attributes.t' },
  { name: 'count' },
]

function renderFieldSelect(props: Partial<React.ComponentProps<typeof FieldSelect>> = {}) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const onChange = props.onChange ?? vi.fn()
  act(() => {
    root.render(
      <FieldSelect
        fields={props.fields ?? FIELDS}
        value={props.value ?? null}
        onChange={onChange}
        allowNone={props.allowNone}
        ariaLabel={props.ariaLabel ?? 'Field'}
        style={props.style}
      />,
    )
  })
  return {
    container,
    onChange,
    select: container.querySelector('select') as HTMLSelectElement,
    unmount: () => { act(() => { root.unmount() }); container.remove() },
  }
}

function selectValue(select: HTMLSelectElement, value: string) {
  act(() => {
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')!.set!
    nativeSetter.call(select, value)
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

describe('FieldSelect (Phase 118 shared AttributeField picker)', () => {
  let unmountFns: Array<() => void> = []
  afterEach(() => {
    unmountFns.forEach(fn => fn())
    unmountFns = []
  })

  it('renders one option per field, in order, with name as both value and text', () => {
    const { select, unmount } = renderFieldSelect()
    unmountFns.push(unmount)
    const options = Array.from(select.querySelectorAll('option'))
    expect(options.map(o => o.value)).toEqual(['name', 'attributes.t', 'count'])
    expect(options.map(o => o.textContent)).toEqual(['name', 'attributes.t', 'count'])
  })

  it('renders a leading None option when allowNone is set; omits it otherwise', () => {
    const withNone = renderFieldSelect({ allowNone: true })
    unmountFns.push(withNone.unmount)
    const noneOptions = withNone.select.querySelectorAll('option[value=""]')
    expect(noneOptions.length).toBe(1)
    expect(noneOptions[0].textContent).toBe('None')
    expect(withNone.select.querySelectorAll('option')[0].value).toBe('')

    const withoutNone = renderFieldSelect({ allowNone: false })
    unmountFns.push(withoutNone.unmount)
    expect(withoutNone.select.querySelectorAll('option[value=""]').length).toBe(0)
  })

  it('value={null} selects the empty option when allowNone is set', () => {
    const { select, unmount } = renderFieldSelect({ allowNone: true, value: null })
    unmountFns.push(unmount)
    expect(select.value).toBe('')
  })

  it('choosing a field calls onChange with that field name', () => {
    const { select, onChange, unmount } = renderFieldSelect({ allowNone: true })
    unmountFns.push(unmount)
    selectValue(select, 'count')
    expect(onChange).toHaveBeenCalledWith('count')
  })

  it('choosing the None option calls onChange with null', () => {
    const { select, onChange, unmount } = renderFieldSelect({ allowNone: true, value: 'name' })
    unmountFns.push(unmount)
    selectValue(select, '')
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('applies ariaLabel as the select aria-label', () => {
    const { select, unmount } = renderFieldSelect({ ariaLabel: 'Label field' })
    unmountFns.push(unmount)
    expect(select.getAttribute('aria-label')).toBe('Label field')
  })

  it('a dot-path field name renders as a single option with that exact value and text', () => {
    const { select, unmount } = renderFieldSelect()
    unmountFns.push(unmount)
    const dotOptions = Array.from(select.querySelectorAll('option')).filter(o => o.value === 'attributes.t')
    expect(dotOptions.length).toBe(1)
    expect(dotOptions[0].textContent).toBe('attributes.t')
  })

  it('an empty fields array renders only the None option (when allowed) without crashing', () => {
    const { select, unmount } = renderFieldSelect({ fields: [], allowNone: true })
    unmountFns.push(unmount)
    const options = Array.from(select.querySelectorAll('option'))
    expect(options.length).toBe(1)
    expect(options[0].value).toBe('')
  })

  it('an empty fields array with allowNone=false renders zero options without crashing', () => {
    const { select, unmount } = renderFieldSelect({ fields: [], allowNone: false })
    unmountFns.push(unmount)
    expect(select.querySelectorAll('option').length).toBe(0)
  })

  it('a field-agnostic option list (no AttributeField "type") renders normally (Phase 127 plan 19)', () => {
    const { select, unmount } = renderFieldSelect({
      fields: [{ name: 'linear' }, { name: 'density' }],
    })
    unmountFns.push(unmount)
    const options = Array.from(select.querySelectorAll('option'))
    expect(options.map(o => o.value)).toEqual(['linear', 'density'])
  })

  it('disabled/disabledReason render the option disabled with the reason as its title', () => {
    const { select, unmount } = renderFieldSelect({
      fields: [
        { name: 'density' },
        { name: 'pedf', disabled: true, disabledReason: 'definition not established' },
      ],
    })
    unmountFns.push(unmount)
    const options = Array.from(select.querySelectorAll('option'))
    const density = options.find(o => o.value === 'density')!
    const pedf = options.find(o => o.value === 'pedf')!
    expect(density.disabled).toBe(false)
    expect(pedf.disabled).toBe(true)
    expect(pedf.title).toBe('definition not established')
  })
})
