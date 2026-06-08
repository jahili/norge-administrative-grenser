import type { ExportFormat } from '../lib/types'

interface ExportPanelProps {
  format: ExportFormat
  onFormatChange: (format: ExportFormat) => void
  onDownload: () => void
  disabled: boolean
  filename: string | null
}

export function ExportPanel({ format, onFormatChange, onDownload, disabled, filename }: ExportPanelProps) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <h2 className="text-sm font-semibold text-slate-900">3. Last ned</h2>

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

      <button
        type="button"
        onClick={onDownload}
        disabled={disabled}
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
