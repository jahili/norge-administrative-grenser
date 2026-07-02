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

/** City districts (bydeler) and sub-areas (delområder) for the six kommuner
 *  that have them: Bergen, Fredrikstad, Kristiansand, Oslo, Stavanger, Trondheim. */
export interface BydelProperties {
  /** Unique id within Norway, encoding kommunenummer as the first 4 digits. */
  bydelnummer: string
  bydelnavn: string
  kommunenummer: string
}

export type ExportFormat = 'geojson' | 'topojson'

/** Whether the export contains fylke polygons, kommune subdivisions, or bydeler. */
export type ExportGranularity = 'fylker' | 'kommuner' | 'bydeler'
