import type { ReactNode, MouseEventHandler, CSSProperties } from 'react'
import { Button, type ButtonVariant } from './Button'

/**
 * PopoverMenuButton — the single shared shape for a kebab/dropdown popover menu
 * item (icon + left-reading label, full width of the popover).
 *
 * Checkpoint fix (2026-07-10, operator feedback item 1): menu item content was
 * previously left-aligned via a `justify="flex-start"` prop repeated at every
 * `<Button>` call site (GisLayerRow's kebab). That's a per-item hack — easy to
 * forget on the next popover item, and GisImageryRow's kebab used a hand-rolled
 * raw `<button>` that skipped the ui/Button design system entirely. This
 * component is the single shared source: every popover menu item renders
 * through here, so left-alignment (and ghost/sm/fullWidth chrome) can never
 * drift per-callsite again.
 */
export interface PopoverMenuButtonProps {
  icon?: ReactNode
  children: ReactNode
  onClick: MouseEventHandler<HTMLButtonElement>
  variant?: ButtonVariant
  disabled?: boolean
  'aria-label'?: string
  /**
   * Optional style override merged onto the underlying Button — e.g. a "text color only"
   * destructive tint (red icon/label, still ghost background) for a genuinely-destructive
   * item that should NOT get `variant="danger"`'s solid filled treatment (Phase 63 service
   * group Delete kebab item, 63-UI-SPEC Copywriting Contract). Every other popover item in
   * the app stays uniform ghost — use sparingly.
   */
  style?: CSSProperties
  /** NEW (Phase 117): native tooltip, forwarded to the underlying Button's `title` attribute.
   *  Used for the disabled-Filter-item explanatory tooltip (FILT-04/D-15) — the same `title`
   *  idiom already used throughout GisLayerRow.tsx's row-level controls (e.g. the read-only
   *  visibility toggle). */
  title?: string
  /** NEW (Phase 125): explicit ARIA role, e.g. `role="menuitem"` inside a `role="menu"`
   *  popover. PopoverMenuButtonProps does not extend ButtonHTMLAttributes, so without this
   *  a caller cannot label its items without dropping back to a raw <button> — which is the
   *  exact hand-rolling this component exists to prevent. Purely additive: omitted by every
   *  existing caller, so no rendered output changes. */
  role?: string
}

export function PopoverMenuButton({
  icon,
  children,
  onClick,
  variant = 'ghost',
  disabled = false,
  style,
  title,
  role,
  ...rest
}: PopoverMenuButtonProps) {
  return (
    <Button
      variant={variant}
      size="sm"
      fullWidth
      justify="flex-start"
      icon={icon}
      onClick={onClick}
      disabled={disabled}
      style={style}
      title={title}
      role={role}
      {...rest}
    >
      {children}
    </Button>
  )
}
