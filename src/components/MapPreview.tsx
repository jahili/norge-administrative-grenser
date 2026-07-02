import { useEffect, useMemo, useRef } from 'react'
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet'
import type { Map as LeafletMap } from 'leaflet'
import type { Feature, FeatureCollection, Position } from 'geojson'
import type { AreaGeometry, BydelProperties, FylkeProperties, KommuneProperties } from '../lib/types'
import type { ExportGranularity } from '../lib/types'
import type { Theme } from '../hooks/useTheme'

type SelectedProperties = KommuneProperties | BydelProperties

function featureId(props: SelectedProperties): string {
  return 'kommunenummer' in props && 'fylkesnummer' in props ? props.kommunenummer : (props as BydelProperties).bydelnummer
}
function featureLabel(props: SelectedProperties): string {
  return 'kommunenavn' in props ? props.kommunenavn : (props as BydelProperties).bydelnavn
}

interface MapPreviewProps {
  selectedFeatures: FeatureCollection<AreaGeometry, SelectedProperties>
  contextFylker: FeatureCollection<AreaGeometry, FylkeProperties>
  detailPercent: number
  havgrenseKey: string
  /** Controls how contextFylker is rendered: filled when 'fylker' (the export target),
   *  dashed outline when drilling into kommuner/bydeler. */
  previewGranularity: ExportGranularity
  theme: Theme
}

const NORWAY_CENTER: [number, number] = [64.5, 13]
const NORWAY_ZOOM = 4

// Monochrome basemaps that match the app's grayscale design; the default OSM
// tiles are far too colorful next to it.
const TILES = {
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
} as const

const SELECTED_STYLE = {
  light: { color: '#0f172a', weight: 1.5, fillColor: '#334155', fillOpacity: 0.4 },
  dark: { color: '#f1f5f9', weight: 1.5, fillColor: '#cbd5e1', fillOpacity: 0.35 },
} as const

const CONTEXT_STYLE = {
  light: { color: '#64748b', weight: 1, fill: false, dashArray: '4 3' },
  dark: { color: '#94a3b8', weight: 1, fill: false, dashArray: '4 3' },
} as const

export function MapPreview({
  selectedFeatures,
  contextFylker,
  detailPercent,
  havgrenseKey,
  previewGranularity,
  theme,
}: MapPreviewProps) {
  const mapRef = useRef<LeafletMap | null>(null)

  const selectionKey = useMemo(
    () => selectedFeatures.features.map((f) => featureId(f.properties)).join(','),
    [selectedFeatures],
  )

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const zoomTarget =
      selectedFeatures.features.length > 0 ? selectedFeatures : contextFylker

    if (zoomTarget.features.length === 0) {
      map.setView(NORWAY_CENTER, NORWAY_ZOOM)
      return
    }

    const bounds = featureCollectionBounds(zoomTarget)
    if (bounds) map.fitBounds(bounds, { padding: [24, 24] })
  }, [selectedFeatures, contextFylker])

  const fylkerKey = `fylker-${contextFylker.features.length}-${detailPercent}-${havgrenseKey}-${previewGranularity}-${theme}`

  return (
    <div>
      <MapContainer
        center={NORWAY_CENTER}
        zoom={NORWAY_ZOOM}
        scrollWheelZoom
        className="h-[420px] w-full rounded-xl border border-slate-200 dark:border-slate-800"
        ref={mapRef}
        aria-label="Forhåndsvisning av valgte områder på kart"
      >
        <TileLayer
          key={`tiles-${theme}`}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-bidragsytere &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url={TILES[theme]}
        />

        {/* Fylke layer: filled when fylker is the export target, dashed outline otherwise */}
        {previewGranularity === 'fylker' ? (
          <GeoJSON
            key={fylkerKey}
            data={contextFylker}
            style={() => SELECTED_STYLE[theme]}
            onEachFeature={(feature: Feature<AreaGeometry, FylkeProperties>, layer) => {
              layer.bindTooltip(feature.properties.fylkesnavn, { sticky: true })
            }}
          />
        ) : (
          <GeoJSON
            key={fylkerKey}
            data={contextFylker}
            style={() => CONTEXT_STYLE[theme]}
            interactive={false}
          />
        )}

        {/* Kommune / bydel selection layer */}
        {selectedFeatures.features.length > 0 && (
          <GeoJSON
            key={`selection-${selectionKey}-${detailPercent}-${havgrenseKey}-${theme}`}
            data={selectedFeatures}
            style={() => SELECTED_STYLE[theme]}
            onEachFeature={(feature: Feature<AreaGeometry, SelectedProperties>, layer) => {
              layer.bindTooltip(featureLabel(feature.properties), { sticky: true })
            }}
          />
        )}
      </MapContainer>

      <p className="sr-only" aria-live="polite">
        {selectedFeatures.features.length === 0 && contextFylker.features.length === 0
          ? 'Ingen områder er valgt ennå. Kartet viser hele Norge.'
          : `Kartet viser ${
              previewGranularity === 'fylker'
                ? contextFylker.features.map((f) => f.properties.fylkesnavn).join(', ')
                : selectedFeatures.features.map((f) => featureLabel(f.properties)).join(', ')
            }.`}
      </p>
    </div>
  )
}

function* ringsOf(geometry: AreaGeometry): Generator<Position[]> {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  for (const polygon of polygons) {
    yield* polygon
  }
}

function featureCollectionBounds(
  fc: FeatureCollection<AreaGeometry>,
): [[number, number], [number, number]] | null {
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
