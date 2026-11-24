import type { KommuneGruppe, KommuneProperties } from './types'

/** A heading (e.g. a fylke) with the groups listed under it. */
export interface GruppeSeksjon {
  id: string
  navn: string
  groups: KommuneGruppe[]
}

/**
 * SSB's standard order of the fylker (roughly south-east to north), which is
 * how most Norwegian tables and lists present them — rather than by number.
 * Unknown numbers go last, by number.
 */
const FYLKE_REKKEFOLGE = ['03', '32', '31', '33', '34', '39', '40', '42', '11', '46', '15', '50', '18', '55', '56']
export function fylkeRekkefolge(fylkesnummer: string): number {
  const index = FYLKE_REKKEFOLGE.indexOf(fylkesnummer)
  return index === -1 ? 100 + Number(fylkesnummer) : index
}

/**
 * The groups listed under a fylke: the one most of a group's kommuner are in,
 * so the few districts crossing a fylke border still land somewhere sensible.
 */
export function fylkeSeksjoner(
  groups: KommuneGruppe[],
  kommunerByGroup: Map<string, KommuneProperties[]>,
  fylker: KommuneGruppe[],
): GruppeSeksjon[] {
  const byFylke = new Map<string, KommuneGruppe[]>()
  for (const group of groups) {
    const counts = new Map<string, number>()
    for (const k of kommunerByGroup.get(group.id) ?? []) counts.set(k.fylkesnummer, (counts.get(k.fylkesnummer) ?? 0) + 1)
    const [fylkesnummer] = [...counts].sort((a, b) => b[1] - a[1] || fylkeRekkefolge(a[0]) - fylkeRekkefolge(b[0]))[0] ?? []
    if (!fylkesnummer) continue
    byFylke.set(fylkesnummer, [...(byFylke.get(fylkesnummer) ?? []), group])
  }
  return fylker
    .filter((fylke) => byFylke.has(fylke.id))
    .map((fylke) => ({ ...fylke, groups: byFylke.get(fylke.id) ?? [] }))
}
