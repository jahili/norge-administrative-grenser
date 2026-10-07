import { useId } from 'react'
import { GRUNNKRETS_INDEX } from '../lib/grunnkretser'
import type { GrunnkretsState } from '../hooks/useGrunnkretser'
import type { KommuneProperties } from '../lib/types'

export interface Delomrade {
  delomradenummer: string
  delomradenavn: string
  grunnkretser: number
}

interface GrunnkretsSelectorProps {
  /** The selected kommuner, whose grunnkretser are offered. */
  kommuner: KommuneProperties[]
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
  state: GrunnkretsState
  /** Delområder per kommune, once the kommune's fylke file has loaded. */
  delomraderByKommune: Map<string, Delomrade[]>
  utelatteDelomrader: Set<string>
  /** Includes (`include = true`) or excludes the given delområder. */
  onDelomraderChange: (delomradenumre: string[], include: boolean) => void
}

const CHECKBOX_CLASS =
  'h-4 w-4 shrink-0 accent-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-700 dark:accent-teal-400 dark:focus-visible:outline-teal-400'

function formatMB(bytes: number): string {
  return `${(bytes / 1e6).toLocaleString('nb-NO', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} MB`
}

/**
 * Step 3 alternative to bydeler: download every grunnkrets in the selected
 * kommuner instead of the kommuner themselves, optionally leaving out
 * delområder. Grunnkretser are fetched per fylke only once this is switched on.
 */
export function GrunnkretsSelector({
  kommuner,
  enabled,
  onEnabledChange,
  state,
  delomraderByKommune,
  utelatteDelomrader,
  onDelomraderChange,
}: GrunnkretsSelectorProps) {
  if (kommuner.length === 0) return null

  const fylker = [...new Set(kommuner.map((k) => k.fylkesnummer))]
  const bytes = fylker.reduce((sum, nr) => sum + (GRUNNKRETS_INDEX[nr]?.bytes ?? 0), 0)
  const loadingNames = state.loading.map((nr) => kommuner.find((k) => k.fylkesnummer === nr)?.fylkesnavn ?? nr)

  return (
    <fieldset className="rounded-sm border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <legend className="px-1 text-sm font-semibold text-slate-900 dark:text-slate-100">Grunnkretser (valgfritt)</legend>

      <label className="mt-1 flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
        <input
          type="checkbox"
          className={`${CHECKBOX_CLASS} mt-0.5`}
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
        />
        <span>
          Last ned grunnkretsene i {kommuner.length === 1 ? kommuner[0].kommunenavn : `de ${kommuner.length} valgte kommunene`} i
          stedet for kommunene
          <span className="block text-xs text-slate-500 dark:text-slate-400">
            Grunnkretser er SSBs minste statistiske enheter. De hentes per fylke ved behov (
            {fylker.length === 1 ? '1 fylke' : `${fylker.length} fylker`}, ca. {formatMB(bytes)}).
          </span>
        </span>
      </label>

      {enabled && (
        <div className="mt-3 flex flex-col gap-3">
          {state.loading.length > 0 && (
            <p role="status" className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-teal-700 dark:border-slate-700 dark:border-t-teal-400" />
              Laster grunnkretser for {loadingNames.join(', ')} …
            </p>
          )}
          {state.errors.size > 0 && (
            <p role="alert" className="text-sm text-red-700 dark:text-red-400">
              Klarte ikke å laste grunnkretser for {[...state.errors.keys()].join(', ')} (
              {[...state.errors.values()][0]}). Slå valget av og på for å prøve igjen.
            </p>
          )}
          {kommuner
            .filter((k) => delomraderByKommune.has(k.kommunenummer))
            .map((kommune) => (
              <KommuneDelomrader
                key={kommune.kommunenummer}
                kommune={kommune}
                delomrader={delomraderByKommune.get(kommune.kommunenummer)!}
                utelatteDelomrader={utelatteDelomrader}
                onDelomraderChange={onDelomraderChange}
              />
            ))}
        </div>
      )}
    </fieldset>
  )
}

interface KommuneDelomraderProps {
  kommune: KommuneProperties
  delomrader: Delomrade[]
  utelatteDelomrader: Set<string>
  onDelomraderChange: (delomradenumre: string[], include: boolean) => void
}

/** One kommune's delområder, collapsed by default since most people want them all. */
function KommuneDelomrader({ kommune, delomrader, utelatteDelomrader, onDelomraderChange }: KommuneDelomraderProps) {
  const headingId = useId()
  const ids = delomrader.map((d) => d.delomradenummer)
  const included = delomrader.filter((d) => !utelatteDelomrader.has(d.delomradenummer))
  const grunnkretser = included.reduce((sum, d) => sum + d.grunnkretser, 0)
  const allIncluded = included.length === delomrader.length

  return (
    <details className="rounded-sm border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-800/40">
      <summary className="cursor-pointer text-sm font-medium text-slate-800 dark:text-slate-200">
        {kommune.kommunenavn}: {grunnkretser} grunnkretser
        {allIncluded
          ? ` i alle ${delomrader.length} delområder`
          : ` i ${included.length} av ${delomrader.length} delområder`}
      </summary>
      <div role="group" aria-labelledby={headingId} className="mt-2">
        <label id={headingId} className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            className={CHECKBOX_CLASS}
            checked={allIncluded}
            ref={(el) => {
              if (el) el.indeterminate = included.length > 0 && !allIncluded
            }}
            onChange={() => onDelomraderChange(ids, !allIncluded)}
          />
          Alle delområder i {kommune.kommunenavn}
        </label>
        <ul className="mt-2 grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
          {delomrader.map((d) => (
            <li key={d.delomradenummer}>
              <label className="flex items-center gap-2 rounded-xs px-1 py-0.5 text-sm text-slate-700 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800">
                <input
                  type="checkbox"
                  className={CHECKBOX_CLASS}
                  checked={!utelatteDelomrader.has(d.delomradenummer)}
                  onChange={(e) => onDelomraderChange([d.delomradenummer], e.target.checked)}
                />
                <span className="min-w-0 truncate">{d.delomradenavn}</span>
                <span className="ml-auto shrink-0 text-xs text-slate-400 tabular-nums dark:text-slate-500">
                  {d.grunnkretser}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </div>
    </details>
  )
}
