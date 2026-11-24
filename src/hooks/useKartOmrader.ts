import { useMemo } from 'react'
import * as topojsonClient from 'topojson-client'
import type { FeatureCollection } from 'geojson'
import { DISTRIKT_KINDS, toDistrikt } from '../lib/distrikter'
import type { DistriktProperties } from '../lib/distrikter'
import { capitalize } from '../lib/format'
import { kartOmrader } from '../lib/kartlag'
import type { KartFeature, KartHandling } from '../lib/kartlag'
import type {
  AreaGeometry,
  BydelProperties,
  ExportGranularity,
  FylkeProperties,
  GruppeKind,
  KommuneProperties,
} from '../lib/types'
import type { GrunnkretsUtvalg } from './useGrunnkretsUtvalg'
import { useLatest } from './useLatest'
import type { SelectionApi } from './useSelection'
import type { NorwayTopologyType } from './useTopology'

interface KartOmraderArgs {
  simplifiedTopology: NorwayTopologyType
  medHavgrense: boolean
  gruppeKind: GruppeKind
  kommunerByGroup: Map<string, KommuneProperties[]>
  bydelsByKommune: Map<string, BydelProperties[]>
  kommuneByNummer: Map<string, KommuneProperties>
  selection: SelectionApi
  grunnkretser: GrunnkretsUtvalg
  /** The level that gets downloaded, which decides what is drawn. */
  granularity: ExportGranularity
}

/** Every area that can be clicked in the map, with its selection state, and what a click does. */
export function useKartOmrader({
  simplifiedTopology,
  medHavgrense,
  gruppeKind,
  kommunerByGroup,
  bydelsByKommune,
  kommuneByNummer,
  selection,
  grunnkretser,
  granularity,
}: KartOmraderArgs) {
  const { selectedGroups, selectedKommuner, selectedBydeler } = selection
  const { kart: kartGrunnkretser, utelatte, changeUtelatte } = grunnkretser
  const groupTarget = granularity === gruppeKind
  const gruppeEntall = gruppeKind === 'fylker' ? 'Fylke' : capitalize(DISTRIKT_KINDS[gruppeKind].entall)
  const kommuneObject = medHavgrense ? 'kommuner' : 'kommunerUtenHavgrense'
  const fylkeObject = medHavgrense ? 'fylker' : 'fylkerUtenHavgrense'

  const alleGrupper = useMemo(() => {
    if (gruppeKind === 'fylker') {
      return topojsonClient.feature(simplifiedTopology, simplifiedTopology.objects[fylkeObject]) as FeatureCollection<
        AreaGeometry,
        FylkeProperties | DistriktProperties
      >
    }
    const { objects } = DISTRIKT_KINDS[gruppeKind]
    return topojsonClient.feature(
      simplifiedTopology,
      simplifiedTopology.objects[medHavgrense ? objects.med : objects.uten],
    ) as FeatureCollection<AreaGeometry, FylkeProperties | DistriktProperties>
  }, [simplifiedTopology, gruppeKind, fylkeObject, medHavgrense])

  const alleKommuner = useMemo(
    () =>
      topojsonClient.feature(simplifiedTopology, simplifiedTopology.objects[kommuneObject]) as FeatureCollection<
        AreaGeometry,
        KommuneProperties
      >,
    [simplifiedTopology, kommuneObject],
  )

  const alleBydeler = useMemo(
    () =>
      topojsonClient.feature(simplifiedTopology, simplifiedTopology.objects.bydeler) as FeatureCollection<
        AreaGeometry,
        BydelProperties
      >,
    [simplifiedTopology],
  )

  const omrader = useMemo<FeatureCollection<AreaGeometry, KartFeature['properties']>>(() => {
    const features: KartFeature[] = []
    const kommunerIValgteGrupper = new Set(
      [...selectedGroups].flatMap((id) => (kommunerByGroup.get(id) ?? []).map((k) => k.kommunenummer)),
    )
    const kommunerMedGrunnkretser = new Set(
      kartGrunnkretser?.map((f) => f.properties.handling.id.slice(0, 4)) ?? [],
    )

    // Groups: unselected ones are always clickable; selected ones are drawn
    // themselves only while they are what gets downloaded.
    features.push(
      ...kartOmrader(alleGrupper, (p) => {
        const { id, navn } = 'fylkesnummer' in p ? { id: p.fylkesnummer as string, navn: p.fylkesnavn as string } : toDistrikt(p)
        const antall = kommunerByGroup.get(id)?.length ?? 0
        return {
          navn,
          nummer: id,
          kontekst: `${gruppeEntall} · ${antall} kommuner`,
          selected: selectedGroups.has(id),
          handling: { type: 'gruppe', id },
        }
      }).filter((f) => groupTarget || !f.properties.selected),
    )

    if (!groupTarget) {
      features.push(
        ...kartOmrader(
          {
            type: 'FeatureCollection',
            features: alleKommuner.features.filter((f) => {
              const nr = f.properties.kommunenummer
              if (!kommunerIValgteGrupper.has(nr)) return false
              const valgt = selectedKommuner.has(nr)
              if (valgt && kartGrunnkretser && kommunerMedGrunnkretser.has(nr)) return false
              if (valgt && granularity === 'bydeler' && bydelsByKommune.has(nr)) return false
              return true
            }),
          },
          (p) => ({
            navn: p.kommunenavn,
            nummer: p.kommunenummer,
            kontekst: p.fylkesnavn,
            selected: selectedKommuner.has(p.kommunenummer),
            handling: { type: 'kommune', id: p.kommunenummer },
          }),
        ),
      )
      if (granularity === 'bydeler') {
        features.push(
          ...kartOmrader(
            {
              type: 'FeatureCollection',
              features: alleBydeler.features.filter((f) => selectedKommuner.has(f.properties.kommunenummer)),
            },
            (p) => ({
              navn: p.bydelnavn,
              nummer: p.bydelnummer,
              kontekst: kommuneByNummer.get(p.kommunenummer)?.kommunenavn ?? '',
              selected: selectedBydeler.has(p.bydelnummer),
              handling: { type: 'bydel', id: p.bydelnummer },
            }),
          ),
        )
      }
      if (kartGrunnkretser) features.push(...kartGrunnkretser)
    }

    // Selected areas last, so their outlines are drawn on top.
    features.sort((a, b) => Number(a.properties.selected) - Number(b.properties.selected))
    return { type: 'FeatureCollection', features }
  }, [
    alleGrupper,
    alleKommuner,
    alleBydeler,
    kartGrunnkretser,
    selectedGroups,
    selectedKommuner,
    selectedBydeler,
    kommunerByGroup,
    groupTarget,
    gruppeEntall,
    granularity,
    bydelsByKommune,
    kommuneByNummer,
  ])

  const onHandling = useLatest((handling: KartHandling) => {
    switch (handling.type) {
      case 'gruppe':
        return selection.toggleGroup(handling.id)
      case 'kommune':
        return selection.toggleKommune(handling.id)
      case 'bydel':
        return selection.toggleBydel(handling.id)
      case 'delomrade':
      case 'levekarssone':
        return changeUtelatte([handling.id], utelatte.has(handling.id))
    }
  })

  return { omrader, onHandling }
}
