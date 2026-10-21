// @vitest-environment jsdom
/**
 * ItemCard tests — React 19 createRoot + act + native DOM events (project convention).
 */
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { createPortal } from 'react-dom'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { TbMap2 } from 'react-icons/tb'
import { ItemCard } from './ItemCard.js'
import type { ItemCardProps } from './ItemCard.js'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const cleanups: Array<() => void> = []
afterEach(() => {
  cleanups.splice(0).forEach((f) => f())
})

const BASE: ItemCardProps = {
  typeIcon: <TbMap2 />,
  typeLabel: 'Layer',
  title: 'Port of Rotterdam AIS',
  subtitle: 'Vector layer · 1,204 features',
  description: 'Vessel positions around the port.',
}

function render(props: Partial<ItemCardProps> = {}) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => root.render(<ItemCard {...BASE} {...props} />))
  cleanups.push(() => {
    act(() => root.unmount())
    container.remove()
  })
  return container
}

const card = (c: HTMLElement) => c.querySelector('.ui-item-card') as HTMLElement

function key(el: HTMLElement, k: string) {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })
  act(() => {
    el.dispatchEvent(e)
  })
  return e
}

describe('ItemCard', () => {
  it('renders the title, sub-caption, description and labelled type icon', () => {
    const c = render()
    expect(c.querySelector('.ui-item-card__title')!.textContent).toBe('Port of Rotterdam AIS')
    expect(c.textContent).toContain('Vector layer · 1,204 features')
    expect(c.textContent).toContain('Vessel positions around the port.')
    const icon = c.querySelector('[role="img"][aria-label="Layer"]') as HTMLElement
    expect(icon).not.toBeNull()
    expect(icon.title).toBe('Layer')
  })

  it('clamps the description to three lines', () => {
    const c = render()
    const d = c.querySelector('.ui-item-card__description') as HTMLElement
    expect(d.style.overflow).toBe('hidden')
  })

  it('is static without onClick: no button role, not focusable', () => {
    const c = render()
    expect(card(c).getAttribute('role')).toBeNull()
    expect(card(c).hasAttribute('tabindex')).toBe(false)
    expect(card(c).classList.contains('ui-item-card--interactive')).toBe(false)
  })

  it('with onClick it is one focusable button named by its title; click, Enter and Space activate', () => {
    const onClick = vi.fn()
    const c = render({ onClick })
    expect(card(c).getAttribute('role')).toBe('button')
    expect(card(c).tabIndex).toBe(0)
    expect(card(c).getAttribute('aria-label')).toBe('Port of Rotterdam AIS')
    act(() => card(c).click())
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(key(card(c), 'Enter').defaultPrevented).toBe(true)
    expect(onClick).toHaveBeenCalledTimes(2)
    expect(key(card(c), ' ').defaultPrevented).toBe(true)
    expect(onClick).toHaveBeenCalledTimes(3)
    key(card(c), 'a')
    expect(onClick).toHaveBeenCalledTimes(3)
  })

  it('ariaLabel overrides the accessible name', () => {
    const c = render({ onClick: () => {}, ariaLabel: 'View details for Port of Rotterdam AIS' })
    expect(card(c).getAttribute('aria-label')).toBe('View details for Port of Rotterdam AIS')
  })

  it('selected marks the card current with an accent border', () => {
    const c = render({ selected: true })
    expect(card(c).getAttribute('aria-current')).toBe('true')
    expect(card(c).style.border).toContain('var(--color-accent)')
    expect(render({}).querySelector('.ui-item-card')!.getAttribute('aria-current')).toBeNull()
  })

  it('renders the badges and the owner (avatar falls back to initials)', () => {
    const c = render({
      badges: <span data-testid="badge">PUBLIC</span>,
      owner: { name: 'Dana Analyst' },
    })
    expect(c.querySelector('[data-testid="badge"]')).not.toBeNull()
    const owner = c.querySelector('.ui-item-card__owner') as HTMLElement
    expect(owner.textContent).toContain('Dana Analyst')
    expect(owner.querySelector('[role="img"]')!.getAttribute('aria-label')).toBe('Dana Analyst')
  })

  it('renders the owner avatar image when given', () => {
    const c = render({ owner: { name: 'Dana', avatarSrc: '/avatars/dana.png' } })
    const img = c.querySelector('.ui-item-card__owner img') as HTMLImageElement
    expect(img.getAttribute('src')).toBe('/avatars/dana.png')
  })

  it('renders meta as given', () => {
    const c = render({ meta: 'Updated 5m ago' })
    expect(c.querySelector('.ui-item-card__meta')!.textContent).toBe('Updated 5m ago')
  })

  it('shows up to maxTags (default 4), then a +N badge naming the rest', () => {
    const c = render({ tags: ['a', 'b', 'c', 'd', 'e', 'f'] })
    const tags = c.querySelector('.ui-item-card__tags') as HTMLElement
    expect(tags.textContent).toBe('abcd+2')
    expect((tags.lastElementChild as HTMLElement).title).toBe('e, f')
    const two = render({ tags: ['a', 'b', 'c'], maxTags: 2 })
    expect(two.querySelector('.ui-item-card__tags')!.textContent).toBe('ab+1')
    const none = render({ tags: [] })
    expect(none.querySelector('.ui-item-card__tags')).toBeNull()
  })

  it('tags are plain badges without onTagClick, buttons with it', () => {
    expect(render({ tags: ['maritime'] }).querySelector('.ui-item-card__tag')).toBeNull()
    const onTagClick = vi.fn()
    const onClick = vi.fn()
    const c = render({ tags: ['maritime', 'ais'], onTagClick, onClick })
    const buttons = Array.from(c.querySelectorAll('button.ui-item-card__tag')) as HTMLButtonElement[]
    expect(buttons.map((b) => b.textContent)).toEqual(['maritime', 'ais'])
    act(() => buttons[1].click())
    expect(onTagClick).toHaveBeenCalledWith('ais')
    expect(onClick).not.toHaveBeenCalled()
    key(buttons[0], 'Enter')
    expect(onClick).not.toHaveBeenCalled()
  })

  it('clicks and keys inside the actions slot never reach onClick', () => {
    const onClick = vi.fn()
    const onMenu = vi.fn()
    const c = render({ onClick, actions: <button type="button" aria-label="More actions" onClick={onMenu} /> })
    const menu = c.querySelector('button[aria-label="More actions"]') as HTMLButtonElement
    act(() => menu.click())
    expect(onMenu).toHaveBeenCalledTimes(1)
    key(menu, 'Enter')
    key(menu, ' ')
    expect(onClick).not.toHaveBeenCalled()
  })

  it('a click inside something the actions slot portals (a kebab menu) never reaches onClick', () => {
    const onClick = vi.fn()
    const onItem = vi.fn()
    const c = render({
      onClick,
      actions: createPortal(<button type="button" data-testid="portaled" onClick={onItem} />, document.body),
    })
    const item = document.querySelector('[data-testid="portaled"]') as HTMLButtonElement
    act(() => item.click())
    expect(onItem).toHaveBeenCalledTimes(1)
    expect(onClick).not.toHaveBeenCalled()
    expect(c).toBeTruthy()
  })

  it('selectable shows a labelled checkbox that reports its state without triggering onClick', () => {
    const onClick = vi.fn()
    const onCheckedChange = vi.fn()
    const c = render({ onClick, selectable: true, checked: false, onCheckedChange })
    const box = c.querySelector('input[type="checkbox"]') as HTMLInputElement
    expect(box.getAttribute('aria-label')).toBe('Select Port of Rotterdam AIS')
    act(() => box.click())
    expect(onCheckedChange).toHaveBeenCalledWith(true)
    expect(onClick).not.toHaveBeenCalled()
    key(box, ' ')
    expect(onClick).not.toHaveBeenCalled()
  })

  it('selectLabel overrides the checkbox name; no checkbox unless selectable', () => {
    const c = render({ selectable: true, checked: true, selectLabel: 'Select row', onCheckedChange: () => {} })
    const box = c.querySelector('input[type="checkbox"]') as HTMLInputElement
    expect(box.getAttribute('aria-label')).toBe('Select row')
    expect(box.checked).toBe(true)
    expect(render({}).querySelector('input[type="checkbox"]')).toBeNull()
  })

  it('the favorite star renders only with onFavoriteChange and toggles without triggering onClick', () => {
    expect(render({ favorite: true }).querySelector('button[aria-pressed]')).toBeNull()
    const onClick = vi.fn()
    const onFavoriteChange = vi.fn()
    const c = render({ onClick, favorite: false, onFavoriteChange })
    const star = c.querySelector('button[aria-pressed]') as HTMLButtonElement
    expect(star.getAttribute('aria-label')).toBe('Favorite')
    expect(star.getAttribute('aria-pressed')).toBe('false')
    act(() => star.click())
    expect(onFavoriteChange).toHaveBeenCalledWith(true)
    expect(onClick).not.toHaveBeenCalled()
    key(star, 'Enter')
    expect(onClick).not.toHaveBeenCalled()
  })

  it('a favorited star is pressed, filled in the warning tone, and turns off on click', () => {
    const onFavoriteChange = vi.fn()
    const c = render({ favorite: true, onFavoriteChange, favoriteLabel: 'Add to favorites' })
    const star = c.querySelector('button[aria-pressed]') as HTMLButtonElement
    expect(star.getAttribute('aria-pressed')).toBe('true')
    expect(star.getAttribute('aria-label')).toBe('Add to favorites')
    expect(star.style.color).toBe('var(--status-warning)')
    act(() => star.click())
    expect(onFavoriteChange).toHaveBeenCalledWith(false)
  })

  describe('layouts', () => {
    it('row (default) is a horizontal card with no thumbnail unless one is given', () => {
      const c = render()
      expect(card(c).dataset.layout).toBe('row')
      expect(card(c).classList.contains('ui-item-card--row')).toBe(true)
      expect(card(c).style.flexDirection).toBe('row')
      expect(c.querySelector('.ui-item-card__thumb')).toBeNull()
    })

    it('row shows a given thumbnail as a small leading preview', () => {
      const c = render({ thumbnailSrc: '/thumb.png', thumbnailAlt: 'Port overview' })
      const thumb = c.querySelector('.ui-item-card__thumb') as HTMLElement
      expect(thumb.style.width).toBe('96px')
      expect(card(c).firstElementChild).toBe(thumb)
      const img = thumb.querySelector('img') as HTMLImageElement
      expect(img.alt).toBe('Port overview')
    })

    it('row puts the selection checkbox at the leading corner', () => {
      const c = render({ selectable: true, onCheckedChange: () => {}, thumbnailSrc: '/thumb.png' })
      expect(card(c).firstElementChild!.querySelector('input[type="checkbox"]')).not.toBeNull()
    })

    it('tile is a column with the thumbnail across the top', () => {
      const c = render({ layout: 'tile', thumbnailSrc: '/thumb.png', thumbnailAlt: 'Port overview' })
      expect(card(c).dataset.layout).toBe('tile')
      expect(card(c).style.flexDirection).toBe('column')
      const thumb = c.querySelector('.ui-item-card__thumb') as HTMLElement
      expect(thumb.style.width).toBe('100%')
      expect(thumb.querySelector('img')!.getAttribute('src')).toBe('/thumb.png')
    })

    it('tile without a thumbnail shows the type icon in a neutral placeholder', () => {
      const c = render({ layout: 'tile' })
      const ph = c.querySelector('.ui-item-card__thumb--placeholder') as HTMLElement
      expect(ph).not.toBeNull()
      expect(ph.getAttribute('aria-hidden')).toBe('true')
      expect(ph.style.background).toBe('var(--surface-layer-2)')
      expect(ph.querySelector('svg')).not.toBeNull()
    })

    it('tile falls back to the placeholder when the thumbnail fails to load', () => {
      const c = render({ layout: 'tile', thumbnailSrc: '/missing.png' })
      act(() => {
        c.querySelector('.ui-item-card__thumb img')!.dispatchEvent(new Event('error'))
      })
      expect(c.querySelector('.ui-item-card__thumb--placeholder')).not.toBeNull()
    })

    it('tile shows its title, description and owner, and clips without becoming a scroll container', () => {
      // `overflow: hidden` made the tile a scroll container (automatic minimum height 0), so a grid
      // of auto rows in a height-limited scroller squeezed every tile to its thumbnail: blank cards.
      const c = render({ layout: 'tile', owner: { name: 'Dana Analyst' } })
      expect(c.querySelector('.ui-item-card__title')!.textContent).toBe('Port of Rotterdam AIS')
      expect(c.querySelector('.ui-item-card__description')!.textContent).toBe('Vessel positions around the port.')
      expect(c.querySelector('.ui-item-card__owner')!.textContent).toContain('Dana Analyst')
      expect(card(c).style.overflow).toBe('clip')
      expect(card(c).style.height).toBe('100%')
    })

    it('size lg makes a larger tile: a taller 3:2 thumbnail, bigger title, four description lines', () => {
      const md = render({ layout: 'tile' })
      const lg = render({ layout: 'tile', size: 'lg' })
      expect((md.querySelector('.ui-item-card__thumb') as HTMLElement).style.aspectRatio).toBe('16 / 9')
      expect((lg.querySelector('.ui-item-card__thumb') as HTMLElement).style.aspectRatio).toBe('3 / 2')
      expect(card(lg).classList.contains('ui-item-card--lg')).toBe(true)
      expect(card(md).classList.contains('ui-item-card--lg')).toBe(false)
      expect((lg.querySelector('.ui-item-card__title') as HTMLElement).style.fontSize).toBe('16px')
      expect((lg.querySelector('.ui-item-card__description') as HTMLElement).style.webkitLineClamp).toBe('4')
    })

    it('a row ignores size', () => {
      const c = render({ size: 'lg' })
      expect(card(c).classList.contains('ui-item-card--lg')).toBe(false)
      expect((c.querySelector('.ui-item-card__title') as HTMLElement).style.fontSize).toBe('14px')
    })

    it('tile overlays the selection checkbox on the thumbnail corner', () => {
      const c = render({ layout: 'tile', selectable: true, onCheckedChange: () => {} })
      const wrap = c.querySelector('input[type="checkbox"]')!.parentElement as HTMLElement
      expect(wrap.style.position).toBe('absolute')
      // Positioned over the thumbnail's own box, so a banner above it never sits under the checkbox.
      const box = wrap.parentElement as HTMLElement
      expect(box.style.position).toBe('relative')
      expect(box.querySelector('.ui-item-card__thumb')).not.toBeNull()
      expect(box.parentElement).toBe(card(c))
    })

    it('no banner renders no banner strip', () => {
      expect(render().querySelector('.ui-item-card__banner')).toBeNull()
      expect(render({ layout: 'tile' }).querySelector('.ui-item-card__banner')).toBeNull()
    })

    it('a tile shows its banner across the top edge, above the thumbnail and the checkbox', () => {
      const c = render({ layout: 'tile', selectable: true, onCheckedChange: () => {}, banner: <div role="note">SECRET</div> })
      const strip = c.querySelector('.ui-item-card__banner') as HTMLElement
      expect(card(c).firstElementChild).toBe(strip)
      expect(strip.textContent).toBe('SECRET')
      expect(strip.nextElementSibling!.querySelector('.ui-item-card__thumb')).not.toBeNull()
      expect(strip.querySelector('input[type="checkbox"]')).toBeNull()
    })

    it('a row with a banner stacks the strip over the row content', () => {
      const c = render({ thumbnailSrc: '/thumb.png', selectable: true, onCheckedChange: () => {}, banner: <div role="note">SECRET</div> })
      const strip = c.querySelector('.ui-item-card__banner') as HTMLElement
      expect(card(c).style.flexDirection).toBe('column')
      expect(card(c).firstElementChild).toBe(strip)
      const row = strip.nextElementSibling as HTMLElement
      expect(row.style.flexDirection).toBe('row')
      expect(row.querySelector('input[type="checkbox"]')).not.toBeNull()
      expect(row.querySelector('.ui-item-card__thumb')).not.toBeNull()
      expect(row.querySelector('.ui-item-card__title')!.textContent).toBe('Port of Rotterdam AIS')
    })

    it('a click on the banner activates the card like any other part of it', () => {
      const onClick = vi.fn()
      const c = render({ layout: 'tile', onClick, banner: <div role="note">SECRET</div> })
      act(() => (c.querySelector('.ui-item-card__banner') as HTMLElement).click())
      expect(onClick).toHaveBeenCalledTimes(1)
    })

    it('tile keeps the slots isolated from onClick too', () => {
      const onClick = vi.fn()
      const onFavoriteChange = vi.fn()
      const onCheckedChange = vi.fn()
      const onTagClick = vi.fn()
      const c = render({
        layout: 'tile', onClick, onFavoriteChange, selectable: true, onCheckedChange, tags: ['x'], onTagClick,
        actions: <button type="button" aria-label="More actions" />,
      })
      act(() => (c.querySelector('button[aria-pressed]') as HTMLButtonElement).click())
      act(() => (c.querySelector('input[type="checkbox"]') as HTMLInputElement).click())
      act(() => (c.querySelector('button.ui-item-card__tag') as HTMLButtonElement).click())
      act(() => (c.querySelector('button[aria-label="More actions"]') as HTMLButtonElement).click())
      expect(onFavoriteChange).toHaveBeenCalledTimes(1)
      expect(onCheckedChange).toHaveBeenCalledTimes(1)
      expect(onTagClick).toHaveBeenCalledTimes(1)
      expect(onClick).not.toHaveBeenCalled()
      act(() => card(c).click())
      expect(onClick).toHaveBeenCalledTimes(1)
    })
  })
})
