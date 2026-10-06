// @vitest-environment jsdom
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { PageHeader } from './PageHeader.js'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const cleanups: Array<() => void> = []
afterEach(() => cleanups.splice(0).forEach((f) => f()))

function mount(ui: React.ReactNode) {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = createRoot(el)
  act(() => root.render(ui))
  cleanups.push(() => {
    act(() => root.unmount())
    el.remove()
  })
  return el
}

describe('PageHeader', () => {
  it('renders the title and slots in a three-column bar and names the tab', () => {
    const el = mount(
      <PageHeader title="Sources" appName="OpenTrack" leading={<i>lead</i>} center={<i>clock</i>} actions={<i>user</i>}>
        <i>site</i>
      </PageHeader>,
    )
    const header = el.querySelector('header') as HTMLElement
    expect(header.style.gridTemplateColumns).toBe('minmax(0, 1fr) auto minmax(0, 1fr)')
    const cols = header.children
    expect(cols).toHaveLength(3)
    expect(cols[0].textContent).toBe('leadSourcessite')
    expect(cols[1].textContent).toBe('clock')
    expect(cols[2].textContent).toBe('user')
    const title = Array.from(header.querySelectorAll('span')).find((s) => s.textContent === 'Sources') as HTMLElement
    expect(title.style.textTransform).toBe('uppercase')
    expect(title.style.color).toBe('var(--color-accent)')
    expect(document.title).toBe('Sources — OpenTrack')
  })

  it('renders nothing for slots it is not given', () => {
    const el = mount(<PageHeader title="OpenTrack" />)
    const cols = (el.querySelector('header') as HTMLElement).children
    expect(cols[1].childElementCount).toBe(0)
    expect(cols[2].childElementCount).toBe(0)
    expect(document.title).toBe('OpenTrack')
  })

  // #31: an app shell can keep the header full width by portaling it; the page keeps a spacer.
  it('portalTarget renders the bar into the target and leaves a spacer in place', () => {
    const target = document.createElement('div')
    document.body.appendChild(target)
    cleanups.push(() => target.remove())
    const el = mount(<PageHeader title="Apex" portalTarget={target} />)
    expect(el.querySelector('header')).toBeNull()
    expect((el.firstElementChild as HTMLElement).style.height).toBe('var(--page-header-height, 48px)')
    expect(target.querySelector('header')?.textContent).toContain('Apex')
  })

  it('a null portalTarget renders only the spacer until the target mounts', () => {
    const el = mount(<PageHeader title="Apex" portalTarget={null} />)
    expect(el.querySelector('header')).toBeNull()
    expect(el.children).toHaveLength(1)
  })
})
