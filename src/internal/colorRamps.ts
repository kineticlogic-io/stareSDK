/**
 * colorRamps.ts — Curated ColorBrewer-style color-ramp registry + sampling
 * helper for categorized/graduated thematic styling (STYLE-04/05, Phase 64, D-09).
 *
 * NO React/DOM/Leaflet/deck.gl imports — pure TypeScript module, mirrors the
 * `symbologyEngine.ts`/`styleSpec.ts` module-header convention.
 *
 * Per `.planning/research/STACK.md` Decision 10 and 64-RESEARCH.md MANDATORY
 * Research Question 3: no `d3-scale-chromatic`/`chroma-js` dependency — a
 * curated inline `RAMPS` registry (published ColorBrewer 2.0 hex stops, public
 * domain, Cynthia Brewer) plus a small local hex→rgb→hex lerp built on the
 * shared `utils/color.ts` `hexToRgb` (D-24, 87-20 — this module's own Q1-seam
 * private copy was reconciled into that shared parser; only `lerpHex`'s
 * hex-string round-trip and its black malformed-input fallback, explicitly
 * preserved via `hexToRgb`'s `fallback` parameter, remain local).
 *
 * All anchor hex values are literal (data-viz exemption from the CLAUDE.md
 * design-token rule — "Geographic map feature colors are intentional —
 * preserve them"). The qualitative palette is the exact Category 10 hex set
 * specified in 64-UI-SPEC.md §2.
 */

import { hexToRgb, type RGB } from './color.js'

/**
 * A curated ramp entry. `anchors` are 2-3 reference stops (published
 * ColorBrewer endpoints, or a curated 8-10 hue set for `qualitative`) —
 * `sampleRamp` interpolates/cycles them to any requested class count.
 */
export interface ColorRamp {
  id: string
  label: string
  kind: 'sequential-single' | 'sequential-multi' | 'diverging' | 'qualitative'
  /** Anchor hex colors — sampled/interpolated to N stops at classify-time. */
  anchors: string[]
}

/**
 * Neutral diverging midpoint (standard ColorBrewer diverging-scheme center —
 * a near-white neutral so the two poles read as distinct directions from a
 * shared zero/mid reference, D-09's "threat scale" framing).
 */
const DIVERGING_MIDPOINT = '#f7f7f7'

/**
 * Twelve sequential/diverging ramps (Graduated mode) + one qualitative
 * Category 10 palette (Categorized mode auto-assign) — 64-UI-SPEC.md §2
 * "Curated ramp set". Endpoint hex values are the published ColorBrewer 2.0
 * light/dark endpoints (public domain, Cynthia Brewer — a deterministic,
 * citable external reference).
 */
export const RAMPS: ColorRamp[] = [
  // Sequential (single-hue)
  { id: 'seq-blues', label: 'Blues', kind: 'sequential-single', anchors: ['#eff3ff', '#08519c'] },
  { id: 'seq-greens', label: 'Greens', kind: 'sequential-single', anchors: ['#edf8e9', '#006d2c'] },
  { id: 'seq-oranges', label: 'Oranges', kind: 'sequential-single', anchors: ['#feedde', '#a63603'] },
  { id: 'seq-reds', label: 'Reds', kind: 'sequential-single', anchors: ['#fee5d9', '#a50f15'] },
  { id: 'seq-purples', label: 'Purples', kind: 'sequential-single', anchors: ['#f2f0f7', '#54278f'] },
  { id: 'seq-greys', label: 'Greys', kind: 'sequential-single', anchors: ['#f7f7f7', '#252525'] },
  // Sequential (multi-hue)
  { id: 'seq-viridis', label: 'Viridis', kind: 'sequential-multi', anchors: ['#440154', '#fde725'] },
  { id: 'seq-ylorrd', label: 'YlOrRd', kind: 'sequential-multi', anchors: ['#ffffb2', '#bd0026'] },
  { id: 'seq-bugn', label: 'BuGn', kind: 'sequential-multi', anchors: ['#edf8fb', '#006d2c'] },
  // Diverging — apt for mil/intel "threat scale" low/mid/high framing (a
  // neutral midpoint is inserted so the two poles genuinely diverge).
  { id: 'div-rdbu', label: 'RdBu', kind: 'diverging', anchors: ['#ca0020', DIVERGING_MIDPOINT, '#0571b0'] },
  {
    id: 'div-rdylgn',
    label: 'RdYlGn ⚠', // colorblind-caution glyph in copy string (D-09 discretion) — not an icon-set icon, exempt from Tabler-only rule
    kind: 'diverging',
    anchors: ['#d73027', DIVERGING_MIDPOINT, '#1a9850'],
  },
  { id: 'div-puor', label: 'PuOr', kind: 'diverging', anchors: ['#e66101', DIVERGING_MIDPOINT, '#5e3c99'] },
  // Qualitative (Categorized default auto-assign) — 64-UI-SPEC.md §2 Category 10.
  {
    id: 'qual-category10',
    label: 'Category 10',
    kind: 'qualitative',
    anchors: [
      '#4C9AFF', '#36B37E', '#FFAB00', '#FF5630', '#6554C0',
      '#00B8D9', '#FF8B00', '#57D9A3', '#998DD9', '#79E2F2',
    ],
  },
  // Live operator request (2026-07-19, batch 2, issue 6 — "On Random Color by ID I
  // cannot change the gradient color palette being used"): the qualitative kind
  // previously had EXACTLY ONE entry (Category 10 above), so `ui/RampPicker`'s
  // "Qualitative" list — already wired to Random-by-ID's `ramp`/`reverse` fields,
  // see RandomByIdSection/StyleEditor.tsx — rendered a single non-actionable row:
  // there was nothing to actually pick between. These three additional published
  // ColorBrewer 2.0 qualitative palettes (public domain, Cynthia Brewer — same
  // citable-external-reference convention as every other RAMPS entry) give the
  // operator genuine palette choice for both Random-by-ID and Categorized mode
  // (both consume the SAME qualitative RAMPS subset via RampPicker's `kind`).
  {
    id: 'qual-set1',
    label: 'Set 1',
    kind: 'qualitative',
    anchors: [
      '#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00',
      '#ffff33', '#a65628', '#f781bf', '#999999',
    ],
  },
  {
    id: 'qual-set2',
    label: 'Set 2',
    kind: 'qualitative',
    anchors: [
      '#66c2a5', '#fc8d62', '#8da0cb', '#e78ac3', '#a6d854',
      '#ffd92f', '#e5c494', '#b3b3b3',
    ],
  },
  {
    id: 'qual-dark2',
    label: 'Dark 2',
    kind: 'qualitative',
    anchors: [
      '#1b9e77', '#d95f02', '#7570b3', '#e7298a', '#66a61e',
      '#e6ab02', '#a6761d', '#666666',
    ],
  },
]

/** Default graduated ramp id (D-08/UI-SPEC §2: "Graduated default ramp: Blues"). */
export const DEFAULT_GRADUATED_RAMP_ID = 'seq-blues'

/** Default categorized (qualitative) ramp id (UI-SPEC §2: "Categorized default ramp: Category 10"). */
export const DEFAULT_CATEGORIZED_RAMP_ID = 'qual-category10'

// ---------------------------------------------------------------------------
// hex <-> rgb lerp (D-24, 87-20: hexToRgb now shared via utils/color.ts;
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

/** Linear-interpolate between two `#rrggbb` hex colors at `t` in [0,1]. Always returns a valid 6-digit hex. */
function lerpHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a, RAMP_HEX_FALLBACK)
  const [br, bg, bb] = hexToRgb(b, RAMP_HEX_FALLBACK)
  return rgbToHex([
    ar + (br - ar) * t,
    ag + (bg - ag) * t,
    ab + (bb - ab) * t,
  ])
}

// ---------------------------------------------------------------------------
// sampleRamp
// ---------------------------------------------------------------------------

/**
 * Sample `ramp` into exactly `n` hex color stops (n >= 1).
 * - `sequential-single`/`sequential-multi`/`diverging`: piecewise-linear RGB
 *   interpolation across `ramp.anchors` (2-3 stops), evenly spaced.
 * - `qualitative`: returns the first `n` anchors, cycling (modulo) once `n`
 *   exceeds the anchor count (e.g. n=12 on a 10-hue palette repeats hues 1-2).
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
    for (let i = 0; i < count; i++) out.push(anchors[i % anchors.length])
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
