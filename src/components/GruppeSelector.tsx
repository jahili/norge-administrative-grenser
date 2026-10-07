import type { KommuneGruppe } from '../lib/types'
import type { SelectionApi } from '../hooks/useSelection'
import { Chip, SectionHeader, TextButton } from './ui'

/** A heading (e.g. a fylke) with the groups listed under it. */
export interface GruppeSeksjon {
  id: string
  navn: string
  groups: KommuneGruppe[]
}

interface GruppeSelectorProps {
  /** Heading, e.g. «Fylker» or «Politidistrikter». */
  tittel: string
  groups: KommuneGruppe[]
  selection: SelectionApi
  /** Shown under the heading, e.g. where the division comes from. */
  note?: string
  /** When given, each chip's tooltip says how many kommuner the group has. */
  kommuneCount?: Map<string, number>
  /** When given, groups are listed under these headings instead of in one list. */
  sections?: GruppeSeksjon[]
  /** Mobile: every chip in one horizontally scrolling row. */
  scrollRow?: boolean
  number?: string
}

/** Section 02: pick the groups (fylker or districts) whose kommuner to work with. */
export function GruppeSelector({
  tittel,
  groups,
  selection,
  note,
  kommuneCount,
  sections,
  scrollRow = false,
  number,
}: GruppeSelectorProps) {
  const chip = (group: KommuneGruppe) => {
    const count = kommuneCount?.get(group.id)
    return (
      <Chip
        key={group.id}
        selected={selection.selectedGroups.has(group.id)}
        onClick={() => selection.toggleGroup(group.id)}
        title={count === undefined ? undefined : `${count} kommuner`}
        large={scrollRow}
      >
        {group.navn}
      </Chip>
    )
  }

  return (
    <section className="flex flex-col gap-2.5">
      <SectionHeader
        number={number}
        title={tittel}
        aside={
          <TextButton onClick={selection.toggleAllGroups}>
            {selection.allGroupsSelected ? 'Fjern alle' : 'Velg alle'}
          </TextButton>
        }
      />
      {note && <p className="-mt-1 text-xs text-muted">{note}</p>}

      {scrollRow ? (
        <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5">{groups.map(chip)}</div>
      ) : sections ? (
        <div className="flex flex-col gap-3">
          {sections.map((section) => {
            const ids = section.groups.map((g) => g.id)
            const all = ids.every((id) => selection.selectedGroups.has(id))
            return (
              <div key={section.id} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-medium tracking-wide text-muted uppercase">{section.navn}</span>
                  <button
                    type="button"
                    onClick={() => selection.toggleGroups(ids)}
                    className="cursor-pointer text-xs font-medium text-accent hover:text-accent-hover"
                  >
                    {all ? 'Fjern alle' : `Alle i ${section.navn}`}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">{section.groups.map(chip)}</div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">{groups.map(chip)}</div>
      )}
    </section>
  )
}
