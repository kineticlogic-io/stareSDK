/**
 * useDraggable — shared drag-to-move + position-persistence for floating panels.
 *
 * Used by DraggablePopup (the shared draggable-popup shell, e.g. FeatureAttributePopup,
 * TrackResultsList) so every floating panel uses the same draggable behaviour and
 * remembers where the operator put it (localStorage).
 *
 * Usage:
 *   const { pos, dragHandleProps } = useDraggable('mykey', () => ({ x: 40, y: 80 }))
 *   <div style={{ position:'fixed', left: pos.x, top: pos.y }}>
 *     <header {...dragHandleProps}>drag me</header>
 *   </div>
 */

import { useState, useRef, useEffect, useCallback } from 'react'

export interface DragPos { x: number; y: number }

/**
 * Minimum top (px) a draggable panel may occupy: the fixed page header height.
 * Without this floor a panel can be dragged up underneath the header, where its
 * own drag handle becomes unreachable. Matches --page-header-height (default 52,
 * post-checkpoint operator revision, 88-11, 2026-08-13).
 */
const HEADER_OFFSET = 52

function clampPos(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), Math.max(lo, hi))
}

export function useDraggable(storageKey: string, getDefault: () => DragPos) {
  const [pos, setPos] = useState<DragPos>(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const p = JSON.parse(raw) as DragPos
        if (typeof p?.x === 'number' && typeof p?.y === 'number') {
          return {
            x: clampPos(p.x, 0, window.innerWidth - 80),
            y: clampPos(p.y, HEADER_OFFSET, window.innerHeight - 40),
          }
        }
      }
    } catch { /* ignore malformed storage */ }
    return getDefault()
  })

  const draggingRef = useRef(false)
  const offsetRef = useRef({ dx: 0, dy: 0 })

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    draggingRef.current = true
    offsetRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y }
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId) } catch { /* noop */ }
    e.preventDefault()
  }, [pos.x, pos.y])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return
    const x = clampPos(e.clientX - offsetRef.current.dx, 0, window.innerWidth - 80)
    const y = clampPos(e.clientY - offsetRef.current.dy, HEADER_OFFSET, window.innerHeight - 40)
    setPos({ x, y })
  }, [])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return
    draggingRef.current = false
    try { (e.currentTarget as Element).releasePointerCapture(e.pointerId) } catch { /* noop */ }
    setPos(p => {
      try { localStorage.setItem(storageKey, JSON.stringify(p)) } catch { /* ignore */ }
      return p
    })
  }, [storageKey])

  // Keep the panel on-screen if the window shrinks.
  useEffect(() => {
    function onResize() {
      setPos(p => ({
        x: clampPos(p.x, 0, window.innerWidth - 80),
        y: clampPos(p.y, HEADER_OFFSET, window.innerHeight - 40),
      }))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const dragHandleProps = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    style: { cursor: 'move' as const, touchAction: 'none' as const },
  }

  return { pos, dragHandleProps }
}
