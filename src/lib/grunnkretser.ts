import * as topojsonClient from 'topojson-client'
import * as topojsonSimplify from 'topojson-simplify'
import type { Feature, FeatureCollection } from 'geojson'
import type { GeometryCollection, Topology } from 'topojson-specification'
import grunnkretsIndex from '../assets/grunnkretser/index.json'
import { DISTRIKT_KINDS } from './distrikter'
import type {
  AreaGeometry,
  DelomradeFilProperties,
  DelomradeProperties,
  GruppeKind,
  GrunnkretsFilProperties,
  GrunnkretsNivå,
  GrunnkretsProperties,
  KommuneFelter,
  KommuneProperties,
} from './types'

/**
 * Grunnkretser live in one file per fylke (built by data:grunnkretser) and are
 * only fetched when someone asks for grunnkretser in that fylke, so they cost
 * nothing until then.
 */
export type GrunnkretsTopology = Topology<{
  grunnkretser: GeometryCollection<GrunnkretsFilProperties>
  grunnkretserUtenHavgrense: GeometryCollection<GrunnkretsFilProperties>
  delomrader: GeometryCollection<DelomradeFilProperties>
  delomraderUtenHavgrense: GeometryCollection<DelomradeFilProperties>
}>

/** Hashed asset URL per fylkesnummer. */
const URLS: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('../assets/grunnkretser/*.topojson', { query: '?url', import: 'default', eager: true }),
  ).map(([file, url]) => [file.match(/(\d{2})\.topojson$/)![1], url]),
)

/** Number of grunnkretser and delområder, and file size, per fylkesnummer. */
export const GRUNNKRETS_INDEX: Record<string, { grunnkretser: number; delomrader: number; bytes: number }> = grunnkretsIndex

const cache = new Map<string, Promise<GrunnkretsTopology>>()

/**
 * Fetches (once per session) and presimplifies one fylke's grunnkretser.
 * Presimplifying here means the detail slider only has to call `simplify`.
 */
export function loadGrunnkretser(fylkesnummer: string): Promise<GrunnkretsTopology> {
  let promise = cache.get(fylkesnummer)
  if (!promise) {
    const url = URLS[fylkesnummer]
    promise = url
      ? fetch(url).then(async (response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          return topojsonSimplify.presimplify((await response.json()) as GrunnkretsTopology)
        })
      : Promise.reject(new Error(`Ingen grunnkretsfil for fylke ${fylkesnummer}`))
    // Let a failed fetch be retried later.
    promise.catch(() => cache.delete(fylkesnummer))
    cache.set(fylkesnummer, promise)
  }
  return promise
}

/**
 * The grunnkretser or delområder in `kommunenumre` (minus excluded
 * delområder) as one FeatureCollection, simplified with the same weight
 * threshold as the main topology so the detail slider affects both alike.
 * Kommune- and fylke-level fields — and, when grouping by a district kind,
 * that district — are joined from the main topology rather than stored in
 * every grunnkrets file.
 */
export function grunnkretsFeatures(
  nivå: 'grunnkretser',
  ...args: FeatureArgs
): FeatureCollection<AreaGeometry, GrunnkretsProperties>
export function grunnkretsFeatures(
  nivå: 'delomrader',
  ...args: FeatureArgs
): FeatureCollection<AreaGeometry, DelomradeProperties>
export function grunnkretsFeatures(
  nivå: GrunnkretsNivå,
  ...[topologies, medHavgrense, minWeight, kommunenumre, utelatteDelomrader, kommuneByNummer, gruppeKind]: FeatureArgs
): FeatureCollection<AreaGeometry, GrunnkretsProperties | DelomradeProperties> {
  const distrikt = gruppeKind === 'fylker' ? null : DISTRIKT_KINDS[gruppeKind]
  const kommuneFelter = (kommune: KommuneProperties): KommuneFelter => ({
    kommunenavn: kommune.kommunenavn,
    kommunenavnOffisielt: kommune.kommunenavnOffisielt,
    fylkesnummer: kommune.fylkesnummer,
    fylkesnavn: kommune.fylkesnavn,
    fylkesnavnOffisielt: kommune.fylkesnavnOffisielt,
    ...(distrikt && {
      [distrikt.idField]: kommune[distrikt.idField],
      [distrikt.nameField]: kommune[distrikt.nameField],
    }),
  })
  const objectName = `${nivå}${medHavgrense ? '' : 'UtenHavgrense'}` as const
  const features: Feature<AreaGeometry, GrunnkretsProperties | DelomradeProperties>[] = []
  for (const presimplified of topologies) {
    const topology = simplified(presimplified, minWeight)
    const collection = topojsonClient.feature(topology, topology.objects[objectName]) as FeatureCollection<
      AreaGeometry,
      GrunnkretsFilProperties | DelomradeFilProperties
    >
    for (const feature of collection.features) {
      const p = feature.properties
      if (!kommunenumre.has(p.kommunenummer) || utelatteDelomrader.has(p.delomradenummer)) continue
      const kommune = kommuneByNummer.get(p.kommunenummer)!
      // The file's own fields first (grunnkretsnummer … kommunenummer), then the joined ones.
      features.push({ ...feature, properties: { ...p, ...kommuneFelter(kommune) } })
    }
  }
  return { type: 'FeatureCollection', features }
}

/** The arguments after `nivå`, shared by both levels. */
export type FeatureArgs = [
  topologies: GrunnkretsTopology[],
  medHavgrense: boolean,
  minWeight: number,
  kommunenumre: Set<string>,
  utelatteDelomrader: Set<string>,
  kommuneByNummer: Map<string, KommuneProperties>,
  gruppeKind: GruppeKind,
]

const simplifiedCache = new WeakMap<GrunnkretsTopology, { minWeight: number; topology: GrunnkretsTopology }>()

/** `simplify` is the expensive part, so keep the last result per fylke file. */
function simplified(presimplified: GrunnkretsTopology, minWeight: number): GrunnkretsTopology {
  if (minWeight <= 0) return presimplified
  const cached = simplifiedCache.get(presimplified)
  if (cached?.minWeight === minWeight) return cached.topology
  const topology = topojsonSimplify.simplify(presimplified, minWeight)
  simplifiedCache.set(presimplified, { minWeight, topology })
  return topology
}

/** Delområder per kommune in a loaded fylke file, in number order. */
export function delomraderByKommune(
  topology: GrunnkretsTopology,
): Map<string, { delomradenummer: string; delomradenavn: string; grunnkretser: number }[]> {
  const byKommune = new Map<string, Map<string, { delomradenummer: string; delomradenavn: string; grunnkretser: number }>>()
  for (const geometry of topology.objects.grunnkretser.geometries) {
    // TopoJSON types properties as optional; every grunnkrets in our files has them.
    const p = geometry.properties as GrunnkretsFilProperties
    const delomrader = byKommune.get(p.kommunenummer) ?? new Map()
    const entry = delomrader.get(p.delomradenummer) ?? { delomradenummer: p.delomradenummer, delomradenavn: p.delomradenavn, grunnkretser: 0 }
    entry.grunnkretser++
    delomrader.set(p.delomradenummer, entry)
    byKommune.set(p.kommunenummer, delomrader)
  }
  return new Map(
    [...byKommune].map(([kommunenummer, delomrader]) => [
      kommunenummer,
      [...delomrader.values()].sort((a, b) => a.delomradenummer.localeCompare(b.delomradenummer)),
    ]),
  )
}
