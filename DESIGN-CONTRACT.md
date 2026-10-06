# stareSDK design contract

How to build an app with `staresdk` that looks, feels and behaves like OpenStare. This is a
contract, not a style suggestion: an app built on stareSDK follows it the way OpenStare follows
its own `CLAUDE.md` Product Bar. Where this document and OpenStare's `CLAUDE.md` disagree,
`CLAUDE.md` wins; raise the difference so this file can be corrected.

## 1. Rules that are never broken

1. **Tokens only.** Every colour, font, radius, shadow and spacing value comes from a `var(--…)`
   token in `styles.css` (or `chromeTheme.ts` on render paths that cannot read CSS). No hex,
   `rgb()`, `rgba()` or font literals in app styling.
2. **Use the component that exists.** Before writing a control, look for it here. If it is not
   here, stop and ask the operator; do not hand-roll one-off equivalents (bespoke modals, custom
   badges, raw `<input type="range">`, home-made tab bars or panels). One component per pattern.
3. **No unrequested controls.** Never add a button, menu item, toggle or advisory copy the
   operator did not ask for. Removing an unrequested control is always in scope; adding one never
   is.
4. **Icons are Tabler.** Every icon comes from `react-icons/tb`. No other icon set, no emoji or
   Unicode glyphs as affordances.
5. **No placeholder states.** Every view handles loading, empty and error explicitly, with real
   copy. No dead controls, no console spam.
6. **Compositor-safe motion only.** Animate `transform`, `opacity` and `filter`; never width,
   height, top/left or colours on a loop. One sanctioned exception: `GraphView` edges marked
   `animated` move their dashes (stroke-dashoffset) to show data flowing; they are drawn still
   under `prefers-reduced-motion`. Use it only for flows, never for decoration.
7. **Tight, not oversized.** Components are compact by default. Do not scale them up to fill space;
   let tables and panels take the width instead.

## 2. Page anatomy

Every page is a full-height column, top to bottom:

```
┌ PageHeader ────────────────────────────────────────────────────────┐  --page-header-height
│ TITLE (accent, uppercase)      [center slot]          [actions slot]│  glass
├ Tabs variant="bar" ────────────────────────────────────────────────┤  40px, glass
│ SOURCES   CARDS   SCHEMA                                            │
├ content (scrolls) ─────────────────────────────────────────────────┤  padding --space-lg
│ ┌ CollapsiblePanel ────────────────────────────────────────────┐   │
│ │ PANEL TITLE (accent, uppercase)                     badge  ⌄ │   │
│ │ DataTable / form / facts                                     │   │  gap --space-md
│ └──────────────────────────────────────────────────────────────┘   │  between panels
│ ┌ CollapsiblePanel ─────────────────────────────────────────────┐  │
└────────────────────────────────────────────────────────────────────┘
                                     SideNav (right) slides over for detail ▶
```

```tsx
<DockProvider>
  <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
                background: 'var(--color-bg-primary)', fontFamily: 'var(--font-sans)' }}>
    <PageHeader title="OpenTrack" appName="OpenTrack" actions={…} />
    <Tabs variant="bar" aria-label="Workspaces" tabs={…} value={view} onChange={setView} />
    <main style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-lg)',
                   marginRight: 'var(--assistant-width, 0px)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        <CollapsiblePanel title="Sources" badge="4">…</CollapsiblePanel>
      </div>
    </main>
  </div>
</DockProvider>
```

- **One `PageHeader` per page**, first in the column. It sets `document.title`.
- **Primary navigation is `Tabs variant="bar"`** directly under the header, uppercase labels, no
  icons. The URL (hash or route) owns the selected tab so a reload or shared link lands on the
  same view.
- **Content is stacked `CollapsiblePanel`s**, full width, `--space-md` apart, inside
  `--space-lg` page padding. Do not build card grids or split the page into columns to fill space.
- **Workspace row (the one split).** A page built around one selected item seen against its
  context (OpenTrack's Track Database: a map of tracks beside the selected track's card) may open
  with a row of two `CollapsiblePanel`s, context on the left and the selected item on the right,
  above the full-width panels. The row is equal height, `--space-md` apart, and wraps to one
  column when either panel would be narrower than about 420px. Everything else on the page stays
  full width. Editing the item still opens a `SideNav`.
- **Detail opens in a right `SideNav`**, not a second column. Selecting a row opens the drawer;
  closing it (its close control, `Esc`, or clearing the selection) returns the full width. The
  page reserves the drawer's width through `--assistant-width` (right) and `--dock-left-width`
  (left), which `DockProvider` maintains, so content reflows instead of being covered.
- **Modals are for decisions, not for browsing.** Confirmations, short create/edit forms: `Modal`
  or `useToast().confirm()`. Anything the user reads alongside the page belongs in a `SideNav`.

## 3. Components: which one, when

| Need | Use | Not |
|------|-----|-----|
| Page title bar | `PageHeader` | a custom header div |
| Primary views of a page | `Tabs variant="bar"` | buttons styled as tabs, `Tabs` with icons |
| Views inside a panel or drawer | `Tabs` (inline) + `TabPanel` | nested page tab bars |
| A section of a page | `CollapsiblePanel` (with `persistKey` if the user will want it to stay closed) | bordered `<section>`s, cards |
| A panel's own compact controls (a table's search, a filter) | `CollapsiblePanel` `titleActions` (the search, directly after the title) and `actions` (filters, right-aligned); `Input`/`FieldSelect` at compact width | a toolbar row above the table for a single search box |
| Detail of a selected item | `SideNav` (`side="right"`, `storageKey` for width) | a split column, a modal |
| Confirm / short form | `Modal`, `useToast().confirm()` | `window.confirm`, custom overlays |
| Admin-only form dialog | `AdminModal` | |
| Transient result or error | `useToast().toast({ variant, message })` | inline banners that never clear |
| Tabular data | `DataTable` (sortable, selectable, virtualised with `maxHeight`) | hand-built `<table>` |
| Status, count, category | `Badge` (`size="sm"`; `uppercase` for states) | coloured text, custom pills |
| Actions | `Button` (`primary` once per view, `secondary`, `ghost` for icon-only, `danger` for destructive) | links styled as buttons |
| Save with dirty/saving/saved states | `SaveButton` | a `Button` with ad-hoc state text |
| Text / number field | `Label` + `Input` | bare `<input>` |
| Pick one of a list | `FieldSelect` (`allowNone` when empty is valid) | bare `<select>` |
| Pick a unit, orientation convention or confidence level | `UnitSelect` (`family`: distance, elevation, elevation-reference, orientation, confidence; conversions in `units.ts`) | a hand-built unit list, inline unit math |
| Search-and-pick from many | `TypeaheadPicker` | |
| On/off setting | `Toggle` | checkboxes for settings |
| Numeric range | `Slider`, `OpacitySlider`, `ZoomRangeSlider` | `<input type="range">` |
| Multi-step flow | `Stepper` at the top of the panel body, with the cancel control beside it | numbered headings |
| Paging a long list | `Pagination` (or `DataTable` virtualisation) | infinite scroll |
| Explaining a field, setting or heading | `InfoTip` (ⓘ beside the label; shows above a `Modal`) | helper text under every field, `title` attributes |
| Hover label of a map feature | `Tooltip` (below a `Modal`) | `title` on key affordances |
| Row actions menu | `PopoverMenuButton` / `ContextMenu` | |
| File input | `FileDropZone` | bare file input |
| JSON / text editing | `CodeEditor` (`staresdk/code-editor`) | `<textarea>` |
| Points on a map | `MapView` (`staresdk/map-view`) | a second map library |
| Lineage, provenance, dependencies (a directed graph) | `GraphView` (`staresdk/graph-view`) | hand-drawn SVG, lists of edges standing in for a graph |
| A pipeline or topology with data moving through it | `GraphView` with `animated` edges (left to right; narrow `width` on stage nodes and a smaller `layerGap` so long chains stay legible; `tone` `warning`/`danger` on failing nodes, `muted` on switched-off ones) | CSS-animated divs, GIFs |
| Values over time (rates, lag, sizes) | `TimeSeriesChart` (`staresdk/chart`; series pick a `tone`, never a colour) | a second chart library, hand-drawn sparklines |
| Rendered Markdown | `MDText` | |

Buttons: at most one `primary` per panel or drawer; `size="sm"` in panel headers and drawers.
Icon-only buttons are `variant="ghost"`, `size="xs"`, and always carry `aria-label` and `title`.

## 4. Typography

| Role | Size / weight | Case | Colour | Font |
|------|---------------|------|--------|------|
| Page title (`PageHeader`) | 14 / 600, `0.08em` | uppercase | `--color-accent` | sans |
| Panel title (`CollapsiblePanel`), primary tab | 12 / 600, `0.08em` | uppercase | `--color-accent` | sans |
| Inactive tab | 12 / 400, `0.08em` | uppercase | `--color-text-secondary` | sans |
| Field label (`Label`), table header, fact name | 11 / 600, `0.08em` | uppercase | `--color-text-secondary` | sans |
| Body text, table cells | 12 / 400 | sentence | `--color-text-primary` | sans |
| Supporting text, hints | 11–12 / 400 | sentence | `--color-text-secondary` | sans |
| Empty and loading states | 12–14 / 400 | uppercase for short states (`NO SOURCES`, `LOADING…`), sentence for guidance | `--color-text-secondary` | sans |
| Identifiers, codes, coordinates, timestamps, JSON | 12 | as data | primary | `--font-mono` |

- `--font-header` (condensed) is for wordmarks only, never for panel or section titles.
- `--font-mono` is for data values only, never for chrome. (`SideNav` sets mono on its container;
  set `fontFamily: 'var(--font-sans)'` on drawer content that is chrome.)

## 5. Colour

- **Accent (`--color-accent`)** marks interaction and structure titles: the selected tab, panel
  and page titles, focus, primary buttons. Never use it for body text, table headers or large
  fills; a screen of green text is wrong.
- **Status** uses `--status-success`, `--status-warning`, `--status-info` and
  `--color-destructive`, through `Badge` colours `success`, `warning`, `blue`, `danger`. Grey
  (`grey`) is the neutral default; `brand` is for brand affordances, not status.
- **Surfaces**: page `--color-bg-primary`; header, tab bar, panels and drawers
  `--color-glass-bg` with `--color-glass-border`; inputs `--color-bg-secondary`.
- **Tables are neutral**: header rows are distinguished by weight, uppercase, letter-spacing and a
  bottom border. No coloured header fill (`--brand-subtle`), no accent header text.
- Both themes (`data-theme="dark"|"light"`) must work. Test both.

## 6. Spacing and density

- Page padding `--space-lg` (24px); gap between panels `--space-md` (16px); inside a panel body
  `--space-md`; between related controls `--space-sm` (8px).
- Radii: panels `--radius-lg` (8px), inputs and buttons `--radius-sm`/`--radius-md`.
- Default component sizes are the compact ones (`Button size="sm"`, `Badge size="sm"`,
  `DataTable` default density). Grow only on explicit operator direction.

## 7. State and feedback

- **Loading**: the panel still renders its title; its body shows `LOADING…` in secondary text or
  keeps the last data while refreshing. Never an empty screen.
- **Empty**: say what is missing and what to do, in one line (`No sources yet. Add one to start
  onboarding a feed.`). No illustrations.
- **Errors**: a failed load raises `useToast().toast({ variant: 'error', message })` and the view
  keeps working; a failed save shows the server's message next to the control that failed, in
  `--color-destructive`.
- **Destructive actions** always go through `useToast().confirm()` naming the object.
- **Persist what the user sets**: selected view in the URL, panel open state via `persistKey`,
  drawer width via `storageKey`.

## 8. Accessibility

Every interactive element is reachable by keyboard and labelled: `aria-label` on icon-only
buttons, `aria-label` on `Tabs`, `DataTable` and `SideNav`, `Label htmlFor` on inputs. Selection
in tables is keyboard-operable (`DataTable` does this). Colour is never the only carrier of
meaning: status badges carry text.
