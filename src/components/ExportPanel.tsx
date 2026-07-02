import { useId, useRef, useState } from 'react'
import type { ExportFormat, ExportGranularity } from '../lib/types'

interface ExportPanelProps {
  format: ExportFormat
  onFormatChange: (format: ExportFormat) => void
  onDownload: (filename: string) => void
  disabled: boolean
  defaultFilenameStem: string | null
  extension: string | null
  granularity: ExportGranularity
  featureCount: number
}

const LEVEL_SINGULAR: Record<ExportGranularity, string> = {
  fylker: 'fylke',
  kommuner: 'kommune',
  bydeler: 'bydel',
}
const LEVEL_PLURAL: Record<ExportGranularity, string> = {
  fylker: 'fylker',
  kommuner: 'kommuner',
  bydeler: 'bydeler',
}

export function ExportPanel({
  format,
  onFormatChange,
  onDownload,
  disabled,
  defaultFilenameStem,
  extension,
  granularity,
  featureCount,
}: ExportPanelProps) {
  const [stem, setStem] = useState(defaultFilenameStem ?? '')
  const [justDownloaded, setJustDownloaded] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const filenameInputId = useId()

  const effectiveStem = stem.trim() || defaultFilenameStem
  const filename = effectiveStem && extension ? `${effectiveStem}.${extension}` : null

  const levelWord = featureCount === 1 ? LEVEL_SINGULAR[granularity] : LEVEL_PLURAL[granularity]
  const formatLabel = format === 'geojson' ? 'GeoJSON' : 'TopoJSON'
  const buttonLabel =
    disabled || featureCount === 0
      ? `Last ned ${formatLabel}`
      : `Last ned ${featureCount} ${levelWord} (${formatLabel})`

  function handleDownload() {
    if (!filename) return
    onDownload(filename)
    setJustDownloaded(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setJustDownloaded(false), 2500)
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Last ned</h2>

      <fieldset className="mt-3">
        <legend className="text-sm text-slate-600 dark:text-slate-400">Filformat</legend>
        <div className="mt-1 flex gap-4">
          {(['geojson', 'topojson'] as const).map((value) => (
            <label key={value} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="radio"
                name="export-format"
                className="h-4 w-4 accent-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900 dark:accent-slate-300 dark:focus-visible:outline-slate-100"
                checked={format === value}
                onChange={() => onFormatChange(value)}
              />
              {value === 'geojson' ? 'GeoJSON' : 'TopoJSON'}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-3">
        <label htmlFor={filenameInputId} className="text-sm text-slate-600 dark:text-slate-400">
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
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500 dark:focus-visible:outline-slate-100 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
          />
          <span className="shrink-0 text-sm text-slate-500 dark:text-slate-400">.{extension ?? '…'}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleDownload}
        disabled={disabled || !filename}
        className="mt-4 inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:bg-slate-300 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white dark:focus-visible:outline-slate-100 dark:disabled:bg-slate-700 dark:disabled:text-slate-500"
      >
        {justDownloaded ? (
          <>
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <polyline points="2,9 6,13 14,4" />
            </svg>
            Lastet ned
          </>
        ) : (
          <>
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M8 2v8M4 7l4 4 4-4M2 13h12" />
            </svg>
            {buttonLabel}
          </>
        )}
      </button>

      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400" aria-live="polite">
        {filename ? (
          <>
            Filnavn: <span className="font-medium text-slate-700 dark:text-slate-300">{filename}</span>
          </>
        ) : (
          'Velg minst én kommune for å aktivere nedlasting.'
        )}
      </p>
    </div>
  )
}
