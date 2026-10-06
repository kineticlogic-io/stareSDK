/**
 * SortableList — the one new shared component this phase (80.1) is authorized to create (D-18,
 * operator sign-off recorded in `.planning/phases/80.1-article-media-citations/80.1-CONTEXT.md`).
 * CLAUDE.md's shared-UI hard rule forbids a fifth hand-rolled `DndContext`/`SortableContext` copy;
 * D-18 extracts exactly one generic component for this phase's two consumers
 * (`MediaEditForm.tsx`, `SourcesEditForm.tsx` — plan 05) and explicitly does NOT migrate the four
 * existing hand-rolled dnd-kit consumers:
 *   - `openstare/src/components/analysis/GisLayerSideNav.tsx`
 *   - `openstare/src/components/analysis/GisLayerRow.tsx`
 *   - `openstare/src/components/analysis/GisImageryRow.tsx`
 *   - `openstare/src/components/admin/OntologyCutoffConfig.tsx`
 * Three drag-reorder implementations coexisting after this phase is a deliberate, recorded
 * deferral (D-18), not an oversight — touching those shipped, UAT-approved files is real
 * regression surface the operator explicitly scoped out.
 *
 * Drag activation — a deliberate deviation from the GIS-row precedent, WITH rationale: the
 * existing consumers spread `{...attributes} {...listeners}` onto the WHOLE row, since those rows
 * contain no interactive text inputs. This phase's rows (image/source entries) are full of text
 * inputs (URL, caption, credit, title) — whole-row drag activation would fight normal
 * click-to-focus behavior inside those fields. `SortableList` therefore restricts drag activation
 * to a dedicated handle element ONLY by default (`dragMode="handle"`).
 *
 * `dragMode="row"` (Phase 118, P-E) — an opt-in second mode originally added for the Configure
 * Popups field list (plan 118-06) on the assumption that its rows had "no free-text inputs, only
 * a checkbox/select/input trio that can tolerate a small pointer-movement threshold before drag
 * wins." That assumption was WRONG — that "trio" included a real free-text custom-label `<input>`
 * — and live operator UAT (2026-09-04) confirmed the practical fallout: clicking a row's dropdown
 * or typing into its label input intermittently got captured as a drag gesture instead. Configure
 * Popups was switched BACK to `dragMode="handle"` (the default) as a result — see
 * `ConfigurePopupsModal.tsx`'s own history for that correction, and CONTEXT.md's D-05 amendment /
 * 118-UI-SPEC.md's updated Configure Popups row spec for the full record. `dragMode="row"` itself
 * is left in place (not deleted) as a general capability for a future consumer whose rows
 * genuinely have no free-text inputs — it currently has NO production consumer. In this mode the
 * drag activation spread moves from the (now-absent) grip button onto the row container itself,
 * and the `PointerSensor` gains an 8px pointer-movement activation-distance threshold (see the
 * sensor setup below) — intended to let a plain click on a checkbox/dropdown/input inside the row
 * still fire while a deliberate drag gesture still reorders, though Configure Popups' own
 * live-UAT experience shows that mitigation is not fully reliable in practice for a row with a
 * real text input. `'handle'` mode's sensor stays a bare `useSensor(PointerSensor)` with no
 * options, so the existing consumers' (`MediaEditForm.tsx`, `SourcesEditForm.tsx`, and now
 * `ConfigurePopupsModal.tsx` again) drag feel is byte-identical.
 *
 * Sensors — `KeyboardSensor` is a deliberate ADDITION beyond the four existing consumers, all of
 * which are PointerSensor-only (grep-verified). This is not an inconsistency; it makes the handle
 * a real, focusable `<button>` that Tab reaches, with Space/Arrow/Esc driving reorder via dnd-kit's
 * own built-in keyboard machinery (`sortableKeyboardCoordinates`) — no custom announcement logic.
 *
 * Zero new npm dependencies — `@dnd-kit/core@6.3.1` and `@dnd-kit/sortable@10.0.0` are already in
 * prod (see `openstare/package.json`); `@dnd-kit/utilities` is their existing transitive
 * dependency, already imported directly by `GisLayerRow.tsx` for the same `CSS.Transform.toString`
 * helper reused here.
 */
import type { CSSProperties, ReactNode } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { TbGripVertical } from 'react-icons/tb'
import { Button } from './Button'
import { buildSortableReorder } from './SortableList.helpers'

export interface SortableListProps<T> {
  items: T[]
  getId: (item: T) => string
  onReorder: (next: T[]) => void
  renderItem: (item: T, index: number) => ReactNode
  itemLabel: string
  gap?: number
  /**
   * `'handle'` (default) spreads drag activation onto a dedicated grip button only — unchanged
   * behavior for existing consumers. `'row'` spreads it onto the whole row container instead and
   * renders NO grip button, for rows whose interactive children are protected by the 8px pointer
   * activation-distance threshold instead of a separate handle element (Phase 118 P-E).
   */
  dragMode?: 'handle' | 'row'
}

export function SortableList<T>({
  items,
  getId,
  onReorder,
  renderItem,
  itemLabel,
  gap = 8, // var(--space-sm)'s value
  dragMode = 'handle',
}: SortableListProps<T>) {
  const sensors = useSensors(
    // The 8px activation-distance constraint is only applied in 'row' mode — see the module doc
    // header. 'handle' mode keeps the bare, option-less sensor so existing consumers are untouched.
    useSensor(PointerSensor, dragMode === 'row' ? { activationConstraint: { distance: 8 } } : undefined),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const onDragEnd = buildSortableReorder(items, getId, onReorder)
  const ids = items.map(getId)

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div style={{ display: 'flex', flexDirection: 'column', gap }}>
          {items.map((item, index) => (
            <SortableRow key={getId(item)} id={getId(item)} index={index} total={items.length} itemLabel={itemLabel} dragMode={dragMode}>
              {renderItem(item, index)}
            </SortableRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

function SortableRow({
  id,
  index,
  total,
  itemLabel,
  dragMode,
  children,
}: {
  id: string
  index: number
  total: number
  itemLabel: string
  dragMode: 'handle' | 'row'
  children: ReactNode
}) {
  const { attributes, listeners, setNodeRef: setRef, transform, transition, isDragging } = useSortable({ id })

  const rowStyle: CSSProperties = {
    // Compositor-safe only: transform (dnd-kit position tracking) + opacity + a STATIC
    // (non-animated) boxShadow swap while dragging. No top/left/margin animation.
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    boxShadow: isDragging ? 'var(--shadow-standard)' : undefined,
    display: 'flex',
    alignItems: 'flex-start',
    gap: 'var(--space-sm)',
    cursor: dragMode === 'row' ? (isDragging ? 'grabbing' : 'grab') : undefined,
  }

  // 'row' mode spreads dnd-kit's drag-activation props onto the row container itself (this is what
  // supplies aria-roledescription="sortable" and the pointer/keyboard listeners); 'handle' mode
  // spreads nothing here — the grip Button below is the sole spread target instead.
  //
  // Operator UAT fix (2026-09-03, Configure Popups spacebar bug): dnd-kit's own KeyboardSensor
  // activator (`KeyboardSensor.activators[0].handler`, @dnd-kit/core) is supposed to no-op unless
  // `event.target === activator` — but that guard is written as
  // `if (activator && event.target !== activator) return false`, so when no drag is active yet
  // `active.activatorNode.current` (`activator`) is `null`, the `activator &&` short-circuits, the
  // target check never runs, and `event.preventDefault()` fires unconditionally for every Space/
  // Enter keydown that bubbles up from ANY descendant — including a free-text `<input>` nested
  // inside the row. Confirmed empirically (a throwaway jsdom test dispatching a real `keydown`
  // showed `defaultPrevented === true` even with the input, not the row, as `event.target`). This
  // silently ate every space keystroke typed into Configure Popups' per-row custom label input
  // (plan 118-06), since that modal is `dragMode="row"`'s only consumer. `'handle'` mode is
  // unaffected — its listeners are spread on a dedicated `<button>`, never on an ancestor of a text
  // input. Fix: wrap `listeners.onKeyDown` so dnd-kit's activation handler only runs when the
  // keydown's REAL target is a non-form-control element (i.e. the row background itself, reached by
  // Tab) — a keydown whose target is an INPUT/SELECT/TEXTAREA/BUTTON is left alone entirely so the
  // browser's normal typing/activation behavior for that control is never intercepted.
  const isFormControlTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) return false
    return ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(target.tagName)
  }
  const rowDragProps =
    dragMode === 'row'
      ? {
          ...attributes,
          ...listeners,
          onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
            if (isFormControlTarget(event.target)) return
            listeners?.onKeyDown?.(event)
          },
        }
      : {}

  return (
    <div ref={setRef} style={rowStyle} {...rowDragProps}>
      {dragMode === 'handle' && (
        /* Drag handle — the ONLY element {...attributes} {...listeners} is spread onto in this
           mode. Whole-row activation (the GIS-row precedent) would fight click-to-focus inside
           this row's text inputs, so activation is restricted to this dedicated, focusable handle
           button. aria-roledescription="sortable" comes from dnd-kit's {...attributes}; do not
           also set it explicitly here — the spread overwrites it (TS2783). */
        <Button
          type="button"
          size="xs"
          variant="ghost"
          icon={<TbGripVertical />}
          aria-label={`Reorder ${itemLabel}, item ${index + 1} of ${total}`}
          style={{ cursor: isDragging ? 'grabbing' : 'grab', flexShrink: 0 }}
          {...attributes}
          {...listeners}
        />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  )
}
