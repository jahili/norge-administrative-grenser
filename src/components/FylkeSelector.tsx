import type { FylkeProperties } from '../lib/types'
import type { SelectionApi } from '../hooks/useSelection'

interface FylkeSelectorProps {
  fylker: FylkeProperties[]
  selection: SelectionApi
}

export function FylkeSelector({ fylker, selection }: FylkeSelectorProps) {
  return (
    <fieldset className="rounded-lg border border-slate-200 p-4">
      <legend className="px-1 text-sm font-semibold text-slate-900">1. Velg fylker</legend>

      <label className="mt-2 flex items-center gap-2 border-b border-slate-100 pb-2 text-sm font-medium text-slate-700">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500"
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
            <label className="flex items-center gap-2 rounded px-1 py-1 text-sm text-slate-700 hover:bg-slate-50">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500"
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
