import { useMemo, useState } from 'react'
import type { FeatureCollection } from 'geojson'
import { grunnkretsFeatures, underomraderByKommune } from '../lib/grunnkretser'
import type { FeatureArgs, Underomrade } from '../lib/grunnkretser'
import { kartOmrader } from '../lib/kartlag'
import type {
  AreaGeometry,
  DelomradeProperties,
  GruppeKind,
  GrunnkretsNivå,
  GrunnkretsProperties,
  KommuneProperties,
  LevekarssoneProperties,
} from '../lib/types'
import { useGrunnkretser } from './useGrunnkretser'

const NONE_LEFT_OUT = new Set<string>()

interface GrunnkretsUtvalgArgs {
  kommuner: KommuneProperties[]
  kommuneByNummer: Map<string, KommuneProperties>
  selectedKommuner: Set<string>
  gruppeKind: GruppeKind
  medHavgrense: boolean
  minWeight: number
}

/**
 * The optional level below kommuner: whether it is switched on, which level
 * (grunnkretser, delområder or levekårssoner), what is left out, and the
 * resulting areas for the download and the map.
 */
export function useGrunnkretsUtvalg({
  kommuner,
  kommuneByNummer,
  selectedKommuner,
  gruppeKind,
  medHavgrense,
  minWeight,
}: GrunnkretsUtvalgArgs) {
  const [enabled, setEnabled] = useState(false)
  const [utelatteDelomrader, setUtelatteDelomrader] = useState<Set<string>>(new Set())
  const [utelatteLevekarssoner, setUtelatteLevekarssoner] = useState<Set<string>>(new Set())
  const [nivå, setNivå] = useState<GrunnkretsNivå>('grunnkretser')

  // Fetched per fylke, only once asked for.
  const valgteKommuner = useMemo(
    () => kommuner.filter((k) => selectedKommuner.has(k.kommunenummer)),
    [kommuner, selectedKommuner],
  )
  /** Switched on, and there are kommuner to show it for. */
  const active = enabled && valgteKommuner.length > 0
  const fylker = useMemo(() => [...new Set(valgteKommuner.map((k) => k.fylkesnummer))], [valgteKommuner])
  const state = useGrunnkretser(fylker, active)

  // What can be left out: levekårssoner at that level, delområder at the
  // other two (each keeps its own choices when switching level).
  const underomradeNivå = nivå === 'levekarssoner' ? 'levekarssoner' : 'delomrader'
  const underomrader = useMemo(() => {
    const merged = new Map<string, Underomrade[]>()
    for (const t of state.topologies.values()) {
      for (const [k, list] of underomraderByKommune(t, underomradeNivå)) merged.set(k, list)
    }
    return merged
  }, [state.topologies, underomradeNivå])
  const utelatte = underomradeNivå === 'levekarssoner' ? utelatteLevekarssoner : utelatteDelomrader

  // Grunnkretser, delområder or levekårssoner, whichever level is chosen.
  const selected = useMemo<
    | { nivå: 'grunnkretser'; features: FeatureCollection<AreaGeometry, GrunnkretsProperties> }
    | { nivå: 'delomrader'; features: FeatureCollection<AreaGeometry, DelomradeProperties> }
    | { nivå: 'levekarssoner'; features: FeatureCollection<AreaGeometry, LevekarssoneProperties> }
  >(() => {
    const args: FeatureArgs = [
      [...state.topologies.values()],
      medHavgrense,
      minWeight,
      selectedKommuner,
      utelatte,
      kommuneByNummer,
      gruppeKind,
    ]
    if (!active) return { nivå: 'grunnkretser', features: { type: 'FeatureCollection', features: [] } }
    switch (nivå) {
      case 'levekarssoner':
        return { nivå: 'levekarssoner', features: grunnkretsFeatures('levekarssoner', ...args) }
      case 'delomrader':
        return { nivå: 'delomrader', features: grunnkretsFeatures('delomrader', ...args) }
      case 'grunnkretser':
        return { nivå: 'grunnkretser', features: grunnkretsFeatures('grunnkretser', ...args) }
    }
  }, [active, nivå, state.topologies, medHavgrense, minWeight, selectedKommuner, utelatte, kommuneByNummer, gruppeKind])
  const someLeftOut = valgteKommuner.some((k) =>
    (underomrader.get(k.kommunenummer) ?? []).some((o) => utelatte.has(o.nummer)),
  )

  // Grunnkretser, delområder or levekårssoner for the map include the left-out
  // ones, so they can be clicked back in. They are built apart from the
  // selection, so leaving something out keeps the geometries and the map can
  // restyle its layers instead of building them again.
  const alle = useMemo(() => {
    if (!active) return null
    const args: FeatureArgs = [
      [...state.topologies.values()],
      medHavgrense,
      minWeight,
      selectedKommuner,
      NONE_LEFT_OUT,
      kommuneByNummer,
      gruppeKind,
    ]
    switch (nivå) {
      case 'levekarssoner':
        return { nivå, features: grunnkretsFeatures(nivå, ...args) }
      case 'delomrader':
        return { nivå, features: grunnkretsFeatures(nivå, ...args) }
      case 'grunnkretser':
        return { nivå, features: grunnkretsFeatures(nivå, ...args) }
    }
  }, [active, nivå, state.topologies, medHavgrense, minWeight, selectedKommuner, kommuneByNummer, gruppeKind])
  const kart = useMemo(() => {
    switch (alle?.nivå) {
      case undefined:
        return null
      case 'levekarssoner':
        return kartOmrader(alle.features, (p) => ({
          navn: p.levekarssonenavn,
          nummer: p.levekarssonenummer,
          kontekst: p.kommunenavn,
          selected: !utelatteLevekarssoner.has(p.levekarssonenummer),
          handling: { type: 'levekarssone', id: p.levekarssonenummer },
        }))
      case 'delomrader':
        return kartOmrader(alle.features, (p) => ({
          navn: p.delomradenavn,
          nummer: p.delomradenummer,
          kontekst: p.kommunenavn,
          selected: !utelatteDelomrader.has(p.delomradenummer),
          handling: { type: 'delomrade', id: p.delomradenummer },
        }))
      case 'grunnkretser':
        return kartOmrader(alle.features, (p) => ({
          navn: p.grunnkretsnavn,
          nummer: p.grunnkretsnummer,
          kontekst: `${p.kommunenavn} · ${p.delomradenavn}`,
          selected: !utelatteDelomrader.has(p.delomradenummer),
          handling: { type: 'delomrade', id: p.delomradenummer },
        }))
    }
  }, [alle, utelatteDelomrader, utelatteLevekarssoner])

  function changeUtelatte(numre: string[], include: boolean) {
    const setUtelatte = underomradeNivå === 'levekarssoner' ? setUtelatteLevekarssoner : setUtelatteDelomrader
    setUtelatte((prev) => {
      const next = new Set(prev)
      for (const nr of numre) {
        if (include) next.delete(nr)
        else next.add(nr)
      }
      return next
    })
  }

  return {
    enabled,
    setEnabled,
    nivå,
    setNivå,
    valgteKommuner,
    active,
    state,
    underomrader,
    utelatte,
    changeUtelatte,
    someLeftOut,
    /** What is downloaded. */
    selected,
    /** What the map draws, including what is left out; null when not in use. */
    kart,
  }
}

export type GrunnkretsUtvalg = ReturnType<typeof useGrunnkretsUtvalg>
