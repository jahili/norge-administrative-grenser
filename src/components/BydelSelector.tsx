import { useId } from 'react'
import type { BydelProperties, KommuneProperties } from '../lib/types'
import type { SelectionApi } from '../hooks/useSelection'

interface BydelSelectorProps {
  /** Only the selected kommuner that have bydeler are passed here. */
  kommunerMedBydeler: KommuneProperties[]
  bydelsByKommune: Map<string, BydelProperties[]>
  selection: SelectionApi
}

export function BydelSelector({ kommunerMedBydeler, bydelsByKommune, selection }: BydelSelectorProps) {
  if (kommunerMedBydeler.length === 0) return null

  return (
    <fieldset className="rounded-lg border border-slate-200 p-4">
      <legend className="px-1 text-sm font-semibold text-slate-900">3. Velg bydeler (valgfritt)</legend>

      <div className="mt-2 flex flex-col gap-4">
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
    <div role="group" aria-labelledby={headingId} className="rounded-md border border-slate-100 bg-slate-50/60 p-3">
      <label id={headingId} className="flex items-center gap-2 text-sm font-medium text-slate-800">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500"
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
            <label className="flex items-center gap-2 rounded px-1 py-0.5 text-sm text-slate-700 hover:bg-white">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500"
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
