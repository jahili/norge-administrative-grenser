import { useEffect, useId, useRef, useState } from 'react'
import type { ExportFormat, ExportGranularity } from '../lib/types'
import { DownloadIcon, Segmented } from './ui'
import { formatBytes, levelWords } from '../lib/format'

const FORMAT_LABEL: Record<ExportFormat, string> = { geojson: 'GeoJSON', topojson: 'TopoJSON' }

export interface DownloadState {
  format: ExportFormat
  onFormatChange: (format: ExportFormat) => void
  /** What the user typed; empty means the suggested filename. */
  stem: string
  onStemChange: (stem: string) => void
  defaultStem: string | null
  granularity: ExportGranularity
  featureCount: number
  /** Size of the download, 'senere' when it is only built on download. */
  bytes: number | 'senere' | null
  /** Downloads with this filename (stem + extension). */
  onDownload: (filename: string) => void
}

function filenameOf({ stem, defaultStem, format }: DownloadState): string | null {
  const effective = stem.trim() || defaultStem
  return effective ? `${effective}.${format}` : null
}

/** Format choice and filename (with the extension as a suffix). */
export function DownloadOptions(props: DownloadState) {
  const filenameId = useId()
  const { format, onFormatChange, stem, onStemChange, defaultStem, featureCount } = props

  return (
    <div className="flex flex-wrap gap-2">
      <Segmented
        label="Filformat"
        size="sm"
        stretch={false}
        options={[
          ['geojson', 'GeoJSON'],
          ['topojson', 'TopoJSON'],
        ]}
        value={format}
        onChange={onFormatChange}
      />
      <div className="flex h-10 min-w-[240px] flex-1 items-center rounded-field border border-input bg-surface px-2.5 font-mono text-xs focus-within:outline-2 focus-within:outline-accent">
        <label htmlFor={filenameId} className="sr-only">
          Filnavn
        </label>
        <input
          id={filenameId}
          value={stem}
          onChange={(e) => onStemChange(e.target.value)}
          placeholder={defaultStem ?? 'filnavn'}
          disabled={featureCount === 0}
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-ink disabled:placeholder:text-muted"
        />
        <span className="text-muted">.{format}</span>
      </div>
    </div>
  )
}

/** The primary download button: «Last ned 21 kommuner  ≈ 74 kB». */
export function DownloadButton(props: DownloadState & { mobile?: boolean }) {
  const { granularity, featureCount, bytes, format, onDownload, mobile = false } = props
  const [justDownloaded, setJustDownloaded] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const filename = filenameOf(props)
  const { entall, flertall, artikkel } = levelWords(granularity)
  const disabled = featureCount === 0 || !filename
  const label = disabled
    ? `Last ned ${FORMAT_LABEL[format]}`
    : `Last ned ${featureCount} ${featureCount === 1 ? entall : flertall}${mobile ? ` · ${FORMAT_LABEL[format]}` : ''}`

  function handleClick() {
    if (!filename) return
    onDownload(filename)
    setJustDownloaded(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setJustDownloaded(false), 2500)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        aria-describedby={disabled ? `${props.granularity}-hint` : undefined}
        className={`flex w-full cursor-pointer items-center justify-center gap-2.5 bg-accent text-[15px] font-semibold text-on-accent hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-seg disabled:text-muted ${
          mobile ? 'h-[52px] rounded-[14px]' : 'h-12 rounded-card'
        }`}
      >
        {justDownloaded ? (
          <>
            <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12l5 5 9-10" />
            </svg>
            Lastet ned
          </>
        ) : (
          <>
            <DownloadIcon />
            {label}
            {!disabled && !mobile && bytes !== null && (
              <span className="font-mono text-xs font-normal opacity-85">
                {bytes === 'senere' ? 'stort utvalg' : `≈ ${formatBytes(bytes)}`}
              </span>
            )}
          </>
        )}
      </button>
      {disabled && (
        <p id={`${props.granularity}-hint`} className="text-xs text-muted">
          Velg minst {artikkel} {entall} for å laste ned.
        </p>
      )}
    </div>
  )
}

/** Desktop: sticky at the bottom of the sidebar. */
export function DownloadBar(props: DownloadState) {
  return (
    <div className="sticky bottom-0 flex flex-col gap-3 border-t border-line bg-surface-2 px-5 pt-4 pb-5">
      <DownloadOptions {...props} />
      <DownloadButton {...props} />
      <span className="text-xs text-muted">WGS84 (EPSG:4326) · Alt skjer i nettleseren, ingen data sendes til en server.</span>
    </div>
  )
}
