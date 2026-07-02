import { useId, useRef, useState } from 'react'
import type { ExportFormat, ExportGranularity } from '../lib/types'

interface ExportPanelProps {
  format: ExportFormat
  onFormatChange: (format: ExportFormat) => void
  granularity: ExportGranularity
  onGranularityChange: (granularity: ExportGranularity) => void
  showGranularityChoice: boolean
  showBydelChoice: boolean
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
  showBydelChoice,
  onDownload,
  disabled,
  defaultFilenameStem,
  extension,
}: ExportPanelProps) {
  const [stem, setStem] = useState(defaultFilenameStem ?? '')
  const [justDownloaded, setJustDownloaded] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const filenameInputId = useId()

  const effectiveStem = stem.trim() || defaultFilenameStem
  const filename = effectiveStem && extension ? `${effectiveStem}.${extension}` : null

  type GranularityOption = { value: ExportGranularity; label: string }
  const granularityOptions: GranularityOption[] = []
  if (showGranularityChoice || showBydelChoice) {
    granularityOptions.push({ value: 'kommuner', label: 'Kommunegrenser' })
  }
  if (showGranularityChoice) {
    granularityOptions.push({ value: 'fylker', label: 'Fylkesgrenser' })
  }
  if (showBydelChoice) {
    granularityOptions.push({ value: 'bydeler', label: 'Bydeler' })
  }

  function handleDownload() {
    if (!filename) return
    onDownload(filename)
    setJustDownloaded(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setJustDownloaded(false), 2500)
  }

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <h2 className="text-sm font-semibold text-slate-900">Last ned</h2>

      {granularityOptions.length > 0 && (
        <fieldset className="mt-3">
          <legend className="text-sm text-slate-600">Inndeling</legend>
          <div className="mt-1 flex flex-wrap gap-4">
            {granularityOptions.map(({ value, label }) => (
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
          <p className="mt-1.5 text-xs text-slate-500">
            {granularity === 'fylker' && 'Eksporterer hele fylket som ett polygon, uten inndeling i kommuner.'}
            {granularity === 'kommuner' && 'Eksporterer de valgte kommunene som separate polygoner.'}
            {granularity === 'bydeler' && 'Eksporterer de valgte bydelene som separate polygoner.'}
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
        onClick={handleDownload}
        disabled={disabled || !filename}
        className="mt-4 inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {justDownloaded ? (
          <>
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="2,9 6,13 14,4" />
            </svg>
            Lastet ned
          </>
        ) : (
          <>
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 2v8M4 7l4 4 4-4M2 13h12" />
            </svg>
            Last ned {format === 'geojson' ? 'GeoJSON' : 'TopoJSON'}
          </>
        )}
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
