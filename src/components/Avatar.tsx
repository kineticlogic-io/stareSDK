import { useState } from 'react'
import type { CSSProperties } from 'react'

/**
 * Shared circular avatar primitive (88-10, D-23/D-37).
 *
 * Fallback chain: `src` (resolved by the host app, #31) renders an `<img>`; a runtime
 * `onError` on that `<img>` — or the absence of any image source — falls back to a flat
 * `--brand-subtle` initials circle. The fallback is a designed treatment (green glyph on a
 * green-tinted wash), never a broken-image glyph — see 88-UI-SPEC.md "New Shared Component —
 * ui/Avatar" for the full contract this file implements verbatim.
 *
 * Consumed at four sizes across this phase: 28 (header pill, admin table), 40 (pill popover),
 * 96 (/account Identity card preview). The font-size lookup below is intentionally a fixed,
 * bounded table — never a ratio formula — so an unlisted diameter can never produce a novel
 * glyph size.
 */

const INITIALS_FONT_SIZE: Record<number, number> = { 28: 12, 40: 16, 96: 32 }

/** Nearest table key to `size` by absolute numeric difference. Never generates a novel size. */
function nearestFontSize(size: number): number {
  const keys = Object.keys(INITIALS_FONT_SIZE).map(Number)
  let best = keys[0]
  let bestDiff = Math.abs(size - best)
  for (const key of keys) {
    const diff = Math.abs(size - key)
    if (diff < bestDiff) {
      best = key
      bestDiff = diff
    }
  }
  return INITIALS_FONT_SIZE[best]
}

function deriveInitials(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  username: string
): string {
  const first = firstName?.[0]
  const last = lastName?.[0]
  if (first && last) return (first + last).toUpperCase()
  if (first) return first.toUpperCase()
  if (last) return last.toUpperCase()
  return username[0]?.toUpperCase() ?? ''
}

export interface AvatarProps {
  /** Square bounding box in px; always rendered circular. */
  size: number
  /** Image URL, resolved by the host app (#31). Absent, empty, or failing to load → initials. */
  src?: string | null
  firstName?: string | null
  lastName?: string | null
  /** Always available — the final link in the initials chain. */
  username: string
  /** Defaults to `${displayName} avatar`. */
  alt?: string
  style?: CSSProperties
}

export function Avatar({
  size,
  src,
  firstName,
  lastName,
  username,
  alt,
  style,
}: AvatarProps) {
  const resolvedSrc = src || null
  const [imgFailed, setImgFailed] = useState(false)
  // A newly-picked avatar (changed src) deserves a fresh attempt. This is the
  // React-documented "adjusting state when a prop changes" pattern — setting state during
  // render (not inside an effect) so the reset happens in the same render pass as the change,
  // with no extra cascading re-render.
  const [trackedSrc, setTrackedSrc] = useState(resolvedSrc)
  if (resolvedSrc !== trackedSrc) {
    setTrackedSrc(resolvedSrc)
    setImgFailed(false)
  }

  const displayName = firstName && lastName ? `${firstName} ${lastName}` : username
  const resolvedAlt = alt ?? `${displayName} avatar`

  const ringStyle: CSSProperties = {
    width: size,
    height: size,
    borderRadius: '50%',
    border: '1px solid var(--color-glass-border)',
    flexShrink: 0,
  }

  if (resolvedSrc && !imgFailed) {
    return (
      <img
        src={resolvedSrc}
        alt={resolvedAlt}
        onError={() => setImgFailed(true)}
        style={{
          ...ringStyle,
          objectFit: 'cover',
          ...style,
        }}
      />
    )
  }

  const initials = deriveInitials(firstName, lastName, username)

  return (
    <div
      role="img"
      aria-label={resolvedAlt}
      style={{
        ...ringStyle,
        background: 'var(--brand-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-accent)',
        fontFamily: 'var(--font-sans)',
        fontWeight: 600,
        lineHeight: 1,
        fontSize: nearestFontSize(size),
        ...style,
      }}
    >
      {initials}
    </div>
  )
}
