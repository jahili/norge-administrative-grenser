import { useId } from 'react'
import { GRUNNKRETS_INDEX } from '../lib/grunnkretser'
import type { GrunnkretsState } from '../hooks/useGrunnkretser'
import type { GrunnkretsNivå, KommuneProperties } from '../lib/types'
import { Segmented, Spinner } from './ui'
import { formatBytes } from '../lib/format'

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
  /** Download every grunnkrets, or the grunnkretser merged per delområde. */
  nivå: GrunnkretsNivå
  onNivåChange: (nivå: GrunnkretsNivå) => void
  state: GrunnkretsState
  /** Delområder per kommune, once the kommune's fylke file has loaded. */
  delomraderByKommune: Map<string, Delomrade[]>
  utelatteDelomrader: Set<string>
  /** Includes (`include = true`) or excludes the given delområder. */
  onDelomraderChange: (delomradenumre: string[], include: boolean) => void
}

/**
 * Optional finer level under section 03: download the grunnkretser — or
 * delområder — in the selected kommuner instead of the kommuner themselves,
 * optionally leaving out delområder. The grunnkrets files (which hold both
 * levels) are fetched per fylke only once this is switched on.
 */
export function GrunnkretsSelector({
  kommuner,
  enabled,
  onEnabledChange,
  nivå,
  onNivåChange,
  state,
  delomraderByKommune,
  utelatteDelomrader,
  onDelomraderChange,
}: GrunnkretsSelectorProps) {
  const toggleId = useId()
  if (kommuner.length === 0) return null

  const fylker = [...new Set(kommuner.map((k) => k.fylkesnummer))]
  const bytes = fylker.reduce((sum, nr) => sum + (GRUNNKRETS_INDEX[nr]?.bytes ?? 0), 0)
  const loadingNames = state.loading.map((nr) => kommuner.find((k) => k.fylkesnummer === nr)?.fylkesnavn ?? nr)

  return (
    <div className="flex flex-col gap-3 rounded-card border border-line bg-surface-2 p-3">
      <label htmlFor={toggleId} className="flex cursor-pointer items-start gap-2.5">
        <input
          id={toggleId}
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer"
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
        />
        <span className="flex flex-col">
          <span className="font-semibold text-ink">Grunnkretser og delområder (valgfritt)</span>
          <span className="text-xs text-muted">
            Last ned SSBs minste statistiske enheter i{' '}
            {kommuner.length === 1 ? kommuner[0].kommunenavn : `de ${kommuner.length} valgte kommunene`} i stedet for
            kommunene. Hentes ved behov ({fylker.length === 1 ? '1 fylke' : `${fylker.length} fylker`},{' '}
            <span className="font-mono">≈ {formatBytes(bytes)}</span>).
          </span>
        </span>
      </label>

      {enabled && (
        <>
          <Segmented
            label="Nivå"
            options={[
              ['grunnkretser', 'Grunnkretser'],
              ['delomrader', 'Delområder'],
            ]}
            value={nivå}
            onChange={onNivåChange}
          />
          {state.loading.length > 0 && (
            <p role="status" className="flex items-center gap-2 text-muted">
              <Spinner /> Laster grunnkretser for {loadingNames.join(', ')} …
            </p>
          )}
          {state.errors.size > 0 && (
            <p role="alert" className="text-red-700 dark:text-red-400">
              Klarte ikke å laste grunnkretser for {[...state.errors.keys()].join(', ')} ({[...state.errors.values()][0]}). Slå
              valget av og på for å prøve igjen.
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
        </>
      )}
    </div>
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
  const ids = delomrader.map((d) => d.delomradenummer)
  const included = delomrader.filter((d) => !utelatteDelomrader.has(d.delomradenummer))
  const grunnkretser = included.reduce((sum, d) => sum + d.grunnkretser, 0)
  const allIncluded = included.length === delomrader.length

  return (
    <details className="rounded-field border border-line bg-surface">
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-3 py-2">
        <span className="flex-1 font-medium text-ink">{kommune.kommunenavn}</span>
        <span className="font-mono text-xs text-muted">
          {grunnkretser} kretser · {included.length}/{delomrader.length} delområder
        </span>
      </summary>
      <div role="group" aria-label={`Delområder i ${kommune.kommunenavn}`} className="border-t border-seg">
        <label className="flex min-h-11 cursor-pointer items-center gap-2.5 border-b border-seg px-3 py-1.5 font-medium">
          <input
            type="checkbox"
            className="h-4 w-4 shrink-0 cursor-pointer"
            checked={allIncluded}
            ref={(el) => {
              if (el) el.indeterminate = included.length > 0 && !allIncluded
            }}
            onChange={() => onDelomraderChange(ids, !allIncluded)}
          />
          Alle delområder i {kommune.kommunenavn}
        </label>
        <div className="max-h-[220px] overflow-auto">
          {delomrader.map((d) => (
            <label key={d.delomradenummer} className="flex min-h-10 cursor-pointer items-center gap-2.5 px-3 py-1 hover:bg-row-selected">
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0 cursor-pointer"
                checked={!utelatteDelomrader.has(d.delomradenummer)}
                onChange={(e) => onDelomraderChange([d.delomradenummer], e.target.checked)}
              />
              <span className="min-w-0 flex-1 truncate">{d.delomradenavn}</span>
              <span className="font-mono text-xs text-muted">{d.delomradenummer}</span>
            </label>
          ))}
        </div>
      </div>
    </details>
  )
}
