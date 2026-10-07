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

- `DataTable` — sortable columns (stable, nulls last), optional row selection with keyboard
  activation, sticky header and row virtualisation when `maxHeight` is set. Header chrome follows
  the neutral-table rule (weight, uppercase, letter-spacing, bottom border; no fill, no colour).
  Since 0.2.5 it also takes `manualSort` (caller-ordered rows, e.g. sorted server-side), per-column
  `sortable` / `sortDisabledReason`, `pinFirstColumn`, resizable columns (`onColumnResize`) and
  `onRowDoubleClick`, for OpenStare's attribute table.
- `Pagination` — offset/limit paging; since 0.2.5 optionally with First/Last buttons (`showEnds`),
  a page-size select (`pageSizes` + `onLimitChange`) and a "Page X of Y · N features" label
  (`label="page"`).
- `Tabs` / `TabPanel` — WAI-ARIA tabs with automatic activation and arrow-key navigation.
- `Stepper` — compact wizard step header; completed or failed steps can be revisited, upcoming
  ones cannot.
- `ProfileChart` — distance against height along a path (plain SVG, token colours, responsive
  width): `null` heights break the line, with an optional dashed sight line and obstruction
  marker. Added 2026-10-06 (first consumer: ATLAS terrain analysis, #275).

## Optional entry points

Four components live behind their own subpath so the main barrel never loads their heavy optional
peer dependencies:

| Import | Component | Optional peers |
|--------|-----------|----------------|
| `@kineticlogic/staresdk/chart` | `TimeSeriesChart` — compact line chart over time (uPlot canvas); colours and fonts resolved from tokens and re-resolved on theme change, series pick a `tone`, legend shows values under the cursor | `uplot` (also import `uplot/dist/uPlot.min.css`) |
| `@kineticlogic/staresdk/code-editor` | `CodeEditor` — CodeMirror 6 JSON/text editor, token-themed, with parse and caller-supplied diagnostics | `@codemirror/{state,view,commands,language,lang-json,lint}`, `@lezer/highlight` |
| `@kineticlogic/staresdk/graph-view` | `GraphView` — directed graph (lineage, provenance, pipelines) in layers: React Flow rendering, dagre layout, token-styled nodes and edges, ended edges dashed, `animated` edges with moving dashes for flows | `@xyflow/react`, `@dagrejs/dagre` (also import `@xyflow/react/dist/base.css`) |
| `@kineticlogic/staresdk/map-view` | `MapView` — MapLibre GL points-and-polylines map styled as the offline basemap (theme-aware), with selection, fit-to-points and parent-driven `fitTo` | `maplibre-gl` (also import `maplibre-gl/dist/maplibre-gl.css`) |

```tsx
import { CodeEditor } from '@kineticlogic/staresdk/code-editor'
import { MapView } from '@kineticlogic/staresdk/map-view'
import 'maplibre-gl/dist/maplibre-gl.css'
import { GraphView } from '@kineticlogic/staresdk/graph-view'
import '@xyflow/react/dist/base.css'
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
  with a hover lift; dimmed with a tooltip when `disabled`). Which apps a user may see is the
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

