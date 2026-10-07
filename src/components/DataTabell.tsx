import { kolonneInfo, nokkelKolonne } from '../lib/kolonner'
import type { ExportGranularity } from '../lib/types'

interface DataTabellProps {
  granularity: ExportGranularity
  /** The properties of every feature in the export, in order. */
  rows: Record<string, string>[]
  /** Properties of one feature at this level, to show the columns before anything is selected. */
  example: Record<string, string> | undefined
  onDownloadCsv: (columns: string[]) => void
}

const CELL = 'px-2 py-1 text-left align-top whitespace-nowrap'
/** Rendering thousands of table rows (e.g. every grunnkrets) would stall the page; the CSV has them all. */
const MAX_VISTE_RADER = 500

/**
 * Shows the attribute table that will be in the downloaded file: which
 * columns there are, what they mean, which one to join other data on, and the
 * rows themselves.
 */
export function DataTabell({ granularity, rows, example, onDownloadCsv }: DataTabellProps) {
  const sample = rows[0] ?? example
  if (!sample) return null

  const columns = Object.keys(sample)
  const nokkel = nokkelKolonne(granularity)
  const nokkelEksempel = sample[nokkel]
  const objectName = granularity

  return (
    <section
      aria-labelledby="data-heading"
      className="rounded-sm border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
    >
      <h2 id="data-heading" className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        Data i filen
      </h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {rows.length > 0
          ? `${rows.length} ${rows.length === 1 ? 'rad' : 'rader'} · ${columns.length} kolonner`
          : `Ingenting valgt ennå — slik ser kolonnene ut (${columns.length} kolonner, eksempel fra første område).`}{' '}
        I GeoJSON ligger kolonnene i <code className="text-xs">properties</code>, i TopoJSON i objektet{' '}
        <code className="text-xs">{objectName}</code>.
      </p>

      <div className="mt-3 rounded-sm border border-teal-200 bg-teal-50 p-3 text-sm text-slate-700 dark:border-teal-900 dark:bg-teal-950/40 dark:text-slate-300">
        <p>
          <span className="font-semibold text-teal-800 dark:text-teal-300">Nøkkelkolonne: </span>
          <code className="font-semibold">{nokkel}</code>
          {nokkelEksempel !== undefined && (
            <>
              {' '}
              (f.eks. <code>{nokkelEksempel}</code>)
            </>
          )}
        </p>
        <p className="mt-1">
          Koble egne data på denne kolonnen. Den er tekst, ikke tall: behold eventuelle ledende nuller, og les
          kolonnen inn som tekst i Excel eller Power BI — ellers blir for eksempel «0301» til 301 og koblingen feiler.
        </p>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Kolonner i filen</caption>
          <thead>
            <tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
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
                <tr
                  key={column}
                  className={`border-b border-slate-100 dark:border-slate-800 ${isKey ? 'bg-teal-50 dark:bg-teal-950/40' : ''}`}
                >
                  <th scope="row" className={`${CELL} font-mono text-xs font-medium text-slate-800 dark:text-slate-200`}>
                    {column}
                    {isKey && (
                      <span className="ml-2 rounded-xs bg-teal-700 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-white uppercase dark:bg-teal-400 dark:text-slate-900">
                        nøkkel
                      </span>
                    )}
                  </th>
                  <td className="px-2 py-1 text-left align-top text-slate-600 dark:text-slate-400">
                    {info?.beskrivelse ?? '—'}
                    {info?.kilde && (
                      <>
                        {' '}
                        <a
                          href={info.kilde.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="whitespace-nowrap text-teal-700 underline hover:text-teal-800 dark:text-teal-400 dark:hover:text-teal-300"
                        >
                          Kilde
                        </a>
                      </>
                    )}
                  </td>
                  <td className={`${CELL} font-mono text-xs text-slate-700 dark:text-slate-300`}>{sample[column]}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {rows.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-slate-700 hover:text-teal-700 dark:text-slate-300 dark:hover:text-teal-400">
            {rows.length > MAX_VISTE_RADER
              ? `Vis de første ${MAX_VISTE_RADER} radene (av ${rows.length} — CSV-filen har alle)`
              : `Vis alle rader (${rows.length})`}
          </summary>
          <div className="mt-2 max-h-80 overflow-auto rounded-xs border border-slate-200 dark:border-slate-800">
            <table className="w-full border-collapse text-xs">
              <caption className="sr-only">Rader i filen</caption>
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800">
                <tr>
                  {columns.map((column) => (
                    <th
                      key={column}
                      scope="col"
                      className={`${CELL} font-mono font-medium ${column === nokkel ? 'text-teal-800 dark:text-teal-300' : 'text-slate-600 dark:text-slate-300'}`}
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, MAX_VISTE_RADER).map((row, i) => (
                  <tr key={row[nokkel] ?? i} className="border-t border-slate-100 dark:border-slate-800">
                    {columns.map((column) => (
                      <td
                        key={column}
                        className={`${CELL} ${column === nokkel ? 'bg-teal-50 font-mono font-medium text-slate-900 dark:bg-teal-950/40 dark:text-slate-100' : 'text-slate-700 dark:text-slate-300'}`}
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
        className="mt-4 inline-flex items-center gap-2 rounded-xs border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:outline-teal-400 dark:disabled:text-slate-500"
      >
        <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M8 2v8M4 7l4 4 4-4M2 13h12" />
        </svg>
        Last ned tabellen som CSV (uten geometri)
      </button>
    </section>
  )
}
