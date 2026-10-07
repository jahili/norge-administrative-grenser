import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import * as topojsonClient from 'topojson-client'
import { useTopology } from './hooks/useTopology'
import type { NorwayTopologyType } from './hooks/useTopology'
import { useSelection } from './hooks/useSelection'
import { useSimplifiedTopology } from './hooks/useSimplifiedTopology'
import { useGrunnkretser } from './hooks/useGrunnkretser'
import { useMediaQuery } from './hooks/useMediaQuery'
import { useTheme } from './hooks/useTheme'
import type { Theme } from './hooks/useTheme'
import { GruppeSelector } from './components/GruppeSelector'
import type { GruppeSeksjon } from './components/GruppeSelector'
import { KommuneSelector } from './components/KommuneSelector'
import { BydelSelector } from './components/BydelSelector'
import { GrunnkretsSelector } from './components/GrunnkretsSelector'
import type { Delomrade } from './components/GrunnkretsSelector'
import { InndelingToggle } from './components/InndelingToggle'
import type { Inndeling } from './components/InndelingToggle'
import { GeometriSection } from './components/GeometriSection'
import { MapView } from './components/MapView'
import { DataTabell } from './components/DataTabell'
import { DownloadBar, DownloadButton, DownloadOptions } from './components/Nedlasting'
import { dataColumns, levelWords } from './lib/format'
import type { DownloadState } from './components/Nedlasting'
import { GITHUB_URL, Header, OmDataene, ThemeButton } from './components/Header'
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
import { delomraderByKommune, grunnkretsFeatures } from './lib/grunnkretser'
import type { FeatureArgs } from './lib/grunnkretser'
import { DISTRIKT_KINDS, toDistrikt } from './lib/distrikter'
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
              <Spinner /> Laster inn kartdata (5,6 MB) …
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

const NO_DELOMRADER = new Set<string>()

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

  // Divisions that nest within fylker (e.g. 85 økonomiske regioner) are listed
  // under their fylke. A district's fylke is that of its kommuner; if any
  // district turns out to span fylker, fall back to one flat list.
  const fylkeSeksjoner = useMemo<GruppeSeksjon[] | undefined>(() => {
    if (gruppeKind === 'fylker' || !DISTRIKT_KINDS[gruppeKind].listeEtterFylke) return undefined
    const byFylke = new Map<string, KommuneGruppe[]>()
    for (const group of groups) {
      const fylker = new Set((kommunerByGroup.get(group.id) ?? []).map((k) => k.fylkesnummer))
      if (fylker.size !== 1) return undefined
      const [fylkesnummer] = fylker
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

  const delomrader = useMemo(() => {
    const merged = new Map<string, Delomrade[]>()
    for (const t of grunnkretsState.topologies.values()) for (const [k, list] of delomraderByKommune(t)) merged.set(k, list)
    return merged
  }, [grunnkretsState.topologies])

  // Grunnkretser or delområder, whichever level is chosen.
  const selectedGrunnkretsFeatures = useMemo<
    | { nivå: 'grunnkretser'; features: FeatureCollection<AreaGeometry, GrunnkretsProperties> }
    | { nivå: 'delomrader'; features: FeatureCollection<AreaGeometry, DelomradeProperties> }
  >(() => {
    const args: FeatureArgs = [
      [...grunnkretsState.topologies.values()],
      medHavgrense,
      minWeight,
      selection.selectedKommuner,
      utelatteDelomrader,
      kommuneByNummer,
      gruppeKind,
    ]
    if (!brukerGrunnkretser) return { nivå: 'grunnkretser', features: { type: 'FeatureCollection', features: [] } }
    return grunnkretsNivå === 'delomrader'
      ? { nivå: 'delomrader', features: grunnkretsFeatures('delomrader', ...args) }
      : { nivå: 'grunnkretser', features: grunnkretsFeatures('grunnkretser', ...args) }
  }, [
    brukerGrunnkretser,
    grunnkretsNivå,
    grunnkretsState.topologies,
    medHavgrense,
    minWeight,
    selection.selectedKommuner,
    utelatteDelomrader,
    kommuneByNummer,
    gruppeKind,
  ])
  const someDelomraderLeftOut = valgteKommuner.some((k) =>
    (delomrader.get(k.kommunenummer) ?? []).some((d) => utelatteDelomrader.has(d.delomradenummer)),
  )

  function handleDelomraderChange(delomradenumre: string[], include: boolean) {
    setUtelatteDelomrader((prev) => {
      const next = new Set(prev)
      for (const nr of delomradenumre) {
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
    | { granularity: DistriktKind; features: FeatureCollection<AreaGeometry, DistriktProperties> }
  >(() => {
    if (effectiveGranularity === 'grunnkretser' || effectiveGranularity === 'delomrader') {
      return selectedGrunnkretsFeatures.nivå === 'delomrader'
        ? { granularity: 'delomrader', features: selectedGrunnkretsFeatures.features }
        : { granularity: 'grunnkretser', features: selectedGrunnkretsFeatures.features }
    }
    if (effectiveGranularity === 'bydeler') return { granularity: 'bydeler', features: selectedBydelFeatures }
    if (effectiveGranularity === 'kommuner') return { granularity: 'kommuner', features: selectedFeatures }
    return contextAreas.kind === 'fylker'
      ? { granularity: 'fylker', features: contextAreas.features }
      : { granularity: contextAreas.kind, features: contextAreas.features }
  }, [effectiveGranularity, contextAreas, selectedGrunnkretsFeatures, selectedBydelFeatures, selectedFeatures])

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
        return grunnkretsSelectionFilenameStem(
          exportTarget.granularity,
          valgteKommuner,
          gruppeKind,
          groups,
          kommunerByGroup,
          someDelomraderLeftOut,
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
  }, [exportTarget, kommuner, bydelsByKommune, gruppeKind, groups, kommunerByGroup, distrikter, valgteKommuner, someDelomraderLeftOut])

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
    if (effectiveGranularity === 'grunnkretser' || effectiveGranularity === 'delomrader') return dataRows[0]
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

  // Grunnkretser/delområder for the map include the left-out delområder, so
  // they can be clicked back in.
  const kartGrunnkretser = useMemo(() => {
    if (!brukerGrunnkretser) return null
    const args: FeatureArgs = [
      [...grunnkretsState.topologies.values()],
      medHavgrense,
      minWeight,
      selection.selectedKommuner,
      NO_DELOMRADER,
      kommuneByNummer,
      gruppeKind,
    ]
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
        return handleDelomraderChange([handling.id], utelatteDelomrader.has(handling.id))
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
    utelatteDelomrader.size,
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
          delomraderByKommune={delomrader}
          utelatteDelomrader={utelatteDelomrader}
          onDelomraderChange={handleDelomraderChange}
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

/**
 * SSB's standard order of the fylker (roughly south-east to north), which is
 * how most Norwegian tables and lists present them — rather than by number.
 * Unknown numbers go last, by number.
 */
const FYLKE_REKKEFOLGE = ['03', '32', '31', '33', '34', '39', '40', '42', '11', '46', '15', '50', '18', '55', '56']
function fylkeRekkefolge(fylkesnummer: string): number {
  const index = FYLKE_REKKEFOLGE.indexOf(fylkesnummer)
  return index === -1 ? 100 + Number(fylkesnummer) : index
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * A stable callback that always runs the latest version of `fn` — for event
 * handlers handed to the map, which binds them once per drawn layer.
 */
function useLatest<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  const ref = useRef(fn)
  useLayoutEffect(() => {
    ref.current = fn
  })
  return useCallback((...args: A) => ref.current(...args), [])
}

/** Map overlay, top left: the selection, its size and «Zoom til utvalg». */
function SelectionCard({
  tittel,
  detaljer,
  onZoom,
  kanZoome,
}: {
  tittel: string
  detaljer: string
  onZoom: () => void
  kanZoome: boolean
}) {
  return (
    <div className="flex max-w-full flex-wrap items-center gap-2.5 rounded-card border border-line bg-surface py-2 pr-2 pl-3.5 shadow-float">
      <span className="font-semibold text-ink">{tittel}</span>
      <span aria-live="polite" className="text-[13px] text-muted">
        {detaljer}
      </span>
      <button
        type="button"
        onClick={onZoom}
        disabled={!kanZoome}
        className="h-8 cursor-pointer rounded-lg border border-line bg-surface px-3 text-[13px] text-ink-2 hover:bg-seg disabled:cursor-not-allowed disabled:opacity-50"
      >
        Zoom til utvalg
      </button>
    </div>
  )
}

/** Map overlay, bottom left: opens the column table, with the key column in one line. */
function DataButton({ nokkel, open, onToggle }: { nokkel: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls="data-skuff"
      className="flex cursor-pointer items-center gap-3 rounded-card border border-line bg-surface px-4 py-3 text-left text-ink shadow-float hover:bg-surface-2"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-accent" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 10h18M9 10v10" />
      </svg>
      <span className="flex min-w-0 flex-col">
        <span className="font-semibold">Data i filen</span>
        <span className="truncate text-xs text-muted">
          Nøkkel: <span className="font-mono">{nokkel}</span> (tekst, behold ledende null)
        </span>
      </span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={`shrink-0 text-ink-2 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true">
        <path d="M6 15l6-6 6 6" />
      </svg>
    </button>
  )
}

/** Drawer over the lower part of the map, holding the column table. */
function DataDrawer({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <section
      id="data-skuff"
      aria-labelledby="data-skuff-tittel"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
      className="absolute inset-x-4 bottom-4 z-[1002] flex max-h-[min(70%,640px)] flex-col overflow-hidden rounded-card border border-line bg-surface shadow-[0_8px_32px_rgba(21,32,30,0.2)]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-2">
        <h2 id="data-skuff-tittel" className="text-[15px] font-semibold">
          Data i filen
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Lukk data i filen"
          className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-field text-ink-2 hover:bg-seg"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <div className="overflow-auto px-5 py-4">{children}</div>
    </section>
  )
}

type MobileTab = 'utvalg' | 'geometri' | 'kolonner'

/** Mobile: map on top, controls in a bottom sheet with tabs, fixed download button. */
function MobileLayout({
  map,
  tab,
  onTabChange,
  utvalg,
  geometri,
  kolonner,
  downloadButton,
}: {
  map: ReactNode
  tab: MobileTab
  onTabChange: (tab: MobileTab) => void
  utvalg: ReactNode
  geometri: ReactNode
  kolonner: ReactNode
  downloadButton: ReactNode
}) {
  const [expanded, setExpanded] = useState(false)
  const tabs: [MobileTab, string][] = [
    ['utvalg', 'Utvalg'],
    ['geometri', 'Geometri'],
    ['kolonner', 'Kolonner'],
  ]
  return (
    <div className="relative h-dvh overflow-hidden bg-sea">
      <div className="absolute inset-x-0 top-0 h-[47dvh]">{map}</div>
      <section
        aria-label="Kontroller"
        className={`absolute inset-x-0 bottom-0 z-[1100] flex flex-col rounded-t-[20px] bg-surface shadow-[0_-6px_24px_rgba(21,32,30,0.15)] transition-[top] duration-200 ${
          expanded ? 'top-[10dvh]' : 'top-[43dvh]'
        }`}
      >
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          aria-label={expanded ? 'Vis mer av kartet' : 'Vis mer av panelet'}
          className="flex h-6 w-full shrink-0 cursor-pointer items-center justify-center"
        >
          <span className="h-1 w-10 rounded-full bg-input" />
        </button>
        <div role="tablist" aria-label="Panel" className="flex shrink-0 gap-1.5 border-b border-line px-4">
          {tabs.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              id={`fane-${value}`}
              aria-selected={tab === value}
              aria-controls={`panel-${value}`}
              onClick={() => onTabChange(value)}
              className={`h-11 cursor-pointer border-b-2 px-3 ${
                tab === value ? 'border-accent font-semibold text-ink' : 'border-transparent text-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div
          role="tabpanel"
          id={`panel-${tab}`}
          aria-labelledby={`fane-${tab}`}
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-3.5"
        >
          {tab === 'utvalg' ? utvalg : tab === 'geometri' ? geometri : kolonner}
        </div>
        <div className="shrink-0 border-t border-line bg-surface-2 px-4 pt-3 pb-[max(22px,env(safe-area-inset-bottom))]">
          {downloadButton}
        </div>
      </section>
    </div>
  )
}

/** Mobile: the header links and theme toggle behind a menu button. */
function MobileMenu({
  theme,
  onToggleTheme,
  onOpenOm,
  onOpenKolonner,
}: {
  theme: Theme
  onToggleTheme: () => void
  onOpenOm: () => void
  onOpenKolonner: () => void
}) {
  const [open, setOpen] = useState(false)
  const item = 'flex min-h-11 w-full cursor-pointer items-center px-4 text-left font-medium text-ink no-underline hover:bg-seg'
  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Meny"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-card bg-surface text-ink shadow-float"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-12 right-0 w-56 overflow-hidden rounded-card border border-line bg-surface py-1 shadow-float">
          <button type="button" className={item} onClick={() => (setOpen(false), onOpenOm())}>
            Om dataene
          </button>
          <button type="button" className={item} onClick={() => (setOpen(false), onOpenKolonner())}>
            Kolonner
          </button>
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className={item}>
            GitHub
          </a>
          <div className="flex items-center justify-between px-4 py-1">
            <span className="text-ink-2">Tema</span>
            <ThemeButton theme={theme} onToggle={onToggleTheme} />
          </div>
        </div>
      )}
    </div>
  )
}

export default App
