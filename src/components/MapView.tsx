import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet'
import L from 'leaflet'
import type { Map as LeafletMap, Path, PathOptions } from 'leaflet'
import type { FeatureCollection, Position } from 'geojson'
import type { AreaGeometry } from '../lib/types'
import { handlingTekst } from '../lib/kartlag'
import type { KartFeature, KartHandling, KartOmrade } from '../lib/kartlag'
import type { Theme } from '../hooks/useTheme'
import { IconButton } from './ui'

const NORWAY_CENTER: [number, number] = [64.5, 13]
const NORWAY_ZOOM = 4

// CARTO's raster basemaps need an API key since September 2026 (keyless
// tiles are stamped "API KEY REQUIRED"). The key is free (5M tiles/month
// non-commercial, 1M commercial) and, like any browser map key, public in the
// shipped code anyway. The map draws every area itself, so the tiles are only
// faint context (neighbouring countries, water; 30 % over the sea colour) — without place names, which
// also avoids the large, blurry upscaled «Oslo» label the old separate label
// layer could leave behind while zooming.
const CARTO_KEY = 'cb1_4cw2_1_22d885a57af0aabf9464b97c'
const TILES = {
  light: `https://basemaps.cartocdn.com/rastertiles/light_nolabels/{z}/{x}/{y}{r}.png?key=${CARTO_KEY}`,
  dark: `https://basemaps.cartocdn.com/rastertiles/dark_nolabels/{z}/{x}/{y}{r}.png?key=${CARTO_KEY}`,
} as const
const TILE_ATTRIBUTION =
  'Grenser © Kartverket · &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-bidragsytere &copy; <a href="https://carto.com/attributions">CARTO</a>'

/** Area colours (spec: valgt, hover, uvalgt), per theme. */
const STYLE: Record<Theme, Record<'unselected' | 'selected' | 'hover', PathOptions>> = {
  light: {
    unselected: { fillColor: '#ECEEE9', fillOpacity: 0.95, color: '#C5CBC4', weight: 1 },
    selected: { fillColor: '#9FD3C9', fillOpacity: 0.85, color: '#0F6B63', weight: 1.6 },
    hover: { fillColor: '#0F6B63', fillOpacity: 0.55, color: '#0A4F49', weight: 2.4 },
  },
  dark: {
    unselected: { fillColor: '#2C3633', fillOpacity: 0.95, color: '#4A5652', weight: 1 },
    selected: { fillColor: '#2F7F75', fillOpacity: 0.85, color: '#7FD1C5', weight: 1.6 },
    hover: { fillColor: '#5CBFB3', fillOpacity: 0.55, color: '#A6E3DA', weight: 2.4 },
  },
}

/** react-leaflet's <GeoJSON> ignores new data, so it is re-mounted per collection. */
const collectionIds = new WeakMap<object, number>()
let nextCollectionId = 0
function collectionId(collection: object): number {
  let id = collectionIds.get(collection)
  if (id === undefined) {
    id = nextCollectionId++
    collectionIds.set(collection, id)
  }
  return id
}

interface MapViewProps {
  /** Every area to draw, with selection state and click action. */
  omrader: FeatureCollection<AreaGeometry, KartOmrade>
  onHandling: (handling: KartHandling) => void
  /** What «Zoom til utvalg» (and automatic zooming) fits to. */
  fitTarget: FeatureCollection<AreaGeometry>
  /** Changes whenever the selection changes; the map then zooms to it — unless the change came from a click in the map. */
  fitKey: string
  theme: Theme
  /** Floating content in the top-left corner; gets a function that zooms to the selection. */
  topLeft?: (zoomToSelection: () => void) => ReactNode
  /** Replaces the zoom buttons in the top-right corner (mobile menu). */
  topRight?: ReactNode
  bottomLeft?: ReactNode
  /** Drawer covering the lower part of the map (e.g. the column table). */
  drawer?: ReactNode
  /** Mobile hides the zoom buttons (pinch to zoom) to keep the small map clear. */
  showZoomButtons?: boolean
}

/** The full-height map: areas to click, custom zoom buttons and floating overlays. */
export function MapView({
  omrader,
  onHandling,
  fitTarget,
  fitKey,
  theme,
  topLeft,
  topRight,
  bottomLeft,
  drawer,
  showZoomButtons = true,
}: MapViewProps) {
  const [map, setMap] = useState<LeafletMap | null>(null)
  // Tooltip position relative to the map; `right` when it would overflow the right edge.
  const [hover, setHover] = useState<{ omrade: KartOmrade; left?: number; right?: number; top: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const fromMapClick = useRef(false)
  const onHandlingRef = useRef(onHandling)
  const fitTargetRef = useRef(fitTarget)
  useEffect(() => {
    onHandlingRef.current = onHandling
    fitTargetRef.current = fitTarget
  })

  const zoomToSelection = useCallback(() => {
    if (map) fitTo(map, fitTarget)
  }, [map, fitTarget])

  // Zoom to the selection when it changes from the sidebar; a click in the map
  // should not move the map under the user's cursor. (Keyed on fitKey rather
  // than fitTarget, which also changes with the detail slider.)
  useEffect(() => {
    if (fromMapClick.current) {
      fromMapClick.current = false
      return
    }
    if (map) fitTo(map, fitTargetRef.current)
  }, [fitKey, map])

  // Leaflet needs to know when its container changes size (layout, drawer, sheet).
  useEffect(() => {
    const element = containerRef.current
    if (!element || !map) return
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(element)
    return () => observer.disconnect()
  }, [map])

  const style = useCallback(
    (feature?: KartFeature) => (feature?.properties.selected ? STYLE[theme].selected : STYLE[theme].unselected),
    [theme],
  )

  const onEachFeature = useCallback(
    (feature: KartFeature, layer: L.Layer) => {
      const path = layer as Path
      const omrade = feature.properties
      const base = () => (omrade.selected ? STYLE[theme].selected : STYLE[theme].unselected)
      const show = (e: L.LeafletMouseEvent) => {
        const width = containerRef.current?.clientWidth ?? 0
        const { x, y } = e.containerPoint
        setHover(x > width - 280 ? { omrade, right: width - x + 14, top: y + 14 } : { omrade, left: x + 14, top: y + 14 })
      }
      path.on({
        mouseover: (e: L.LeafletMouseEvent) => {
          path.setStyle(STYLE[theme].hover)
          path.bringToFront()
          show(e)
        },
        mousemove: show,
        mouseout: () => {
          path.setStyle(base())
          setHover(null)
        },
        click: (e: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(e)
          fromMapClick.current = true
          setHover(null)
          onHandlingRef.current(omrade.handling)
        },
      })
    },
    [theme],
  )

  return (
    <div ref={containerRef} className="relative h-full min-h-0 w-full overflow-hidden bg-sea">
      <MapContainer
        center={NORWAY_CENTER}
        zoom={NORWAY_ZOOM}
        zoomControl={false}
        scrollWheelZoom
        // Canvas rather than one SVG element per polygon: grunnkretser can be
        // thousands of features.
        preferCanvas
        className="h-full w-full"
        ref={setMap}
        aria-label="Kart over områdene. Klikk et område for å legge det til i eller fjerne det fra utvalget."
      >
        <TileLayer key={`tiles-${theme}`} attribution={TILE_ATTRIBUTION} url={TILES[theme]} opacity={0.3} />
        <GeoJSON
          key={`omrader-${collectionId(omrader)}-${theme}`}
          data={omrader}
          style={style as (feature?: GeoJSON.Feature) => PathOptions}
          onEachFeature={onEachFeature as (feature: GeoJSON.Feature, layer: L.Layer) => void}
        />
      </MapContainer>

      {/* Overlays sit above Leaflet's panes (z-index up to 1000). */}
      <div className="pointer-events-none absolute inset-x-4 top-4 z-[1000] flex flex-wrap items-start justify-between gap-3">
        <div className="pointer-events-auto">{topLeft?.(zoomToSelection)}</div>
        {topRight && <div className="pointer-events-auto">{topRight}</div>}
        {showZoomButtons && !topRight && (
          <div className="pointer-events-auto flex flex-col overflow-hidden rounded-card border border-line bg-surface shadow-float">
            <IconButton label="Zoom inn" onClick={() => map?.zoomIn()} className="border-b border-line text-xl">
              +
            </IconButton>
            <IconButton label="Zoom ut" onClick={() => map?.zoomOut()} className="text-xl">
              −
            </IconButton>
          </div>
        )}
      </div>

      {hover && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-[1001] flex max-w-[260px] flex-col gap-0.5 rounded-field bg-tooltip px-3 py-2.5 text-tooltip-ink shadow-[0_6px_20px_rgba(21,32,30,0.25)]"
          style={{ left: hover.left, right: hover.right, top: hover.top }}
        >
          <span className="font-semibold">{hover.omrade.navn}</span>
          <span className="font-mono text-xs text-tooltip-muted">
            {[hover.omrade.nummer, hover.omrade.kontekst].filter(Boolean).join(' · ')}
          </span>
          <span className="text-xs text-tooltip-muted">{handlingTekst(hover.omrade)}</span>
        </div>
      )}

      {bottomLeft && <div className="absolute bottom-4 left-4 z-[1000] max-w-[calc(100%-2rem)]">{bottomLeft}</div>}
      {drawer}
    </div>
  )
}

function fitTo(map: LeafletMap, target: FeatureCollection<AreaGeometry>) {
  const bounds = featureCollectionBounds(target)
  if (bounds) map.fitBounds(bounds, { padding: [32, 32] })
  else map.setView(NORWAY_CENTER, NORWAY_ZOOM)
}

function* ringsOf(geometry: AreaGeometry): Generator<Position[]> {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  for (const polygon of polygons) yield* polygon
}

function featureCollectionBounds(fc: FeatureCollection<AreaGeometry>): [[number, number], [number, number]] | null {
  let minLat = Infinity
  let minLng = Infinity
  let maxLat = -Infinity
  let maxLng = -Infinity
  for (const feature of fc.features) {
    for (const ring of ringsOf(feature.geometry)) {
      for (const [lng, lat] of ring) {
        if (lat < minLat) minLat = lat
        if (lat > maxLat) maxLat = lat
        if (lng < minLng) minLng = lng
        if (lng > maxLng) maxLng = lng
      }
    }
  }
  if (!Number.isFinite(minLat)) return null
  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ]
}
