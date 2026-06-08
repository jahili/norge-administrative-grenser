import { useId, useState } from 'react'
import type { ExportFormat, ExportGranularity } from '../lib/types'

interface ExportPanelProps {
  format: ExportFormat
  onFormatChange: (format: ExportFormat) => void
  granularity: ExportGranularity
  onGranularityChange: (granularity: ExportGranularity) => void
  showGranularityChoice: boolean
  onDownload: (filename: string) => void
  disabled: boolean
  defaultFilenameStem: string | null
  extension: string | null
}

export function ExportPanel({
  format,
  onFormatChange,
  granularity,
  onGranularityChange,
  showGranularityChoice,
  onDownload,
  disabled,
  defaultFilenameStem,
  extension,
}: ExportPanelProps) {
  // Pre-fill the filename field with the computed suggestion, but let the
  // user override it freely. The parent remounts this panel (via `key`)
  // whenever the suggestion changes, so the field always starts out showing
  // the current suggestion for the active selection.
  const [stem, setStem] = useState(defaultFilenameStem ?? '')
  const filenameInputId = useId()

  const effectiveStem = stem.trim() || defaultFilenameStem
  const filename = effectiveStem && extension ? `${effectiveStem}.${extension}` : null

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <h2 className="text-sm font-semibold text-slate-900">3. Last ned</h2>

      {showGranularityChoice && (
        <fieldset className="mt-3">
          <legend className="text-sm text-slate-600">Inndeling</legend>
          <div className="mt-1 flex gap-4">
            {(
              [
                { value: 'kommuner', label: 'Kommunegrenser' },
                { value: 'fylker', label: 'Fylkesgrenser' },
              ] as const
            ).map(({ value, label }) => (
              <label key={value} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="export-granularity"
                  className="h-4 w-4 border-slate-300 text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500"
                  checked={granularity === value}
                  onChange={() => onGranularityChange(value)}
                />
                {label}
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Fylkesgrenser eksporterer hele fylker som sammenhengende områder, uten å dele dem opp i
            kommuner.
          </p>
        </fieldset>
      )}

      <fieldset className="mt-3">
        <legend className="text-sm text-slate-600">Filformat</legend>
        <div className="mt-1 flex gap-4">
          {(['geojson', 'topojson'] as const).map((value) => (
            <label key={value} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="export-format"
                className="h-4 w-4 border-slate-300 text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500"
                checked={format === value}
                onChange={() => onFormatChange(value)}
              />
              {value === 'geojson' ? 'GeoJSON' : 'TopoJSON'}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-3">
        <label htmlFor={filenameInputId} className="text-sm text-slate-600">
          Filnavn
        </label>
        <div className="mt-1 flex items-center gap-2">
          <input
            id={filenameInputId}
            type="text"
            value={stem}
            onChange={(e) => setStem(e.target.value)}
            placeholder={defaultFilenameStem ?? undefined}
            disabled={disabled}
            spellCheck={false}
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-900 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          />
          <span className="shrink-0 text-sm text-slate-500">.{extension ?? '…'}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => filename && onDownload(filename)}
        disabled={disabled || !filename}
        className="mt-4 inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        Last ned {format === 'geojson' ? 'GeoJSON' : 'TopoJSON'}
      </button>

      <p className="mt-2 text-sm text-slate-500" aria-live="polite">
        {filename ? (
          <>
            Filnavn: <span className="font-medium text-slate-700">{filename}</span>
          </>
        ) : (
          'Velg minst én kommune for å aktivere nedlasting.'
        )}
      </p>
    </div>
  )
}
