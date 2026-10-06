import { useMemo, useState } from 'react'
import * as topojsonClient from 'topojson-client'
import { useTopology } from './hooks/useTopology'
import type { NorwayTopologyType } from './hooks/useTopology'
import { useSelection } from './hooks/useSelection'
import { useSimplifiedTopology } from './hooks/useSimplifiedTopology'
import { useTheme } from './hooks/useTheme'
import { GruppeSelector } from './components/GruppeSelector'
import type { GruppeSeksjon } from './components/GruppeSelector'
import { KommuneSelector } from './components/KommuneSelector'
import { BydelSelector } from './components/BydelSelector'
import { InndelingToggle } from './components/InndelingToggle'
import type { Inndeling } from './components/InndelingToggle'
import { HavgrenseToggle } from './components/HavgrenseToggle'
import { MapPreview } from './components/MapPreview'
import { SimplificationControl } from './components/SimplificationControl'
import { ExportPanel } from './components/ExportPanel'
import { ThemeToggle } from './components/ThemeToggle'
import { DataTabell } from './components/DataTabell'
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
} from './lib/filename'
import { DISTRIKT_KINDS, toDistrikt } from './lib/distrikter'
import type { DistriktProperties } from './lib/distrikter'
import type {
  ExportFormat,
  ExportGranularity,
  AreaGeometry,
  BydelProperties,
  DistriktKind,
  FylkeProperties,
  GruppeKind,
  KommuneGruppe,
  KommuneProperties,
} from './lib/types'
import type { FeatureCollection } from 'geojson'

function App() {
  const topologyState = useTopology()
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="flex items-center justify-between gap-4">
        <img
          src={`${import.meta.env.BASE_URL}logo.png`}
          alt="Plotikon"
          className="h-10 w-auto"
          width={44}
          height={40}
        />
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
      </div>

      <header className="mt-6">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Norge – administrative grenser
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-400">
          Her kan du finne og laste ned kartdata for norske administrative grenser. Velg mellom
          fylker, kommuner og bydeler, eller grupper kommunene etter politidistrikter,
          valgdistrikter, helseregioner og en rekke andre inndelinger, og last ned
          grensene i GeoJSON- eller TopoJSON-format.
        </p>
        <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-400">
          Appen gjør det enkelt å hente ut kartgrunnlag til analyser, visualiseringer og webkart
          – enten du trenger hele landet, utvalgte områder eller bestemte administrative nivåer.
          Alt skjer lokalt i nettleseren – ingen data sendes til en server.
        </p>
        <p className="mt-3 text-xs font-medium tracking-wide text-slate-400 uppercase dark:text-slate-500">
          Kartdata oppdatert i 2026
        </p>
      </header>

      <main className="mt-8">
        {topologyState.status === 'loading' && (
          <div className="flex items-center gap-3 py-10">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-teal-700 dark:border-slate-700 dark:border-t-teal-400" />
            <p role="status" className="text-slate-600 dark:text-slate-400">
              Laster inn kartdata (5,6 MB) …
            </p>
          </div>
        )}
        {topologyState.status === 'error' && (
          <p role="alert" className="text-red-700 dark:text-red-400">
            Klarte ikke å laste kartdata: {topologyState.error.message}
          </p>
        )}
        {topologyState.status === 'ready' && <Workspace {...topologyState} theme={theme} />}
      </main>

      <footer className="mt-12 border-t border-slate-100 pt-6 text-xs text-slate-400 dark:border-slate-800 dark:text-slate-500">
        <p>
          Grensedata fra{' '}
          <a
            href="https://kartverket.no"
            className="underline hover:text-teal-700 dark:hover:text-teal-400"
            target="_blank"
            rel="noopener noreferrer"
          >
            Kartverket
          </a>
          . Politidistrikter, valgdistrikter og de øvrige inndelingene fra{' '}
          <a
            href="https://www.ssb.no/klass/"
            className="underline hover:text-teal-700 dark:hover:text-teal-400"
            target="_blank"
            rel="noopener noreferrer"
          >
            SSBs klassifikasjoner
          </a>{' '}
          og 110-distrikter fra{' '}
          <a
            href="https://kartkatalog.geonorge.no/metadata/c4436a5f-1e22-461a-8209-786f7052acb5"
            className="underline hover:text-teal-700 dark:hover:text-teal-400"
            target="_blank"
            rel="noopener noreferrer"
          >
            DSB
          </a>
          . Bydelsdata tilgjengelig for Bergen, Fredrikstad, Kristiansand, Oslo, Stavanger og
          Trondheim — kommuner med bydeler er merket med{' '}
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-teal-600 align-middle dark:bg-teal-400" /> i
          kommunelisten.
        </p>
      </footer>
    </div>
  )
}

interface WorkspaceProps {
  topology: NorwayTopologyType
  fylker: FylkeProperties[]
  kommuner: KommuneProperties[]
  kommunerByFylke: Map<string, KommuneProperties[]>
  bydelsByKommune: Map<string, BydelProperties[]>
  distrikter: Record<DistriktKind, KommuneGruppe[]>
  kommunerByDistrikt: Record<DistriktKind, Map<string, KommuneProperties[]>>
  theme: 'light' | 'dark'
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
}: WorkspaceProps) {
  const [detailPercent, setDetailPercent] = useState(100)
  const [format, setFormat] = useState<ExportFormat>('geojson')
  const [medHavgrense, setMedHavgrense] = useState(false)
  const [inndeling, setInndeling] = useState<Inndeling>('administrativ')

  // Kommuner are grouped by fylke or by one of the district kinds. Each
  // grouping keeps its own selection, so switching inndeling back and forth
  // doesn't lose anything.
  const fylkeGrupper = useMemo(() => fylker.map((f) => ({ id: f.fylkesnummer, navn: f.fylkesnavn })), [fylker])
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

  const simplifiedTopology = useSimplifiedTopology(topology, detailPercent)

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
    if (selection.selectedBydeler.size > 0) return 'bydeler'
    if (selection.selectedKommuner.size > 0) return 'kommuner'
    if (selection.selectedGroups.size > 0) return gruppeKind
    return gruppeKind === 'fylker' ? 'kommuner' : gruppeKind
  })()

  const exportTarget = useMemo<
    | { granularity: 'fylker'; features: FeatureCollection<AreaGeometry, FylkeProperties> }
    | { granularity: 'kommuner'; features: FeatureCollection<AreaGeometry, KommuneProperties> }
    | { granularity: 'bydeler'; features: FeatureCollection<AreaGeometry, BydelProperties> }
    | { granularity: DistriktKind; features: FeatureCollection<AreaGeometry, DistriktProperties> }
  >(() => {
    if (effectiveGranularity === 'bydeler') return { granularity: 'bydeler', features: selectedBydelFeatures }
    if (effectiveGranularity === 'kommuner') return { granularity: 'kommuner', features: selectedFeatures }
    return contextAreas.kind === 'fylker'
      ? { granularity: 'fylker', features: contextAreas.features }
      : { granularity: contextAreas.kind, features: contextAreas.features }
  }, [effectiveGranularity, contextAreas, selectedBydelFeatures, selectedFeatures])

  const exportResult = useMemo(
    () =>
      exportTarget.features.features.length > 0
        ? buildExport(exportTarget.features, exportTarget.granularity, format)
        : null,
    [exportTarget, format],
  )

  const filenameStem = useMemo(() => {
    if (exportTarget.features.features.length === 0) return null
    switch (exportTarget.granularity) {
      case 'fylker':
        return fylkeSelectionFilenameStem(exportTarget.features.features.map((f) => f.properties))
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
  }, [exportTarget, kommuner, bydelsByKommune, gruppeKind, groups, kommunerByGroup, distrikter])

  // Map shows selected bydeler or kommuner with fill; the selected fylker or
  // districts are shown as outlines, or filled when they are the export target.
  const previewFeatures = effectiveGranularity === 'bydeler' ? selectedBydelFeatures : selectedFeatures
  const contextIsTarget = effectiveGranularity === gruppeKind

  const previewLabel = (() => {
    if (contextIsTarget) {
      const n = selection.selectedGroups.size
      if (gruppeKind === 'fylker') return `${n} fylke${n === 1 ? '' : 'r'} valgt.`
      const { entall, flertall } = DISTRIKT_KINDS[gruppeKind]
      return n === 0 ? `Ingen ${flertall} valgt ennå.` : `${n} ${n === 1 ? entall : flertall} valgt.`
    }
    if (effectiveGranularity === 'bydeler') {
      const n = selectedBydelFeatures.features.length
      return n === 0 ? 'Ingen bydeler valgt ennå.' : `${n} bydel${n === 1 ? '' : 'er'} valgt.`
    }
    const n = selectedFeatures.features.length
    return n === 0 ? 'Ingen kommuner valgt ennå.' : `${n} kommune${n === 1 ? '' : 'r'} valgt.`
  })()

  function handleDownload(filename: string) {
    if (!exportResult) return
    downloadBlob(exportResult.blob, filename)
  }

  // The attribute table of the export, and one feature's properties at the
  // same level so the columns can be explored before anything is selected.
  const dataRows = useMemo(
    () => exportTarget.features.features.map((f) => f.properties as Record<string, string>),
    [exportTarget],
  )
  const dataExample = (() => {
    const objectName =
      effectiveGranularity === 'fylker' || effectiveGranularity === 'kommuner' || effectiveGranularity === 'bydeler'
        ? effectiveGranularity
        : DISTRIKT_KINDS[effectiveGranularity].objects.med
    return topology.objects[objectName].geometries[0]?.properties as Record<string, string> | undefined
  })()

  function handleDownloadCsv(columns: string[]) {
    downloadBlob(buildCsv(columns, dataRows), `${filenameStem ?? effectiveGranularity}.csv`)
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Left column: selection steps */}
      <div className="flex flex-col gap-6">
        <InndelingToggle inndeling={inndeling} onChange={setInndeling} />
        <GruppeSelector
          key={gruppeKind}
          flertall={gruppeFlertall}
          groups={groups}
          selection={selection}
          sections={fylkeSeksjoner}
          note={
            gruppeKind === 'fylker'
              ? undefined
              : `Kilde: ${DISTRIKT_KINDS[gruppeKind].kilde}. ${DISTRIKT_KINDS[gruppeKind].tittel} består av hele kommuner, og grensene er satt sammen av kommunegrensene.`
          }
          kommuneCount={
            gruppeKind === 'fylker'
              ? undefined
              : new Map([...kommunerByDistrikt[gruppeKind]].map(([id, list]) => [id, list.length]))
          }
        />
        <KommuneSelector
          key={`kommuner-${gruppeKind}`}
          groups={groups}
          gruppeFlertall={gruppeFlertall}
          gruppeArtikkel={gruppeArtikkel}
          kommunerByGroup={kommunerByGroup}
          bydelsByKommune={bydelsByKommune}
          selection={selection}
        />
        <BydelSelector
          kommunerMedBydeler={kommunerMedBydeler}
          bydelsByKommune={bydelsByKommune}
          selection={selection}
        />
      </div>

      {/* Right column: preview + output settings */}
      <div className="flex flex-col gap-6">
        <section aria-label="Kartforhåndsvisning">
          <h2 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">Forhåndsvisning</h2>
          <MapPreview
            selectedFeatures={previewFeatures}
            contextAreas={contextAreas.features}
            detailPercent={detailPercent}
            havgrenseKey={medHavgrense ? 'med' : 'uten'}
            contextIsTarget={contextIsTarget}
            theme={theme}
          />
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{previewLabel}</p>
        </section>

        <HavgrenseToggle medHavgrense={medHavgrense} onChange={setMedHavgrense} />

        <SimplificationControl
          detailPercent={detailPercent}
          onChange={setDetailPercent}
          estimatedBytes={exportResult?.blob.size ?? null}
        />

        <ExportPanel
          key={filenameStem ?? 'no-selection'}
          format={format}
          onFormatChange={setFormat}
          onDownload={handleDownload}
          disabled={!exportResult}
          defaultFilenameStem={filenameStem}
          extension={exportResult?.extension ?? null}
          granularity={effectiveGranularity}
          featureCount={exportTarget.features.features.length}
        />
      </div>

      {/* Full width: the attribute table behind the download */}
      <div className="lg:col-span-2">
        <DataTabell
          granularity={effectiveGranularity}
          rows={dataRows}
          example={dataExample}
          onDownloadCsv={handleDownloadCsv}
        />
      </div>
    </div>
  )
}

export default App
