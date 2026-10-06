import type { CSSProperties, LabelHTMLAttributes } from 'react'

/**
 * Canonical field label (D-20).
 *
 * ⚠ Same roadmap criterion 4 caveat as `ui/Input`: this does not deliver a single universal
 * definition. Named, justified exceptions (87-UI-SPEC.md Component Contracts §3):
 *
 *   1. `FileDropZone.tsx` (`components/ui/`) — uses `var(--font-mono)`, a pre-existing,
 *      undocumented deviation that predates this phase. Fixing it is scope creep beyond D-20's
 *      approval; left untouched.
 *   2. `ImageryLayerControls.tsx` — a compact HUD row caption (9px, mono, no uppercase/weight
 *      declared) purpose-built for a dense metadata panel, not a form-field label. Forcing it
 *      into this component would be a VISIBLE regression. Stays a local style, not migrated.
 *   3. `components/analysis/formStyles.ts`'s exported `labelStyle` — same mono-font deviation as
 *      `FileDropZone.tsx` (`fontFamily: 'var(--font-mono)'`), shared by the Analysis workspace's
 *      form surfaces. Same disposition: pre-existing, out of D-20's approval, left untouched.
 *
 * Default recipe = 11px/600/uppercase/0.08em/marginBottom 4 — also CLAUDE.md's own canonical
 * Tables reference (`UserManagementTab.tsx`). `size="sm"` reproduces the HUD-compact group
 * (10px/marginBottom 2) exactly.
 *
 * Migrated onto this primitive (87-19): `SecuritySection`, `DbSection`, `UnitsSection`,
 * `GeneralSettingsSection` (default size); `MissionOrderForm`, `ConfigurationUpdateForm`
 * (`size="sm"`, both removed along with the APEX command-dispatch UI in Phase 102, D-02);
 * `InfoboxEditForm`, `ReclassifyModal`, `AddLocalAttributeModal`, `ArticleInfobox`
 * (default size, wiki field-label group — letter-spacing moved 0.06em -> 0.08em, a documented
 * SUBTLE change).
 *
 * ⚠ NOT YET migrated — byte-identical local `labelStyle`/`fieldLabelStyle` consts remain in
 * `GenAiSection.tsx`, `BannerSection.tsx`, `BeaconSection.tsx`, `SamlSection.tsx` (all
 * default-recipe-shaped) and `DisconnectedModeToggle.tsx` (same recipe minus an explicit
 * `marginBottom`, defaulting to 0). These are OUT OF 87-19's file scope (not listed in its
 * `files_modified`), not named exceptions — they are plain unconverted duplicates awaiting a
 * follow-up plan. Do not treat their continued existence as an intentional exception; see
 * 87-19-SUMMARY.md's "Surviving local label definitions" section.
 *
 * This is a plain block-level element — icon layout (the wiki field-label group's inline
 * icon composition) stays with the caller, not baked into this primitive.
 */

export type LabelSize = 'md' | 'sm'

interface SizeRecipe {
  fontSize: number
  marginBottom: number
}

const SIZE: Record<LabelSize, SizeRecipe> = {
  md: { fontSize: 11, marginBottom: 4 },
  sm: { fontSize: 10, marginBottom: 2 },
}

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  size?: LabelSize
}

export function Label({ size = 'md', style, children, ...rest }: LabelProps) {
  const s = SIZE[size]
  const css: CSSProperties = {
    display: 'block',
    fontSize: s.fontSize,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'var(--color-text-secondary)',
    marginBottom: s.marginBottom,
    ...style,
  }
  return (
    <label style={css} {...rest}>
      {children}
    </label>
  )
}
