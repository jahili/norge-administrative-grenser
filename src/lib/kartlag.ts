import type { Feature, FeatureCollection } from 'geojson'
import type { AreaGeometry } from './types'

/** What a click on an area in the map does. */
export type KartHandling =
  | { type: 'gruppe'; id: string }
  | { type: 'kommune'; id: string }
  | { type: 'bydel'; id: string }
  | { type: 'delomrade'; id: string }
  | { type: 'levekarssone'; id: string }

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

/**
 * Whether two collections hold the very same areas — at most in another order
 * or with another selection state — so drawn layers can be kept.
 */
export function sammeOmrader(
  a: FeatureCollection<AreaGeometry, KartOmrade>,
  b: FeatureCollection<AreaGeometry, KartOmrade>,
): boolean {
  if (a.features.length !== b.features.length) return false
  const geometries = new Map(a.features.map((f) => [f.properties.key, f.geometry]))
  return b.features.every((f) => geometries.get(f.properties.key) === f.geometry)
}

/** The tooltip's call to action for an area. */
export function handlingTekst({ handling, selected }: KartOmrade): string {
  if (handling.type === 'delomrade') {
    return selected ? 'Klikk for å utelate delområdet' : 'Klikk for å ta med delområdet'
  }
  if (handling.type === 'levekarssone') {
    return selected ? 'Klikk for å utelate levekårssonen' : 'Klikk for å ta med levekårssonen'
  }
  return selected ? 'Klikk for å fjerne fra utvalget' : 'Klikk for å legge til i utvalget'
}
