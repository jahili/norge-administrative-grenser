import { useMemo, useState } from 'react'
import * as topojsonClient from 'topojson-client'
import { useTopology } from './hooks/useTopology'
import type { NorwayTopologyType } from './hooks/useTopology'
import { useSelection } from './hooks/useSelection'
import { useSimplifiedTopology } from './hooks/useSimplifiedTopology'
import { useGrunnkretser } from './hooks/useGrunnkretser'
import { useLatest } from './hooks/useLatest'
import { useMediaQuery } from './hooks/useMediaQuery'
import { useTheme } from './hooks/useTheme'
import type { Theme } from './hooks/useTheme'
import { GruppeSelector } from './components/GruppeSelector'
import type { GruppeSeksjon } from './components/GruppeSelector'
import { KommuneSelector } from './components/KommuneSelector'
import { BydelSelector } from './components/BydelSelector'
import { GrunnkretsSelector } from './components/GrunnkretsSelector'
import { InndelingToggle } from './components/InndelingToggle'
import type { Inndeling } from './components/InndelingToggle'
import { GeometriSection } from './components/GeometriSection'
import { MapView } from './components/MapView'
import { DataButton, DataDrawer } from './components/DataDrawer'
import { DataTabell } from './components/DataTabell'
import { MobileLayout } from './components/MobileLayout'
import type { MobileTab } from './components/MobileLayout'
import { MobileMenu } from './components/MobileMenu'
import { SelectionCard } from './components/SelectionCard'
import { DownloadBar, DownloadButton, DownloadOptions } from './components/Nedlasting'
import { capitalize, dataColumns, levelWords } from './lib/format'
import type { DownloadState } from './components/Nedlasting'
import { Header, OmDataene } from './components/Header'
import { Logo, Spinner } from './components/ui'
import {
  selectedFeatureCollection,
  selectedBydelFeatureCollection,
  selectedDistriktFeatureCollection,
  buildExport,
  buildCsv,
  downloadBlob,
} from './lib/exportData'
import {
  selectionFilenameStem,
  fylkeSelectionFilenameStem,
  bydelSelectionFilenameStem,
  distriktSelectionFilenameStem,
  grunnkretsSelectionFilenameStem,
} from './lib/filename'
import { grunnkretsFeatures, underomraderByKommune } from './lib/grunnkretser'
import type { FeatureArgs, Underomrade } from './lib/grunnkretser'
import { DISTRIKT_KINDS, toDistrikt } from './lib/distrikter'
import { fylkeRekkefolge } from './lib/grupper'
import type { DistriktProperties } from './lib/distrikter'
import { nokkelKolonne } from './lib/kolonner'
import { kartOmrader } from './lib/kartlag'
import type { KartFeature, KartHandling } from './lib/kartlag'
import type {
  ExportFormat,
  ExportGranularity,
  AreaGeometry,
  BydelProperties,
  DistriktKind,
  FylkeProperties,
  GruppeKind,
  DelomradeProperties,
  GrunnkretsNivå,
  GrunnkretsProperties,
  LevekarssoneProperties,
  KommuneGruppe,
  KommuneProperties,
} from './lib/types'
import type { FeatureCollection } from 'geojson'

/** Below this width the layout switches to map-on-top with a bottom sheet. */
const MOBILE_QUERY = '(max-width: 767px)'

function App() {
  const topologyState = useTopology()
  const { theme, toggleTheme } = useTheme()
  const mobile = useMediaQuery(MOBILE_QUERY)
  const [omOpen, setOmOpen] = useState(false)

  if (topologyState.status !== 'ready') {
    return (
      <div className="flex h-dvh flex-col bg-bg">
        {!mobile && (
          <Header theme={theme} onToggleTheme={toggleTheme} onOpenOm={() => setOmOpen(true)} onOpenKolonner={() => {}} />
        )}
        <div className="flex flex-1 items-center justify-center p-6">
          {topologyState.status === 'loading' ? (
            <p role="status" className="flex items-center gap-3 text-ink-2">
              <Spinner /> Laster inn kartdata (5,9 MB) …
            </p>
          ) : (
            <p role="alert" className="text-red-700 dark:text-red-400">
              Klarte ikke å laste kartdata: {topologyState.error.message}
            </p>
          )}
        </div>
        <OmDataene open={omOpen} onClose={() => setOmOpen(false)} />
      </div>
    )
  }

  return (
    <>
      <Workspace
        {...topologyState}
        theme={theme}
        onToggleTheme={toggleTheme}
        mobile={mobile}
        onOpenOm={() => setOmOpen(true)}
      />
      <OmDataene open={omOpen} onClose={() => setOmOpen(false)} />
    </>
  )
}

/** Above this many features the download is only built when someone downloads it. */
const LAZY_EXPORT_FEATURES = 2000

const NONE_LEFT_OUT = new Set<string>()

interface WorkspaceProps {
  topology: NorwayTopologyType
  fylker: FylkeProperties[]
  kommuner: KommuneProperties[]
  kommunerByFylke: Map<string, KommuneProperties[]>
  bydelsByKommune: Map<string, BydelProperties[]>
  distrikter: Record<DistriktKind, KommuneGruppe[]>
  kommunerByDistrikt: Record<DistriktKind, Map<string, KommuneProperties[]>>
  theme: Theme
  onToggleTheme: () => void
  mobile: boolean
  onOpenOm: () => void
}

function Workspace({
  topology,
  fylker,
  kommuner,
  kommunerByFylke,
  bydelsByKommune,
  distrikter,
  kommunerByDistrikt,
  theme,
  onToggleTheme,
  mobile,
  onOpenOm,
}: WorkspaceProps) {
  const [detailPercent, setDetailPercent] = useState(100)
  const [format, setFormat] = useState<ExportFormat>('geojson')
  const [medHavgrense, setMedHavgrense] = useState(false)
  const [inndeling, setInndeling] = useState<Inndeling>('administrativ')
  const [grunnkretsModus, setGrunnkretsModus] = useState(false)
  const [utelatteDelomrader, setUtelatteDelomrader] = useState<Set<string>>(new Set())
  const [utelatteLevekarssoner, setUtelatteLevekarssoner] = useState<Set<string>>(new Set())
  const [grunnkretsNivå, setGrunnkretsNivå] = useState<GrunnkretsNivå>('grunnkretser')

  // Kommuner are grouped by fylke or by one of the district kinds. Each
  // grouping keeps its own selection, so switching inndeling back and forth
  // doesn't lose anything.
  const fylkeGrupper = useMemo(
    () =>
      [...fylker]
        .sort((a, b) => fylkeRekkefolge(a.fylkesnummer) - fylkeRekkefolge(b.fylkesnummer))
        .map((f) => ({ id: f.fylkesnummer, navn: f.fylkesnavn })),
    [fylker],
  )
  const gruppeKind: GruppeKind = inndeling === 'administrativ' ? 'fylker' : inndeling
  const groups = gruppeKind === 'fylker' ? fylkeGrupper : distrikter[gruppeKind]
  const kommunerByGroup = gruppeKind === 'fylker' ? kommunerByFylke : kommunerByDistrikt[gruppeKind]
  const selection = useSelection(gruppeKind, groups, kommunerByGroup, bydelsByKommune)
  const gruppeFlertall = gruppeKind === 'fylker' ? 'fylker' : DISTRIKT_KINDS[gruppeKind].flertall
  const gruppeArtikkel = gruppeKind === 'fylker' ? 'ett' : DISTRIKT_KINDS[gruppeKind].artikkel

  // Divisions with many districts (e.g. 85 økonomiske regioner, 159
  // BA-regioner) are listed under a fylke: the one most of a district's
  // kommuner are in, so the few districts crossing a fylke border still land
  // somewhere sensible.
  const fylkeSeksjoner = useMemo<GruppeSeksjon[] | undefined>(() => {
    if (gruppeKind === 'fylker' || !DISTRIKT_KINDS[gruppeKind].listeEtterFylke) return undefined
    const byFylke = new Map<string, KommuneGruppe[]>()
    for (const group of groups) {
      const counts = new Map<string, number>()
      for (const k of kommunerByGroup.get(group.id) ?? []) counts.set(k.fylkesnummer, (counts.get(k.fylkesnummer) ?? 0) + 1)
      const [fylkesnummer] = [...counts].sort((a, b) => b[1] - a[1] || fylkeRekkefolge(a[0]) - fylkeRekkefolge(b[0]))[0] ?? []
      if (!fylkesnummer) continue
      byFylke.set(fylkesnummer, [...(byFylke.get(fylkesnummer) ?? []), group])
    }
    return fylkeGrupper
      .filter((fylke) => byFylke.has(fylke.id))
      .map((fylke) => ({ ...fylke, groups: byFylke.get(fylke.id) ?? [] }))
  }, [gruppeKind, groups, kommunerByGroup, fylkeGrupper])

  const { topology: simplifiedTopology, minWeight } = useSimplifiedTopology(topology, detailPercent)

  const kommuneObject = medHavgrense ? 'kommuner' : 'kommunerUtenHavgrense'
  const fylkeObject = medHavgrense ? 'fylker' : 'fylkerUtenHavgrense'

  const selectedFeatures = useMemo(
    () => selectedFeatureCollection(simplifiedTopology, kommuneObject, selection.selectedKommuner),
    [simplifiedTopology, kommuneObject, selection.selectedKommuner],
  )

  // The selected groups as areas: fylker, or the chosen district kind.
  const contextAreas = useMemo<
    | { kind: 'fylker'; features: FeatureCollection<AreaGeometry, FylkeProperties> }
    | { kind: DistriktKind; features: FeatureCollection<AreaGeometry, DistriktProperties> }
  >(() => {
    if (gruppeKind !== 'fylker') {
      return {
        kind: gruppeKind,
        features: selectedDistriktFeatureCollection(simplifiedTopology, gruppeKind, medHavgrense, selection.selectedGroups),
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
        features: all.features.filter((f) => selection.selectedGroups.has(f.properties.fylkesnummer)),
      },
    }
  }, [simplifiedTopology, gruppeKind, medHavgrense, fylkeObject, selection.selectedGroups])

  const selectedBydelFeatures = useMemo(
    () => selectedBydelFeatureCollection(simplifiedTopology, selection.selectedBydeler),
    [simplifiedTopology, selection.selectedBydeler],
  )

  // --- Grunnkretser: fetched per fylke, only once asked for ---
  const valgteKommuner = useMemo(
    () => kommuner.filter((k) => selection.selectedKommuner.has(k.kommunenummer)),
    [kommuner, selection.selectedKommuner],
  )
  const brukerGrunnkretser = grunnkretsModus && valgteKommuner.length > 0
  const grunnkretsFylker = useMemo(() => [...new Set(valgteKommuner.map((k) => k.fylkesnummer))], [valgteKommuner])
  const grunnkretsState = useGrunnkretser(grunnkretsFylker, brukerGrunnkretser)
  const kommuneByNummer = useMemo(() => new Map(kommuner.map((k) => [k.kommunenummer, k])), [kommuner])

  // What can be left out: levekårssoner at that level, delområder at the
  // other two (each keeps its own choices when switching level).
  const underomradeNivå = grunnkretsNivå === 'levekarssoner' ? 'levekarssoner' : 'delomrader'
  const underomrader = useMemo(() => {
    const merged = new Map<string, Underomrade[]>()
    for (const t of grunnkretsState.topologies.values()) {
      for (const [k, list] of underomraderByKommune(t, underomradeNivå)) merged.set(k, list)
    }
    return merged
  }, [grunnkretsState.topologies, underomradeNivå])
  const utelatte = underomradeNivå === 'levekarssoner' ? utelatteLevekarssoner : utelatteDelomrader

  // Grunnkretser, delområder or levekårssoner, whichever level is chosen.
  const selectedGrunnkretsFeatures = useMemo<
    | { nivå: 'grunnkretser'; features: FeatureCollection<AreaGeometry, GrunnkretsProperties> }
    | { nivå: 'delomrader'; features: FeatureCollection<AreaGeometry, DelomradeProperties> }
    | { nivå: 'levekarssoner'; features: FeatureCollection<AreaGeometry, LevekarssoneProperties> }
  >(() => {
    const args: FeatureArgs = [
      [...grunnkretsState.topologies.values()],
      medHavgrense,
      minWeight,
      selection.selectedKommuner,
      utelatte,
      kommuneByNummer,
      gruppeKind,
    ]
    if (!brukerGrunnkretser) return { nivå: 'grunnkretser', features: { type: 'FeatureCollection', features: [] } }
    switch (grunnkretsNivå) {
      case 'levekarssoner':
        return { nivå: 'levekarssoner', features: grunnkretsFeatures('levekarssoner', ...args) }
      case 'delomrader':
        return { nivå: 'delomrader', features: grunnkretsFeatures('delomrader', ...args) }
      case 'grunnkretser':
        return { nivå: 'grunnkretser', features: grunnkretsFeatures('grunnkretser', ...args) }
    }
  }, [
    brukerGrunnkretser,
    grunnkretsNivå,
    grunnkretsState.topologies,
    medHavgrense,
    minWeight,
    selection.selectedKommuner,
    utelatte,
    kommuneByNummer,
    gruppeKind,
  ])
  const someLeftOut = valgteKommuner.some((k) =>
    (underomrader.get(k.kommunenummer) ?? []).some((o) => utelatte.has(o.nummer)),
  )

  function handleUtelatteChange(numre: string[], include: boolean) {
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

  const kommunerMedBydeler = useMemo(
    () =>
      kommuner.filter(
        (k) => selection.selectedKommuner.has(k.kommunenummer) && bydelsByKommune.has(k.kommunenummer),
      ),
    [kommuner, selection.selectedKommuner, bydelsByKommune],
  )

  // Granularity follows the deepest selection level the user has made —
  // no separate radio button needed.
  const effectiveGranularity: ExportGranularity = (() => {
    if (brukerGrunnkretser) return grunnkretsNivå
    if (selection.selectedBydeler.size > 0) return 'bydeler'
    if (selection.selectedKommuner.size > 0) return 'kommuner'
    if (selection.selectedGroups.size > 0) return gruppeKind
    return gruppeKind === 'fylker' ? 'kommuner' : gruppeKind
  })()

  const exportTarget = useMemo<
    | { granularity: 'fylker'; features: FeatureCollection<AreaGeometry, FylkeProperties> }
    | { granularity: 'kommuner'; features: FeatureCollection<AreaGeometry, KommuneProperties> }
    | { granularity: 'bydeler'; features: FeatureCollection<AreaGeometry, BydelProperties> }
    | { granularity: 'grunnkretser'; features: FeatureCollection<AreaGeometry, GrunnkretsProperties> }
    | { granularity: 'delomrader'; features: FeatureCollection<AreaGeometry, DelomradeProperties> }
    | { granularity: 'levekarssoner'; features: FeatureCollection<AreaGeometry, LevekarssoneProperties> }
    | { granularity: DistriktKind; features: FeatureCollection<AreaGeometry, DistriktProperties> }
  >(() => {
    if (brukerGrunnkretser) {
      const { nivå, features } = selectedGrunnkretsFeatures
      switch (nivå) {
        case 'levekarssoner':
          return { granularity: nivå, features }
        case 'delomrader':
          return { granularity: nivå, features }
        case 'grunnkretser':
          return { granularity: nivå, features }
      }
    }
    if (effectiveGranularity === 'bydeler') return { granularity: 'bydeler', features: selectedBydelFeatures }
    if (effectiveGranularity === 'kommuner') return { granularity: 'kommuner', features: selectedFeatures }
    return contextAreas.kind === 'fylker'
      ? { granularity: 'fylker', features: contextAreas.features }
      : { granularity: contextAreas.kind, features: contextAreas.features }
  }, [brukerGrunnkretser, effectiveGranularity, contextAreas, selectedGrunnkretsFeatures, selectedBydelFeatures, selectedFeatures])

  // The download is normally built up front so its exact size can be shown,
  // but for thousands of grunnkretser that would make every click sluggish —
  // then it is only built when someone actually downloads.
  const featureCount = exportTarget.features.features.length
  const buildOnDownload = featureCount > LAZY_EXPORT_FEATURES
  const exportResult = useMemo(
    () =>
      featureCount > 0 && !buildOnDownload ? buildExport(exportTarget.features, exportTarget.granularity, format) : null,
    [exportTarget, format, featureCount, buildOnDownload],
  )

  const filenameStem = useMemo(() => {
    if (exportTarget.features.features.length === 0) return null
    switch (exportTarget.granularity) {
      case 'fylker':
        return fylkeSelectionFilenameStem(exportTarget.features.features.map((f) => f.properties))
      case 'grunnkretser':
      case 'delomrader':
      case 'levekarssoner':
        return grunnkretsSelectionFilenameStem(
          exportTarget.granularity,
          valgteKommuner,
          gruppeKind,
          groups,
          kommunerByGroup,
          someLeftOut,
        )
      case 'bydeler':
        return bydelSelectionFilenameStem(
          exportTarget.features.features.map((f) => f.properties),
          bydelsByKommune,
          kommuner,
        )
      case 'kommuner':
        return selectionFilenameStem(
          exportTarget.features.features.map((f) => f.properties),
          gruppeKind,
          groups,
          kommunerByGroup,
        )
      default:
        return distriktSelectionFilenameStem(
          exportTarget.granularity,
          exportTarget.features.features.map((f) => toDistrikt(f.properties)),
          distrikter[exportTarget.granularity],
        )
    }
  }, [exportTarget, kommuner, bydelsByKommune, gruppeKind, groups, kommunerByGroup, distrikter, valgteKommuner, someLeftOut])

  function handleDownload(filename: string) {
    const result = exportResult ?? (featureCount > 0 ? buildExport(exportTarget.features, exportTarget.granularity, format) : null)
    if (!result) return
    downloadBlob(result.blob, filename)
  }

  // The attribute table of the export, and one feature's properties at the
  // same level so the columns can be explored before anything is selected.
  const dataRows = useMemo(
    () => exportTarget.features.features.map((f) => f.properties as Record<string, string>),
    [exportTarget],
  )
  const dataExample = (() => {
    if (
      effectiveGranularity === 'grunnkretser' ||
      effectiveGranularity === 'delomrader' ||
      effectiveGranularity === 'levekarssoner'
    ) {
      return dataRows[0]
    }
    const objectName =
      effectiveGranularity === 'fylker' || effectiveGranularity === 'kommuner' || effectiveGranularity === 'bydeler'
        ? effectiveGranularity
        : DISTRIKT_KINDS[effectiveGranularity].objects.med
    return topology.objects[objectName].geometries[0]?.properties as Record<string, string> | undefined
  })()

  function handleDownloadCsv(columns: string[]) {
    downloadBlob(buildCsv(columns, dataRows), `${filenameStem ?? effectiveGranularity}.csv`)
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
    granularity: effectiveGranularity,
    featureCount,
    bytes: exportResult ? exportResult.blob.size : buildOnDownload ? 'senere' : null,
    onDownload: handleDownload,
  }

  // --- The map: every area that can be clicked, with its selection state ---
  const groupTarget = effectiveGranularity === gruppeKind
  const gruppeEntall =
    gruppeKind === 'fylker' ? 'Fylke' : capitalize(DISTRIKT_KINDS[gruppeKind].entall)

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

  // Grunnkretser, delområder or levekårssoner for the map include the left-out
  // ones, so they can be clicked back in.
  const kartGrunnkretser = useMemo(() => {
    if (!brukerGrunnkretser) return null
    const args: FeatureArgs = [
      [...grunnkretsState.topologies.values()],
      medHavgrense,
      minWeight,
      selection.selectedKommuner,
      NONE_LEFT_OUT,
      kommuneByNummer,
      gruppeKind,
    ]
    if (grunnkretsNivå === 'levekarssoner') {
      return kartOmrader(grunnkretsFeatures('levekarssoner', ...args), (p) => ({
        navn: p.levekarssonenavn,
        nummer: p.levekarssonenummer,
        kontekst: p.kommunenavn,
        selected: !utelatteLevekarssoner.has(p.levekarssonenummer),
        handling: { type: 'levekarssone', id: p.levekarssonenummer },
      }))
    }
    return grunnkretsNivå === 'delomrader'
      ? kartOmrader(grunnkretsFeatures('delomrader', ...args), (p) => ({
          navn: p.delomradenavn,
          nummer: p.delomradenummer,
          kontekst: p.kommunenavn,
          selected: !utelatteDelomrader.has(p.delomradenummer),
          handling: { type: 'delomrade', id: p.delomradenummer },
        }))
      : kartOmrader(grunnkretsFeatures('grunnkretser', ...args), (p) => ({
          navn: p.grunnkretsnavn,
          nummer: p.grunnkretsnummer,
          kontekst: `${p.kommunenavn} · ${p.delomradenavn}`,
          selected: !utelatteDelomrader.has(p.delomradenummer),
          handling: { type: 'delomrade', id: p.delomradenummer },
        }))
  }, [
    brukerGrunnkretser,
    grunnkretsNivå,
    grunnkretsState.topologies,
    medHavgrense,
    minWeight,
    selection.selectedKommuner,
    utelatteDelomrader,
    utelatteLevekarssoner,
    kommuneByNummer,
    gruppeKind,
  ])

  const kartOmraderSamlet = useMemo<FeatureCollection<AreaGeometry, KartFeature['properties']>>(() => {
    const features: KartFeature[] = []
    const kommunerIValgteGrupper = new Set(
      [...selection.selectedGroups].flatMap((id) => (kommunerByGroup.get(id) ?? []).map((k) => k.kommunenummer)),
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
          nummer: gruppeKind === 'distrikter110' ? '' : id,
          kontekst: `${gruppeEntall} · ${antall} kommuner`,
          selected: selection.selectedGroups.has(id),
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
              const valgt = selection.selectedKommuner.has(nr)
              if (valgt && kartGrunnkretser && kommunerMedGrunnkretser.has(nr)) return false
              if (valgt && effectiveGranularity === 'bydeler' && bydelsByKommune.has(nr)) return false
              return true
            }),
          },
          (p) => ({
            navn: p.kommunenavn,
            nummer: p.kommunenummer,
            kontekst: p.fylkesnavn,
            selected: selection.selectedKommuner.has(p.kommunenummer),
            handling: { type: 'kommune', id: p.kommunenummer },
          }),
        ),
      )
      if (effectiveGranularity === 'bydeler') {
        features.push(
          ...kartOmrader(
            {
              type: 'FeatureCollection',
              features: alleBydeler.features.filter((f) => selection.selectedKommuner.has(f.properties.kommunenummer)),
            },
            (p) => ({
              navn: p.bydelnavn,
              nummer: p.bydelnummer,
              kontekst: kommuneByNummer.get(p.kommunenummer)?.kommunenavn ?? '',
              selected: selection.selectedBydeler.has(p.bydelnummer),
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
    selection.selectedGroups,
    selection.selectedKommuner,
    selection.selectedBydeler,
    kommunerByGroup,
    groupTarget,
    gruppeKind,
    gruppeEntall,
    effectiveGranularity,
    bydelsByKommune,
    kommuneByNummer,
  ])

  const handleKartHandling = useLatest((handling: KartHandling) => {
    switch (handling.type) {
      case 'gruppe':
        return selection.toggleGroup(handling.id)
      case 'kommune':
        return selection.toggleKommune(handling.id)
      case 'bydel':
        return selection.toggleBydel(handling.id)
      case 'delomrade':
      case 'levekarssone':
        return handleUtelatteChange([handling.id], utelatte.has(handling.id))
    }
  })

  const fitTarget: FeatureCollection<AreaGeometry> =
    featureCount > 0 && !groupTarget ? exportTarget.features : contextAreas.features
  const fitKey = [
    gruppeKind,
    effectiveGranularity,
    [...selection.selectedGroups].sort().join(','),
    selection.selectedKommuner.size,
    selection.selectedBydeler.size,
    utelatte.size,
    featureCount,
  ].join('|')

  // --- Text for the map card and the «Data i filen» button ---
  const columns = dataColumns(dataRows, dataExample)
  const nokkel = nokkelKolonne(effectiveGranularity)
  const valgteGruppeNavn = groups.filter((g) => selection.selectedGroups.has(g.id)).map((g) => g.navn)
  const kortTittel =
    valgteGruppeNavn.length === 0
      ? 'Ingen utvalg ennå'
      : valgteGruppeNavn.length <= 2
        ? valgteGruppeNavn.join(' og ')
        : `${valgteGruppeNavn.slice(0, 2).join(', ')} +${valgteGruppeNavn.length - 2}`
  const { entall, flertall } = levelWords(effectiveGranularity)
  const kortDetaljer =
    grunnkretsState.loading.length > 0
      ? 'Laster grunnkretser …'
      : featureCount === 0
        ? 'Klikk i kartet eller velg i listen'
        : `${featureCount} ${featureCount === 1 ? entall : flertall} · ${columns.length} kolonner`

  const [dataOpen, setDataOpen] = useState(false)
  const [mobileTab, setMobileTab] = useState<MobileTab>('utvalg')

  const sections = (mobileVariant: boolean) => ({
    inndeling: (
      <InndelingToggle inndeling={inndeling} onChange={setInndeling} number={mobileVariant ? undefined : '01'} />
    ),
    grupper: (
      <GruppeSelector
        key={gruppeKind}
        tittel={gruppeKind === 'fylker' ? 'Fylker' : DISTRIKT_KINDS[gruppeKind].tittel}
        groups={groups}
        selection={selection}
        sections={fylkeSeksjoner}
        scrollRow={mobileVariant}
        number={mobileVariant ? undefined : '02'}
        note={
          gruppeKind === 'fylker'
            ? undefined
            : `Kilde: ${DISTRIKT_KINDS[gruppeKind].kilde}. ${DISTRIKT_KINDS[gruppeKind].tittel} består av hele kommuner.`
        }
        kommuneCount={
          gruppeKind === 'fylker'
            ? undefined
            : new Map([...kommunerByDistrikt[gruppeKind]].map(([id, list]) => [id, list.length]))
        }
      />
    ),
    kommuner: (
      <div className="flex flex-col gap-3">
        <KommuneSelector
          key={`kommuner-${gruppeKind}`}
          groups={groups}
          gruppeFlertall={gruppeFlertall}
          gruppeArtikkel={gruppeArtikkel}
          kommunerByGroup={kommunerByGroup}
          bydelsByKommune={bydelsByKommune}
          selection={selection}
          number={mobileVariant ? undefined : '03'}
          uncapped={mobileVariant}
        />
        <GrunnkretsSelector
          kommuner={valgteKommuner}
          enabled={grunnkretsModus}
          onEnabledChange={setGrunnkretsModus}
          nivå={grunnkretsNivå}
          onNivåChange={setGrunnkretsNivå}
          state={grunnkretsState}
          underomraderByKommune={underomrader}
          utelatte={utelatte}
          onUtelatteChange={handleUtelatteChange}
        />
        {!brukerGrunnkretser && (
          <BydelSelector kommunerMedBydeler={kommunerMedBydeler} bydelsByKommune={bydelsByKommune} selection={selection} />
        )}
      </div>
    ),
    geometri: (
      <GeometriSection
        medHavgrense={medHavgrense}
        onMedHavgrenseChange={setMedHavgrense}
        detailPercent={detailPercent}
        onDetailChange={setDetailPercent}
        number={mobileVariant ? undefined : '04'}
      />
    ),
    data: <DataTabell granularity={effectiveGranularity} rows={dataRows} example={dataExample} onDownloadCsv={handleDownloadCsv} />,
  })

  const map = (mobileVariant: boolean) => (
    <MapView
      omrader={kartOmraderSamlet}
      onHandling={handleKartHandling}
      fitTarget={fitTarget}
      fitKey={fitKey}
      theme={theme}
      showZoomButtons={!mobileVariant}
      topLeft={(zoomToSelection) =>
        mobileVariant ? (
          <div className="flex items-center gap-2 rounded-card bg-surface px-3 py-2 shadow-float">
            <Logo size={22} />
            <span className="font-bold text-ink">Norske grenser</span>
          </div>
        ) : (
          <SelectionCard tittel={kortTittel} detaljer={kortDetaljer} onZoom={zoomToSelection} kanZoome={fitTarget.features.length > 0} />
        )
      }
      topRight={
        mobileVariant ? (
          <MobileMenu
            theme={theme}
            onToggleTheme={onToggleTheme}
            onOpenOm={onOpenOm}
            onOpenKolonner={() => setMobileTab('kolonner')}
          />
        ) : undefined
      }
      bottomLeft={
        mobileVariant ? undefined : (
          <DataButton nokkel={nokkel} open={dataOpen} onToggle={() => setDataOpen((open) => !open)} />
        )
      }
      drawer={
        !mobileVariant && dataOpen ? (
          <DataDrawer onClose={() => setDataOpen(false)}>{sections(false).data}</DataDrawer>
        ) : undefined
      }
    />
  )

  if (mobile) {
    const s = sections(true)
    return (
      <MobileLayout
        map={map(true)}
        tab={mobileTab}
        onTabChange={setMobileTab}
        utvalg={
          <>
            {s.inndeling}
            {s.grupper}
            {s.kommuner}
          </>
        }
        geometri={
          <>
            {s.geometri}
            <section className="flex flex-col gap-2">
              <h2 className="text-[15px] font-semibold">Fil</h2>
              <DownloadOptions {...download} />
              <span className="text-xs text-muted">WGS84 (EPSG:4326) · Alt skjer i nettleseren.</span>
            </section>
          </>
        }
        kolonner={s.data}
        downloadButton={<DownloadButton {...download} mobile />}
      />
    )
  }

  const s = sections(false)
  return (
    <div className="flex flex-col bg-bg min-[960px]:h-dvh min-[960px]:overflow-hidden">
      <Header theme={theme} onToggleTheme={onToggleTheme} onOpenOm={onOpenOm} onOpenKolonner={() => setDataOpen(true)} />
      <div className="flex min-h-0 flex-1 flex-wrap">
        <aside
          aria-label="Utvalg og nedlasting"
          className="flex w-full flex-[1_1_400px] flex-col border-line bg-surface min-[960px]:h-full min-[960px]:max-w-[420px] min-[960px]:overflow-y-auto min-[960px]:border-r"
        >
          <div className="flex flex-1 flex-col gap-[22px] p-5">
            {s.inndeling}
            {s.grupper}
            {s.kommuner}
            {s.geometri}
          </div>
          <DownloadBar {...download} />
        </aside>
        <main className="h-[70vh] min-w-0 flex-[999_1_560px] min-[960px]:h-full">{map(false)}</main>
      </div>
    </div>
  )
}

export default App
