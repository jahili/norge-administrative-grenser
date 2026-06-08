import { useId } from 'react'
import type { FylkeProperties, KommuneProperties } from '../lib/types'
import type { SelectionApi } from '../hooks/useSelection'

interface KommuneSelectorProps {
  fylker: FylkeProperties[]
  kommunerByFylke: Map<string, KommuneProperties[]>
  selection: SelectionApi
}

export function KommuneSelector({ fylker, kommunerByFylke, selection }: KommuneSelectorProps) {
  const selectedFylker = fylker.filter((f) => selection.selectedFylker.has(f.fylkesnummer))

  return (
    <fieldset className="rounded-lg border border-slate-200 p-4">
      <legend className="px-1 text-sm font-semibold text-slate-900">2. Velg kommuner</legend>

      {selectedFylker.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">Velg ett eller flere fylker for å se kommunene deres her.</p>
      ) : (
        <div className="mt-2 flex flex-col gap-4">
          {selectedFylker.map((fylke) => (
            <FylkeGroup
              key={fylke.fylkesnummer}
              fylke={fylke}
              kommuner={kommunerByFylke.get(fylke.fylkesnummer) ?? []}
              selection={selection}
            />
          ))}
        </div>
      )}
    </fieldset>
  )
}

interface FylkeGroupProps {
  fylke: FylkeProperties
  kommuner: KommuneProperties[]
  selection: SelectionApi
}

function FylkeGroup({ fylke, kommuner, selection }: FylkeGroupProps) {
  const headingId = useId()
  const allSelected = kommuner.every((k) => selection.selectedKommuner.has(k.kommunenummer))
  const someSelected = kommuner.some((k) => selection.selectedKommuner.has(k.kommunenummer))

  return (
    <div role="group" aria-labelledby={headingId} className="rounded-md border border-slate-100 bg-slate-50/60 p-3">
      <label id={headingId} className="flex items-center gap-2 text-sm font-medium text-slate-800">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500"
          checked={allSelected}
          ref={(el) => {
            if (el) el.indeterminate = someSelected && !allSelected
          }}
          onChange={() => selection.toggleAllInFylke(fylke.fylkesnummer)}
        />
        Velg alle i {fylke.fylkesnavn} ({kommuner.length})
      </label>

      <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3 lg:grid-cols-4">
        {kommuner.map((kommune) => (
          <li key={kommune.kommunenummer}>
            <label className="flex items-center gap-2 rounded px-1 py-0.5 text-sm text-slate-700 hover:bg-white">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500"
                checked={selection.selectedKommuner.has(kommune.kommunenummer)}
                onChange={() => selection.toggleKommune(kommune.kommunenummer)}
              />
              {kommune.kommunenavn}
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}
