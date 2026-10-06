import { useEffect, useState } from 'react'
import type { GeometryCollection, Topology } from 'topojson-specification'
import topologyUrl from '../assets/norge-grenser.topojson?url'
import { DISTRIKT_KIND_LIST, kommuneGruppeId, toDistrikt } from '../lib/distrikter'
import type { DistriktProperties } from '../lib/distrikter'
import type { BydelProperties, DistriktKind, FylkeProperties, KommuneGruppe, KommuneProperties } from '../lib/types'

export type NorwayTopologyType = Topology<{
  fylker: GeometryCollection<FylkeProperties>
  kommuner: GeometryCollection<KommuneProperties>
  fylkerUtenHavgrense: GeometryCollection<FylkeProperties>
  kommunerUtenHavgrense: GeometryCollection<KommuneProperties>
  bydeler: GeometryCollection<BydelProperties>
} & {
  [K in DistriktKind | `${DistriktKind}UtenHavgrense`]: GeometryCollection<DistriktProperties>
}>

export interface NorwayTopology {
  topology: NorwayTopologyType
  fylker: FylkeProperties[]
  kommuner: KommuneProperties[]
  kommunerByFylke: Map<string, KommuneProperties[]>
  bydeler: BydelProperties[]
  /** All bydeler indexed by kommunenummer — only populated for the 6 kommuner
   *  that have bydeler in the dataset. */
  bydelsByKommune: Map<string, BydelProperties[]>
  /** The districts of each kind, in the order the data lists them. */
  distrikter: Record<DistriktKind, KommuneGruppe[]>
  /** Kommuner in each district, by kind and district id. */
  kommunerByDistrikt: Record<DistriktKind, Map<string, KommuneProperties[]>>
}

export type TopologyState =
  | { status: 'loading' }
  | { status: 'error'; error: Error }
  | ({ status: 'ready' } & NorwayTopology)

/** Loads the bundled, prebaked TopoJSON once and indexes it for quick lookup. */
export function useTopology(): TopologyState {
  const [state, setState] = useState<TopologyState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false

    fetch(topologyUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json()
      })
      .then((topology: NorwayTopology['topology']) => {
        if (cancelled) return

        // TopoJSON's `properties` is typed as optional, but every geometry in
        // our bundled, pipeline-controlled dataset always carries one.
        const fylker = topology.objects.fylker.geometries.map((g) => g.properties as FylkeProperties)
        const kommuner = topology.objects.kommuner.geometries.map((g) => g.properties as KommuneProperties)
        const bydeler = topology.objects.bydeler.geometries.map((g) => g.properties as BydelProperties)

        const kommunerByFylke = new Map<string, KommuneProperties[]>()
        for (const kommune of kommuner) {
          const list = kommunerByFylke.get(kommune.fylkesnummer)
          if (list) list.push(kommune)
          else kommunerByFylke.set(kommune.fylkesnummer, [kommune])
        }

        const bydelsByKommune = new Map<string, BydelProperties[]>()
        for (const bydel of bydeler) {
          const list = bydelsByKommune.get(bydel.kommunenummer)
          if (list) list.push(bydel)
          else bydelsByKommune.set(bydel.kommunenummer, [bydel])
        }

        const distrikter = {} as NorwayTopology['distrikter']
        const kommunerByDistrikt = {} as NorwayTopology['kommunerByDistrikt']
        for (const kind of DISTRIKT_KIND_LIST) {
          distrikter[kind] = topology.objects[kind].geometries.map((g) => toDistrikt(g.properties as DistriktProperties))
          const byDistrikt = new Map<string, KommuneProperties[]>()
          for (const kommune of kommuner) {
            const id = kommuneGruppeId(kommune, kind)
            const list = byDistrikt.get(id)
            if (list) list.push(kommune)
            else byDistrikt.set(id, [kommune])
          }
          kommunerByDistrikt[kind] = byDistrikt
        }

        setState({
          status: 'ready',
          topology,
          fylker,
          kommuner,
          kommunerByFylke,
          bydeler,
          bydelsByKommune,
          distrikter,
          kommunerByDistrikt,
        })
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({ status: 'error', error: error instanceof Error ? error : new Error(String(error)) })
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  return state
}
