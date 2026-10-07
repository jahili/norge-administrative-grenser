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
  return DISTRIKT_KINDS[granularity]
}

/** The column names of the download, for counts elsewhere (map card, button). */
export function dataColumns(rows: Record<string, string>[], example: Record<string, string> | undefined): string[] {
  const sample = rows[0] ?? example
  return sample ? Object.keys(sample) : []
}
