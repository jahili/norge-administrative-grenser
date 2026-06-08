import { useId } from 'react'

interface SimplificationControlProps {
  detailPercent: number
  onChange: (value: number) => void
  estimatedBytes: number | null
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} kB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function SimplificationControl({ detailPercent, onChange, estimatedBytes }: SimplificationControlProps) {
  const sliderId = useId()

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <label htmlFor={sliderId} className="text-sm font-semibold text-slate-900">
        Detaljnivå på geometrien
      </label>
      <p className="mt-1 text-sm text-slate-500">
        Lavere detaljnivå gir enklere geometri og mindre fil — fint hvis du bare trenger
        omtrentlige grenser til visualisering.
      </p>
      <div className="mt-3 flex items-center gap-3">
        <input
          id={sliderId}
          type="range"
          min={5}
          max={100}
          step={1}
          value={detailPercent}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-2 w-full cursor-pointer accent-blue-600"
          aria-describedby={`${sliderId}-value`}
        />
        <output id={`${sliderId}-value`} htmlFor={sliderId} className="w-14 text-right text-sm tabular-nums text-slate-700">
          {detailPercent}%
        </output>
      </div>
      <p className="mt-2 text-sm text-slate-600">
        Estimert filstørrelse for valgt utvalg:{' '}
        <span className="font-medium text-slate-900">
          {estimatedBytes === null ? 'velg minst én kommune' : formatBytes(estimatedBytes)}
        </span>
      </p>
    </div>
  )
}
