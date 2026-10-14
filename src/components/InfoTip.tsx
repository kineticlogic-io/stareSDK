import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { TbInfoCircle } from 'react-icons/tb'

/**
 * InfoTip — a small ⓘ beside a label that explains it, in a padded popover shown on hover or
 * keyboard focus (operator-approved 2026-09-29; extracted from OpenTrack, which used it for every
 * field hint).
 *
 * The popover is portaled to `document.body`, `position: fixed`, beside the icon: to its right,
 * or to its left when there is no room. Its `zIndex` (default 5100) sits **above `ui/Modal`
 * (5000)** — an InfoTip is usually inside a form, and forms are often inside a modal — and below
 * the toast stack (5500) and the classification banner (9999). This deliberately differs from the
 * map `Tooltip` (4200, below Modal), which labels map features and should stay under a modal.
 *
 * Pointer events are off on the popover, so it never steals the hover that shows it. The icon is a
 * focusable `role="button"` with an `aria-label` ("About <label>"), and the popover is
 * `role="tooltip"`, so keyboard users get the same text on focus.
 *
 * Takes its content as `children` (text or inline markup), and no app wiring.
 *
 * `interactive` (0.2.19, kineticlogic-io/OpenStare landing page): for a bubble that holds links or
 * other controls. The bubble then takes pointer input and stays open while the pointer moves from
 * the icon into it; a click (or Enter/Space) on the icon pins it open, Escape or a press outside
 * closes it, and its links are focusable and clickable. The bubble is then a `role="dialog"` named
 * by `label`, and the icon reports `aria-expanded`. Without `interactive` nothing changes.
 */

export interface InfoTipProps {
  /** What it explains, for the accessible name: "About <label>". */
  label: string
  children: ReactNode
  /** The popover's greatest width in pixels (default 320). */
  width?: number
  /** Stacking order of the popover. Default 5100 — above ui/Modal (5000), below toasts (5500). */
  zIndex?: number
  style?: CSSProperties
  /** The bubble holds links or controls: it takes pointer input, can be pinned open by a click,
   *  and closes on Escape or a press outside. Default `false`. 0.2.19+ */
  interactive?: boolean
}

const GAP = 8
/** How long an interactive bubble waits after the pointer leaves before closing (ms), so the
 *  pointer can cross the gap between the icon and the bubble. */
const LEAVE_GRACE_MS = 150

/** Where the popover goes beside an icon: right of it if it fits, else left, kept on screen. Exported for tests. */
export function infoTipPosition(
  icon: { left: number; right: number; top: number },
  width: number,
  viewportWidth: number,
): { left: number; top: number } {
  const fitsRight = icon.right + GAP + width <= viewportWidth - GAP
  return {
    left: fitsRight ? icon.right + GAP : Math.max(GAP, icon.left - GAP - width),
    top: Math.max(GAP, icon.top - 6),
  }
}

export function InfoTip({ label, children, width = 320, zIndex = 5100, style, interactive = false }: InfoTipProps) {
  const [at, setAt] = useState<{ left: number; top: number } | null>(null)
  const [hot, setHot] = useState(false)
  const [pinned, setPinned] = useState(false)
  const iconRef = useRef<HTMLSpanElement>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refocusing = useRef(false)
  // React portals bubble events through the React tree, so a click, key or focus inside the
  // bubble also reaches the icon's handlers: they act only on events from the icon itself.
  const fromIcon = (e: { target: EventTarget }) => iconRef.current?.contains(e.target as Node) ?? false

  const cancelLeave = () => {
    if (leaveTimer.current !== null) {
      clearTimeout(leaveTimer.current)
      leaveTimer.current = null
    }
  }
  const show = (el: HTMLElement) => {
    cancelLeave()
    setHot(true)
    setAt(infoTipPosition(el.getBoundingClientRect(), width, window.innerWidth))
  }
  const close = () => {
    cancelLeave()
    setPinned(false)
    setHot(false)
    setAt(null)
  }
  const hide = () => {
    if (!interactive) {
      setHot(false)
      setAt(null)
      return
    }
    if (pinned) return
    cancelLeave()
    leaveTimer.current = setTimeout(close, LEAVE_GRACE_MS)
  }
  const togglePin = (el: HTMLElement) => {
    if (pinned) {
      close()
    } else {
      show(el)
      setPinned(true)
    }
  }

  // An open interactive bubble closes on Escape or a press outside both the icon and the bubble.
  useEffect(() => {
    if (!interactive || !at) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const focusInBubble = bubbleRef.current?.contains(document.activeElement) ?? false
      close()
      // Return focus from the bubble to the icon without that focus reopening it.
      if (focusInBubble) {
        refocusing.current = true
        iconRef.current?.focus()
        refocusing.current = false
      }
    }
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node | null
      if (t && (iconRef.current?.contains(t) || bubbleRef.current?.contains(t))) return
      close()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- close only touches state setters and refs
  }, [interactive, at])

  useEffect(() => cancelLeave, [])

  const icon: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    verticalAlign: 'middle',
    marginLeft: 4,
    color: hot ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
    cursor: 'help',
    fontSize: 14,
    textTransform: 'none',
    letterSpacing: 'normal',
    outline: 'none',
    ...style,
  }
  const pop: CSSProperties = {
    position: 'fixed',
    left: at?.left,
    top: at?.top,
    maxWidth: width,
    zIndex,
    pointerEvents: interactive ? 'auto' : 'none',
    padding: 'var(--space-sm) var(--space-md)',
    background: 'var(--color-glass-bg)',
    border: '1px solid var(--color-glass-border)',
    borderRadius: 'var(--radius-sm)',
    boxShadow: 'var(--shadow-standard)',
    fontFamily: 'var(--font-sans)',
    fontSize: 12,
    fontWeight: 400,
    lineHeight: 1.5,
    color: 'var(--color-text-secondary)',
    textTransform: 'none',
    letterSpacing: 'normal',
  }

  return (
    <span
      ref={iconRef}
      tabIndex={0}
      role="button"
      aria-label={`About ${label}`}
      aria-expanded={interactive ? at !== null : undefined}
      style={icon}
      onMouseEnter={(e) => show(e.currentTarget)}
      onMouseLeave={hide}
      onFocus={(e) => {
        if (!fromIcon(e) || refocusing.current) return
        show(e.currentTarget)
      }}
      onBlur={(e) => {
        if (!fromIcon(e)) return
        // Focus moving into an interactive bubble (to a link) keeps it open.
        if (interactive && bubbleRef.current?.contains(e.relatedTarget as Node | null)) return
        hide()
      }}
      onClick={interactive ? (e) => { if (fromIcon(e)) togglePin(e.currentTarget) } : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (!fromIcon(e)) return
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                togglePin(e.currentTarget)
              }
            }
          : undefined
      }
    >
      <TbInfoCircle aria-hidden />
      {at &&
        createPortal(
          interactive ? (
            <div
              ref={bubbleRef}
              role="dialog"
              aria-label={label}
              style={pop}
              onMouseEnter={cancelLeave}
              onMouseLeave={hide}
              onBlur={(e) => {
                const next = e.relatedTarget as Node | null
                if (next && (bubbleRef.current?.contains(next) || iconRef.current?.contains(next))) return
                hide()
              }}
            >
              {children}
            </div>
          ) : (
            <div role="tooltip" style={pop}>
              {children}
            </div>
          ),
          document.body,
        )}
    </span>
  )
}
