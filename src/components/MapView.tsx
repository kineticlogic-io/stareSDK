import type { CSSProperties } from 'react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AttributionControl, type GeoJSONSource, type LineLayerSpecification, Map as MapLibreMap, Popup } from 'maplibre-gl'
import { themeFor } from '../styles/chromeTheme.js'
import { useTheme } from '../theme/useTheme.js'

/**
 * MapView — a compact, self-contained MapLibre GL map for previews and pickers
 * (stareSDK, operator-approved 2026-09-25). Import it from the `staresdk/map-view` subpath:
 * `maplibre-gl` is an optional peer dependency, so apps that never show a map do not bundle a
 * WebGL renderer. The consumer also imports `maplibre-gl/dist/maplibre-gl.css` once, and — because
 * MapLibre 5+ resolves its worker relative to its own module, which bundling breaks — hands
 * MapLibre the bundled worker URL once before the first map mounts, exactly as OpenStare's
 * `MapLibreBasemapLayer` does (Vite: `import url from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'`
 * then `setWorkerUrl(url)`). The SDK cannot do this itself: it is bundler-agnostic.
 *
 * Looks like OpenStare's offline basemap (the airgapped default): the ocean, country borders
 * and land fill come from `chromeTheme`'s `offlineBasemap` for the active theme — a JS render
 * path cannot read CSS custom properties, so per CLAUDE.md it uses the JS theme objects, never
 * `getComputedStyle`. Country outlines are passed in (`outlines`: a GeoJSON FeatureCollection
 * or its URL), so the SDK does not bundle Natural Earth; with none given, the map is plain
 * ocean.
 *
 * Points are feature/data colours and therefore theme-invariant (CLAUDE.md): each point may
 * carry its own `color` (e.g. an affiliation colour); the default is `statusInfo`. The selected
 * point gets a ring in the theme's primary text colour. Points render as a GPU circle layer, so
 * thousands are cheap. Clicking a point calls `onSelect(id)`; clicking empty map calls
 * `onSelect(null)`.
 *
 * Lines (`lines`) are polylines drawn under the points — a track's history, a route, a boundary.
 * Like points, their colours are data colours (theme-invariant; default `statusInfo`); each line
 * may set its width, opacity and a dashed stroke. Coordinates are `[lon, lat]`, oldest first for a
 * trail; invalid pairs are dropped and a line with fewer than two valid pairs is not drawn. Lines
 * are not clickable: clicks still go to the points above them.
 *
 * `fitKey`: whenever it changes (and on first data), the view fits all points. Keep it stable
 * while data merely updates so the map does not jump under the user.
 *
 * `tiles`: a raster basemap in place of the outlines — an XYZ URL template such as
 * `https://tiles.example/{z}/{x}/{y}.png` (`{z}`, `{x}`, `{y}`; `{s}` is not expanded). With it,
 * the land fill and country borders are hidden and the tiles draw over the ocean colour; without
 * it (or with an empty `url`), the map is the offline basemap above. It can change while mounted.
 * Its `attribution`, when set, shows in a compact attribution control.
 *
 * `fitTo`: the parent moving the camera — whenever its `key` changes, the view eases to the
 * extent of its `coordinates` (a single coordinate centres on it at `maxZoom`). Same idiom as
 * `fitKey`: bump the key for each request (e.g. a "zoom to" button's click counter); data
 * changes under an unchanged key never move the map.
 */

export interface MapPoint {
  id: string
  latitude: number
  longitude: number
  /** CSS colour for this point (a data colour; theme-invariant). */
  color?: string
  /** Shown on hover. */
  label?: string
}

export interface MapLine {
  id: string
  /** `[longitude, latitude]` pairs, in drawing order. */
  coordinates: [number, number][]
  /** CSS colour for this line (a data colour; theme-invariant). */
  color?: string
  /** Stroke width in pixels (default 2). */
  width?: number
  /** Stroke opacity, 0–1 (default 0.9). */
  opacity?: number
  dashed?: boolean
}

/** A camera request: fit these coordinates whenever `key` changes. */
export interface MapFitTo {
  /** `[longitude, latitude]` pairs to fit. */
  coordinates: [number, number][]
  /** Change to fit again. */
  key: string | number
  /** Pixels kept clear around the extent (default 32). */
  padding?: number
  /** The closest the fit zooms in, e.g. for a single coordinate (default 12). */
  maxZoom?: number
}

/** A raster basemap: an XYZ tile URL template. */
export interface MapTiles {
  /** `{z}`, `{x}` and `{y}` are replaced, e.g. `https://tiles.example/{z}/{x}/{y}.png`. */
  url: string
  /** Credit the tile provider requires, shown on the map. */
  attribution?: string
  /** Tile size in pixels (default 256). */
  tileSize?: number
  /** The highest zoom the server has tiles for (default 19); the map overzooms past it. */
  maxZoom?: number
}

export interface MapViewProps {
  points: MapPoint[]
  /** Polylines drawn under the points. */
  lines?: MapLine[]
  selectedId?: string | null
  onSelect?: (id: string | null) => void
  /** Country outlines: a GeoJSON FeatureCollection or a URL to one. */
  outlines?: GeoJSON.FeatureCollection | string
  /** A raster basemap drawn instead of the outlines. */
  tiles?: MapTiles
  /** Change to re-fit the view to the points. */
  fitKey?: string | number
  /** Fit the view to given coordinates whenever its `key` changes. */
  fitTo?: MapFitTo
  height?: number | string
  'aria-label': string
  style?: CSSProperties
}

type PointProps = { id: string; color: string; label: string; selected: boolean }

/** Points as GeoJSON, skipping invalid coordinates. Exported for tests. */
export function pointsToGeoJSON(
  points: MapPoint[],
  selectedId: string | null | undefined,
  defaultColor: string,
): GeoJSON.FeatureCollection<GeoJSON.Point, PointProps> {
  return {
    type: 'FeatureCollection',
    features: points
      .filter(
        (p) =>
          Number.isFinite(p.latitude) &&
          Number.isFinite(p.longitude) &&
          Math.abs(p.latitude) <= 90 &&
          Math.abs(p.longitude) <= 180,
      )
      .map((p) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.longitude, p.latitude] },
        properties: {
          id: p.id,
          color: p.color ?? defaultColor,
          label: p.label ?? p.id,
          selected: p.id === selectedId,
        },
      })),
  }
}

/** Bounds of the points as [[w, s], [e, n]], or null. Exported for tests. */
export function pointBounds(points: MapPoint[]): [[number, number], [number, number]] | null {
  const ok = points.filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
  if (ok.length === 0) return null
  let [w, s, e, n] = [180, 90, -180, -90]
  for (const p of ok) {
    w = Math.min(w, p.longitude)
    e = Math.max(e, p.longitude)
    s = Math.min(s, p.latitude)
    n = Math.max(n, p.latitude)
  }
  return [
    [w, s],
    [e, n],
  ]
}

type LineProps = { id: string; color: string; width: number; opacity: number; dashed: boolean }

const validCoord = ([lon, lat]: [number, number]) =>
  Number.isFinite(lon) && Number.isFinite(lat) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180

/** Lines as GeoJSON, dropping invalid coordinates and lines left with fewer than two. Exported for tests. */
export function linesToGeoJSON(lines: MapLine[], defaultColor: string): GeoJSON.FeatureCollection<GeoJSON.LineString, LineProps> {
  const features: GeoJSON.Feature<GeoJSON.LineString, LineProps>[] = []
  for (const l of lines) {
    const coordinates = l.coordinates.filter(validCoord)
    if (coordinates.length < 2) continue
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates },
      properties: {
        id: l.id,
        color: l.color ?? defaultColor,
        width: l.width ?? 2,
        opacity: l.opacity ?? 0.9,
        dashed: l.dashed ?? false,
      },
    })
  }
  return { type: 'FeatureCollection', features }
}

/** Bounds of `[lon, lat]` coordinates as [[w, s], [e, n]], or null. Exported for tests. */
export function coordinateBounds(coordinates: [number, number][]): [[number, number], [number, number]] | null {
  return pointBounds(
    coordinates.filter(validCoord).map(([longitude, latitude], i) => ({ id: String(i), latitude, longitude })),
  )
}

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

export function MapView({
  points,
  selectedId,
  onSelect,
  outlines,
  tiles,
  lines,
  fitKey,
  fitTo,
  height = 240,
  'aria-label': ariaLabel,
  style,
}: MapViewProps) {
  const { theme } = useTheme()
  const palette = themeFor(theme)
  const host = useRef<HTMLDivElement>(null)
  const map = useRef<MapLibreMap | null>(null)
  const [ready, setReady] = useState(false)
  const onSelectRef = useRef(onSelect)
  const fitted = useRef<string | number | undefined | null>(null)
  const fittedTo = useRef<string | number | null>(null)
  const paletteRef = useRef(palette)
  // Latest callback/palette for the map's own event handlers (load, click), which outlive any one
  // render. Synced after commit, before paint and before any event can fire.
  useLayoutEffect(() => {
    onSelectRef.current = onSelect
    paletteRef.current = palette
  })

  // Mount once.
  useEffect(() => {
    if (!host.current) return
    const m = new MapLibreMap({
      container: host.current,
      style: { version: 8, sources: {}, layers: [] },
      center: [0, 20],
      zoom: 0.6,
      attributionControl: false,
      renderWorldCopies: false,
      dragRotate: false,
      pitchWithRotate: false,
    })
    m.touchZoomRotate.disableRotation()
    m.on('load', () => {
      const b = paletteRef.current.offlineBasemap
      m.addSource('outlines', { type: 'geojson', data: EMPTY })
      m.addSource('lines', { type: 'geojson', data: EMPTY })
      m.addSource('points', { type: 'geojson', data: EMPTY })
      m.addLayer({ id: 'background', type: 'background', paint: { 'background-color': b.ocean } })
      m.addLayer({
        id: 'land',
        type: 'fill',
        source: 'outlines',
        paint: { 'fill-color': b.landFill, 'fill-opacity': b.landFillOpacity },
      })
      m.addLayer({ id: 'borders', type: 'line', source: 'outlines', paint: { 'line-color': b.countryBorder, 'line-width': 0.6 } })
      // Solid and dashed strokes are two layers: `line-dasharray` cannot be data-driven.
      const linePaint: LineLayerSpecification['paint'] = {
        'line-color': ['get', 'color'],
        'line-width': ['get', 'width'],
        'line-opacity': ['get', 'opacity'],
      }
      const lineLayout: LineLayerSpecification['layout'] = { 'line-join': 'round', 'line-cap': 'round' }
      m.addLayer({ id: 'lines', type: 'line', source: 'lines', filter: ['!', ['get', 'dashed']], layout: lineLayout, paint: linePaint })
      m.addLayer({
        id: 'lines-dashed',
        type: 'line',
        source: 'lines',
        filter: ['get', 'dashed'],
        layout: { 'line-join': 'round' },
        paint: { ...linePaint, 'line-dasharray': [2, 2] },
      })
      m.addLayer({
        id: 'points',
        type: 'circle',
        source: 'points',
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': ['case', ['get', 'selected'], 5, 3.5],
          'circle-stroke-width': ['case', ['get', 'selected'], 2, 0.5],
          'circle-stroke-color': b.ocean,
        },
      })
      setReady(true)
    })
    m.on('click', (e) => {
      const hit = m.queryRenderedFeatures(e.point, { layers: ['points'] })[0]
      onSelectRef.current?.(hit ? String(hit.properties?.id) : null)
    })
    const popup = new Popup({ closeButton: false, closeOnClick: false, offset: 8, className: 'ui-map-view__popup' })
    m.on('mousemove', 'points', (e) => {
      const f = e.features?.[0]
      if (!f) return
      m.getCanvas().style.cursor = 'pointer'
      popup.setLngLat(e.lngLat).setText(String(f.properties?.label ?? '')).addTo(m)
    })
    m.on('mouseleave', 'points', () => {
      m.getCanvas().style.cursor = ''
      popup.remove()
    })
    map.current = m
    return () => {
      popup.remove()
      m.remove()
      map.current = null
    }
  }, [])

  // Theme: basemap palette and selection ring.
  useEffect(() => {
    const m = map.current
    if (!m || !ready) return
    const b = palette.offlineBasemap
    m.setPaintProperty('background', 'background-color', b.ocean)
    m.setPaintProperty('land', 'fill-color', b.landFill)
    m.setPaintProperty('land', 'fill-opacity', b.landFillOpacity)
    m.setPaintProperty('borders', 'line-color', b.countryBorder)
    m.setPaintProperty('points', 'circle-stroke-color', [
      'case',
      ['get', 'selected'],
      palette.colorTextPrimary,
      b.ocean,
    ])
  }, [ready, palette])

  useEffect(() => {
    const m = map.current
    if (!m || !ready) return
    ;(m.getSource('outlines') as GeoJSONSource).setData(outlines ?? EMPTY)
  }, [ready, outlines])

  // Basemap tiles: a raster layer just above the ocean, in place of the land and borders.
  const tileUrl = tiles?.url.trim() || ''
  const tileAttribution = tiles?.attribution?.trim() || ''
  const tileSize = tiles?.tileSize ?? 256
  const tileMaxZoom = tiles?.maxZoom ?? 19
  useEffect(() => {
    const m = map.current
    if (!m || !ready || !tileUrl) return
    m.addSource('basemap', { type: 'raster', tiles: [tileUrl], tileSize, maxzoom: tileMaxZoom, attribution: tileAttribution || undefined })
    m.addLayer({ id: 'basemap', type: 'raster', source: 'basemap' }, 'land')
    m.setLayoutProperty('land', 'visibility', 'none')
    m.setLayoutProperty('borders', 'visibility', 'none')
    const credit = tileAttribution ? new AttributionControl({ compact: true }) : null
    if (credit) m.addControl(credit, 'bottom-right')
    return () => {
      // The map may already be gone (unmounted first).
      if (map.current !== m) return
      if (credit) m.removeControl(credit)
      m.removeLayer('basemap')
      m.removeSource('basemap')
      m.setLayoutProperty('land', 'visibility', 'visible')
      m.setLayoutProperty('borders', 'visibility', 'visible')
    }
  }, [ready, tileUrl, tileAttribution, tileSize, tileMaxZoom])

  useEffect(() => {
    const m = map.current
    if (!m || !ready) return
    ;(m.getSource('points') as GeoJSONSource).setData(pointsToGeoJSON(points, selectedId, palette.statusInfo))
    if (fitted.current !== fitKey || fitted.current === null) {
      const bounds = pointBounds(points)
      if (bounds) {
        m.fitBounds(bounds, { padding: 24, maxZoom: 9, duration: 0 })
        fitted.current = fitKey
      }
    }
  }, [ready, points, selectedId, fitKey, palette.statusInfo])

  useEffect(() => {
    const m = map.current
    if (!m || !ready) return
    ;(m.getSource('lines') as GeoJSONSource).setData(linesToGeoJSON(lines ?? [], palette.statusInfo))
  }, [ready, lines, palette.statusInfo])

  // Camera requests: once per key.
  useEffect(() => {
    const m = map.current
    if (!m || !ready || !fitTo || fittedTo.current === fitTo.key) return
    const bounds = coordinateBounds(fitTo.coordinates)
    if (!bounds) return
    fittedTo.current = fitTo.key
    m.fitBounds(bounds, { padding: fitTo.padding ?? 32, maxZoom: fitTo.maxZoom ?? 12, duration: 600 })
  }, [ready, fitTo])

  return (
    <div
      ref={host}
      role="region"
      aria-label={ariaLabel}
      className="ui-map-view"
      style={{
        height,
        border: '1px solid var(--color-glass-border)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        ...style,
      }}
    />
  )
}
