import { useId, useState } from 'react'
import type { BydelProperties, KommuneGruppe, KommuneProperties } from '../lib/types'
import type { SelectionApi } from '../hooks/useSelection'
import { SectionHeader } from './ui'

interface KommuneSelectorProps {
  /** Fylker or districts, in display order; only the selected ones are shown. */
  groups: KommuneGruppe[]
  /** Plural noun for the groups and the article of its singular, e.g. "fylker"/"ett". */
  gruppeFlertall: string
  gruppeArtikkel: 'ett' | 'én'
  kommunerByGroup: Map<string, KommuneProperties[]>
  bydelsByKommune: Map<string, BydelProperties[]>
  selection: SelectionApi
  number?: string
  /** Mobile: let the sheet scroll instead of capping the list's height. */
  uncapped?: boolean
}

/**
 * Section 03: kommuner in the selected groups — a «Hele {gruppe}» row per
 * group, then one row per kommune with its number. Searchable by name or number.
 */
export function KommuneSelector({
  groups,
  gruppeFlertall,
  gruppeArtikkel,
  kommunerByGroup,
  bydelsByKommune,
  selection,
  number,
  uncapped = false,
}: KommuneSelectorProps) {
  const searchId = useId()
  const [query, setQuery] = useState('')
  const selectedGroups = groups.filter((g) => selection.selectedGroups.has(g.id))
  const all = selectedGroups.flatMap((g) => kommunerByGroup.get(g.id) ?? [])
  const valgt = all.filter((k) => selection.selectedKommuner.has(k.kommunenummer)).length

  const q = query.trim().toLowerCase()
  const matches = (k: KommuneProperties) =>
    !q || k.kommunenavn.toLowerCase().includes(q) || k.kommunenummer.startsWith(q)

  const title =
    selectedGroups.length === 1 ? `Kommuner i ${selectedGroups[0].navn}` : 'Kommuner'

  return (
    <section className="flex flex-col gap-2.5">
      <SectionHeader
        number={number}
        title={title}
        aside={
          all.length > 0 && (
            <span className="font-mono text-xs text-muted" aria-label={`${valgt} av ${all.length} kommuner valgt`}>
              {valgt} / {all.length}
            </span>
          )
        }
      />

      {selectedGroups.length === 0 ? (
        <p className="text-muted">
          Velg {gruppeArtikkel} eller flere {gruppeFlertall} for å se kommunene her.
        </p>
      ) : (
        <>
          <div className="flex h-10 items-center gap-2 rounded-field border border-input bg-surface px-3 focus-within:outline-2 focus-within:outline-accent">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-muted" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-4-4" />
            </svg>
            <label htmlFor={searchId} className="sr-only">
              Søk kommuner
            </label>
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Søk kommune eller nummer"
              className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-muted"
            />
          </div>

          {selectedGroups.length > 1 && (
            <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-field border border-line bg-surface-2 px-3 py-2 font-semibold text-ink hover:bg-row-selected">
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0 cursor-pointer"
                checked={valgt === all.length}
                ref={(el) => {
                  if (el) el.indeterminate = valgt > 0 && valgt < all.length
                }}
                onChange={() => selection.toggleAllInGroups(selectedGroups.map((g) => g.id))}
              />
              <span className="flex-1">
                Alle kommuner i {selectedGroups.length} valgte {gruppeFlertall}
              </span>
              <span className="font-mono text-xs font-normal text-muted">{all.length}</span>
            </label>
          )}

          <div className={`overflow-auto rounded-field border border-line ${uncapped ? '' : 'max-h-[260px]'}`}>
            {selectedGroups.map((group) => {
              const kommuner = kommunerByGroup.get(group.id) ?? []
              const shown = kommuner.filter(matches).sort((a, b) => a.kommunenavn.localeCompare(b.kommunenavn, 'nb'))
              const allSelected = kommuner.every((k) => selection.selectedKommuner.has(k.kommunenummer))
              const someSelected = kommuner.some((k) => selection.selectedKommuner.has(k.kommunenummer))
              return (
                <div key={group.id} role="group" aria-label={group.navn}>
                  <label className="sticky top-0 z-10 flex min-h-11 cursor-pointer items-center gap-2.5 border-b border-seg bg-surface px-3 py-2 font-medium text-ink">
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0 cursor-pointer"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected && !allSelected
                      }}
                      onChange={() => selection.toggleAllInGroup(group.id)}
                    />
                    <span className="flex-1">Hele {group.navn}</span>
                    <span className="font-mono text-xs font-normal text-muted">{kommuner.length}</span>
                  </label>
                  {shown.length === 0 ? (
                    <p className="px-3 py-2 text-muted">Ingen kommuner matcher «{query}».</p>
                  ) : (
                    shown.map((kommune) => {
                      const checked = selection.selectedKommuner.has(kommune.kommunenummer)
                      return (
                        <label
                          key={kommune.kommunenummer}
                          className={`flex min-h-11 cursor-pointer items-center gap-2.5 px-3 py-1.5 hover:bg-row-selected ${
                            uncapped ? 'border-b border-seg last:border-b-0' : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 shrink-0 cursor-pointer"
                            checked={checked}
                            onChange={() => selection.toggleKommune(kommune.kommunenummer)}
                          />
                          <span className="flex min-w-0 flex-1 items-center gap-1.5">
                            <span className="truncate">{kommune.kommunenavn}</span>
                            {bydelsByKommune.has(kommune.kommunenummer) && (
                              <span
                                title="Har bydeler"
                                aria-label="har bydeler"
                                className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                              />
                            )}
                          </span>
                          <span className="font-mono text-xs text-muted">{kommune.kommunenummer}</span>
                        </label>
                      )
                    })
                  )}
                </div>
              )
            })}
          </div>
          {valgt === 0 && (
            <p className="text-xs text-muted">
              Ingen kommuner valgt – da lastes {gruppeFlertall} ned som hele områder.
            </p>
          )}
        </>
      )}
    </section>
  )
}
