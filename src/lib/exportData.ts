import * as topojsonClient from 'topojson-client'
import { topology as buildTopology } from 'topojson-server'
import type { FeatureCollection } from 'geojson'
import type { NorwayTopologyType } from '../hooks/useTopology'
import type { AreaGeometry, ExportFormat, ExportGranularity, KommuneProperties } from './types'

/** Extracts the selected kommuner from one of the bundled kommune layers (with or without "havgrense") as a standalone GeoJSON FeatureCollection (WGS84). */
export function selectedFeatureCollection(
  topology: NorwayTopologyType,
  objectName: 'kommuner' | 'kommunerUtenHavgrense',
  selectedKommuner: Set<string>,
): FeatureCollection<AreaGeometry, KommuneProperties> {
  // Kommune geometries in our bundled dataset are a mix of Polygon and
  // MultiPolygon (mainland-only vs. areas with islands); topojson-client's
  // return type is the broader Geometry union because TopoJSON doesn't
  // statically guarantee either shape.
  const all = topojsonClient.feature(topology, topology.objects[objectName]) as FeatureCollection<
    AreaGeometry,
    KommuneProperties
  >
  return {
    type: 'FeatureCollection',
    features: all.features.filter((f) => selectedKommuner.has(f.properties.kommunenummer)),
  }
}

/**
 * Builds the file to download, in the requested format and granularity.
 *  - GeoJSON: the plain FeatureCollection of selected features.
 *  - TopoJSON: a fresh topology built from just the selected features (named
 *    after the granularity, "kommuner" or "fylker"), so the download only
 *    contains the selection — not the whole bundled dataset's arcs.
 */
export function buildExport<P extends KommuneProperties | { fylkesnummer: string; fylkesnavn: string }>(
  features: FeatureCollection<AreaGeometry, P>,
  granularity: ExportGranularity,
  format: ExportFormat,
): { blob: Blob; extension: string } {
  if (format === 'geojson') {
    const json = JSON.stringify(features)
    return { blob: new Blob([json], { type: 'application/geo+json' }), extension: 'geojson' }
  }

  const topology = buildTopology({ [granularity]: features })
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
