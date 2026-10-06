import { useId } from 'react'
import { DISTRIKT_KIND_LIST, DISTRIKT_KINDS } from '../lib/distrikter'
import type { DistriktKind } from '../lib/types'

/** 'administrativ' groups kommuner by fylke; the rest group them by a district kind. */
export type Inndeling = 'administrativ' | DistriktKind

interface InndelingToggleProps {
  inndeling: Inndeling
  onChange: (inndeling: Inndeling) => void
}

export function InndelingToggle({ inndeling, onChange }: InndelingToggleProps) {
  const selectId = useId()

  return (
    <div className="rounded-sm border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <label htmlFor={selectId} className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        Inndeling
      </label>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Hva skal kommunene grupperes etter?</p>
      <select
        id={selectId}
        value={inndeling}
        onChange={(e) => onChange(e.target.value as Inndeling)}
        className="mt-2 w-full rounded-xs border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus-visible:outline-teal-400"
      >
        <option value="administrativ">Fylker (med kommuner og bydeler)</option>
        <optgroup label="Andre regioninndelinger">
          {DISTRIKT_KIND_LIST.filter((kind) => !DISTRIKT_KINDS[kind].ikkeSammenhengende).map((kind) => (
            <option key={kind} value={kind}>
              {DISTRIKT_KINDS[kind].tittel}
            </option>
          ))}
        </optgroup>
        <optgroup label="Kommunegrupperinger">
          {DISTRIKT_KIND_LIST.filter((kind) => DISTRIKT_KINDS[kind].ikkeSammenhengende).map((kind) => (
            <option key={kind} value={kind}>
              {DISTRIKT_KINDS[kind].tittel}
            </option>
          ))}
        </optgroup>
      </select>
    </div>
  )
}
