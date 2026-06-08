import { useEffect, useState } from 'react'
import type { GeometryCollection, Topology } from 'topojson-specification'
import topologyUrl from '../assets/norge-grenser.topojson?url'
import type { FylkeProperties, KommuneProperties } from '../lib/types'

export interface NorwayTopology {
  topology: Topology<{
    fylker: GeometryCollection<FylkeProperties>
    kommuner: GeometryCollection<KommuneProperties>
  }>
  fylker: FylkeProperties[]
  kommuner: KommuneProperties[]
  kommunerByFylke: Map<string, KommuneProperties[]>
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

        const kommunerByFylke = new Map<string, KommuneProperties[]>()
        for (const kommune of kommuner) {
          const list = kommunerByFylke.get(kommune.fylkesnummer)
          if (list) list.push(kommune)
          else kommunerByFylke.set(kommune.fylkesnummer, [kommune])
        }

        setState({ status: 'ready', topology, fylker, kommuner, kommunerByFylke })
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
