import type { CSSProperties } from 'react'

/** Height of each classification strip, in px. Hosts reserve it via `--banner-height`. */
export const BANNER_HEIGHT_PX = 19

/**
 * Classification banner: identical fixed strips at the top and bottom of the viewport, above
 * everything else (z-index 9999). Props only (#31): the host app supplies the configured marking
 * and colors. Renders nothing when `enabled` is false.
 */
export interface ClassificationBannerProps {
  enabled: boolean
  /** The marking, e.g. `UNCLASSIFIED`. */
  text: string
  background: string
  color: string
}

export function ClassificationBanner({ enabled, text, background, color }: ClassificationBannerProps) {
  if (!enabled) return null

  const style: CSSProperties = {
    position: 'fixed',
    left: 0,
    right: 0,
    height: BANNER_HEIGHT_PX,
    zIndex: 9999,
    background,
    color,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'var(--font-sans)',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    userSelect: 'none',
    pointerEvents: 'none',
  }

  return (
    <>
      <div style={{ ...style, top: 0 }}>{text}</div>
      <div style={{ ...style, bottom: 0 }}>{text}</div>
    </>
  )
}
