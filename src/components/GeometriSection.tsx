import { useId } from 'react'
import { SectionHeader, Segmented } from './ui'

interface GeometriSectionProps {
  medHavgrense: boolean
  onMedHavgrenseChange: (medHavgrense: boolean) => void
  detailPercent: number
  onDetailChange: (percent: number) => void
  number?: string
}

/**
 * Section 04: the geometry variant (coastline or out to the territorial
 * boundary, «havgrensen») and how much detail to keep. Both affect the map
 * preview and the download.
 */
export function GeometriSection({
  medHavgrense,
  onMedHavgrenseChange,
  detailPercent,
  onDetailChange,
  number,
}: GeometriSectionProps) {
  const sliderId = useId()

  return (
    <section className="flex flex-col gap-3.5">
      <SectionHeader number={number} title="Geometri" />

      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] text-ink-2">Kystlinje</span>
        <Segmented
          label="Kystlinje"
          options={[
            ['kyst', 'Følger kysten'],
            ['hav', 'Til havgrensen'],
          ]}
          value={medHavgrense ? 'hav' : 'kyst'}
          onChange={(value) => onMedHavgrenseChange(value === 'hav')}
        />
        <p className="text-xs text-muted">
          {medHavgrense
            ? 'Grensene går ut til territorialgrensen i havet, slik de er vedtatt.'
            : 'Grensene er klippet etter kystlinjen.'}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between">
          <label htmlFor={sliderId} className="text-[13px] text-ink-2">
            Detaljnivå
          </label>
          <output htmlFor={sliderId} className="font-mono text-xs text-ink">
            {detailPercent} %
          </output>
        </div>
        <input
          id={sliderId}
          type="range"
          min={5}
          max={100}
          value={detailPercent}
          onChange={(e) => onDetailChange(Number(e.target.value))}
          aria-valuetext={`${detailPercent} prosent`}
          className="h-6 w-full cursor-pointer"
        />
        <div className="flex justify-between text-xs text-muted">
          <span>Enkel · liten fil</span>
          <span>Full presisjon</span>
        </div>
      </div>
    </section>
  )
}
