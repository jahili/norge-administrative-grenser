import { kolonneInfo, nokkelKolonne } from '../lib/kolonner'
import type { ExportGranularity } from '../lib/types'
import { DownloadIcon } from './ui'

interface DataTabellProps {
  granularity: ExportGranularity
  /** The properties of every feature in the export, in order. */
  rows: Record<string, string>[]
  /** Properties of one feature at this level, to show the columns before anything is selected. */
  example: Record<string, string> | undefined
  onDownloadCsv: (columns: string[]) => void
}

const CELL = 'px-2 py-1.5 text-left align-top whitespace-nowrap'
/** Rendering thousands of table rows (e.g. every grunnkrets) would stall the page; the CSV has them all. */
const MAX_VISTE_RADER = 500

/**
 * The attribute table that will be in the downloaded file: which columns
 * there are, what they mean, which one to join other data on, and the rows
 * themselves. Shown in the map's «Data i filen» drawer (desktop) or the
 * «Kolonner» tab (mobile).
 */
export function DataTabell({ granularity, rows, example, onDownloadCsv }: DataTabellProps) {
  const sample = rows[0] ?? example
  if (!sample) return <p className="text-muted">Ingen data å vise ennå.</p>

  const columns = Object.keys(sample)
  const nokkel = nokkelKolonne(granularity)
  const nokkelEksempel = sample[nokkel]

  return (
    <div className="flex flex-col gap-4">
      <p className="text-ink-2">
        {rows.length > 0
          ? `${rows.length} ${rows.length === 1 ? 'rad' : 'rader'} · ${columns.length} kolonner.`
          : `Ingenting valgt ennå – slik ser kolonnene ut (${columns.length} kolonner, eksempel fra første område).`}{' '}
        I GeoJSON ligger kolonnene i <code className="font-mono text-xs">properties</code>, i TopoJSON i objektet{' '}
        <code className="font-mono text-xs">{granularity}</code>.
      </p>

      <div className="rounded-card border border-accent/30 bg-row-selected p-3">
        <p>
          <span className="font-semibold text-accent">Nøkkelkolonne: </span>
          <code className="font-mono font-semibold">{nokkel}</code>
          {nokkelEksempel !== undefined && (
            <>
              {' '}
              (f.eks. <code className="font-mono">{nokkelEksempel}</code>)
            </>
          )}
        </p>
        <p className="mt-1 text-ink-2">
          Koble egne data på denne kolonnen. Den er tekst, ikke tall: behold ledende nuller, og les kolonnen inn som tekst i
          Excel eller Power BI – ellers blir for eksempel «0301» til 301 og koblingen feiler.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <caption className="sr-only">Kolonner i filen</caption>
          <thead>
            <tr className="border-b border-line text-xs text-muted">
              <th scope="col" className={CELL}>
                Kolonne
              </th>
              <th scope="col" className={CELL}>
                Beskrivelse
              </th>
              <th scope="col" className={CELL}>
                Eksempel
              </th>
            </tr>
          </thead>
          <tbody>
            {columns.map((column) => {
              const info = kolonneInfo(column)
              const isKey = column === nokkel
              return (
                <tr key={column} className={`border-b border-seg ${isKey ? 'bg-row-selected' : ''}`}>
                  <th scope="row" className={`${CELL} font-mono text-xs font-medium text-ink`}>
                    {column}
                    {isKey && (
                      <span className="ml-2 rounded bg-accent px-1.5 py-0.5 font-sans text-[10px] font-semibold text-on-accent uppercase">
                        nøkkel
                      </span>
                    )}
                  </th>
                  <td className="min-w-[240px] px-2 py-1.5 text-left align-top text-ink-2">
                    {info?.beskrivelse ?? '—'}
                    {info?.kilde && (
                      <>
                        {' '}
                        <a href={info.kilde.url} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap underline">
                          Kilde
                        </a>
                      </>
                    )}
                  </td>
                  <td className={`${CELL} font-mono text-xs text-ink`}>{sample[column]}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {rows.length > 0 && (
        <details>
          <summary className="cursor-pointer font-medium text-ink-2 hover:text-accent">
            {rows.length > MAX_VISTE_RADER
              ? `Vis de første ${MAX_VISTE_RADER} radene (av ${rows.length} – CSV-filen har alle)`
              : `Vis alle rader (${rows.length})`}
          </summary>
          <div className="mt-2 max-h-80 overflow-auto rounded-field border border-line">
            <table className="w-full border-collapse text-xs">
              <caption className="sr-only">Rader i filen</caption>
              <thead className="sticky top-0 bg-surface-2">
                <tr>
                  {columns.map((column) => (
                    <th
                      key={column}
                      scope="col"
                      className={`${CELL} font-mono font-medium ${column === nokkel ? 'text-accent' : 'text-ink-2'}`}
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, MAX_VISTE_RADER).map((row, i) => (
                  <tr key={row[nokkel] ?? i} className="border-t border-seg">
                    {columns.map((column) => (
                      <td
                        key={column}
                        className={`${CELL} ${column === nokkel ? 'bg-row-selected font-mono font-medium text-ink' : 'text-ink-2'}`}
                      >
                        {row[column]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      <button
        type="button"
        onClick={() => onDownloadCsv(columns)}
        disabled={rows.length === 0}
        className="inline-flex h-11 cursor-pointer items-center gap-2 self-start rounded-field border border-input bg-surface px-3 font-medium text-ink hover:bg-seg disabled:cursor-not-allowed disabled:text-muted"
      >
        <DownloadIcon className="h-4 w-4" />
        Last ned tabellen som CSV (uten geometri)
      </button>
    </div>
  )
}
