import { useId } from 'react'
import { DISTRIKT_KIND_LIST, DISTRIKT_KINDS } from '../lib/distrikter'
import type { DistriktKind } from '../lib/types'
import { SectionHeader } from './ui'

/** 'administrativ' groups kommuner by fylke; the rest group them by a district kind. */
export type Inndeling = 'administrativ' | DistriktKind

interface InndelingToggleProps {
  inndeling: Inndeling
  onChange: (inndeling: Inndeling) => void
  /** Section number; omitted on mobile, where the select sits in a tab. */
  number?: string
}

/** Section 01: what the kommuner are grouped by. */
export function InndelingToggle({ inndeling, onChange, number }: InndelingToggleProps) {
  const selectId = useId()

  return (
    <section className="flex flex-col gap-2">
      {number ? (
        <SectionHeader number={number} title="Inndeling" titleFor={selectId} />
      ) : (
        <label htmlFor={selectId} className="sr-only">
          Inndeling
        </label>
      )}
      <select
        id={selectId}
        value={inndeling}
        onChange={(e) => onChange(e.target.value as Inndeling)}
        className="h-11 w-full cursor-pointer rounded-field border border-input bg-surface px-3 text-ink"
      >
        <option value="administrativ">Fylker (med kommuner og bydeler)</option>
        <optgroup label="Andre regioninndelinger">
          {DISTRIKT_KIND_LIST.filter((kind) => !DISTRIKT_KINDS[kind].ikkeSammenhengende).map((kind) => (
            <option key={kind} value={kind}>
              {DISTRIKT_KINDS[kind].tittel}
            </option>
          ))}
        </optgroup>
        <optgroup label="Kommunegrupperinger">
          {DISTRIKT_KIND_LIST.filter((kind) => DISTRIKT_KINDS[kind].ikkeSammenhengende).map((kind) => (
            <option key={kind} value={kind}>
              {DISTRIKT_KINDS[kind].tittel}
            </option>
          ))}
        </optgroup>
      </select>
    </section>
  )
}
