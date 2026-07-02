import type { BydelProperties, FylkeProperties, KommuneProperties } from './types'

/** Norwegian names contain spaces, slashes and æøå — keep the latter (valid in
 * filenames on every OS we care about) but normalize the rest for a clean,
 * URL- and shell-safe download name. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-zæøå0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Builds a filename that reflects the current selection:
 *  - one whole fylke selected           → "akershus-kommuner"
 *  - a single kommune selected          → "oslo"
 *  - anything else (mixed/partial)      → "n-kommuner-utvalg"
 * The caller appends the format-specific extension.
 */
export function selectionFilenameStem(
  selectedKommuner: KommuneProperties[],
  fylker: FylkeProperties[],
  kommunerByFylke: Map<string, KommuneProperties[]>,
): string {
  if (selectedKommuner.length === 1) {
    return slugify(selectedKommuner[0].kommunenavn)
  }

  if (selectedKommuner.length > 1) {
    const fylkesnummerInSelection = new Set(selectedKommuner.map((k) => k.fylkesnummer))
    if (fylkesnummerInSelection.size === 1) {
      const [fylkesnummer] = fylkesnummerInSelection
      const everyKommuneInFylke = kommunerByFylke.get(fylkesnummer) ?? []
      if (everyKommuneInFylke.length === selectedKommuner.length) {
        const fylke = fylker.find((f) => f.fylkesnummer === fylkesnummer)
        if (fylke) return `${slugify(fylke.fylkesnavn)}-kommuner`
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
