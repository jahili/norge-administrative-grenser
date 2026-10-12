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
  LevekarssoneFilProperties,
  LevekarssoneProperties,
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
  levekarssoner: GeometryCollection<LevekarssoneFilProperties>
  levekarssonerUtenHavgrense: GeometryCollection<LevekarssoneFilProperties>
}>

/** Hashed asset URL per fylkesnummer. */
const URLS: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('../assets/grunnkretser/*.topojson', { query: '?url', import: 'default', eager: true }),
  ).map(([file, url]) => [file.match(/(\d{2})\.topojson$/)![1], url]),
)

/** Number of grunnkretser, delområder and levekårssoner, and file size, per fylkesnummer. */
export const GRUNNKRETS_INDEX: Record<
  string,
  { grunnkretser: number; delomrader: number; levekarssoner: number; bytes: number }
> = grunnkretsIndex

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
 * The grunnkretser, delområder or levekårssoner in `kommunenumre` (minus the
 * excluded ones: delområder, or levekårssoner at that level) as one
 * FeatureCollection, simplified with the same weight
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
  nivå: 'levekarssoner',
  ...args: FeatureArgs
): FeatureCollection<AreaGeometry, LevekarssoneProperties>
export function grunnkretsFeatures(
  nivå: GrunnkretsNivå,
  ...[topologies, medHavgrense, minWeight, kommunenumre, utelatte, kommuneByNummer, gruppeKind]: FeatureArgs
): FeatureCollection<AreaGeometry, GrunnkretsProperties | DelomradeProperties | LevekarssoneProperties> {
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
  const features: Feature<AreaGeometry, GrunnkretsProperties | DelomradeProperties | LevekarssoneProperties>[] = []
  for (const presimplified of topologies) {
    const topology = simplified(presimplified, minWeight)
    const object = topology.objects[objectName] as GeometryCollection<
      GrunnkretsFilProperties | DelomradeFilProperties | LevekarssoneFilProperties
    >
    const collection = topojsonClient.feature(topology, object) as FeatureCollection<
      AreaGeometry,
      GrunnkretsFilProperties | DelomradeFilProperties | LevekarssoneFilProperties
    >
    for (const feature of collection.features) {
      const p = feature.properties
      const id =
        nivå === 'levekarssoner'
          ? (p as LevekarssoneFilProperties).levekarssonenummer
          : (p as GrunnkretsFilProperties | DelomradeFilProperties).delomradenummer
      if (!kommunenumre.has(p.kommunenummer) || utelatte.has(id)) continue
      const kommune = kommuneByNummer.get(p.kommunenummer)!
      // The file's own fields first (grunnkretsnummer … kommunenummer), then the joined ones.
      const own = nivå === 'grunnkretser' ? medLevekarssone(p as GrunnkretsFilProperties) : p
      features.push({ ...feature, properties: { ...own, ...kommuneFelter(kommune) } })
    }
  }
  return { type: 'FeatureCollection', features }
}

/** A grunnkrets's fields with the levekårssone columns always present (empty outside kommuner that have them). */
function medLevekarssone({ levekarssonenummer = '', levekarssonenavn = '', kommunenummer, ...p }: GrunnkretsFilProperties) {
  return { ...p, levekarssonenummer, levekarssonenavn, kommunenummer }
}

/** The arguments after `nivå`, shared by both levels. */
export type FeatureArgs = [
  topologies: GrunnkretsTopology[],
  medHavgrense: boolean,
  minWeight: number,
  kommunenumre: Set<string>,
  /** Excluded delområder — or, at the levekårssone level, excluded levekårssoner. */
  utelatte: Set<string>,
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

/** A delområde or levekårssone, as listed per kommune for leaving some out. */
export interface Underomrade {
  nummer: string
  navn: string
  grunnkretser: number
}

/** Delområder or levekårssoner per kommune in a loaded fylke file, in number order. */
export function underomraderByKommune(
  topology: GrunnkretsTopology,
  nivå: 'delomrader' | 'levekarssoner',
): Map<string, Underomrade[]> {
  const byKommune = new Map<string, Map<string, Underomrade>>()
  for (const geometry of topology.objects.grunnkretser.geometries) {
    // TopoJSON types properties as optional; every grunnkrets in our files has them.
    const p = geometry.properties as GrunnkretsFilProperties
    const [nummer, navn] =
      nivå === 'delomrader' ? [p.delomradenummer, p.delomradenavn] : [p.levekarssonenummer, p.levekarssonenavn]
    if (!nummer || !navn) continue
    const omrader = byKommune.get(p.kommunenummer) ?? new Map<string, Underomrade>()
    const entry = omrader.get(nummer) ?? { nummer, navn, grunnkretser: 0 }
    entry.grunnkretser++
    omrader.set(nummer, entry)
    byKommune.set(p.kommunenummer, omrader)
  }
  return new Map(
    [...byKommune].map(([kommunenummer, omrader]) => [
      kommunenummer,
      [...omrader.values()].sort((a, b) => a.nummer.localeCompare(b.nummer)),
    ]),
  )
}
