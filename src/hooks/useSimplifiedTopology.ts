import { useMemo } from 'react'
import * as topojsonSimplify from 'topojson-simplify'
import type { GeometryCollection, Topology } from 'topojson-specification'
import type { FylkeProperties, KommuneProperties } from '../lib/types'

type NorwayTopologyType = Topology<{
  fylker: GeometryCollection<FylkeProperties>
  kommuner: GeometryCollection<KommuneProperties>
}>

/**
 * Lets the user dial in detail reduction at runtime via `topojson-simplify`,
 * mapping a 0–100 "detaljnivå" percentage to a weight threshold using the
 * quantile distribution of the presimplified topology — so the slider tracks
 * feel roughly linear regardless of how the underlying weights are
 * distributed.
 *
 * `presimplify` must run on a topology in *its own* encoding (decoded
 * coordinates with per-vertex weights) — the bundled topology's mapshaper-
 * stamped weights on quantized delta-arcs aren't in that format, and feeding
 * them to `simplify` directly silently produces corrupted geometry. So we
 * presimplify at runtime once per loaded topology (a few tens of ms) rather
 * than relying on the bundled data's own simplification metadata.
 *
 * detalj = 100 → minWeight = 0           (full presimplified detail, nothing removed)
 * detalj = 0   → minWeight = max weight  (most aggressive simplification)
 */
export function useSimplifiedTopology(topology: NorwayTopologyType, detailPercent: number): NorwayTopologyType {
  const presimplified = useMemo(() => topojsonSimplify.presimplify(topology), [topology])

  return useMemo(() => {
    if (detailPercent >= 100) return presimplified
    const quantile = 1 - detailPercent / 100
    const minWeight = topojsonSimplify.quantile(presimplified, quantile)
    return topojsonSimplify.simplify(presimplified, minWeight)
  }, [presimplified, detailPercent])
}
