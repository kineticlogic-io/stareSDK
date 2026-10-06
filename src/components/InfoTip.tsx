import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
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
 * Takes its content as `children` (text or inline markup, e.g. a link to the app's help), and no
 * app wiring.
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
}

const GAP = 8

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

export function InfoTip({ label, children, width = 320, zIndex = 5100, style }: InfoTipProps) {
  const [at, setAt] = useState<{ left: number; top: number } | null>(null)
  const [hot, setHot] = useState(false)
  const show = (el: HTMLElement) => {
    setHot(true)
    setAt(infoTipPosition(el.getBoundingClientRect(), width, window.innerWidth))
  }
  const hide = () => {
    setHot(false)
    setAt(null)
  }

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
    pointerEvents: 'none',
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
      tabIndex={0}
      role="button"
      aria-label={`About ${label}`}
      style={icon}
      onMouseEnter={(e) => show(e.currentTarget)}
      onMouseLeave={hide}
      onFocus={(e) => show(e.currentTarget)}
      onBlur={hide}
    >
      <TbInfoCircle aria-hidden />
      {at &&
        createPortal(
          <div role="tooltip" style={pop}>
            {children}
          </div>,
          document.body,
        )}
    </span>
  )
}
