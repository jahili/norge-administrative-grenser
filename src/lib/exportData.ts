import * as topojsonClient from 'topojson-client'
import { topology as buildTopology } from 'topojson-server'
import type { Topology, GeometryCollection } from 'topojson-specification'
import type { FeatureCollection } from 'geojson'
import type { AreaGeometry, ExportFormat, KommuneProperties } from './types'

type KommuneTopology = Topology<{ kommuner: GeometryCollection<KommuneProperties> }>

/** Extracts the selected kommuner as a standalone GeoJSON FeatureCollection (WGS84). */
export function selectedFeatureCollection(
  topology: KommuneTopology,
  selectedKommuner: Set<string>,
): FeatureCollection<AreaGeometry, KommuneProperties> {
  // Kommune geometries in our bundled dataset are a mix of Polygon and
  // MultiPolygon (mainland-only vs. areas with islands); topojson-client's
  // return type is the broader Geometry union because TopoJSON doesn't
  // statically guarantee either shape.
  const all = topojsonClient.feature(topology, topology.objects.kommuner) as FeatureCollection<
    AreaGeometry,
    KommuneProperties
  >
  return {
    type: 'FeatureCollection',
    features: all.features.filter((f) => selectedKommuner.has(f.properties.kommunenummer)),
  }
}

/**
 * Builds the file to download, in the requested format.
 *  - GeoJSON: the plain FeatureCollection of selected kommuner.
 *  - TopoJSON: a fresh topology built from just the selected features, so the
 *    download only contains the selection (not the whole bundled dataset).
 */
export function buildExport(
  features: FeatureCollection<AreaGeometry, KommuneProperties>,
  format: ExportFormat,
): { blob: Blob; extension: string } {
  if (format === 'geojson') {
    const json = JSON.stringify(features)
    return { blob: new Blob([json], { type: 'application/geo+json' }), extension: 'geojson' }
  }

  // Build a fresh topology from just the selected features, so the download
  // contains only the selection — not the whole bundled dataset's arcs.
  const topology = buildTopology({ kommuner: features })
  const json = JSON.stringify(topology)
  return { blob: new Blob([json], { type: 'application/json' }), extension: 'topojson' }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
