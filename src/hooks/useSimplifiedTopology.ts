import { useMemo } from 'react'
import * as topojsonSimplify from 'topojson-simplify'
import type { NorwayTopologyType } from './useTopology'

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
 * detalj = 100 → minWeight ≈ 0         (full detail, nothing removed — early return)
 * detalj = 0   → minWeight = max weight (most aggressive simplification)
 *
 * topojson-simplify's quantile() sorts weights in DESCENDING order, so p=0
 * returns the maximum weight and p=1 returns the minimum. We therefore map
 * detailPercent directly to p (not 1-p) to get the intended behaviour.
 */
export function useSimplifiedTopology(
  topology: NorwayTopologyType,
  detailPercent: number,
): { topology: NorwayTopologyType; minWeight: number } {
  const presimplified = useMemo(() => topojsonSimplify.presimplify(topology), [topology])

  // `minWeight` is returned too, so the separately loaded grunnkrets files can
  // be simplified with the same threshold (weights are planar areas in the
  // same lon/lat units, so they compare across files).
  return useMemo(() => {
    if (detailPercent >= 100) return { topology: presimplified, minWeight: 0 }
    const quantile = detailPercent / 100
    const minWeight = topojsonSimplify.quantile(presimplified, quantile)
    return { topology: topojsonSimplify.simplify(presimplified, minWeight), minWeight }
  }, [presimplified, detailPercent])
}
