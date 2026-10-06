import type { MouseEvent } from 'react'

/**
 * Click handler for an SDK component that renders a real `<a href>` but lets the host app route
 * it (#31): the SDK never depends on a router. A plain left click is handed to `onNavigate`
 * (client-side routing); a modified click (Ctrl/⌘/Shift/Alt, or a non-primary button) keeps the
 * browser's own behavior, so "open in new tab" still works. Without `onNavigate` the link is an
 * ordinary link.
 */
export function navigationClickHandler(
  href: string,
  onNavigate: ((href: string) => void) | undefined,
): ((event: MouseEvent<HTMLAnchorElement>) => void) | undefined {
  if (!onNavigate) return undefined
  return event => {
    if (event.defaultPrevented || event.button !== 0) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    onNavigate(href)
  }
}
