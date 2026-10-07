import type { Polygon, MultiPolygon } from 'geojson'

/** Norway's administrative borders are bundled as a mix of Polygon (mainland-only areas) and MultiPolygon (areas with islands) geometries. */
export type AreaGeometry = Polygon | MultiPolygon

export interface FylkeProperties {
  fylkesnummer: string
  /** Norwegian name. */
  fylkesnavn: string
  /** Full official name in every language, e.g. "Troms - Romsa - Tromssa". */
  fylkesnavnOffisielt: string
}

export interface KommuneProperties {
  kommunenummer: string
  /** Norwegian name. */
  kommunenavn: string
  /** Full official name in every language, e.g. "Guovdageaidnu - Kautokeino". */
  kommunenavnOffisielt: string
  fylkesnummer: string
  fylkesnavn: string
  fylkesnavnOffisielt: string
  /** Plus an id and a name field per district kind, e.g. politidistriktnummer and
   *  politidistriktnavn (see DISTRIKT_KINDS in ./distrikter). */
  [distriktField: string]: string
}

/** Divisions built from whole kommuner, offered as alternatives to fylker. */
export type DistriktKind =
  | 'politidistrikter'
  | 'distrikter110'
  | 'valgdistrikter'
  | 'okonomiskeRegioner'
  | 'landsdeler'
  | 'helseregioner'
  | 'familievernregioner'
  | 'barnevernsregioner'
  | 'reiselivsregioner'
  | 'samiskeValgkretser'
  | 'sentralitet'

/** What kommuner are grouped by in step 1: fylker or one of the district kinds. */
export type GruppeKind = 'fylker' | DistriktKind

/** A selectable group of kommuner — a fylke or a district. */
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

/** A grunnkrets as stored in the per-fylke files (src/assets/grunnkretser/). */
export interface GrunnkretsFilProperties {
  /** 8 digits: kommunenummer + 2-digit delområde + 2-digit krets. */
  grunnkretsnummer: string
  grunnkretsnavn: string
  /** The first 6 digits of grunnkretsnummer. */
  delomradenummer: string
  delomradenavn: string
  kommunenummer: string
}

/** A delområde as stored in the per-fylke files: its grunnkretser merged. */
export interface DelomradeFilProperties {
  /** 6 digits: kommunenummer + 2 digits. */
  delomradenummer: string
  delomradenavn: string
  kommunenummer: string
}

/** Kommune- and fylke-level fields joined onto grunnkretser and delområder at export
 *  (plus the grouping district's id and name, when grouping by one). */
export interface KommuneFelter {
  kommunenavn: string
  kommunenavnOffisielt: string
  fylkesnummer: string
  fylkesnavn: string
  fylkesnavnOffisielt: string
  [distriktField: string]: string
}

export type DelomradeProperties = DelomradeFilProperties & KommuneFelter

/** A grunnkrets as exported: the file's fields plus kommune- and fylke-level fields
 *  (and the grouping district's, when grouping by one) joined from the main topology. */
export interface GrunnkretsProperties extends GrunnkretsFilProperties {
  kommunenavn: string
  kommunenavnOffisielt: string
  fylkesnummer: string
  fylkesnavn: string
  fylkesnavnOffisielt: string
  [distriktField: string]: string
}

export type ExportFormat = 'geojson' | 'topojson'

/** Whether the export contains fylker, kommuner, bydeler, grunnkretser, or districts. */
export type ExportGranularity = 'fylker' | 'kommuner' | 'bydeler' | 'grunnkretser' | 'delomrader' | DistriktKind

/** The two levels below kommune that come from the grunnkrets files. */
export type GrunnkretsNivå = 'grunnkretser' | 'delomrader'
