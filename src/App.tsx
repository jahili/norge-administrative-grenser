import { useMemo, useState } from 'react'
import * as topojsonClient from 'topojson-client'
import { useTopology } from './hooks/useTopology'
import type { NorwayTopologyType } from './hooks/useTopology'
import { useSelection } from './hooks/useSelection'
import { useSimplifiedTopology } from './hooks/useSimplifiedTopology'
import { useTheme } from './hooks/useTheme'
import { FylkeSelector } from './components/FylkeSelector'
import { KommuneSelector } from './components/KommuneSelector'
import { BydelSelector } from './components/BydelSelector'
import { HavgrenseToggle } from './components/HavgrenseToggle'
import { MapPreview } from './components/MapPreview'
import { SimplificationControl } from './components/SimplificationControl'
import { ExportPanel } from './components/ExportPanel'
import { ThemeToggle } from './components/ThemeToggle'
import {
  selectedFeatureCollection,
  selectedBydelFeatureCollection,
  buildExport,
  downloadBlob,
} from './lib/exportData'
import {
  selectionFilenameStem,
  fylkeSelectionFilenameStem,
  bydelSelectionFilenameStem,
} from './lib/filename'
import type {
  ExportFormat,
  ExportGranularity,
  AreaGeometry,
  BydelProperties,
  FylkeProperties,
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
          fylker, kommuner og bydeler, og last ned grensene i GeoJSON- eller TopoJSON-format.
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
              Laster inn kartdata (3,2 MB) …
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
  theme: 'light' | 'dark'
}

function Workspace({ topology, fylker, kommuner, kommunerByFylke, bydelsByKommune, theme }: WorkspaceProps) {
  const selection = useSelection(fylker, kommunerByFylke, bydelsByKommune)
  const [detailPercent, setDetailPercent] = useState(100)
  const [format, setFormat] = useState<ExportFormat>('geojson')
  const [medHavgrense, setMedHavgrense] = useState(false)

  const simplifiedTopology = useSimplifiedTopology(topology, detailPercent)

  const kommuneObject = medHavgrense ? 'kommuner' : 'kommunerUtenHavgrense'
  const fylkeObject = medHavgrense ? 'fylker' : 'fylkerUtenHavgrense'

  const selectedFeatures = useMemo(
    () => selectedFeatureCollection(simplifiedTopology, kommuneObject, selection.selectedKommuner),
    [simplifiedTopology, kommuneObject, selection.selectedKommuner],
  )

  const contextFylker = useMemo<FeatureCollection<AreaGeometry, FylkeProperties>>(() => {
    const all = topojsonClient.feature(simplifiedTopology, simplifiedTopology.objects[fylkeObject]) as FeatureCollection<
      AreaGeometry,
      FylkeProperties
    >
    return {
      type: 'FeatureCollection',
      features: all.features.filter((f) => selection.selectedFylker.has(f.properties.fylkesnummer)),
    }
  }, [simplifiedTopology, fylkeObject, selection.selectedFylker])

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
    if (selection.selectedFylker.size > 0) return 'fylker'
    return 'kommuner'
  })()

  const exportTarget = useMemo<
    | { granularity: 'fylker'; features: FeatureCollection<AreaGeometry, FylkeProperties> }
    | { granularity: 'kommuner'; features: FeatureCollection<AreaGeometry, KommuneProperties> }
    | { granularity: 'bydeler'; features: FeatureCollection<AreaGeometry, BydelProperties> }
  >(() => {
    if (effectiveGranularity === 'fylker') return { granularity: 'fylker', features: contextFylker }
    if (effectiveGranularity === 'bydeler') return { granularity: 'bydeler', features: selectedBydelFeatures }
    return { granularity: 'kommuner', features: selectedFeatures }
  }, [effectiveGranularity, contextFylker, selectedBydelFeatures, selectedFeatures])

  const exportResult = useMemo(
    () =>
      exportTarget.features.features.length > 0
        ? buildExport(exportTarget.features, exportTarget.granularity, format)
        : null,
    [exportTarget, format],
  )

  const filenameStem = useMemo(() => {
    if (exportTarget.features.features.length === 0) return null
    if (exportTarget.granularity === 'fylker') {
      return fylkeSelectionFilenameStem(exportTarget.features.features.map((f) => f.properties))
    }
    if (exportTarget.granularity === 'bydeler') {
      return bydelSelectionFilenameStem(
        exportTarget.features.features.map((f) => f.properties),
        bydelsByKommune,
        kommuner,
      )
    }
    return selectionFilenameStem(exportTarget.features.features.map((f) => f.properties), fylker, kommunerByFylke)
  }, [exportTarget, fylker, kommuner, kommunerByFylke, bydelsByKommune])

  // Map shows selected bydeler or kommuner with fill; fylker are always
  // shown as outlines via contextFylker regardless of granularity.
  const previewFeatures = effectiveGranularity === 'bydeler' ? selectedBydelFeatures : selectedFeatures

  const previewLabel = (() => {
    if (effectiveGranularity === 'fylker') {
      const n = selection.selectedFylker.size
      return `${n} fylke${n === 1 ? '' : 'r'} valgt.`
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

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Left column: selection steps */}
      <div className="flex flex-col gap-6">
        <FylkeSelector fylker={fylker} selection={selection} />
        <KommuneSelector
          fylker={fylker}
          kommunerByFylke={kommunerByFylke}
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
            contextFylker={contextFylker}
            detailPercent={detailPercent}
            havgrenseKey={medHavgrense ? 'med' : 'uten'}
            previewGranularity={effectiveGranularity}
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
    </div>
  )
}

export default App
