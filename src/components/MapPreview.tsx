import { useEffect, useMemo, useRef } from 'react'
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet'
import type { Map as LeafletMap } from 'leaflet'
import type { Feature, FeatureCollection, Position } from 'geojson'
import type { AreaGeometry, FylkeProperties, KommuneProperties } from '../lib/types'

interface MapPreviewProps {
  selectedFeatures: FeatureCollection<AreaGeometry, KommuneProperties>
  contextFylker: FeatureCollection<AreaGeometry, FylkeProperties>
}

const NORWAY_CENTER: [number, number] = [64.5, 13]
const NORWAY_ZOOM = 4

export function MapPreview({ selectedFeatures, contextFylker }: MapPreviewProps) {
  const mapRef = useRef<LeafletMap | null>(null)

  // Re-key the GeoJSON layer whenever the selection changes shape, so Leaflet
  // replaces (rather than diffs) the layer — much simpler and fast enough at
  // this data size.
  const selectionKey = useMemo(
    () => selectedFeatures.features.map((f) => f.properties.kommunenummer).join(','),
    [selectedFeatures],
  )

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (selectedFeatures.features.length === 0) {
      map.setView(NORWAY_CENTER, NORWAY_ZOOM)
      return
    }
    // Compute bounds from the feature collection directly (avoids creating a
    // throwaway Leaflet layer just to read its bounds).
    const bounds = featureCollectionBounds(selectedFeatures)
    if (bounds) map.fitBounds(bounds, { padding: [24, 24] })
  }, [selectedFeatures])

  return (
    <div>
      <MapContainer
        center={NORWAY_CENTER}
        zoom={NORWAY_ZOOM}
        scrollWheelZoom
        className="h-[420px] w-full rounded-lg border border-slate-200"
        ref={mapRef}
        aria-label="Forhåndsvisning av valgte områder på kart"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-bidragsytere'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <GeoJSON
          key={`fylker-${contextFylker.features.length}`}
          data={contextFylker}
          style={() => ({ color: '#94a3b8', weight: 1, fill: false, dashArray: '4 3' })}
          interactive={false}
        />
        {selectedFeatures.features.length > 0 && (
          <GeoJSON
            key={`kommuner-${selectionKey}`}
            data={selectedFeatures}
            style={() => ({ color: '#1d4ed8', weight: 1.5, fillColor: '#3b82f6', fillOpacity: 0.45 })}
            onEachFeature={(feature: Feature<AreaGeometry, KommuneProperties>, layer) => {
              layer.bindTooltip(feature.properties.kommunenavn, { sticky: true })
            }}
          />
        )}
      </MapContainer>

      {/* Non-visual summary so the selection is available without the map. */}
      <p className="sr-only" aria-live="polite">
        {selectedFeatures.features.length === 0
          ? 'Ingen kommuner er valgt ennå. Kartet viser hele Norge.'
          : `Kartet viser ${selectedFeatures.features.length} valgte kommuner: ${selectedFeatures.features
              .map((f) => f.properties.kommunenavn)
              .join(', ')}.`}
      </p>
    </div>
  )
}

/** Yields every ring (coordinate position array) in a Polygon or MultiPolygon, regardless of nesting depth. */
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
