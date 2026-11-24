import { topology } from 'topojson-server'
import type { FeatureCollection, Polygon, Position } from 'geojson'
import type { NorwayTopologyType } from '../hooks/useTopology'
import type { GrunnkretsTopology } from '../lib/grunnkretser'
import type { BydelProperties, KommuneProperties } from '../lib/types'

/** A kommune in fylke `nr.slice(0, 2)`; every kommune is in politidistrikt "p" + fylkesnummer. */
export function kommune(nr: string, navn: string): KommuneProperties {
  const fylkesnummer = nr.slice(0, 2)
  return {
    kommunenummer: nr,
    kommunenavn: navn,
    kommunenavnOffisielt: `${navn} offisielt`,
    fylkesnummer,
    fylkesnavn: `Fylke ${fylkesnummer}`,
    fylkesnavnOffisielt: `Fylke ${fylkesnummer} offisielt`,
    politidistriktnummer: `p${fylkesnummer}`,
    politidistriktnavn: `Politi ${fylkesnummer}`,
  }
}

export function bydel(nr: string, navn: string): BydelProperties {
  return { bydelnummer: nr, bydelnavn: navn, kommunenummer: nr.slice(0, 4) }
}

/** A clockwise square with its lower left corner in (x, y). */
export function square(x: number, y: number, size = 1): Position[] {
  return [
    [x, y],
    [x, y + size],
    [x + size, y + size],
    [x + size, y],
    [x, y],
  ]
}

export function collection<P>(...features: [P, Position[][]][]): FeatureCollection<Polygon, P> {
  return {
    type: 'FeatureCollection',
    features: features.map(([properties, coordinates]) => ({
      type: 'Feature',
      properties,
      geometry: { type: 'Polygon', coordinates },
    })),
  }
}

/** A topology with only the objects a test needs, typed as the bundled one. */
export function norway(objects: Record<string, FeatureCollection>): NorwayTopologyType {
  return topology(objects) as unknown as NorwayTopologyType
}

/** Likewise for a fylke's grunnkrets file. */
export function grunnkretsFil(objects: Record<string, FeatureCollection>): GrunnkretsTopology {
  return topology(objects) as unknown as GrunnkretsTopology
}
