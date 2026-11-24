import { useMemo, useState } from 'react'
import * as topojsonClient from 'topojson-client'
import type { FeatureCollection } from 'geojson'
import type { DownloadState } from '../components/Nedlasting'
import { DISTRIKT_KINDS, toDistrikt } from '../lib/distrikter'
import type { DistriktProperties } from '../lib/distrikter'
import {
  buildCsv,
  buildExport,
  downloadBlob,
  exportGranularity,
  selectedBydelFeatureCollection,
  selectedDistriktFeatureCollection,
  selectedFeatureCollection,
} from '../lib/exportData'
import {
  bydelSelectionFilenameStem,
  distriktSelectionFilenameStem,
  fylkeSelectionFilenameStem,
  grunnkretsSelectionFilenameStem,
  selectionFilenameStem,
} from '../lib/filename'
import type {
  AreaGeometry,
  BydelProperties,
  DelomradeProperties,
  DistriktKind,
  ExportFormat,
  FylkeProperties,
  GrunnkretsProperties,
  GruppeKind,
  KommuneGruppe,
  KommuneProperties,
  LevekarssoneProperties,
} from '../lib/types'
import type { GrunnkretsUtvalg } from './useGrunnkretsUtvalg'
import type { SelectionApi } from './useSelection'
import type { NorwayTopology, NorwayTopologyType } from './useTopology'

/** Above this many features the download is only built when someone downloads it. */
const LAZY_EXPORT_FEATURES = 2000

interface ExportArgs extends Pick<NorwayTopology, 'topology' | 'kommuner' | 'bydelsByKommune' | 'distrikter'> {
  simplifiedTopology: NorwayTopologyType
  medHavgrense: boolean
  gruppeKind: GruppeKind
  groups: KommuneGruppe[]
  kommunerByGroup: Map<string, KommuneProperties[]>
  selection: SelectionApi
  grunnkretser: GrunnkretsUtvalg
}

/** What gets downloaded: the features, the file and its name, and the attribute table. */
export function useExport({
  topology,
  simplifiedTopology,
  kommuner,
  bydelsByKommune,
  distrikter,
  medHavgrense,
  gruppeKind,
  groups,
  kommunerByGroup,
  selection: { selectedGroups, selectedKommuner, selectedBydeler },
  grunnkretser,
}: ExportArgs) {
  const [format, setFormat] = useState<ExportFormat>('geojson')

  const kommuneObject = medHavgrense ? 'kommuner' : 'kommunerUtenHavgrense'
  const fylkeObject = medHavgrense ? 'fylker' : 'fylkerUtenHavgrense'

  const selectedFeatures = useMemo(
    () => selectedFeatureCollection(simplifiedTopology, kommuneObject, selectedKommuner),
    [simplifiedTopology, kommuneObject, selectedKommuner],
  )

  // The selected groups as areas: fylker, or the chosen district kind.
  const contextAreas = useMemo<
    | { kind: 'fylker'; features: FeatureCollection<AreaGeometry, FylkeProperties> }
    | { kind: DistriktKind; features: FeatureCollection<AreaGeometry, DistriktProperties> }
  >(() => {
    if (gruppeKind !== 'fylker') {
      return {
        kind: gruppeKind,
        features: selectedDistriktFeatureCollection(simplifiedTopology, gruppeKind, medHavgrense, selectedGroups),
      }
    }
    const all = topojsonClient.feature(simplifiedTopology, simplifiedTopology.objects[fylkeObject]) as FeatureCollection<
      AreaGeometry,
      FylkeProperties
    >
    return {
      kind: 'fylker',
      features: {
        type: 'FeatureCollection',
        features: all.features.filter((f) => selectedGroups.has(f.properties.fylkesnummer)),
      },
    }
  }, [simplifiedTopology, gruppeKind, medHavgrense, fylkeObject, selectedGroups])

  const selectedBydelFeatures = useMemo(
    () => selectedBydelFeatureCollection(simplifiedTopology, selectedBydeler),
    [simplifiedTopology, selectedBydeler],
  )

  const granularity = exportGranularity({
    gruppeKind,
    grunnkretsNivå: grunnkretser.active ? grunnkretser.nivå : null,
    grupper: selectedGroups.size,
    kommuner: selectedKommuner.size,
    bydeler: selectedBydeler.size,
  })

  const { active: brukerGrunnkretser, selected: selectedGrunnkretser, valgteKommuner, someLeftOut } = grunnkretser
  const target = useMemo<
    | { granularity: 'fylker'; features: FeatureCollection<AreaGeometry, FylkeProperties> }
    | { granularity: 'kommuner'; features: FeatureCollection<AreaGeometry, KommuneProperties> }
    | { granularity: 'bydeler'; features: FeatureCollection<AreaGeometry, BydelProperties> }
    | { granularity: 'grunnkretser'; features: FeatureCollection<AreaGeometry, GrunnkretsProperties> }
    | { granularity: 'delomrader'; features: FeatureCollection<AreaGeometry, DelomradeProperties> }
    | { granularity: 'levekarssoner'; features: FeatureCollection<AreaGeometry, LevekarssoneProperties> }
    | { granularity: DistriktKind; features: FeatureCollection<AreaGeometry, DistriktProperties> }
  >(() => {
    if (brukerGrunnkretser) {
      const { nivå, features } = selectedGrunnkretser
      switch (nivå) {
        case 'levekarssoner':
          return { granularity: nivå, features }
        case 'delomrader':
          return { granularity: nivå, features }
        case 'grunnkretser':
          return { granularity: nivå, features }
      }
    }
    if (granularity === 'bydeler') return { granularity: 'bydeler', features: selectedBydelFeatures }
    if (granularity === 'kommuner') return { granularity: 'kommuner', features: selectedFeatures }
    return contextAreas.kind === 'fylker'
      ? { granularity: 'fylker', features: contextAreas.features }
      : { granularity: contextAreas.kind, features: contextAreas.features }
  }, [brukerGrunnkretser, granularity, contextAreas, selectedGrunnkretser, selectedBydelFeatures, selectedFeatures])

  // The download is normally built up front so its exact size can be shown,
  // but for thousands of grunnkretser that would make every click sluggish —
  // then it is only built when someone actually downloads.
  const featureCount = target.features.features.length
  const buildOnDownload = featureCount > LAZY_EXPORT_FEATURES
  const exportResult = useMemo(
    () => (featureCount > 0 && !buildOnDownload ? buildExport(target.features, target.granularity, format) : null),
    [target, format, featureCount, buildOnDownload],
  )

  const filenameStem = useMemo(() => {
    if (target.features.features.length === 0) return null
    switch (target.granularity) {
      case 'fylker':
        return fylkeSelectionFilenameStem(target.features.features.map((f) => f.properties))
      case 'grunnkretser':
      case 'delomrader':
      case 'levekarssoner':
        return grunnkretsSelectionFilenameStem(
          target.granularity,
          valgteKommuner,
          gruppeKind,
          groups,
          kommunerByGroup,
          someLeftOut,
        )
      case 'bydeler':
        return bydelSelectionFilenameStem(
          target.features.features.map((f) => f.properties),
          bydelsByKommune,
          kommuner,
        )
      case 'kommuner':
        return selectionFilenameStem(
          target.features.features.map((f) => f.properties),
          gruppeKind,
          groups,
          kommunerByGroup,
        )
      default:
        return distriktSelectionFilenameStem(
          target.granularity,
          target.features.features.map((f) => toDistrikt(f.properties)),
          distrikter[target.granularity],
        )
    }
  }, [target, kommuner, bydelsByKommune, gruppeKind, groups, kommunerByGroup, distrikter, valgteKommuner, someLeftOut])

  function handleDownload(filename: string) {
    const result = exportResult ?? (featureCount > 0 ? buildExport(target.features, target.granularity, format) : null)
    if (!result) return
    downloadBlob(result.blob, filename)
  }

  // The attribute table of the export, and one feature's properties at the
  // same level so the columns can be explored before anything is selected.
  const dataRows = useMemo(() => target.features.features.map((f) => f.properties as Record<string, string>), [target])
  const dataExample = (() => {
    if (granularity === 'grunnkretser' || granularity === 'delomrader' || granularity === 'levekarssoner') {
      return dataRows[0]
    }
    const objectName =
      granularity === 'fylker' || granularity === 'kommuner' || granularity === 'bydeler'
        ? granularity
        : DISTRIKT_KINDS[granularity].objects.med
    return topology.objects[objectName].geometries[0]?.properties as Record<string, string> | undefined
  })()

  function handleDownloadCsv(columns: string[]) {
    downloadBlob(buildCsv(columns, dataRows), `${filenameStem ?? granularity}.csv`)
  }

  // --- Filename: what the user typed, reset whenever the suggestion changes ---
  const [stemState, setStemState] = useState<{ forDefault: string | null; value: string }>({ forDefault: null, value: '' })
  const stem = stemState.forDefault === filenameStem ? stemState.value : ''

  const download: DownloadState = {
    format,
    onFormatChange: setFormat,
    stem,
    onStemChange: (value) => setStemState({ forDefault: filenameStem, value }),
    defaultStem: filenameStem,
    granularity,
    featureCount,
    bytes: exportResult ? exportResult.blob.size : buildOnDownload ? 'senere' : null,
    onDownload: handleDownload,
  }

  return {
    granularity,
    featureCount,
    /** The features of the download. */
    features: target.features as FeatureCollection<AreaGeometry>,
    /** The selected groups as areas, whether or not they are what gets downloaded. */
    gruppeFeatures: contextAreas.features as FeatureCollection<AreaGeometry>,
    download,
    dataRows,
    dataExample,
    downloadCsv: handleDownloadCsv,
  }
}
