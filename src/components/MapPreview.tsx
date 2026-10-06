import { useEffect, useMemo, useRef } from 'react'
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet'
import type { Map as LeafletMap } from 'leaflet'
import type { Feature, FeatureCollection, Position } from 'geojson'
import type { AreaGeometry, BydelProperties, FylkeProperties, KommuneProperties } from '../lib/types'
import { toDistrikt } from '../lib/distrikter'
import type { DistriktProperties } from '../lib/distrikter'
import type { Theme } from '../hooks/useTheme'

type SelectedProperties = KommuneProperties | BydelProperties
type ContextProperties = FylkeProperties | DistriktProperties

function featureId(props: SelectedProperties): string {
  return 'bydelnummer' in props ? props.bydelnummer : props.kommunenummer
}
function featureLabel(props: SelectedProperties): string {
  return 'bydelnavn' in props ? props.bydelnavn : props.kommunenavn
}
function contextLabel(props: ContextProperties): string {
  return 'fylkesnavn' in props ? props.fylkesnavn : toDistrikt(props).navn
}

interface MapPreviewProps {
  selectedFeatures: FeatureCollection<AreaGeometry, SelectedProperties>
  /** The selected fylker or districts that the kommuner are picked from. */
  contextAreas: FeatureCollection<AreaGeometry, ContextProperties>
  detailPercent: number
  havgrenseKey: string
  /** Whether contextAreas are what gets exported: filled when they are,
   *  dashed outline when drilling into kommuner/bydeler. */
  contextIsTarget: boolean
  theme: Theme
}

const NORWAY_CENTER: [number, number] = [64.5, 13]
const NORWAY_ZOOM = 4

// Monochrome basemaps that match the app's grayscale design; the default OSM
// tiles are far too colorful next to it. Esri's Canvas basemaps need no API key
// (CARTO's basemaps now return an "API KEY REQUIRED" placeholder tile).
const ESRI_CANVAS = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas'
const TILES = {
  light: {
    base: `${ESRI_CANVAS}/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`,
    labels: `${ESRI_CANVAS}/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}`,
  },
  dark: {
    base: `${ESRI_CANVAS}/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`,
    labels: `${ESRI_CANVAS}/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`,
  },
} as const
const TILE_ATTRIBUTION = 'Powered by <a href="https://www.esri.com">Esri</a> | Esri, HERE, Garmin, &copy; OpenStreetMap-bidragsytere'
const TILE_MAX_ZOOM = 16

const SELECTED_STYLE = {
  light: { color: '#0f766e', weight: 1.5, fillColor: '#14b8a6', fillOpacity: 0.4 },
  dark: { color: '#5eead4', weight: 1.5, fillColor: '#2dd4bf', fillOpacity: 0.35 },
} as const

const CONTEXT_STYLE = {
  light: { color: '#64748b', weight: 1, fill: false, dashArray: '4 3' },
  dark: { color: '#94a3b8', weight: 1, fill: false, dashArray: '4 3' },
} as const

export function MapPreview({
  selectedFeatures,
  contextAreas,
  detailPercent,
  havgrenseKey,
  contextIsTarget,
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
      selectedFeatures.features.length > 0 ? selectedFeatures : contextAreas

    if (zoomTarget.features.length === 0) {
      map.setView(NORWAY_CENTER, NORWAY_ZOOM)
      return
    }

    const bounds = featureCollectionBounds(zoomTarget)
    if (bounds) map.fitBounds(bounds, { padding: [24, 24] })
  }, [selectedFeatures, contextAreas])

  const contextKey = `context-${contextAreas.features.map((f) => contextLabel(f.properties)).join(',')}-${detailPercent}-${havgrenseKey}-${contextIsTarget}-${theme}`

  return (
    <div>
      <MapContainer
        center={NORWAY_CENTER}
        zoom={NORWAY_ZOOM}
        scrollWheelZoom
        className="h-[420px] w-full rounded-sm border border-slate-200 dark:border-slate-800"
        ref={mapRef}
        aria-label="Forhåndsvisning av valgte områder på kart"
      >
        <TileLayer
          key={`tiles-${theme}`}
          attribution={TILE_ATTRIBUTION}
          url={TILES[theme].base}
          maxNativeZoom={TILE_MAX_ZOOM}
        />
        <TileLayer
          key={`labels-${theme}`}
          url={TILES[theme].labels}
          maxNativeZoom={TILE_MAX_ZOOM}
        />

        {/* Fylke/district layer: filled when it is the export target, dashed outline otherwise */}
        {contextIsTarget ? (
          <GeoJSON
            key={contextKey}
            data={contextAreas}
            style={() => SELECTED_STYLE[theme]}
            onEachFeature={(feature: Feature<AreaGeometry, ContextProperties>, layer) => {
              layer.bindTooltip(contextLabel(feature.properties), { sticky: true })
            }}
          />
        ) : (
          <GeoJSON
            key={contextKey}
            data={contextAreas}
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
        {selectedFeatures.features.length === 0 && contextAreas.features.length === 0
          ? 'Ingen områder er valgt ennå. Kartet viser hele Norge.'
          : `Kartet viser ${
              contextIsTarget
                ? contextAreas.features.map((f) => contextLabel(f.properties)).join(', ')
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
