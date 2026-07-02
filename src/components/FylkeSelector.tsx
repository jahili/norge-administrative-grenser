import type { FylkeProperties } from '../lib/types'
import type { SelectionApi } from '../hooks/useSelection'

interface FylkeSelectorProps {
  fylker: FylkeProperties[]
  selection: SelectionApi
}

export function FylkeSelector({ fylker, selection }: FylkeSelectorProps) {
  return (
    <fieldset className="rounded-sm border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <legend className="px-1 text-sm font-semibold text-slate-900 dark:text-slate-100">1. Velg fylker</legend>

      <label className="mt-2 flex items-center gap-2 border-b border-slate-100 pb-2 text-sm font-medium text-slate-700 dark:border-slate-800 dark:text-slate-300">
        <input
          type="checkbox"
          className="h-4 w-4 accent-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-700 dark:accent-teal-400 dark:focus-visible:outline-teal-400"
          checked={selection.allFylkerSelected}
          ref={(el) => {
            if (el) el.indeterminate = selection.someFylkerSelected && !selection.allFylkerSelected
          }}
          onChange={selection.toggleAllFylker}
        />
        Velg alle fylker
      </label>

      <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
        {fylker.map((fylke) => (
          <li key={fylke.fylkesnummer}>
            <label className="flex items-center gap-2 rounded-xs px-1 py-1 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800">
              <input
                type="checkbox"
                className="h-4 w-4 accent-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-700 dark:accent-teal-400 dark:focus-visible:outline-teal-400"
                checked={selection.selectedFylker.has(fylke.fylkesnummer)}
                onChange={() => selection.toggleFylke(fylke.fylkesnummer)}
              />
              {fylke.fylkesnavn}
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  )
}
