import { DISTRIKT_KINDS, kommuneGruppeId } from './distrikter'
import type { BydelProperties, DistriktKind, FylkeProperties, GruppeKind, KommuneGruppe, KommuneProperties } from './types'

/** Norwegian names contain spaces, slashes, æøå and Sami letters (á, š, …) —
 * keep every letter (valid in filenames on every OS we care about) but
 * normalize the rest for a clean, URL- and shell-safe download name. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
}

/** Names one fylke or district: "akershus", "øst-politidistrikt", "oslo-110-sentral",
 *  "hedmark-valgdistrikt" (a suffix is only added when the name doesn't say what it is). */
function gruppeFilenameStem(kind: GruppeKind, gruppe: KommuneGruppe): string {
  const navn = slugify(gruppe.navn)
  const suffiks = kind === 'fylker' ? undefined : DISTRIKT_KINDS[kind].filnavnSuffiks
  return suffiks ? `${navn}-${slugify(suffiks)}` : navn
}

/**
 * Builds a filename that reflects the current selection:
 *  - every kommune in one group selected → "akershus-kommuner", "øst-politidistrikt-kommuner"
 *  - a single kommune selected           → "oslo"
 *  - anything else (mixed/partial)       → "n-kommuner-utvalg"
 * The caller appends the format-specific extension.
 */
export function selectionFilenameStem(
  selectedKommuner: KommuneProperties[],
  kind: GruppeKind,
  groups: KommuneGruppe[],
  kommunerByGroup: Map<string, KommuneProperties[]>,
): string {
  if (selectedKommuner.length === 1) {
    return slugify(selectedKommuner[0].kommunenavn)
  }

  if (selectedKommuner.length > 1) {
    const groupIdsInSelection = new Set(selectedKommuner.map((k) => kommuneGruppeId(k, kind)))
    if (groupIdsInSelection.size === 1) {
      const [groupId] = groupIdsInSelection
      const everyKommuneInGroup = kommunerByGroup.get(groupId) ?? []
      if (everyKommuneInGroup.length === selectedKommuner.length) {
        const group = groups.find((g) => g.id === groupId)
        if (group) return `${gruppeFilenameStem(kind, group)}-kommuner`
      }
    }
  }

  return `${selectedKommuner.length}-kommuner-utvalg`
}

/**
 * Builds a filename stem for a fylke-level export (whole fylkesgrenser, not
 * broken down into kommuner):
 *  - one fylke selected   → "akershus-fylke"
 *  - several fylker       → "n-fylker-utvalg"
 */
export function fylkeSelectionFilenameStem(selectedFylker: FylkeProperties[]): string {
  if (selectedFylker.length === 1) {
    return `${slugify(selectedFylker[0].fylkesnavn)}-fylke`
  }
  return `${selectedFylker.length}-fylker-utvalg`
}

/**
 * Builds a filename stem for a bydel-level export:
 *  - one bydel selected                   → "grünerløkka"
 *  - all bydeler in one kommune           → "oslo-bydeler"
 *  - mix                                  → "n-bydeler-utvalg"
 */
export function bydelSelectionFilenameStem(
  selectedBydeler: BydelProperties[],
  bydelsByKommune: Map<string, BydelProperties[]>,
  kommuner: KommuneProperties[],
): string {
  if (selectedBydeler.length === 1) {
    return slugify(selectedBydeler[0].bydelnavn)
  }

  if (selectedBydeler.length > 1) {
    const kommunenummerInSelection = new Set(selectedBydeler.map((b) => b.kommunenummer))
    if (kommunenummerInSelection.size === 1) {
      const [kommunenummer] = kommunenummerInSelection
      const allBydelerInKommune = bydelsByKommune.get(kommunenummer) ?? []
      if (allBydelerInKommune.length === selectedBydeler.length) {
        const kommune = kommuner.find((k) => k.kommunenummer === kommunenummer)
        if (kommune) return `${slugify(kommune.kommunenavn)}-bydeler`
      }
    }
  }

  return `${selectedBydeler.length}-bydeler-utvalg`
}

/**
 * Builds a filename stem for a politidistrikt or 110-distrikt export:
 *  - one politidistrikt selected  → "øst-politidistrikt"
 *  - one 110-distrikt selected    → "oslo-110-sentral" (DSB's names already say what they are)
 *  - every district of the kind   → "alle-politidistrikter"
 *  - anything else                → "n-politidistrikter-utvalg"
 */
export function distriktSelectionFilenameStem(
  kind: DistriktKind,
  selected: KommuneGruppe[],
  allOfKind: KommuneGruppe[],
): string {
  const { flertall } = DISTRIKT_KINDS[kind]
  if (selected.length === 1) return gruppeFilenameStem(kind, selected[0])
  if (selected.length === allOfKind.length) return `alle-${slugify(flertall)}`
  return `${selected.length}-${slugify(flertall)}-utvalg`
}
