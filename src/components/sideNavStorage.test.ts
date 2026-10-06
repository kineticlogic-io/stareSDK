import { describe, it, expect, beforeEach } from 'vitest'
import { sideNavOpenKey, readSideNavOpen, writeSideNavOpen } from './sideNavStorage'

describe('sideNavStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('derives the storage key by appending .open', () => {
    expect(sideNavOpenKey('assistant.width')).toBe('assistant.width.open')
  })

  it('round-trips true', () => {
    writeSideNavOpen('assistant.width', true)
    expect(readSideNavOpen('assistant.width', false)).toBe(true)
  })

  it('round-trips false', () => {
    writeSideNavOpen('assistant.width', true)
    writeSideNavOpen('assistant.width', false)
    expect(readSideNavOpen('assistant.width', true)).toBe(false)
  })

  it('returns the fallback and writes nothing when storageKey is undefined', () => {
    writeSideNavOpen(undefined, true)
    expect(readSideNavOpen(undefined, false)).toBe(false)
    expect(readSideNavOpen(undefined, true)).toBe(true)
    expect(localStorage.length).toBe(0)
  })

  it('returns the fallback when the key is absent', () => {
    expect(readSideNavOpen('never-written.width', true)).toBe(true)
    expect(readSideNavOpen('never-written.width', false)).toBe(false)
  })

  it.each(['yes', '380', ''])('returns the fallback for a garbage stored value %j', garbage => {
    localStorage.setItem(sideNavOpenKey('atlas.toolsPanel.width'), garbage)
    expect(readSideNavOpen('atlas.toolsPanel.width', true)).toBe(true)
    expect(readSideNavOpen('atlas.toolsPanel.width', false)).toBe(false)
  })

  it('returns the fallback and does not throw when localStorage.getItem throws', () => {
    const original = Storage.prototype.getItem
    Storage.prototype.getItem = () => {
      throw new Error('storage disabled')
    }
    try {
      expect(readSideNavOpen('assistant.width', true)).toBe(true)
    } finally {
      Storage.prototype.getItem = original
    }
  })

  it('does not throw when localStorage.setItem throws', () => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = () => {
      throw new Error('quota exceeded')
    }
    try {
      expect(() => writeSideNavOpen('assistant.width', true)).not.toThrow()
    } finally {
      Storage.prototype.setItem = original
    }
  })
})
