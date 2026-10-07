import * as topojsonClient from 'topojson-client'
import { topology as buildTopology } from 'topojson-server'
import type { FeatureCollection, Position } from 'geojson'
import type { GeometryCollection } from 'topojson-specification'
import type { NorwayTopologyType } from '../hooks/useTopology'
import { DISTRIKT_KINDS, toDistrikt } from './distrikter'
import type { DistriktProperties } from './distrikter'
import type {
  AreaGeometry,
  BydelProperties,
  DistriktKind,
  GrunnkretsProperties,
  ExportFormat,
  ExportGranularity,
  FylkeProperties,
  KommuneProperties,
} from './types'

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

/** Extracts the selected bydeler from the bundled bydeler layer. */
export function selectedBydelFeatureCollection(
  topology: NorwayTopologyType,
  selectedBydeler: Set<string>,
): FeatureCollection<AreaGeometry, BydelProperties> {
  const all = topojsonClient.feature(topology, topology.objects.bydeler) as FeatureCollection<
    AreaGeometry,
    BydelProperties
  >
  return {
    type: 'FeatureCollection',
    features: all.features.filter((f) => selectedBydeler.has(f.properties.bydelnummer)),
  }
}

/** Extracts the selected politidistrikter or 110-distrikter, with or without "havgrense". */
export function selectedDistriktFeatureCollection(
  topology: NorwayTopologyType,
  kind: DistriktKind,
  medHavgrense: boolean,
  selectedIds: Set<string>,
): FeatureCollection<AreaGeometry, DistriktProperties> {
  const { objects } = DISTRIKT_KINDS[kind]
  // The four district objects have different property types; widen to their
  // union so topojson-client's overloads accept whichever one we pick.
  const object = topology.objects[medHavgrense ? objects.med : objects.uten] as GeometryCollection<DistriktProperties>
  const all = topojsonClient.feature(topology, object) as FeatureCollection<AreaGeometry, DistriktProperties>
  return {
    type: 'FeatureCollection',
    features: all.features.filter((f) => selectedIds.has(toDistrikt(f.properties).id)),
  }
}

/**
 * Builds the file to download, in the requested format and granularity.
 *  - GeoJSON: the plain FeatureCollection of selected features.
 *  - TopoJSON: a fresh topology built from just the selected features (named
 *    after the granularity, e.g. "kommuner" or "politidistrikter"), so the
 *    download only contains the selection — not the whole bundled dataset's arcs.
 */
export function buildExport(
  features:
    | FeatureCollection<AreaGeometry, FylkeProperties>
    | FeatureCollection<AreaGeometry, KommuneProperties>
    | FeatureCollection<AreaGeometry, BydelProperties>
    | FeatureCollection<AreaGeometry, DistriktProperties>
    | FeatureCollection<AreaGeometry, GrunnkretsProperties>,
  granularity: ExportGranularity,
  format: ExportFormat,
): { blob: Blob; extension: string } {
  features = withConsistentWinding(features)
  if (format === 'geojson') {
    const json = JSON.stringify(features)
    return { blob: new Blob([json], { type: 'application/geo+json' }), extension: 'geojson' }
  }

  const topology = buildTopology({ [granularity]: features })
  const json = JSON.stringify(topology)
  return { blob: new Blob([json], { type: 'application/json' }), extension: 'topojson' }
}

/** Twice the signed area of a ring in lon/lat; positive when counter-clockwise. */
function ringArea(ring: Position[]): number {
  let area = 0
  for (let i = 0, n = ring.length - 1; i < n; i++) area += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
  return area
}

/**
 * Every exterior ring clockwise and every hole counter-clockwise — the
 * winding the bundled data uses, and what d3 expects. The detail slider can
 * flip tiny islets (a few points, a few hundred m²) inside out, which tools
 * that honour winding would then draw as covering the rest of the world.
 */
function withConsistentWinding<F extends FeatureCollection<AreaGeometry>>(collection: F): F {
  const fixRing = (ring: Position[], exterior: boolean) =>
    (exterior ? ringArea(ring) > 0 : ringArea(ring) < 0) ? [...ring].reverse() : ring
  const fixPolygon = (polygon: Position[][]) => polygon.map((ring, i) => fixRing(ring, i === 0))
  return {
    ...collection,
    features: collection.features.map((feature) => ({
      ...feature,
      geometry:
        feature.geometry.type === 'Polygon'
          ? { ...feature.geometry, coordinates: fixPolygon(feature.geometry.coordinates) }
          : { ...feature.geometry, coordinates: feature.geometry.coordinates.map(fixPolygon) },
    })),
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * The attribute table of an export (no geometry) as CSV, for joining in Excel
 * or Power BI. Semicolon-separated with a UTF-8 BOM, which is what Norwegian
 * Excel expects. Every value is quoted, so names containing ";" are safe —
 * but note that Excel still strips leading zeros ("0301" → 301) when simply
 * opening the file; the UI tells users to import the key column as text.
 */
export function buildCsv(columns: string[], rows: Record<string, string>[]): Blob {
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`
  const lines = [columns.map(quote).join(';'), ...rows.map((row) => columns.map((c) => quote(row[c] ?? '')).join(';'))]
  return new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
}
