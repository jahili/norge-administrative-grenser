import { useMemo, useState } from 'react'
import * as topojsonClient from 'topojson-client'
import { useTopology } from './hooks/useTopology'
import { useSelection } from './hooks/useSelection'
import { useSimplifiedTopology } from './hooks/useSimplifiedTopology'
import { FylkeSelector } from './components/FylkeSelector'
import { KommuneSelector } from './components/KommuneSelector'
import { MapPreview } from './components/MapPreview'
import { SimplificationControl } from './components/SimplificationControl'
import { ExportPanel } from './components/ExportPanel'
import { selectedFeatureCollection, buildExport, downloadBlob } from './lib/exportData'
import { selectionFilenameStem } from './lib/filename'
import type { ExportFormat, AreaGeometry, FylkeProperties } from './lib/types'
import type { FeatureCollection } from 'geojson'

function App() {
  const topologyState = useTopology()

  return (
    <div className="mx-auto max-w-6xl p-6">
      <header>
        <h1 className="text-3xl font-semibold text-slate-900">Norge – administrative grenser</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Velg fylker og kommuner, forhåndsvis utvalget på kartet, og last det ned som GeoJSON
          eller TopoJSON i WGS84 (EPSG:4326). Alt skjer i nettleseren — ingen data sendes til en
          server.
        </p>
      </header>

      <main className="mt-6">
        {topologyState.status === 'loading' && (
          <p role="status" className="text-slate-600">
            Laster inn kart­data …
          </p>
        )}
        {topologyState.status === 'error' && (
          <p role="alert" className="text-red-700">
            Klarte ikke å laste kartdata: {topologyState.error.message}
          </p>
        )}
        {topologyState.status === 'ready' && <Workspace {...topologyState} />}
      </main>
    </div>
  )
}

interface WorkspaceProps {
  topology: import('./hooks/useTopology').NorwayTopology['topology']
  fylker: import('./lib/types').FylkeProperties[]
  kommunerByFylke: Map<string, import('./lib/types').KommuneProperties[]>
}

function Workspace({ topology, fylker, kommunerByFylke }: WorkspaceProps) {
  const selection = useSelection(fylker, kommunerByFylke)
  const [detailPercent, setDetailPercent] = useState(100)
  const [format, setFormat] = useState<ExportFormat>('geojson')

  const simplifiedTopology = useSimplifiedTopology(topology, detailPercent)

  const selectedFeatures = useMemo(
    () => selectedFeatureCollection(simplifiedTopology, selection.selectedKommuner),
    [simplifiedTopology, selection.selectedKommuner],
  )

  const contextFylker = useMemo<FeatureCollection<AreaGeometry, FylkeProperties>>(() => {
    // Fylke and kommune geometries in our bundled dataset are a mix of Polygon
    // and MultiPolygon (mainland-only vs. areas with islands); topojson-client's
    // return type is the broader Geometry union because TopoJSON doesn't
    // statically guarantee either shape.
    const all = topojsonClient.feature(simplifiedTopology, simplifiedTopology.objects.fylker) as FeatureCollection<
      AreaGeometry,
      FylkeProperties
    >
    return {
      type: 'FeatureCollection',
      features: all.features.filter((f) => selection.selectedFylker.has(f.properties.fylkesnummer)),
    }
  }, [simplifiedTopology, selection.selectedFylker])

  const exportResult = useMemo(
    () => (selectedFeatures.features.length > 0 ? buildExport(selectedFeatures, format) : null),
    [selectedFeatures, format],
  )

  const filenameStem = useMemo(
    () =>
      selectedFeatures.features.length > 0
        ? selectionFilenameStem(selectedFeatures.features.map((f) => f.properties), fylker, kommunerByFylke)
        : null,
    [selectedFeatures, fylker, kommunerByFylke],
  )

  const filename =
    filenameStem && exportResult ? `${filenameStem}.${exportResult.extension}` : null

  function handleDownload() {
    if (!exportResult || !filename) return
    downloadBlob(exportResult.blob, filename)
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-6">
        <FylkeSelector fylker={fylker} selection={selection} />
        <KommuneSelector fylker={fylker} kommunerByFylke={kommunerByFylke} selection={selection} />
      </div>

      <div className="flex flex-col gap-6">
        <section aria-label="Kartforhåndsvisning">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Forhåndsvisning</h2>
          <MapPreview selectedFeatures={selectedFeatures} contextFylker={contextFylker} />
          <p className="mt-2 text-sm text-slate-500">
            {selectedFeatures.features.length === 0
              ? 'Ingen kommuner valgt ennå.'
              : `${selectedFeatures.features.length} kommune${selectedFeatures.features.length === 1 ? '' : 'r'} valgt.`}
          </p>
        </section>

        <SimplificationControl
          detailPercent={detailPercent}
          onChange={setDetailPercent}
          estimatedBytes={exportResult?.blob.size ?? null}
        />

        <ExportPanel
          format={format}
          onFormatChange={setFormat}
          onDownload={handleDownload}
          disabled={!exportResult}
          filename={filename}
        />
      </div>
    </div>
  )
}

export default App
