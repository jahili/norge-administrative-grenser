interface HavgrenseToggleProps {
  medHavgrense: boolean
  onChange: (medHavgrense: boolean) => void
}

/**
 * Lets the user choose between two bundled geometry variants for every
 * fylke/kommune: the official borders (which extend out to the maritime
 * territorial boundary, "havgrense" — encompassing large open-sea areas for
 * coastal areas) or borders clipped to the coastline. This choice affects
 * both the map preview and the downloaded file.
 */
export function HavgrenseToggle({ medHavgrense, onChange }: HavgrenseToggleProps) {
  return (
    <fieldset className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <legend className="px-1 text-sm font-semibold text-slate-900 dark:text-slate-100">Kystlinje</legend>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Skal grensene følge kystlinjen, eller strekke seg videre ut til territorialgrensen i havet
        ("havgrensen")? Gjelder både forhåndsvisning og nedlasting.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:gap-6">
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="radio"
            name="havgrense"
            className="h-4 w-4 accent-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900 dark:accent-slate-300 dark:focus-visible:outline-slate-100"
            checked={!medHavgrense}
            onChange={() => onChange(false)}
          />
          Uten havgrense (følger kysten)
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="radio"
            name="havgrense"
            className="h-4 w-4 accent-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900 dark:accent-slate-300 dark:focus-visible:outline-slate-100"
            checked={medHavgrense}
            onChange={() => onChange(true)}
          />
          Med havgrense (til territorialgrensen)
        </label>
      </div>
    </fieldset>
  )
}
