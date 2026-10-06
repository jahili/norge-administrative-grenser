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
  politidistriktnummer: string
  politidistriktnavn: string
  distrikt110id: string
  distrikt110navn: string
}

/** Politidistrikt from SSB's classification 109, e.g. { "p01", "Oslo" }. */
export interface PolitidistriktProperties {
  politidistriktnummer: string
  politidistriktnavn: string
}

/** 110-distrikt (brannalarmsentral district) from DSB; the id is DSB's lokalId. */
export interface Distrikt110Properties {
  distrikt110id: string
  distrikt110navn: string
}

/** Divisions built from whole kommuner, offered as alternatives to fylker. */
export type DistriktKind = 'politidistrikter' | 'distrikter110'

/** What kommuner are grouped by in step 1: fylker or one of the district kinds. */
export type GruppeKind = 'fylker' | DistriktKind

/** A selectable group of kommuner — a fylke, politidistrikt or 110-distrikt. */
export interface KommuneGruppe {
  id: string
  navn: string
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

/** Whether the export contains fylke polygons, kommune subdivisions, bydeler, or districts. */
export type ExportGranularity = 'fylker' | 'kommuner' | 'bydeler' | DistriktKind
