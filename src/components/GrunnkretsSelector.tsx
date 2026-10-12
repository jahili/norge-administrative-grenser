import { useId } from 'react'
import { GRUNNKRETS_INDEX } from '../lib/grunnkretser'
import type { Underomrade } from '../lib/grunnkretser'
import levekarssoner from '../assets/levekarssoner.json'
import type { GrunnkretsState } from '../hooks/useGrunnkretser'
import type { GrunnkretsNivå, KommuneProperties } from '../lib/types'
import { Segmented, Spinner } from './ui'
import { formatBytes } from '../lib/format'

const KOMMUNER_MED_LEVEKARSSONER = new Set(levekarssoner.kommuner)

interface GrunnkretsSelectorProps {
  /** The selected kommuner, whose grunnkretser are offered. */
  kommuner: KommuneProperties[]
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
  /** Download every grunnkrets, or the grunnkretser merged per delområde or levekårssone. */
  nivå: GrunnkretsNivå
  onNivåChange: (nivå: GrunnkretsNivå) => void
  state: GrunnkretsState
  /** What can be left out per kommune, once the kommune's fylke file has loaded:
   *  levekårssoner at that level, delområder otherwise. */
  underomraderByKommune: Map<string, Underomrade[]>
  utelatte: Set<string>
  /** Includes (`include = true`) or excludes the given delområder or levekårssoner. */
  onUtelatteChange: (numre: string[], include: boolean) => void
}

/**
 * Optional finer level under section 03: download the grunnkretser — or
 * delområder or levekårssoner — in the selected kommuner instead of the
 * kommuner themselves, optionally leaving some out. The grunnkrets files
 * (which hold every level) are fetched per fylke only once this is switched on.
 */
export function GrunnkretsSelector({
  kommuner,
  enabled,
  onEnabledChange,
  nivå,
  onNivåChange,
  state,
  underomraderByKommune,
  utelatte,
  onUtelatteChange,
}: GrunnkretsSelectorProps) {
  const toggleId = useId()
  if (kommuner.length === 0) return null

  const fylker = [...new Set(kommuner.map((k) => k.fylkesnummer))]
  const bytes = fylker.reduce((sum, nr) => sum + (GRUNNKRETS_INDEX[nr]?.bytes ?? 0), 0)
  const loadingNames = state.loading.map((nr) => kommuner.find((k) => k.fylkesnummer === nr)?.fylkesnavn ?? nr)
  const utenLevekarssoner = kommuner.filter((k) => !KOMMUNER_MED_LEVEKARSSONER.has(k.kommunenummer))
  const flertall = nivå === 'levekarssoner' ? 'levekårssoner' : 'delområder'

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
          <span className="font-semibold text-ink">Grunnkretser, delområder og levekårssoner (valgfritt)</span>
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
              ['levekarssoner', 'Levekårssoner'],
            ]}
            value={nivå}
            onChange={onNivåChange}
          />
          {nivå === 'levekarssoner' && (
            <p className="text-xs text-muted">
              Levekårssoner (LKS) er grupper av grunnkretser som FHI publiserer folkehelsestatistikk på. SSB deler inn
              kommunene puljevis; {levekarssoner.navn} har {levekarssoner.levekarssoner} soner i{' '}
              {levekarssoner.kommuner.length} kommuner.
              {utenLevekarssoner.length > 0 &&
                (utenLevekarssoner.length === kommuner.length
                  ? ' Ingen av de valgte kommunene har levekårssoner ennå.'
                  : ` ${listeTekst(utenLevekarssoner.map((k) => k.kommunenavn))} har ingen ennå og er ikke med i nedlastingen.`)}
            </p>
          )}
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
            .filter((k) => underomraderByKommune.has(k.kommunenummer))
            .map((kommune) => (
              <KommuneUnderomrader
                key={kommune.kommunenummer}
                kommune={kommune}
                omrader={underomraderByKommune.get(kommune.kommunenummer)!}
                flertall={flertall}
                utelatte={utelatte}
                onUtelatteChange={onUtelatteChange}
              />
            ))}
        </>
      )}
    </div>
  )
}

/** "A", "A og B", "A, B og C" — capped so a long selection doesn't fill the panel. */
function listeTekst(navn: string[]): string {
  if (navn.length > 4) return `${navn.slice(0, 3).join(', ')} og ${navn.length - 3} andre`
  return navn.length === 1 ? navn[0] : `${navn.slice(0, -1).join(', ')} og ${navn[navn.length - 1]}`
}

interface KommuneUnderomraderProps {
  kommune: KommuneProperties
  omrader: Underomrade[]
  /** "delområder" or "levekårssoner". */
  flertall: string
  utelatte: Set<string>
  onUtelatteChange: (numre: string[], include: boolean) => void
}

/** One kommune's delområder or levekårssoner, collapsed by default since most people want them all. */
function KommuneUnderomrader({ kommune, omrader, flertall, utelatte, onUtelatteChange }: KommuneUnderomraderProps) {
  const ids = omrader.map((o) => o.nummer)
  const included = omrader.filter((o) => !utelatte.has(o.nummer))
  const grunnkretser = included.reduce((sum, o) => sum + o.grunnkretser, 0)
  const allIncluded = included.length === omrader.length
  const Flertall = flertall[0].toUpperCase() + flertall.slice(1)

  return (
    <details className="rounded-field border border-line bg-surface">
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-3 py-2">
        <span className="flex-1 font-medium text-ink">{kommune.kommunenavn}</span>
        <span className="font-mono text-xs text-muted">
          {grunnkretser} kretser · {included.length}/{omrader.length} {flertall}
        </span>
      </summary>
      <div role="group" aria-label={`${Flertall} i ${kommune.kommunenavn}`} className="border-t border-seg">
        <label className="flex min-h-11 cursor-pointer items-center gap-2.5 border-b border-seg px-3 py-1.5 font-medium">
          <input
            type="checkbox"
            className="h-4 w-4 shrink-0 cursor-pointer"
            checked={allIncluded}
            ref={(el) => {
              if (el) el.indeterminate = included.length > 0 && !allIncluded
            }}
            onChange={() => onUtelatteChange(ids, !allIncluded)}
          />
          Alle {flertall} i {kommune.kommunenavn}
        </label>
        <div className="max-h-[220px] overflow-auto">
          {omrader.map((o) => (
            <label key={o.nummer} className="flex min-h-10 cursor-pointer items-center gap-2.5 px-3 py-1 hover:bg-row-selected">
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0 cursor-pointer"
                checked={!utelatte.has(o.nummer)}
                onChange={(e) => onUtelatteChange([o.nummer], e.target.checked)}
              />
              <span className="min-w-0 flex-1 truncate">{o.navn}</span>
              <span className="font-mono text-xs text-muted">{o.nummer}</span>
            </label>
          ))}
        </div>
      </div>
    </details>
  )
}
