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
    <fieldset className="rounded-lg border border-slate-200 p-4">
      <legend className="text-sm font-semibold text-slate-900">Kystlinje</legend>
      <p className="mt-1 text-sm text-slate-500">
        Skal grensene følge kystlinjen, eller strekke seg videre ut til territorialgrensen i havet
        ("havgrensen")? Gjelder både forhåndsvisning og nedlasting.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:gap-6">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="radio"
            name="havgrense"
            className="h-4 w-4 border-slate-300 text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500"
            checked={!medHavgrense}
            onChange={() => onChange(false)}
          />
          Uten havgrense (følger kysten)
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="radio"
            name="havgrense"
            className="h-4 w-4 border-slate-300 text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500"
            checked={medHavgrense}
            onChange={() => onChange(true)}
          />
          Med havgrense (til territorialgrensen)
        </label>
      </div>
    </fieldset>
  )
}
