import type { Polygon, MultiPolygon } from 'geojson'

/** Norway's administrative borders are bundled as a mix of Polygon (mainland-only areas) and MultiPolygon (areas with islands) geometries. */
export type AreaGeometry = Polygon | MultiPolygon

export interface FylkeProperties {
  fylkesnummer: string
  fylkesnavn: string
}

export interface KommuneProperties {
  kommunenummer: string
  kommunenavn: string
  fylkesnummer: string
  fylkesnavn: string
}

export type ExportFormat = 'geojson' | 'topojson'

/** Whether the export contains whole fylke polygons or kommune-level subdivisions. */
export type ExportGranularity = 'fylker' | 'kommuner'
