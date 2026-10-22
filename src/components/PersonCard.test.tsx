// @vitest-environment jsdom
/**
 * PersonCard tests — React 19 createRoot + act + native DOM events (project convention).
 */
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { PersonCard } from './PersonCard.js'
import type { PersonCardProps } from './PersonCard.js'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const cleanups: Array<() => void> = []
afterEach(() => {
  cleanups.splice(0).forEach((f) => f())
})

const BASE: PersonCardProps = {
  name: 'Dana Ellis',
  position: 'Senior Analyst',
  organization: 'J2 Intelligence',
  site: 'Norfolk',
}

function render(props: Partial<PersonCardProps> = {}) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => root.render(<PersonCard {...BASE} {...props} />))
  cleanups.push(() => {
    act(() => root.unmount())
    container.remove()
  })
  return container
}

const card = (c: HTMLElement) => c.querySelector('.ui-person-card') as HTMLElement

function key(el: HTMLElement, k: string) {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })
  act(() => {
    el.dispatchEvent(e)
  })
  return e
}

describe('PersonCard', () => {
  it('renders the name, position and organization · site', () => {
    const c = render()
    expect(c.querySelector('.ui-person-card__name')!.textContent).toBe('Dana Ellis')
    expect(c.querySelector('.ui-person-card__position')!.textContent).toBe('Senior Analyst')
    expect(c.querySelector('.ui-person-card__affiliation')!.textContent).toBe('J2 Intelligence · Norfolk')
    const only = render({ position: undefined, organization: undefined, site: 'Norfolk' })
    expect(only.querySelector('.ui-person-card__position')).toBeNull()
    expect(only.querySelector('.ui-person-card__affiliation')!.textContent).toBe('Norfolk')
    expect(render({ organization: undefined, site: undefined }).querySelector('.ui-person-card__affiliation')).toBeNull()
  })

  it('a large avatar takes the thumbnail\'s place: an image when given, initials otherwise', () => {
    const c = render({ avatarSrc: '/avatars/dana.png' })
    const img = c.querySelector('img') as HTMLImageElement
    expect(img.getAttribute('src')).toBe('/avatars/dana.png')
    expect(img.alt).toBe('Dana Ellis')
    const initials = render({ username: 'dellis' }).querySelector('[role="img"]') as HTMLElement
    expect(initials.textContent).toBe('D')
    expect(initials.getAttribute('aria-label')).toBe('Dana Ellis')
  })

  describe('layouts', () => {
    it('row (default) is a horizontal card with a 48 px avatar at the leading edge', () => {
      const c = render()
      expect(card(c).dataset.layout).toBe('row')
      expect(card(c).classList.contains('ui-person-card--row')).toBe(true)
      expect(card(c).style.flexDirection).toBe('row')
      const av = c.querySelector('[role="img"]') as HTMLElement
      expect(av.style.width).toBe('48px')
      expect(av.parentElement!.firstElementChild).toBe(av)
      expect((av.parentElement as HTMLElement).style.flexDirection).toBe('row')
    })

    it('tile is a centred column with an 80 px avatar above the text, clipping without scrolling', () => {
      const c = render({ layout: 'tile' })
      expect(card(c).dataset.layout).toBe('tile')
      expect(card(c).style.flexDirection).toBe('column')
      expect(card(c).style.overflow).toBe('clip')
      expect(card(c).style.height).toBe('100%')
      const av = c.querySelector('[role="img"]') as HTMLElement
      expect(av.style.width).toBe('80px')
      const content = av.parentElement as HTMLElement
      expect(content.style.flexDirection).toBe('column')
      expect(content.style.alignItems).toBe('center')
      expect(content.firstElementChild).toBe(av)
    })

    it('a banner is a strip across the top edge in both layouts', () => {
      for (const layout of ['row', 'tile'] as const) {
        const c = render({ layout, banner: <div role="note">SECRET</div> })
        const strip = c.querySelector('.ui-person-card__banner') as HTMLElement
        expect(card(c).firstElementChild).toBe(strip)
        expect(card(c).style.flexDirection).toBe('column')
        expect(strip.textContent).toBe('SECRET')
      }
      expect(render().querySelector('.ui-person-card__banner')).toBeNull()
    })
  })

  describe('skills', () => {
    it('shows up to maxSkills (default 4), then a +N badge whose tooltip lists the rest', () => {
      const c = render({ skills: ['GEOINT', 'SIGINT', 'Python', 'Arabic', 'Maritime', 'ArcGIS'] })
      const skills = c.querySelector('.ui-person-card__skills') as HTMLElement
      expect(skills.textContent).toBe('GEOINTSIGINTPythonArabic+2')
      expect((skills.lastElementChild as HTMLElement).title).toBe('Maritime, ArcGIS')
      expect(render({ skills: ['a', 'b', 'c'], maxSkills: 2 }).querySelector('.ui-person-card__skills')!.textContent).toBe('ab+1')
      expect(render({ skills: [] }).querySelector('.ui-person-card__skills')).toBeNull()
    })

    it('skills are plain badges without onSkillClick', () => {
      expect(render({ skills: ['GEOINT'] }).querySelector('button')).toBeNull()
    })

    it('with onSkillClick each skill is a button whose clicks and keys never reach onClick', () => {
      const onSkillClick = vi.fn()
      const onClick = vi.fn()
      const c = render({ skills: ['GEOINT', 'SIGINT'], onSkillClick, onClick })
      const buttons = Array.from(c.querySelectorAll('button.ui-person-card__skill')) as HTMLButtonElement[]
      expect(buttons.map((b) => b.textContent)).toEqual(['GEOINT', 'SIGINT'])
      act(() => buttons[1].click())
      expect(onSkillClick).toHaveBeenCalledWith('SIGINT')
      expect(onClick).not.toHaveBeenCalled()
      key(buttons[0], 'Enter')
      key(buttons[0], ' ')
      expect(onClick).not.toHaveBeenCalled()
    })

    it('tile centres its skills', () => {
      const c = render({ layout: 'tile', skills: ['GEOINT'] })
      expect((c.querySelector('.ui-person-card__skills') as HTMLElement).style.justifyContent).toBe('center')
    })
  })

  describe('interaction', () => {
    it('is static without onClick: no button role, not focusable', () => {
      const c = render()
      expect(card(c).getAttribute('role')).toBeNull()
      expect(card(c).hasAttribute('tabindex')).toBe(false)
      expect(card(c).hasAttribute('aria-label')).toBe(false)
      expect(card(c).classList.contains('ui-person-card--interactive')).toBe(false)
    })

    it('with onClick it is one focusable button named by the person; click, Enter and Space activate', () => {
      const onClick = vi.fn()
      const c = render({ onClick })
      expect(card(c).getAttribute('role')).toBe('button')
      expect(card(c).tabIndex).toBe(0)
      expect(card(c).getAttribute('aria-label')).toBe('Dana Ellis')
      expect(card(c).classList.contains('ui-person-card--interactive')).toBe(true)
      act(() => card(c).click())
      expect(onClick).toHaveBeenCalledTimes(1)
      expect(key(card(c), 'Enter').defaultPrevented).toBe(true)
      expect(onClick).toHaveBeenCalledTimes(2)
      expect(key(card(c), ' ').defaultPrevented).toBe(true)
      expect(onClick).toHaveBeenCalledTimes(3)
      key(card(c), 'a')
      expect(onClick).toHaveBeenCalledTimes(3)
    })

    it('tile activates from the keyboard the same way', () => {
      const onClick = vi.fn()
      const c = render({ layout: 'tile', onClick })
      key(card(c), 'Enter')
      expect(onClick).toHaveBeenCalledTimes(1)
    })

    it('ariaLabel overrides the accessible name', () => {
      const c = render({ onClick: () => {}, ariaLabel: 'View Dana Ellis in the directory' })
      expect(card(c).getAttribute('aria-label')).toBe('View Dana Ellis in the directory')
    })

    it('selected marks the card current with an accent border', () => {
      const c = render({ selected: true })
      expect(card(c).getAttribute('aria-current')).toBe('true')
      expect(card(c).style.border).toContain('var(--color-accent)')
      expect(card(c).classList.contains('ui-person-card--selected')).toBe(true)
      expect(card(render()).getAttribute('aria-current')).toBeNull()
    })
  })
})
