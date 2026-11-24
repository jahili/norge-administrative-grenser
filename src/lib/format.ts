import { DISTRIKT_KINDS } from './distrikter'
import type { ExportGranularity } from './types'

/** Formats a byte count the Norwegian way: «74 kB», «1,2 MB». */
export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`
  if (bytes < 1e6) return `${Math.round(bytes / 1000)} kB`
  return `${(bytes / 1e6).toLocaleString('nb-NO', { maximumFractionDigits: 1 })} MB`
}

/** Singular, plural and indefinite article for what a download contains. */
export function levelWords(granularity: ExportGranularity): { entall: string; flertall: string; artikkel: string } {
  if (granularity === 'fylker') return { entall: 'fylke', flertall: 'fylker', artikkel: 'ett' }
  if (granularity === 'kommuner') return { entall: 'kommune', flertall: 'kommuner', artikkel: 'én' }
  if (granularity === 'bydeler') return { entall: 'bydel', flertall: 'bydeler', artikkel: 'én' }
  if (granularity === 'grunnkretser') return { entall: 'grunnkrets', flertall: 'grunnkretser', artikkel: 'én' }
  if (granularity === 'delomrader') return { entall: 'delområde', flertall: 'delområder', artikkel: 'ett' }
  if (granularity === 'levekarssoner') return { entall: 'levekårssone', flertall: 'levekårssoner', artikkel: 'én' }
  return DISTRIKT_KINDS[granularity]
}

/** The column names of the download, for counts elsewhere (map card, button). */
export function dataColumns(rows: Record<string, string>[], example: Record<string, string> | undefined): string[] {
  const sample = rows[0] ?? example
  return sample ? Object.keys(sample) : []
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** The map card's title: the selected groups' names, shortened when there are more than two. */
export function utvalgTittel(navn: string[]): string {
  if (navn.length === 0) return 'Ingen utvalg ennå'
  if (navn.length <= 2) return navn.join(' og ')
  return `${navn.slice(0, 2).join(', ')} +${navn.length - 2}`
}

/** The map card's second line: what the download contains. */
export function utvalgDetaljer(granularity: ExportGranularity, featureCount: number, kolonner: number): string {
  if (featureCount === 0) return 'Klikk i kartet eller velg i listen'
  const { entall, flertall } = levelWords(granularity)
  return `${featureCount} ${featureCount === 1 ? entall : flertall} · ${kolonner} kolonner`
}
