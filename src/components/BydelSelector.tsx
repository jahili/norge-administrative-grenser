import { useId } from 'react'
import type { BydelProperties, KommuneProperties } from '../lib/types'
import type { SelectionApi } from '../hooks/useSelection'

interface BydelSelectorProps {
  kommunerMedBydeler: KommuneProperties[]
  bydelsByKommune: Map<string, BydelProperties[]>
  selection: SelectionApi
}

export function BydelSelector({ kommunerMedBydeler, bydelsByKommune, selection }: BydelSelectorProps) {
  if (kommunerMedBydeler.length === 0) return null

  const anySelected = selection.selectedBydeler.size > 0

  return (
    <fieldset className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <legend className="px-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
        3. Velg bydeler (valgfritt)
      </legend>

      <div className="mt-2 flex items-center justify-between">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Kystlinje-valget gjelder ikke for bydeler — de følger alltid kystlinjen.
        </p>
        {anySelected && (
          <button
            type="button"
            onClick={selection.clearAllBydeler}
            className="ml-4 shrink-0 text-xs text-slate-400 underline hover:text-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 dark:text-slate-500 dark:hover:text-slate-300 dark:focus-visible:outline-slate-100"
          >
            Fjern alle
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-4">
        {kommunerMedBydeler.map((kommune) => (
          <KommuneGroup
            key={kommune.kommunenummer}
            kommune={kommune}
            bydeler={bydelsByKommune.get(kommune.kommunenummer) ?? []}
            selection={selection}
          />
        ))}
      </div>
    </fieldset>
  )
}

interface KommuneGroupProps {
  kommune: KommuneProperties
  bydeler: BydelProperties[]
  selection: SelectionApi
}

function KommuneGroup({ kommune, bydeler, selection }: KommuneGroupProps) {
  const headingId = useId()
  const allSelected = bydeler.every((b) => selection.selectedBydeler.has(b.bydelnummer))
  const someSelected = bydeler.some((b) => selection.selectedBydeler.has(b.bydelnummer))

  return (
    <div
      role="group"
      aria-labelledby={headingId}
      className="rounded-lg border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-800/40"
    >
      <label id={headingId} className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-200">
        <input
          type="checkbox"
          className="h-4 w-4 accent-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900 dark:accent-slate-300 dark:focus-visible:outline-slate-100"
          checked={allSelected}
          ref={(el) => {
            if (el) el.indeterminate = someSelected && !allSelected
          }}
          onChange={() => selection.toggleAllBydelerInKommune(kommune.kommunenummer)}
        />
        Velg alle i {kommune.kommunenavn} ({bydeler.length})
      </label>

      <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3 lg:grid-cols-4">
        {bydeler.map((bydel) => (
          <li key={bydel.bydelnummer}>
            <label className="flex items-center gap-2 rounded-md px-1 py-0.5 text-sm text-slate-700 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800">
              <input
                type="checkbox"
                className="h-4 w-4 accent-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900 dark:accent-slate-300 dark:focus-visible:outline-slate-100"
                checked={selection.selectedBydeler.has(bydel.bydelnummer)}
                onChange={() => selection.toggleBydel(bydel.bydelnummer)}
              />
              {bydel.bydelnavn}
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}
