import { useCallback, useId, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { TbChevronDown, TbChevronUp } from 'react-icons/tb'

/**
 * Tray — a panel docked to the bottom of its container, like a browser's developer tools
 * (0.2.32, for OpenTrack's source workspace samples, kineticlogic-io/OpenTrack#104).
 *
 * Its header bar is always there: the title (a button that opens and closes the tray), any
 * `actions`, and a chevron. Open, the body sits under it at `height`, scrolls on its own, and the
 * tray is resized by dragging its top edge or, focused there, with the arrow keys (`Home`/`End`
 * for the limits).
 * The height can persist under `storageKey`. The tray takes no space beyond its own: place it last
 * in a flex column so the content above gives way.
 */
export interface TrayProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  /** Controls in the header bar, before the chevron (a view toggle, a count). Clicks stay inside. */
  actions?: ReactNode
  /** Body height in px when open (default 260); the user's resize wins when `storageKey` is set. */
  height?: number
  minHeight?: number
  maxHeight?: number
  /** localStorage key for the user-resized height. Omit to keep it for the session only. */
  storageKey?: string
  /** The tray's accessible name. */
  'aria-label': string
  style?: CSSProperties
  children: ReactNode
}

const HEADER = 32
const STEP = 24

function readHeight(key: string | undefined, fallback: number): number {
  if (!key) return fallback
  try {
    const n = Number(localStorage.getItem(key))
    return Number.isFinite(n) && n > 0 ? n : fallback
  } catch {
    return fallback
  }
}

function writeHeight(key: string | undefined, h: number) {
  if (!key) return
  try {
    localStorage.setItem(key, String(Math.round(h)))
  } catch {
    // Private mode or storage disabled: the height lasts for the session.
  }
}

export function Tray({
  open,
  onOpenChange,
  title,
  actions,
  height = 260,
  minHeight = 120,
  maxHeight = 640,
  storageKey,
  'aria-label': ariaLabel,
  style,
  children,
}: TrayProps) {
  const clamp = useCallback((h: number) => Math.min(maxHeight, Math.max(minHeight, h)), [minHeight, maxHeight])
  const [stored, setH] = useState(() => readHeight(storageKey, height))
  // Within the limits as they are now, even if they changed since.
  const h = clamp(stored)
  const drag = useRef<{ y: number; h: number } | null>(null)
  const bodyId = useId()

  const resize = (next: number) => {
    const v = clamp(next)
    setH(v)
    writeHeight(storageKey, v)
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    drag.current = { y: e.clientY, h }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    // Dragging up makes the tray taller.
    resize(drag.current.h + (drag.current.y - e.clientY))
  }
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = null
    e.currentTarget.releasePointerCapture?.(e.pointerId)
  }
  const onHandleKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const by: Record<string, number> = { ArrowUp: STEP, ArrowDown: -STEP }
    if (e.key in by) resize(h + by[e.key])
    else if (e.key === 'Home') resize(maxHeight)
    else if (e.key === 'End') resize(minHeight)
    else return
    e.preventDefault()
  }

  return (
    <section
      className="ui-tray"
      aria-label={ariaLabel}
      style={{
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        borderTop: '1px solid var(--color-glass-border)',
        background: 'var(--color-bg-secondary)',
        fontFamily: 'var(--font-sans)',
        ...style,
      }}
    >
      {open && (
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label={`Resize ${ariaLabel}`}
          aria-controls={bodyId}
          aria-valuemin={minHeight}
          aria-valuemax={maxHeight}
          aria-valuenow={Math.round(h)}
          tabIndex={0}
          className="ui-tray-handle"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onKeyDown={onHandleKey}
          style={{ height: 6, marginTop: -3, cursor: 'row-resize', touchAction: 'none', position: 'relative', zIndex: 1 }}
        />
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-sm)',
          height: HEADER,
          padding: '0 var(--space-sm) 0 var(--space-md)',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          className="ui-tray-toggle"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => onOpenChange(!open)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-sm)',
            flex: 1,
            minWidth: 0,
            height: '100%',
            padding: 0,
            border: 0,
            background: 'transparent',
            color: 'var(--color-text-secondary)',
            font: 'inherit',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            textAlign: 'left',
            cursor: 'pointer',
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
        </button>
        {actions != null && (
          <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
            {actions}
          </div>
        )}
        <button
          type="button"
          aria-label={open ? `Close ${ariaLabel}` : `Open ${ariaLabel}`}
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => onOpenChange(!open)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            padding: 0,
            border: 0,
            background: 'transparent',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
          }}
        >
          {open ? <TbChevronDown aria-hidden /> : <TbChevronUp aria-hidden />}
        </button>
      </div>
      <div id={bodyId} hidden={!open} className="ui-tray-body" style={{ height: h, overflow: 'auto', minHeight: 0 }}>
        {open && children}
      </div>
    </section>
  )
}
