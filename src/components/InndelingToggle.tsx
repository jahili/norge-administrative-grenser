import { DISTRIKT_KINDS } from '../lib/distrikter'
import type { DistriktKind } from '../lib/types'

/** 'administrativ' is the fylke → kommune → bydel drill-down; the rest are flat district lists. */
export type Inndeling = 'administrativ' | DistriktKind

interface InndelingToggleProps {
  inndeling: Inndeling
  onChange: (inndeling: Inndeling) => void
}

const OPTIONS: { value: Inndeling; label: string }[] = [
  { value: 'administrativ', label: 'Fylker, kommuner og bydeler' },
  { value: 'politidistrikter', label: DISTRIKT_KINDS.politidistrikter.tittel },
  { value: 'distrikter110', label: DISTRIKT_KINDS.distrikter110.tittel },
]

export function InndelingToggle({ inndeling, onChange }: InndelingToggleProps) {
  return (
    <fieldset className="rounded-sm border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <legend className="px-1 text-sm font-semibold text-slate-900 dark:text-slate-100">Inndeling</legend>
      <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-6">
        {OPTIONS.map(({ value, label }) => (
          <label key={value} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="radio"
              name="inndeling"
              className="h-4 w-4 accent-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-700 dark:accent-teal-400 dark:focus-visible:outline-teal-400"
              checked={inndeling === value}
              onChange={() => onChange(value)}
            />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
