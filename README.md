# @kineticlogic/staresdk

React UI components, theming and design tokens for mission and geospatial applications: the
Elite Command Design System. It powers the interfaces of
[OpenStare](https://github.com/kineticlogic-io/OpenStare) and
[OpenTrack](https://github.com/kineticlogic-io/OpenTrack). It ships the components,
`ThemeProvider`/`useTheme` (dark and light), the `chromeTheme.ts` token set, and optional map, graph,
chart and code-editor views.

Components take their data as props. Routing, data fetching and app state stay in your app.

**[Component guide](https://kineticlogic-io.github.io/stareSDK/)**: every component running live, the
colour tokens for both themes, and the code for each example. Its source is `docs/src/`; rebuild it
with `npm run docs`.

## Install

```sh
npm install @kineticlogic/staresdk react react-dom react-icons framer-motion react-markdown remark-gfm \
  mdast-util-find-and-replace @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

The optional views need their own peer dependencies, installed only if you use them:

| Entry point | Install |
|---|---|
| `@kineticlogic/staresdk/map-view` | `maplibre-gl` |
| `@kineticlogic/staresdk/graph-view` | `@xyflow/react @dagrejs/dagre` |
| `@kineticlogic/staresdk/flow-canvas` | `@xyflow/react` |
| `@kineticlogic/staresdk/chart` | `uplot` |
| `@kineticlogic/staresdk/code-editor` | `@codemirror/*` and `@lezer/highlight` |
| Mermaid diagrams in `Markdown` | `mermaid` |

## Usage

Import the stylesheet once at your application's entry point, wrap your tree in `ThemeProvider`
(and `ToastProvider` if you use `Toast`/`useToast`), then import components by name:

```tsx
import '@kineticlogic/staresdk/styles.css'
import { ThemeProvider, ToastProvider, Button, Modal, useTheme } from '@kineticlogic/staresdk'

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <YourApp />
      </ToastProvider>
    </ThemeProvider>
  )
}
```

`ThemeProvider` resolves the active theme (`'dark'` | `'light'`, default `'dark'`) onto
`<html data-theme="dark"|"light">` and exposes it via `useTheme()`. Every component in this
package reads its colors from the `--color-*`/`--surface-*`/`--status-*` custom properties defined
in `styles.css`, so once the stylesheet and provider are mounted, components theme correctly with
no further wiring.

## Design contract

[`DESIGN-CONTRACT.md`](DESIGN-CONTRACT.md) is how an app built on `staresdk` is laid out and which
component to use for what: the page anatomy (`PageHeader`, a `Tabs` bar, stacked
`CollapsiblePanel`s, detail in a `SideNav`), the typography and colour rules, and the loading,
empty and error states every view must handle. Read it before building a page.

## Page structure components

Added 2026-09-25 from OpenStare's own shell (first consumer: OpenTrack):

- `PageHeader` — the glass page title bar. A portable version of OpenStare's: same bar, grid and
  title styling, rendered in place, with the home button, clock badges, assistant and user chip
  as optional `leading` / `center` / `actions` slots.
- `CollapsiblePanel` — the titled, collapsible section every page is built from (copied from
  OpenStare's `components/hud`). stareSDK adds `titleActions` (after the title) and `actions`
  (right-aligned) slots in the title row for the panel's own compact controls, such as a table's
  search and filters; clicks there never toggle the panel.
- `SideNav` with `DockProvider` / `useDock` — the drawer for detail views, docked left or right,
  resizable, stacking with other drawers and reserving page width through `--assistant-width` /
  `--dock-left-width` (copied from OpenStare's `components/ui` and `context`). `SideNav` must be
  rendered inside a `DockProvider`.
- `Tabs` gained `variant="bar"` (the AdminPage tab bar under the header) and now follows
  OpenStare's tab typography: uppercase, `0.08em`, accent for the selected tab.

## Data and navigation components

Added 2026-09-25 (first consumer: OpenTrack), compact by default and neutral per OpenStare's table
and token rules:

- `Popover` (0.2.12) — an anchored, portaled floating panel (kebab menus, pickers): flips and clamps to the
  viewport, stays clear of the classification banners, closes on Escape / outside press / anchor scroll;
  since 0.2.13 `maxHeight` caps its height; since 0.2.14 it is placed by its rendered width (kept on
  screen; `align="end"` lines up with the anchor's right edge) and a press inside anything its
  children portal (e.g. a colour picker) does not close it.
- `Checkbox` (0.2.12) — a themed real checkbox with label, indeterminate and disabled states.
- `RadioGroup` (0.2.15) — one choice from a short visible list: real radios in a `radiogroup` (one
  tab stop, arrow keys move and choose), options with `description`/`disabled`, vertical or
  horizontal, accent-tinted, tokens only.
- `ButtonPalettePopover` (0.2.15) — the flyout a `ButtonPalette` button opens: rendered in place
  beside its trigger (`side` right/left/top/bottom, flips when there is no room; `align`
  start/center/end, or lined up with another element via `alignTo`), kept clear of the
  classification banners and inside any ancestor that clips its overflow, glass surface, closes on Escape and
  outside press (`closeOnOutsideClick={false}` keeps a drawing tool open), optional `title`,
  `autoFocus`, focus back to the trigger on close, `panelRef`, optional `isolatePointer` over a canvas. Separate from `Popover`, which hangs
  menus and pickers below a control.
- `ContextMenu` / `ContextMenuItem` — right-click menu shell; since 0.2.11 keyboard-operable
  (focus on open, arrows/Home/End, Enter/Space, Escape/Tab close, focus returns to the opener);
  since 0.2.16 `size="sm"` is the compact menu (10px text, tight rows, as wide as its content).
- `InfoTip` — an ⓘ beside a label whose bubble explains it (hover or focus, above a `Modal`); since
  0.2.19 `interactive` lets the bubble hold links: it stays open as the pointer moves in, a click
  pins it, Escape or a press outside closes it.
- `Tree` — collapsible tree in `none`/`single`/`multi` selection modes; since 0.2.17 a node's
  `description` shows in a `Tooltip` while its row is hovered or focused (`aria-describedby`).
- `KeyValueTree` (0.2.34) — a read-only, collapsible tree of `key: value` rows for structured
  metadata (file headers, decoded telemetry): caller-owned expansion, an optional interpreted
  reading shown before the raw value, muted absent values, long payloads in a bounded monospace
  block, rows that expand to caller-rendered content, a per-value copy button (hover or focus,
  copies the raw value), query highlighting, and an indent cap. Its helpers —
  `filterKeyValueTree` (prunes to matches, returns the ancestors to expand),
  `keyValueMatchRanges` and `jsonToKeyValueNodes` — are exported too. Since 0.2.35 its copy
  button matches the VANTAGE inspector's ("Copy value", 14px icons, an accent check, "Copied" /
  "Couldn't copy" announced politely, revealed on row hover or focus).
- `DataTable` — sortable columns (stable, nulls last), optional row selection with keyboard
  activation, sticky header and row virtualisation when `maxHeight` is set. Header chrome follows
  the neutral-table rule (weight, uppercase, letter-spacing, bottom border; no fill, no colour).
  Since 0.2.5 it also takes `manualSort` (caller-ordered rows, e.g. sorted server-side), per-column
  `sortable` / `sortDisabledReason`, `pinFirstColumn`, resizable columns (`onColumnResize`) and
  `onRowDoubleClick`, for OpenStare's attribute table.
  Since 0.2.7, `headerDividers` draws a faint line between header cells.
  Since 0.2.8, `onColumnReorder` lets users drag headers (or Alt+Shift+Arrow) to move columns.
  Since 0.2.11, `onRowContextMenu` reports a row's right-click, Shift+F10 or ContextMenu key.
  Since 0.2.9, `selection` adds a fixed checkbox column (row boxes + a header all/none/some box)
  for a caller-owned selection, and `onRowClick` receives the modifier keys held.
- `MultiSelect` — a dropdown of checkboxes; since 0.2.6 optionally an `xs` icon button (`icon`)
  whose list floats below it (`align`), for toolbars.
- `TagInput` — since 0.2.20, free-entry values as removable chips: Enter or comma adds (a pasted
  list is split; since 0.2.21 also a comma typed on a touch keyboard or autofilled, and the
  placeholder shows only while there are no chips), Backspace in the empty input removes the last, each chip has a ×; values are
  trimmed and de-duplicated, with optional `normalize`, `validate` (the message shows under the
  field), `suggestions` (typeahead), `maxItems`, `removeLabel`, `disabled` and `readOnly`.
- `Select` — a native single-select over `{ value, label, disabled? }` options with an optional
  "nothing chosen" `placeholder` (reported as `null`); since 0.2.13 it passes `id`, `name`,
  `required`, `title` and `ref` through to the `<select>`.
- `Pagination` — offset/limit paging; since 0.2.5 optionally with First/Last buttons (`showEnds`),
  a page-size select (`pageSizes` + `onLimitChange`) and a "Page X of Y · N features" label
  (`label="page"`).
- `UnitSelect` and `units.ts` — the shared unit dropdown and conversions (distance, elevation,
  elevation reference, orientation, confidence); since 0.2.18 also `speed` (`mps`, `kph`, `kn`, `mph`;
  `speedToMetersPerSecond` / `speedFromMetersPerSecond`) and `time` (`s`, `min`, `h`, `d`;
  `durationToSeconds` / `durationFromSeconds`).
- `Tabs` / `TabPanel` — WAI-ARIA tabs with automatic activation and arrow-key navigation.
- `Stepper` — compact wizard step header; completed or failed steps can be revisited, upcoming
  ones cannot.
- `ProfileChart` — distance against height along a path (plain SVG, token colours, responsive
  width): `null` heights break the line, with an optional dashed sight line and obstruction
  marker. Added 2026-10-06 (first consumer: ATLAS terrain analysis, #275).

## Catalog components

Added in 0.2.25 for OpenStare's LEDGER content-management overhaul (later FORGE and LOOM); data
in through props only:

- `SearchInput` — the search field: `Input`'s look with a leading search icon and a clear button
  (Escape clears too); controlled `value`/`onChange`, optional `onDebouncedChange` after
  `debounceMs` (default 250, immediate on clear), `placeholder`, `aria-label`, `autoFocus`,
  `size` `sm`/`md`, `disabled`.
- `EmptyState` — the quiet centered "nothing to show" state: optional `icon`, `title`, optional
  `description` and `action` slot (pass a `Button`), `size` `sm`/`md`.
- `SegmentedControl` — one choice from a few views or modes (grid / table): the `ButtonPalette`
  row of ghost `Button`s with the chosen one `active`, as a `radiogroup` with arrow-key
  navigation; options `{ value, label?, icon?, ariaLabel? }`, `size` `sm`/`md`, `disabled`.
- `ItemCard` — a catalog item as a full-width `row` or a grid `tile` (thumbnail on top, or the
  type icon in a neutral placeholder): type icon, title, `subtitle`, `description` (3 lines),
  `badges` and `actions` slots, `owner`, `tags` (up to `maxTags`, then "+N"; `onTagClick`),
  `meta`, `onClick` with Enter/Space, `selected`, a `selectable` checkbox and an optional
  favorite star (`onFavoriteChange`). Clicks in the slots, checkbox, star and tags never reach
  `onClick`.

0.2.26: `ItemCard` `size` `md`/`lg` scales a tile (taller 3:2 thumbnail, larger type, four
description lines), and a tile clips with `overflow: clip` so a grid of tiles in a
height-limited scroller no longer squeezes them to their thumbnails. `Badge` `onRemove` (with
`removeLabel`, `removeDisabled`) makes a removable chip, the one `TagInput` uses. `Facets`
`children` replaces the option list under the same header and Clear, for a facet chosen through a
search field instead of a list.

0.2.28: `ItemCard` `banner` is a strip across the card's top edge in both layouts (above a tile's
thumbnail, above a row's content), e.g. an `ItemClassificationBar` for the item's classification.

0.2.29, for OpenStare's user directory (kineticlogic-io/OpenStare#391):

- `PersonChip` — the one clickable way to show a person anywhere: `Avatar` + display name as ONE
  button (`name`, `avatarSrc`, `username` for the initials fallback, `size` `sm`/`md` = 16/20 px
  avatar, `onClick`, `ariaLabel` default "Show <name>'s profile", `subtitle` second line, `style`).
  Without `onClick` it is plain text. It inherits typography, so it sits inline in a sentence
  ("deleted by <PersonChip/>"); accent on hover and an accent focus ring, like a link.
- `PersonCard` — a directory entry in the `ItemCard` family, built on the same card internals: a
  large avatar in place of the thumbnail, `name`, `position`, `organization` · `site`, `skills`
  (up to `maxSkills`, default 4, then "+N" with the rest as its tooltip; `onSkillClick`),
  `onClick` with Enter/Space, `layout` `row`/`tile`, `selected`, `banner`, `ariaLabel`. Skill
  clicks never reach `onClick`.
- `ItemCard` `onOwnerClick` makes the owner a `PersonChip` button whose clicks never reach the
  card's `onClick`; without it the card is unchanged.

0.2.27: a `Facets` option may carry `subOptions` (with `subLabel`), a second level rendered
directly beneath that option — not after the whole list — toggled through `onToggleSub` and
marked from `subSelected`.

- `Breadcrumbs` (0.2.26) — the trail from the app's home to the current page: `items`
  `{ label, href?, icon?, hideLabel?, onNavigate? }[]`; every crumb but the last is a real link
  (plain clicks go to `onNavigate`), the last is the current page (`aria-current="page"`).
  `TbArrowBadgeRight` separators; `hideLabel` shows only the icon with the label as its name and
  tooltip; labels before the last truncate past `maxItemWidth` with the full label as a tooltip.

0.2.30, for OpenStare's CODEX homepage (kineticlogic-io/OpenStare#392):

- `Timeline` — dated entries on a horizontal time axis in greedily packed, never-overlapping
  lanes: `entries` `{ id, label, start, end?, tone?, meta? }[]` (`start`/`end` an ISO string or
  `Date`; with `end` a bar, without it a point marker; `tone` `accent`/`info`/`warning`/`neutral`;
  `meta` joins the label and dates in the tooltip and accessible name), `onSelect(id)` /
  `selectedId`, `height` (default 260; extra lanes scroll), the visible window uncontrolled
  (`initialRange`, else fitted to the entries) or controlled (`range` + `onRangeChange`, which
  reports `{ start: Date, end: Date }`), `aria-label`, `now` (the "today" line; `null` hides it),
  `emptyTitle` / `emptyDescription`. The axis adapts from centuries to days (UTC); drag pans,
  wheel or pinch zooms about the pointer, and zoom-in / zoom-out / fit buttons sit above the axis.
  Entries are buttons in time order with one tab stop: arrow keys move (panning off-screen entries
  into view), Home / End jump, Enter selects, `+` / `-` zoom. Labels sit inside a wide bar or
  beside it, truncated before the next entry with the full text as a tooltip. Only entries near
  the view are rendered, placed with transforms. The pure parts (`packTimelineLanes`,
  `timelineTicks`, `fitTimelineSpan`, `zoomTimelineSpan`, `panTimelineSpan`) are exported too.

0.2.31, `Timeline` polish for the CODEX homepage:

- Labels show in full where there is room: lane packing reserves each label's width (measured
  with an `OffscreenCanvas` in `--font-sans`, estimated where it cannot measure) beside a point or
  a bar too short to hold it, so a nearby entry takes another lane instead of cutting the label
  short. A bar holds its label inside only when the whole label fits; otherwise it sits beside.
  Truncation (with the tooltip) is the last resort: past 240 px or at the edge of the view.
  `TimelineLaneItem` gains an optional `footprint` (ms) for this, and
  `estimateTimelineLabelWidth(text, fontSizePx?, letterSpacingEm?)` is exported.
- The "today" label never overlaps an axis label: it sits right of the line, else left of it,
  and only when neither side is clear does it hide the one tick label it covers
  (`layoutTimelineAxisLabels(ticks, today, plotWidth)`, exported).
- Auto height: without `height` the timeline is as tall as its lanes, between `minHeight`
  (default: room for two lanes) and `maxHeight` (default 320), and more lanes scroll; an empty
  timeline is 140 px. An explicit `height` works as before (0.2.30 defaulted to 260).

0.2.32, for OpenTrack's source workspace samples (kineticlogic-io/OpenTrack#104):

  Since 0.2.36 it also spans short recordings and picks times: `minSpanMs` (down to a second;
  below three days the axis gains hour, minute, second and sub-second ticks and tooltips carry the
  time), `nowLabel` (the `now` line's label; default "Today", `null` for none), `onTimePick` (a
  click on the plot outside an entry reports the time under it) and `interaction: 'scrub'`
  (press-and-drag picks times, Shift+drag pans, arrow keys on the focused plot step the time from
  the `now` line). Without them nothing changes.
- `Tray` — a panel docked to the bottom of its container, like a browser's developer tools:
  `open` / `onOpenChange`, `title`, `actions` (header controls whose clicks never toggle it),
  `height` (default 260) within `minHeight` / `maxHeight` (120–640), `storageKey` to keep the
  user's height, `aria-label`. The header bar is always there; open, the body scrolls on its own
  and is resized by dragging its top edge, or with the arrow keys, Home and End there (a
  `separator` with its value). Place it last in a flex column so the content above gives way.
- `RecordTable` — records side by side: `rows` `{ id, label?, value?, before?, dropped? }[]`, one
  column per field (nested fields as dotted paths, arrays whole), `pinned` paths first. With a
  row's `before`, added and changed fields are tinted (`--color-accent`, `--status-warning`) and
  removed ones struck through, unless `showChanges={false}`; a `dropped` row shows its reason
  across the row, dimmed. `selectedId` / `onRowClick` (click, Enter or Space), `maxCellWidth`
  (default 240; longer values are cut, with a tooltip), `empty`. The header and first column stay
  in view as it scrolls. `flattenRecord`, `recordColumns`, `cellChange` and `formatCell` are
  exported.

0.2.33: `RecordTable` `draggableColumns` — a column's header can be dragged out, carrying its
field path as `RECORD_FIELD_MIME` (`application/x-staresdk-record-field`, exported) and as text,
for a drop target elsewhere (OpenTrack drops a sample's field onto a Map step to map it).

## Optional entry points

Five components live behind their own subpath so the main barrel never loads their heavy optional
peer dependencies:

| Import | Component | Optional peers |
|--------|-----------|----------------|
| `@kineticlogic/staresdk/chart` | `TimeSeriesChart` — compact line chart over time (uPlot canvas); colours and fonts resolved from tokens and re-resolved on theme change, series pick a `tone`, legend shows values under the cursor | `uplot` (also import `uplot/dist/uPlot.min.css`) |
| `@kineticlogic/staresdk/code-editor` | `CodeEditor` — CodeMirror 6 JSON/HTML/text editor, token-themed, with parse and caller-supplied diagnostics and (since 0.2.10) caller-supplied completions | `@codemirror/{state,view,commands,language,lang-json,lang-html,lint,autocomplete}`, `@lezer/highlight` |
| `@kineticlogic/staresdk/graph-view` | `GraphView` — directed graph (lineage, provenance, pipelines) in layers: React Flow rendering, dagre layout, token-styled nodes and edges, ended edges dashed, `animated` edges with moving dashes for flows | `@xyflow/react`, `@dagrejs/dagre` (also import `@xyflow/react/dist/base.css`) |
| `@kineticlogic/staresdk/flow-canvas` | `FlowCanvas` (0.2.22) — editable drag-and-drop flow (LOOM's feed editor): React Flow with every colour variable on tokens, consumer-supplied node renderers, a palette (drag a step on or press Enter on it; `onDropNode(type, position)`; since 0.2.24 an item's optional `group` lists it under a quiet uppercase section heading, groups in first-appearance order, ungrouped items without one), `isValidConnection`, zoom/fit controls, optional minimap, Delete removes the selection, `readOnly` | `@xyflow/react` (also import `@xyflow/react/dist/style.css`) |
| `@kineticlogic/staresdk/map-view` | `MapView` — MapLibre GL points-and-polylines map styled as the offline basemap (theme-aware), with selection, fit-to-points and parent-driven `fitTo` | `maplibre-gl` (also import `maplibre-gl/dist/maplibre-gl.css`) |

```tsx
import { CodeEditor } from '@kineticlogic/staresdk/code-editor'
import { MapView } from '@kineticlogic/staresdk/map-view'
import 'maplibre-gl/dist/maplibre-gl.css'
import { GraphView } from '@kineticlogic/staresdk/graph-view'
import '@xyflow/react/dist/base.css'
import { FlowCanvas } from '@kineticlogic/staresdk/flow-canvas'
import '@xyflow/react/dist/style.css' // FlowCanvas (a superset of base.css)
import { TimeSeriesChart } from '@kineticlogic/staresdk/chart'
import 'uplot/dist/uPlot.min.css'
```

`MapView` also needs MapLibre's worker URL set once by the app, because MapLibre resolves its worker
relative to its own module and a bundle breaks that (OpenStare does the same in
`MapLibreBasemapLayer`). With Vite:

```ts
import { setWorkerUrl } from 'maplibre-gl'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
setWorkerUrl(maplibreWorkerUrl)
```

## Design-token contract

Chrome colors come from two places, matched to where they need to be read:

- **CSS / inline `style={{}}`** — via `var(--token-name)`, resolved from `:root` (dark, the
  default) and `[data-theme="light"]` (light) in `styles.css`.
- **JS / Canvas / non-DOM render paths** that cannot read CSS custom properties — via
  `chromeTheme.ts`'s `DARK_THEME` / `LIGHT_THEME` objects, or `themeFor(name)` to resolve either by
  name. Never call `getComputedStyle` from a render path to recover a token value; use the JS
  theme objects instead.

The eight canonical token roles are `--color-bg-primary`, `--color-bg-secondary`,
`--color-accent`, `--color-text-primary`, `--color-text-secondary`, `--color-destructive`,
`--color-glass-bg`, and `--color-glass-border`. Beyond that canonical set, every other Elite
Command token in `styles.css` is itself canonical with no duplicate alias — `--brand-subtle`,
`--brand-primary-hover`, `--brand-primary-active`, the `--status-warning`/`--status-success`/
`--status-info` set, the `--intel-cyan`/`--intel-purple`/`--intel-lime`/`--intel-heat` set,
`--surface-layer-2`, `--border-strong`, `--text-muted`, `--text-inverse`, `--color-link`, plus the
shadow/radius/font/spacing scales. Always reference a token by `var(--token-name)` or its
`chromeTheme.ts` field — never hardcode a color or font literal in a consuming app's own styling
of these components.

Map feature, track, tactical, and data-viz colors used inside OpenStare's own layer-rendering code
are deliberately **theme-invariant** — that domain-color set is out of scope for this package,
which covers only UI chrome.

## Icons

Every icon rendered by a `staresdk` component comes from `react-icons/tb` (Tabler) — the same
hard rule OpenStare itself follows. Consumers building around `staresdk` components should use
`react-icons/tb` for any additional icon needs to keep a visually consistent icon set; no other
`react-icons/*` set, icon library, or Unicode glyph/emoji is used as an affordance icon anywhere in
this package.

## Hardcoded-hex exceptions

Two spots in this package intentionally keep raw hex color literals instead of `var()` references,
mirroring the same two exceptions in `openstare`:

- **`badgeTokens.ts`'s `BADGE_BG`** — a per-theme map (`Record<'dark' | 'light',
  Record<BadgeColor, string>>`) of raw hex values. `Badge.tsx`'s `contrastText()` parses these as
  WCAG luminance numbers; a `var()` string would parse as `NaN`.
- **`chromeTheme.ts`'s `severityRamp`** — the shared status-severity ramp (`live`/`lagging`/
  `degraded`/`stale`/`offline`/`gps`/`fallback`) used by topology/map/HUD-style consumers. It
  deliberately keeps its own hues distinct from the `--status-*` token set.

## Peer dependencies

`staresdk` declares its runtime dependencies as `peerDependencies` so a consuming app controls the
installed versions rather than getting a second copy bundled in:

`react`, `react-dom`, `react-icons`, `framer-motion`, `@dnd-kit/core`, `@dnd-kit/sortable`,
`@dnd-kit/utilities`, `react-markdown`, `remark-gfm`, `mdast-util-find-and-replace`, and `mermaid`
(**optional** — only loaded via a dynamic `import('mermaid')` when `MDText` renders a Mermaid code
block; omit it entirely if you never render Mermaid diagrams).

## App-shell components (props only)

Added for OpenStare's migration onto this package (#31). Each takes its data as props, so the SDK
never depends on a router, an app context, or an API client; the host app keeps that wiring.

- `AppCard` — the landing-page app tile (icon, uppercase label, description; 180 × 160 glass tile
  with a hover lift; when `disabled`, dimmed with no link and its `disabledTooltip` shown in a
  `Tooltip` on hover or focus — 0.2.23). Which apps a user may see is the
  host's concern.
- `HomeButton` — the header "Home" link.
- `AppCard` and `HomeButton` render real links (`href`), so Ctrl/⌘-click still opens a new tab;
  pass `onNavigate(href)` to route a plain click through your router.
- `AssistantButton` — `{ open, onToggle }`.
- `ClassificationBanner` — `{ enabled, text, background, color }`: fixed top and bottom strips
  above everything; reserve `BANNER_HEIGHT_PX` via `--banner-height`.
- `ClockBadges` — `{ clocks }`: ticking header clocks with a width staircase. `null` means "not
  known yet" and renders nothing (no default clock flashes during a page change); `[]` means none.
- `Avatar` — circular avatar; pass a resolved `src`. Missing or failing images fall back to a
  designed initials circle.
- `PageHeader` accepts `portalTarget` to render the bar into an app-shell slot (keeping it full
  width beside docked panels) while an in-flow spacer reserves its footprint.
- `Disclosure` (inline expander) and `VirtualList` (windowed list) are also here.

## Lint

`npm run lint` (part of `npm run check`) runs the same base rules as the app plus the raw-color-
literal gate (`eslint/colorLiteralGate.js`, shared with `openstare/eslint.config.js`): colors come
from the design tokens, with a small file allowlist for files that exist to hold literals.

## Development

```sh
npm install --legacy-peer-deps
npm run check     # typecheck, lint (including the color-literal gate) and tests
npm run build     # dist/
```

To release, bump `version` in `package.json` (and run `npm run docs` so the guide shows it), then
publish a GitHub release tagged `v<version>`. The `publish` workflow publishes the package to npm
with provenance; it refuses a tag that does not match `package.json`, or a version npm already has
from a different commit. The `release-sync` workflow (after each publish, on `main` and daily) fails
if any npm version lacks a GitHub release on the commit it was built from, or a release never
reached npm.

## License

[MIT](LICENSE). © 2026 kineticlogic.io. For consulting or support, email
[admin@kineticlogic.io](mailto:admin@kineticlogic.io).

