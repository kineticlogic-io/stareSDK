/**
 * colorRamps.ts — the ONE colour-ramp registry for every ramp-driven style (graduated,
 * categorized, random colour by ID, track colour by ID, heatmap, hexbin) and its sampling helpers.
 * OpenStare and every other consumer import it from `@kineticlogic/staresdk`; nobody keeps a copy
 * (operator, 2026-11-10: "the same ramps available anywhere ramps are"). `RampPicker` lists all of
 * them, so what a picker previews is exactly what the map draws.
 *
 * NO React/DOM/map-library imports — a pure TypeScript module.
 *
 * No `d3-scale-chromatic`/`chroma-js` dependency: each ramp carries its published stops inline, and
 * sampling interpolates them in OKLab (Björn Ottosson, 2020), a perceptual colour space.
 *
 * Sources of the stops (all openly licensed, cited per ramp below):
 * - ColorBrewer 2.0 (Cynthia Brewer, Mark Harrower and The Pennsylvania State University;
 *   colorbrewer2.org; Apache-2.0-style licence): the 9-class sequential, 11-class diverging and
 *   qualitative sets.
 * - matplotlib's perceptually uniform maps (Stéfan van der Walt and Nathaniel Smith, 2015; CC0):
 *   Viridis, Magma, Inferno, Plasma — sampled at 11 evenly spaced points.
 * - Cividis (Nuñez, Anderton and Renslow, PLOS ONE 2018; as published in viridisLite, MIT) —
 *   10 evenly spaced points.
 * - Turbo (Anton Mikhailov, Google, 2019; Apache-2.0) — 11 points of d3-scale-chromatic's
 *   published polynomial approximation (`interpolateTurbo`, ISC).
 *
 * All stop values are literal (data-viz colours, exempt from the design-token rule; this file is on
 * the colour-literal lint allowlist).
 */

import { hexToRgb, type RGB } from './color.js'

/**
 * A ramp: its published stops (`anchors`), sampled to any class count by `sampleRamp`.
 * `qualitative` ramps are distinct hues, used in order.
 */
export interface ColorRamp {
  id: string
  label: string
  kind: 'sequential-single' | 'sequential-multi' | 'diverging' | 'qualitative'
  /** The ramp's stops, low to high (or in palette order for `qualitative`). */
  anchors: string[]
}

/** The group a ramp is listed under in `RampPicker`. */
export type ColorRampGroup = 'Sequential' | 'Diverging' | 'Qualitative'

/** The group `ramp` is listed under. */
export function rampGroupOf(ramp: ColorRamp): ColorRampGroup {
  if (ramp.kind === 'diverging') return 'Diverging'
  if (ramp.kind === 'qualitative') return 'Qualitative'
  return 'Sequential'
}

/** The groups, in the order `RampPicker` lists them. */
export const RAMP_GROUPS: readonly ColorRampGroup[] = ['Sequential', 'Diverging', 'Qualitative']

/** ColorBrewer's diverging midpoint for the RdBu, PuOr and PiYG 11-class sets. */
const DIVERGING_MIDPOINT = '#f7f7f7'

/**
 * Every ramp. Ids are stable: stored styles reference them, so an id is never renamed or reused.
 */
export const RAMPS: ColorRamp[] = [
  // ---- Sequential, single hue (ColorBrewer 2.0, 9-class) ----
  { id: 'seq-blues', label: 'Blues', kind: 'sequential-single', anchors: ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c', '#08306b'] },
  { id: 'seq-greens', label: 'Greens', kind: 'sequential-single', anchors: ['#f7fcf5', '#e5f5e0', '#c7e9c0', '#a1d99b', '#74c476', '#41ab5d', '#238b45', '#006d2c', '#00441b'] },
  { id: 'seq-oranges', label: 'Oranges', kind: 'sequential-single', anchors: ['#fff5eb', '#fee6ce', '#fdd0a2', '#fdae6b', '#fd8d3c', '#f16913', '#d94801', '#a63603', '#7f2704'] },
  { id: 'seq-reds', label: 'Reds', kind: 'sequential-single', anchors: ['#fff5f0', '#fee0d2', '#fcbba1', '#fc9272', '#fb6a4a', '#ef3b2c', '#cb181d', '#a50f15', '#67000d'] },
  { id: 'seq-purples', label: 'Purples', kind: 'sequential-single', anchors: ['#fcfbfd', '#efedf5', '#dadaeb', '#bcbddc', '#9e9ac8', '#807dba', '#6a51a3', '#54278f', '#3f007d'] },
  { id: 'seq-greys', label: 'Greys', kind: 'sequential-single', anchors: ['#ffffff', '#f0f0f0', '#d9d9d9', '#bdbdbd', '#969696', '#737373', '#525252', '#252525', '#000000'] },
  // ---- Sequential, multi-hue ----
  // Heat: OpenStare's own heat-map gradient (operator, 2026-11-10) — dark blue, blue, cyan, green,
  // yellow, red: the classic density-surface gradient.
  { id: 'seq-heat', label: 'Heat', kind: 'sequential-multi', anchors: ['#000080', '#0000ff', '#00ffff', '#00ff00', '#ffff00', '#ff0000'] },
  // matplotlib (CC0), 9 points (Viridis, unchanged) and 11 points (the others).
  { id: 'seq-viridis', label: 'Viridis', kind: 'sequential-multi', anchors: ['#440154', '#472d7b', '#3b528b', '#2c728e', '#21918c', '#28ae80', '#5ec962', '#addc30', '#fde725'] },
  { id: 'seq-magma', label: 'Magma', kind: 'sequential-multi', anchors: ['#000004', '#140e36', '#3b0f70', '#641a80', '#8c2981', '#b73779', '#de4968', '#f7705c', '#fe9f6d', '#fecf92', '#fcfdbf'] },
  { id: 'seq-inferno', label: 'Inferno', kind: 'sequential-multi', anchors: ['#000004', '#160b39', '#420a68', '#6a176e', '#932667', '#bc3754', '#dd513a', '#f37819', '#fca50a', '#f6d746', '#fcffa4'] },
  { id: 'seq-plasma', label: 'Plasma', kind: 'sequential-multi', anchors: ['#0d0887', '#41049d', '#6a00a8', '#8f0da4', '#b12a90', '#cc4778', '#e16462', '#f2844b', '#fca636', '#fcce25', '#f0f921'] },
  // Cividis (Nuñez et al. 2018, via viridisLite, MIT), 10 points.
  { id: 'seq-cividis', label: 'Cividis', kind: 'sequential-multi', anchors: ['#00204d', '#00336f', '#39486b', '#575c6d', '#707173', '#8a8779', '#a69d75', '#c4b56c', '#e4cf5b', '#ffea46'] },
  // Turbo (Mikhailov, Google 2019, Apache-2.0), 11 points of d3-scale-chromatic's polynomial (ISC).
  { id: 'seq-turbo', label: 'Turbo', kind: 'sequential-multi', anchors: ['#23171b', '#4a58dd', '#2f9df5', '#27d7c4', '#4df884', '#95fb51', '#dedd32', '#ffa423', '#f65f18', '#ba2208', '#900c00'] },
  // ColorBrewer 2.0, 9-class.
  { id: 'seq-ylorrd', label: 'YlOrRd', kind: 'sequential-multi', anchors: ['#ffffcc', '#ffeda0', '#fed976', '#feb24c', '#fd8d3c', '#fc4e2a', '#e31a1c', '#bd0026', '#800026'] },
  { id: 'seq-bugn', label: 'BuGn', kind: 'sequential-multi', anchors: ['#f7fcfd', '#e5f5f9', '#ccece6', '#99d8c9', '#66c2a4', '#41ae76', '#238b45', '#006d2c', '#00441b'] },
  { id: 'seq-ylgnbu', label: 'YlGnBu', kind: 'sequential-multi', anchors: ['#ffffd9', '#edf8b1', '#c7e9b4', '#7fcdbb', '#41b6c4', '#1d91c0', '#225ea8', '#253494', '#081d58'] },
  { id: 'seq-ylgn', label: 'YlGn', kind: 'sequential-multi', anchors: ['#ffffe5', '#f7fcb9', '#d9f0a3', '#addd8e', '#78c679', '#41ab5d', '#238443', '#006837', '#004529'] },
  { id: 'seq-gnbu', label: 'GnBu', kind: 'sequential-multi', anchors: ['#f7fcf0', '#e0f3db', '#ccebc5', '#a8ddb5', '#7bccc4', '#4eb3d3', '#2b8cbe', '#0868ac', '#084081'] },
  { id: 'seq-pubu', label: 'PuBu', kind: 'sequential-multi', anchors: ['#fff7fb', '#ece7f2', '#d0d1e6', '#a6bddb', '#74a9cf', '#3690c0', '#0570b0', '#045a8d', '#023858'] },
  { id: 'seq-orrd', label: 'OrRd', kind: 'sequential-multi', anchors: ['#fff7ec', '#fee8c8', '#fdd49e', '#fdbb84', '#fc8d59', '#ef6548', '#d7301f', '#b30000', '#7f0000'] },
  { id: 'seq-rdpu', label: 'RdPu', kind: 'sequential-multi', anchors: ['#fff7f3', '#fde0dd', '#fcc5c0', '#fa9fb5', '#f768a1', '#dd3497', '#ae017e', '#7a0177', '#49006a'] },
  // ---- Diverging (ColorBrewer 2.0, 11-class) ----
  { id: 'div-rdbu', label: 'RdBu', kind: 'diverging', anchors: ['#67001f', '#b2182b', '#d6604d', '#f4a582', '#fddbc7', DIVERGING_MIDPOINT, '#d1e5f0', '#92c5de', '#4393c3', '#2166ac', '#053061'] },
  {
    id: 'div-rdylgn',
    label: 'RdYlGn ⚠', // colorblind-caution glyph in the copy string — not an icon-set icon
    kind: 'diverging',
    anchors: ['#a50026', '#d73027', '#f46d43', '#fdae61', '#fee08b', '#ffffbf', '#d9ef8b', '#a6d96a', '#66bd63', '#1a9850', '#006837'],
  },
  { id: 'div-puor', label: 'PuOr', kind: 'diverging', anchors: ['#7f3b08', '#b35806', '#e08214', '#fdb863', '#fee0b6', DIVERGING_MIDPOINT, '#d8daeb', '#b2abd2', '#8073ac', '#542788', '#2d004b'] },
  { id: 'div-spectral', label: 'Spectral', kind: 'diverging', anchors: ['#9e0142', '#d53e4f', '#f46d43', '#fdae61', '#fee08b', '#ffffbf', '#e6f598', '#abdda4', '#66c2a5', '#3288bd', '#5e4fa2'] },
  { id: 'div-rdylbu', label: 'RdYlBu', kind: 'diverging', anchors: ['#a50026', '#d73027', '#f46d43', '#fdae61', '#fee090', '#ffffbf', '#e0f3f8', '#abd9e9', '#74add1', '#4575b4', '#313695'] },
  { id: 'div-brbg', label: 'BrBG', kind: 'diverging', anchors: ['#543005', '#8c510a', '#bf812d', '#dfc27d', '#f6e8c3', '#f5f5f5', '#c7eae5', '#80cdc1', '#35978f', '#01665e', '#003c30'] },
  { id: 'div-piyg', label: 'PiYG', kind: 'diverging', anchors: ['#8e0152', '#c51b7d', '#de77ae', '#f1b6da', '#fde0ef', DIVERGING_MIDPOINT, '#e6f5d0', '#b8e186', '#7fbc41', '#4d9221', '#276419'] },
  // ---- Qualitative ----
  // Category 10: OpenStare's own categorical palette (the Categorized default).
  {
    id: 'qual-category10',
    label: 'Category 10',
    kind: 'qualitative',
    anchors: [
      '#4C9AFF', '#36B37E', '#FFAB00', '#FF5630', '#6554C0',
      '#00B8D9', '#FF8B00', '#57D9A3', '#998DD9', '#79E2F2',
    ],
  },
  // ColorBrewer 2.0 qualitative sets.
  { id: 'qual-set1', label: 'Set 1', kind: 'qualitative', anchors: ['#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00', '#ffff33', '#a65628', '#f781bf', '#999999'] },
  { id: 'qual-set2', label: 'Set 2', kind: 'qualitative', anchors: ['#66c2a5', '#fc8d62', '#8da0cb', '#e78ac3', '#a6d854', '#ffd92f', '#e5c494', '#b3b3b3'] },
  { id: 'qual-dark2', label: 'Dark 2', kind: 'qualitative', anchors: ['#1b9e77', '#d95f02', '#7570b3', '#e7298a', '#66a61e', '#e6ab02', '#a6761d', '#666666'] },
  { id: 'qual-paired', label: 'Paired', kind: 'qualitative', anchors: ['#a6cee3', '#1f78b4', '#b2df8a', '#33a02c', '#fb9a99', '#e31a1c', '#fdbf6f', '#ff7f00', '#cab2d6', '#6a3d9a', '#ffff99', '#b15928'] },
  // ColorBrewer "Pastel1".
  { id: 'qual-pastel', label: 'Pastel', kind: 'qualitative', anchors: ['#fbb4ae', '#b3cde3', '#ccebc5', '#decbe4', '#fed9a6', '#ffffcc', '#e5d8bd', '#fddaec', '#f2f2f2'] },
  { id: 'qual-accent', label: 'Accent', kind: 'qualitative', anchors: ['#7fc97f', '#beaed4', '#fdc086', '#ffff99', '#386cb0', '#f0027f', '#bf5b17', '#666666'] },
]

/** Default graduated ramp id (D-08/UI-SPEC §2: "Graduated default ramp: Blues"). */
export const DEFAULT_GRADUATED_RAMP_ID = 'seq-blues'

/** Default categorized (qualitative) ramp id (UI-SPEC §2: "Categorized default ramp: Category 10"). */
export const DEFAULT_CATEGORIZED_RAMP_ID = 'qual-category10'

/** Default heatmap ramp id (operator, 2026-11-10). */
export const DEFAULT_HEATMAP_RAMP_ID = 'seq-heat'

/** The ramp with `id`, if any. */
export function rampById(id: string): ColorRamp | undefined {
  return RAMPS.find(r => r.id === id)
}

// ---------------------------------------------------------------------------
// hex <-> rgb lerp (D-24, 87-20: hexToRgb shared via internal/color.ts;
// this module's own parse-fallback (black) is preserved explicitly, since it
// differs from the shared default (white) and ramp anchors are curated
// literals where a black fallback is effectively unreachable in practice)
// ---------------------------------------------------------------------------

/** Malformed-input fallback preserved from this module's pre-reconciliation `hexToRgb` (black). */
const RAMP_HEX_FALLBACK: RGB = [0, 0, 0]

function channelToHex(v: number): string {
  const clamped = Math.max(0, Math.min(255, Math.round(v)))
  return clamped.toString(16).padStart(2, '0')
}

function rgbToHex([r, g, b]: RGB): string {
  return `#${channelToHex(r)}${channelToHex(g)}${channelToHex(b)}`
}

// #456: interpolation runs in OKLab (Björn Ottosson, 2020), a perceptual colour space, so the
// steps between two stops look even rather than dipping through grey as straight RGB does.
type Lab = [number, number, number]

const toLinear = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
const fromLinear = (v: number) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.max(v, 0) ** (1 / 2.4) - 0.055)

function rgbToOklab([r8, g8, b8]: RGB): Lab {
  const [r, g, b] = [toLinear(r8), toLinear(g8), toLinear(b8)]
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

function oklabToRgb([L, A, B]: Lab): RGB {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3
  return [
    fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ]
}

/** Interpolate between two `#rrggbb` hex colors at `t` in [0,1], in OKLab. Always returns a valid 6-digit hex. */
function lerpHex(a: string, b: string, t: number): string {
  const la = rgbToOklab(hexToRgb(a, RAMP_HEX_FALLBACK))
  const lb = rgbToOklab(hexToRgb(b, RAMP_HEX_FALLBACK))
  return rgbToHex(oklabToRgb([la[0] + (lb[0] - la[0]) * t, la[1] + (lb[1] - la[1]) * t, la[2] + (lb[2] - la[2]) * t]))
}

/**
 * #456: the `i`-th colour past a qualitative palette's own — hues a golden angle apart in OKLCH at
 * a fixed mid lightness and chroma, so no class past the palette repeats an earlier one.
 */
function extraQualitative(i: number): string {
  const hue = ((i * 137.508) % 360) * (Math.PI / 180)
  return rgbToHex(oklabToRgb([0.68, 0.13 * Math.cos(hue), 0.13 * Math.sin(hue)]))
}

// ---------------------------------------------------------------------------
// sampleRamp
// ---------------------------------------------------------------------------

/**
 * Sample `ramp` into exactly `n` hex color stops (n >= 1).
 * - `sequential-single`/`sequential-multi`/`diverging`: piecewise interpolation in OKLab across
 *   `ramp.anchors` (the published stops), evenly spaced.
 * - `qualitative`: returns the first `n` anchors; past the anchor count, further distinct colours
 *   ([`extraQualitative`], #456) — never a repeat of an earlier class's colour.
 * `reversed` reverses the anchor order before sampling/cycling. Never throws;
 * every returned string is a valid `#rrggbb` hex literal.
 */
export function sampleRamp(ramp: ColorRamp, n: number, reversed = false): string[] {
  const count = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
  if (count === 0) return []

  const anchors = reversed ? [...ramp.anchors].reverse() : ramp.anchors
  if (anchors.length === 0) return new Array(count).fill('#000000')

  if (ramp.kind === 'qualitative') {
    const out: string[] = []
    for (let i = 0; i < count; i++) out.push(i < anchors.length ? anchors[i] : extraQualitative(i - anchors.length))
    return out
  }

  if (anchors.length === 1 || count === 1) {
    return new Array(count).fill(anchors[0])
  }

  const out: string[] = []
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1)
    const scaled = t * (anchors.length - 1)
    const segIdx = Math.min(Math.floor(scaled), anchors.length - 2)
    const localT = scaled - segIdx
    out.push(lerpHex(anchors[segIdx], anchors[segIdx + 1], localT))
  }
  return out
}

// ---------------------------------------------------------------------------
// hashToPaletteIndex — deterministic string hash -> palette index (STYLE-10,
// "Random Color by ID" — ArcGIS Arcade `hash(<attribute>) % N` mental model)
// ---------------------------------------------------------------------------

/**
 * FNV-1a 32-bit hash — a fast, well-distributed, PURE string hash (no
 * `Math.random`, no `Date`-based seed) so the same input string always
 * produces the same output, forever, across reloads/sessions/renderers.
 * Standard public-domain algorithm (Fowler/Noll/Vo), not a project invention.
 */
function fnv1aHash(str: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0 // coerce to an unsigned 32-bit integer
}

/**
 * Deterministic `idValue` -> palette index in `[0, n)` (STYLE-10). Same id
 * string always resolves to the same index — the "same ID -> same color,
 * always" contract that makes this scheme deterministic across reloads AND
 * across the two independent renderers (vector features, track entities)
 * that both hash through this single function. `n <= 0` or non-finite
 * resolves to `0` (never throws, never divides by zero on a malformed/empty
 * palette).
 */
export function hashToPaletteIndex(idValue: string, n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0
  return fnv1aHash(idValue) % Math.floor(n)
}

// ---------------------------------------------------------------------------
// Random-by-ID palette cache (STYLE-10) — `resolveRandomByIdColor`
// (thematicStyleEngine.ts) calls this ONCE PER FEATURE (potentially thousands
// of times per render); memoizing on (rampId, n, reversed) means `sampleRamp`
// itself only runs once per distinct style config, not once per feature.
// ---------------------------------------------------------------------------

const randomByIdPaletteCache = new Map<string, string[]>()

/**
 * Sample (and cache) a palette of `n` colors from ramp `rampId` for the
 * Random-by-ID symbology mode / Track per-entity color-by-ID option
 * (STYLE-10). Falls back to the qualitative Category-10 ramp when `rampId`
 * doesn't resolve to a registered ramp (never throws, mirrors `sampleRamp`'s
 * own defensive posture).
 */
export function getRandomByIdPalette(rampId: string, n: number, reversed = false): string[] {
  const key = `${rampId}|${n}|${reversed}`
  const cached = randomByIdPaletteCache.get(key)
  if (cached) return cached
  const ramp = RAMPS.find(r => r.id === rampId) ?? RAMPS.find(r => r.kind === 'qualitative') ?? RAMPS[0]
  const palette = sampleRamp(ramp, n, reversed)
  randomByIdPaletteCache.set(key, palette)
  return palette
}
