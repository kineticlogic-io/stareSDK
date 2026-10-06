import type { CSSProperties, InputHTMLAttributes, Ref } from 'react'

/**
 * Canonical text input (D-20).
 *
 * ⚠ Roadmap criterion 4 was reworded by operator ruling (2026-08-11): "one canonical
 * `ui/Input`... with documented size variants, plus an explicitly named and justified
 * exception list" — not "one definition." This component is NOT greenfield and does NOT
 * supersede every input recipe in the codebase. Full exception list (87-UI-SPEC.md
 * Component Contracts §2):
 *
 *   1. `TacticalSymbolBuilder.tsx` `selectStyle`/`inputStyle` (Group C) — a monospace,
 *      28px/11px HUD-density recipe purpose-built for the tactical symbol builder's tight
 *      side-panel real estate. Forcing it to this component's 36px/13px default would be a
 *      VISIBLE regression (taller rows, less content visible). Stays local, not migrated.
 *   2. `openstare/src/utils/styles.ts`'s shared exports (`inputStyle`, `inputStyleFull`,
 *      `TEXTAREA_STYLE`, `btnStyle`, `glass`) — 13+ consumers across `wiki/`, `hud/`, and
 *      `analysis/`. Already a single, correctly-collapsed
 *      shared definition, not the local-redeclaration duplication D-20 targets. `utils/styles.ts`
 *      stays unchanged and un-deprecated; none of its consumers migrate to `ui/Input` in this
 *      phase — two legitimate, coexisting input-styling patterns is the intended end state.
 *
 * Default recipe = Group A (5-file admin-settings plurality: `BasemapSection`, `GenAiSection`,
 * `BannerSection`, `SamlSection`, `BeaconSection`). `size="lg"` reproduces Group B exactly
 * (`CreateUserModal`, `EditRoleModal`, `ResetPasswordModal`) — no call site loses its recipe,
 * it is named here instead.
 */

export type InputSize = 'md' | 'lg'

interface SizeRecipe {
  height: number
  fontSize: number
  padding: string
}

const SIZE: Record<InputSize, SizeRecipe> = {
  md: { height: 36, fontSize: 13, padding: '0 var(--space-sm)' },
  lg: { height: 44, fontSize: 14, padding: 'var(--space-sm) var(--space-md)' },
}

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: InputSize
  /** Applies the destructive border color. Additive — no current call site uses this. */
  error?: boolean
  /** React 19 ref-as-prop (no forwardRef needed). Additive — needed by call sites that
   *  autofocus the input on mount (e.g. `CreateUserModal`'s email field). */
  ref?: Ref<HTMLInputElement>
}

export function Input({ size = 'md', error = false, disabled = false, style, className, ref, ...rest }: InputProps) {
  const s = SIZE[size]
  const css: CSSProperties = {
    height: s.height,
    fontSize: s.fontSize,
    padding: s.padding,
    background: 'var(--surface-layer-2)',
    border: `1px solid ${error ? 'var(--color-destructive)' : 'var(--color-glass-border)'}`,
    borderRadius: 4,
    color: 'var(--color-text-primary)',
    fontFamily: 'var(--font-sans)',
    opacity: disabled ? 0.4 : 1,
    cursor: disabled ? 'not-allowed' : undefined,
    boxSizing: 'border-box',
    ...style,
  }
  return (
    <input
      ref={ref}
      disabled={disabled}
      className={className ? `ui-input ${className}` : 'ui-input'}
      style={css}
      {...rest}
    />
  )
}
