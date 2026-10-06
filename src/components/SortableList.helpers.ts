/**
 * Non-component export split out of `SortableList.tsx` (87-27, D-08) to satisfy
 * `react-refresh/only-export-components` — `buildSortableReorder` moves here verbatim.
 */
import { arrayMove } from '@dnd-kit/sortable'
import type { DragEndEvent } from '@dnd-kit/core'

/**
 * Pure drag-reorder handler factory — mirrors `buildOnCutoffDragEnd`
 * (`admin/OntologyCutoffConfig.tsx`) and `GisLayerSideNav.tsx`'s `buildOnDragEnd`: given `items`,
 * `getId` and `onReorder`, returns a `(event: DragEndEvent) => void` that no-ops when `over` is
 * null, when `active.id === over.id`, or when either id resolves to index -1 (e.g. a duplicate or
 * stale id), and otherwise calls `onReorder` with a NEW array via `arrayMove` — the input array is
 * never mutated. Keeping this a standalone export is what makes reorder testable in jsdom, which
 * cannot drive `PointerSensor` pointer events.
 */
export function buildSortableReorder<T>(
  items: T[],
  getId: (item: T) => string,
  onReorder: (next: T[]) => void,
): (event: DragEndEvent) => void {
  return function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex(item => getId(item) === active.id)
    const newIndex = items.findIndex(item => getId(item) === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    onReorder(arrayMove(items, oldIndex, newIndex))
  }
}
