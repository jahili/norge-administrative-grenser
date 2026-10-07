import type { BydelProperties, KommuneProperties } from '../lib/types'
import type { SelectionApi } from '../hooks/useSelection'
import { Chip, TextButton } from './ui'

interface BydelSelectorProps {
  kommunerMedBydeler: KommuneProperties[]
  bydelsByKommune: Map<string, BydelProperties[]>
  selection: SelectionApi
}

/** Optional finer level under section 03: bydeler in the selected kommuner that have them. */
export function BydelSelector({ kommunerMedBydeler, bydelsByKommune, selection }: BydelSelectorProps) {
  if (kommunerMedBydeler.length === 0) return null

  return (
    <div className="flex flex-col gap-3 rounded-card border border-line bg-surface-2 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-semibold text-ink">Bydeler (valgfritt)</h3>
        {selection.selectedBydeler.size > 0 && <TextButton onClick={selection.clearAllBydeler}>Fjern alle</TextButton>}
      </div>
      <p className="-mt-2 text-xs text-muted">
        Velger du bydeler, lastes de ned i stedet for kommunene. De følger alltid kystlinjen.
      </p>
      {kommunerMedBydeler.map((kommune) => {
        const bydeler = bydelsByKommune.get(kommune.kommunenummer) ?? []
        const allSelected = bydeler.every((b) => selection.selectedBydeler.has(b.bydelnummer))
        return (
          <div key={kommune.kommunenummer} role="group" aria-label={`Bydeler i ${kommune.kommunenavn}`} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-medium tracking-wide text-muted uppercase">
                {kommune.kommunenavn} · {bydeler.length}
              </span>
              <button
                type="button"
                onClick={() => selection.toggleAllBydelerInKommune(kommune.kommunenummer)}
                className="cursor-pointer text-xs font-medium text-accent hover:text-accent-hover"
              >
                {allSelected ? 'Fjern alle' : 'Velg alle'}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {bydeler.map((bydel) => (
                <Chip
                  key={bydel.bydelnummer}
                  selected={selection.selectedBydeler.has(bydel.bydelnummer)}
                  onClick={() => selection.toggleBydel(bydel.bydelnummer)}
                  title={bydel.bydelnummer}
                >
                  {bydel.bydelnavn}
                </Chip>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
