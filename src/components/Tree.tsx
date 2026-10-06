import type { CSSProperties } from 'react'
import { useState } from 'react'
import { TbChevronRight, TbSquare, TbSquareCheckFilled, TbSquareMinusFilled } from 'react-icons/tb'

/**
 * ui/Tree — generic collapsible, multi-select checkbox tree (D-03).
 *
 * Intentionally domain-agnostic: no external-integration-specific props or copy.
 * Built for a Phase 63 capabilities picker, but shaped for reuse by any future
 * title-only hierarchical picker (e.g. a "Group Layer" capability).
 *
 * Fully controlled: `checkedIds`/`expandedIds` are owned by the caller. The only
 * internal state is transient per-row hover (purely visual, never read by a
 * parent). Callers wanting a "top-level expanded by default" initial state should
 * seed `expandedIds` accordingly before first render — this component does not
 * apply any default expansion itself.
 *
 * Tri-state checkbox semantics: checking a node checks itself (if not disabled)
 * and every non-disabled descendant; unchecking inverts. A node's displayed state
 * is 'checked' only when itself + every non-disabled descendant are checked,
 * 'indeterminate' when some but not all are, else 'unchecked'. Disabled nodes are
 * excluded entirely from this computation and always render a static, inert
 * checkbox — clicking one is a no-op.
 *
 * `onCheckedChange` is called once per affected node id (not batched into a single
 * array) so the caller's state updater should use the functional `setState(prev
 * => ...)` form — multiple synchronous calls during one cascade must each see the
 * previous call's result.
 *
 * Phase 81 D-30: `selectable='single'` is a real, additive row-click selection mode
 * (row click + Enter/Space + `aria-selected` + `--brand-subtle`/accent active highlight).
 * The `selectable='multi'` and `selectable='none'` render paths are deliberately UNTOUCHED
 * by D-30 — no new click handler, no cascade math change — so the two shipped multi-select
 * consumers (`ServiceLayerPicker`, `ManageServiceLayersModal`) render byte-identically.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TreeNode {
  id: string
  title: string
  children?: TreeNode[]
  disabled?: boolean
  disabledReason?: string
  name?: string
  bbox?: [number, number, number, number]
}

export type TreeSelectable = 'none' | 'single' | 'multi'

export interface TreeProps {
  nodes: TreeNode[]
  selectable: TreeSelectable
  checkedIds: Set<string>
  onCheckedChange: (id: string, checked: boolean) => void
  expandedIds: Set<string>
  onExpandedChange: (id: string, expanded: boolean) => void
  /**
   * The currently active node id (Phase 81 D-30). Read only when `selectable === 'single'`;
   * ignored for `'multi'`/`'none'`. Optional so existing multi-select consumers compile and
   * behave unchanged with zero code changes.
   */
  selectedId?: string | null
  /**
   * Called with a node's id when its row is clicked, or Enter/Space is pressed while it is
   * focused (Phase 81 D-30). Read only when `selectable === 'single'` — never invoked for
   * `'multi'`/`'none'`, and never invoked for a `disabled` node. Optional so existing
   * multi-select consumers compile and behave unchanged with zero code changes.
   */
  onSelect?: (id: string) => void
}

type CheckState = 'checked' | 'indeterminate' | 'unchecked'

// ---------------------------------------------------------------------------
// Named-constant tables (Badge SIZE_STYLES idiom) — no hardcoded literals
// scattered through the render tree.
// ---------------------------------------------------------------------------

/** Row rhythm — matches layerRowMainLine's 28px row height. */
const ROW_HEIGHT = 28
/** Per-depth indent — mirrors the `--space-md` (16px) token per 63-UI-SPEC §1. */
const INDENT_PER_DEPTH = 16
/** Chevron/leaf-spacer hit-area width — matches layerRowChevron's 22px convention. */
const EXPANDER_WIDTH = 22

const CHECK_ICON: Record<CheckState, typeof TbSquare> = {
  checked: TbSquareCheckFilled,
  indeterminate: TbSquareMinusFilled,
  unchecked: TbSquare,
}

const CHECK_COLOR: Record<CheckState, string> = {
  checked: 'var(--color-accent)',
  indeterminate: 'var(--color-accent)',
  unchecked: 'var(--color-text-secondary)',
}

const CHECK_OPACITY: Record<CheckState, number> = {
  checked: 1,
  indeterminate: 0.7,
  unchecked: 1,
}

const TITLE_WEIGHT: Record<'checked' | 'unchecked', number> = {
  checked: 600,
  unchecked: 400,
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  minHeight: ROW_HEIGHT,
  gap: 4,
  paddingRight: 4,
  borderRadius: 4,
}

const expanderStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: EXPANDER_WIDTH,
  height: ROW_HEIGHT,
  flexShrink: 0,
  cursor: 'pointer',
  color: 'var(--color-text-secondary)',
  transition: 'transform 0.15s',
  fontSize: 13,
}

const checkboxStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 18,
  height: ROW_HEIGHT,
  flexShrink: 0,
  fontSize: 13,
}

const titleColumnStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  minHeight: ROW_HEIGHT,
  minWidth: 0,
  flex: 1,
  padding: '2px 0',
}

const titleStyle: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: 'var(--color-text-primary)',
}

const disabledReasonStyle: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  color: 'var(--color-text-secondary)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

// ---------------------------------------------------------------------------
// Selection helpers
// ---------------------------------------------------------------------------

/** Every non-disabled id in `node`'s subtree, including `node` itself. */
function selectableIds(node: TreeNode): string[] {
  const self = node.disabled ? [] : [node.id]
  const kids = (node.children ?? []).flatMap(selectableIds)
  return [...self, ...kids]
}

function checkState(node: TreeNode, checkedIds: Set<string>): CheckState {
  const ids = selectableIds(node)
  if (ids.length === 0) return 'unchecked'
  const checkedCount = ids.filter(id => checkedIds.has(id)).length
  if (checkedCount === 0) return 'unchecked'
  if (checkedCount === ids.length) return 'checked'
  return 'indeterminate'
}

// ---------------------------------------------------------------------------
// Row (recursive)
// ---------------------------------------------------------------------------

interface TreeRowProps {
  node: TreeNode
  depth: number
  selectable: TreeSelectable
  checkedIds: Set<string>
  onCheckedChange: (id: string, checked: boolean) => void
  expandedIds: Set<string>
  onExpandedChange: (id: string, expanded: boolean) => void
  selectedId?: string | null
  onSelect?: (id: string) => void
}

function TreeRow({
  node,
  depth,
  selectable,
  checkedIds,
  onCheckedChange,
  expandedIds,
  onExpandedChange,
  selectedId,
  onSelect,
}: TreeRowProps) {
  const [hovered, setHovered] = useState(false)
  const hasChildren = (node.children?.length ?? 0) > 0
  const expanded = expandedIds.has(node.id)
  const state: CheckState = selectable === 'multi' ? checkState(node, checkedIds) : 'unchecked'
  const hasReason = Boolean(node.disabled && node.disabledReason)
  const CheckIcon = CHECK_ICON[state]
  // Phase 81 D-30 — 'multi' and 'none' never compute/use these; only 'single' does.
  const isSingle = selectable === 'single'
  const isActive = isSingle && selectedId === node.id
  const isSelectableSingleRow = isSingle && !node.disabled

  function handleToggleExpand(e: React.MouseEvent) {
    e.stopPropagation()
    onExpandedChange(node.id, !expanded)
  }

  function handleToggleCheck(e: React.MouseEvent) {
    e.stopPropagation()
    if (node.disabled) return
    const nextChecked = state !== 'checked'
    for (const id of selectableIds(node)) onCheckedChange(id, nextChecked)
  }

  function handleSelect() {
    if (node.disabled) return
    onSelect?.(node.id)
  }

  function handleRowKeyDown(e: React.KeyboardEvent) {
    if (!isSelectableSingleRow) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect?.(node.id)
    }
  }

  return (
    <div>
      <div
        style={{
          ...rowStyle,
          alignItems: hasReason ? 'flex-start' : 'center',
          paddingLeft: depth * INDENT_PER_DEPTH,
          background: isActive ? 'var(--brand-subtle)' : hovered ? 'var(--color-glass-bg)' : 'transparent',
          opacity: node.disabled ? 0.5 : 1,
          ...(isSelectableSingleRow ? { cursor: 'pointer' } : {}),
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={isSingle ? handleSelect : undefined}
        {...(isSelectableSingleRow
          ? { 'aria-selected': isActive, tabIndex: 0, onKeyDown: handleRowKeyDown }
          : {})}
      >
        {hasChildren ? (
          <span
            onClick={handleToggleExpand}
            style={{ ...expanderStyle, transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
            aria-label={expanded ? `Collapse ${node.title}` : `Expand ${node.title}`}
          >
            <TbChevronRight />
          </span>
        ) : (
          <span style={{ ...expanderStyle, cursor: 'default' }} aria-hidden />
        )}

        {selectable === 'multi' && (
          node.disabled ? (
            <span
              style={{ ...checkboxStyle, color: 'var(--color-text-secondary)', opacity: 0.3, cursor: 'not-allowed' }}
              aria-hidden
            >
              <TbSquare />
            </span>
          ) : (
            <span
              onClick={handleToggleCheck}
              style={{
                ...checkboxStyle,
                color: CHECK_COLOR[state],
                opacity: CHECK_OPACITY[state],
                cursor: 'pointer',
              }}
              role="checkbox"
              aria-checked={state === 'indeterminate' ? 'mixed' : state === 'checked'}
              aria-label={node.title}
            >
              <CheckIcon />
            </span>
          )
        )}

        <div style={titleColumnStyle}>
          <span
            style={{
              ...titleStyle,
              fontWeight: TITLE_WEIGHT[state === 'checked' ? 'checked' : 'unchecked'],
              ...(isActive ? { color: 'var(--color-accent)' } : {}),
            }}
            title={node.title}
          >
            {node.title}
          </span>
          {hasReason && <span style={disabledReasonStyle}>{node.disabledReason}</span>}
        </div>
      </div>

      {hasChildren && expanded && node.children!.map(child => (
        <TreeRow
          key={child.id}
          node={child}
          depth={depth + 1}
          selectable={selectable}
          checkedIds={checkedIds}
          onCheckedChange={onCheckedChange}
          expandedIds={expandedIds}
          onExpandedChange={onExpandedChange}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tree
// ---------------------------------------------------------------------------

export function Tree({
  nodes,
  selectable,
  checkedIds,
  onCheckedChange,
  expandedIds,
  onExpandedChange,
  selectedId,
  onSelect,
}: TreeProps) {
  return (
    <div>
      {nodes.map(node => (
        <TreeRow
          key={node.id}
          node={node}
          depth={0}
          selectable={selectable}
          checkedIds={checkedIds}
          onCheckedChange={onCheckedChange}
          expandedIds={expandedIds}
          onExpandedChange={onExpandedChange}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}
