import type { Feature, FeatureCollection } from 'geojson'
import type { AreaGeometry } from './types'

/** What a click on an area in the map does. */
export type KartHandling =
  | { type: 'gruppe'; id: string }
  | { type: 'kommune'; id: string }
  | { type: 'bydel'; id: string }
  | { type: 'delomrade'; id: string }

/** Properties of every area drawn in the map (not of the download). */
export interface KartOmrade {
  /** Unique across all layers, e.g. "kommune:0301". */
  key: string
  navn: string
  /** Code shown in the tooltip (kommunenummer, grunnkretsnummer, …). */
  nummer: string
  /** Second line of the tooltip, e.g. the fylke a kommune is in. */
  kontekst: string
  selected: boolean
  handling: KartHandling
}

export type KartFeature = Feature<AreaGeometry, KartOmrade>

/** Wraps already-built features as map areas. */
export function kartOmrader<P>(
  collection: FeatureCollection<AreaGeometry, P>,
  describe: (properties: P) => Omit<KartOmrade, 'key'>,
): KartFeature[] {
  return collection.features.map((feature) => {
    const omrade = describe(feature.properties)
    return {
      type: 'Feature',
      geometry: feature.geometry,
      properties: { ...omrade, key: `${omrade.handling.type}:${omrade.handling.id}:${omrade.nummer}` },
    }
  })
}

/** The tooltip's call to action for an area. */
export function handlingTekst({ handling, selected }: KartOmrade): string {
  if (handling.type === 'delomrade') {
    return selected ? 'Klikk for å utelate delområdet' : 'Klikk for å ta med delområdet'
  }
  return selected ? 'Klikk for å fjerne fra utvalget' : 'Klikk for å legge til i utvalget'
}
