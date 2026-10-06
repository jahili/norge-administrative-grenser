import type { KommuneGruppe } from '../lib/types'
import type { SelectionApi } from '../hooks/useSelection'

interface GruppeSelectorProps {
  /** Plural noun for the groups, e.g. "fylker" or "politidistrikter". */
  flertall: string
  groups: KommuneGruppe[]
  selection: SelectionApi
  /** Shown under the heading, e.g. where the division comes from. */
  note?: string
  /** When given, each group shows how many kommuner it has. */
  kommuneCount?: Map<string, number>
}

/** Step 1: pick the groups (fylker, politidistrikter or 110-distrikter) whose kommuner to work with. */
export function GruppeSelector({ flertall, groups, selection, note, kommuneCount }: GruppeSelectorProps) {
  return (
    <fieldset className="rounded-sm border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <legend className="px-1 text-sm font-semibold text-slate-900 dark:text-slate-100">1. Velg {flertall}</legend>
      {note && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{note}</p>}

      <label className="mt-2 flex items-center gap-2 border-b border-slate-100 pb-2 text-sm font-medium text-slate-700 dark:border-slate-800 dark:text-slate-300">
        <input
          type="checkbox"
          className="h-4 w-4 accent-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-700 dark:accent-teal-400 dark:focus-visible:outline-teal-400"
          checked={selection.allGroupsSelected}
          ref={(el) => {
            if (el) el.indeterminate = selection.someGroupsSelected && !selection.allGroupsSelected
          }}
          onChange={selection.toggleAllGroups}
        />
        Velg alle {flertall}
      </label>

      <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
        {groups.map((group) => (
          <li key={group.id}>
            <label className="flex items-center gap-2 rounded-xs px-1 py-1 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800">
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0 accent-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-700 dark:accent-teal-400 dark:focus-visible:outline-teal-400"
                checked={selection.selectedGroups.has(group.id)}
                onChange={() => selection.toggleGroup(group.id)}
              />
              <span className="min-w-0 truncate">{group.navn}</span>
              {kommuneCount && (
                <span className="ml-auto shrink-0 text-xs text-slate-400 tabular-nums dark:text-slate-500">
                  {kommuneCount.get(group.id) ?? 0} kom.
                </span>
              )}
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  )
}
