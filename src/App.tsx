import { useMemo, useState } from 'react'
import { useTopology } from './hooks/useTopology'
import type { NorwayTopology } from './hooks/useTopology'
import { useSelection } from './hooks/useSelection'
import { useSimplifiedTopology } from './hooks/useSimplifiedTopology'
import { useGrunnkretsUtvalg } from './hooks/useGrunnkretsUtvalg'
import { useExport } from './hooks/useExport'
import { useKartOmrader } from './hooks/useKartOmrader'
import { useMediaQuery } from './hooks/useMediaQuery'
import { useTheme } from './hooks/useTheme'
import type { Theme } from './hooks/useTheme'
import { GruppeSelector } from './components/GruppeSelector'
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
import { Header, OmDataene } from './components/Header'
import { Logo, Spinner } from './components/ui'
import { DISTRIKT_KINDS } from './lib/distrikter'
import { dataColumns, utvalgDetaljer, utvalgTittel } from './lib/format'
import { fylkeRekkefolge, fylkeSeksjoner } from './lib/grupper'
import { nokkelKolonne } from './lib/kolonner'
import type { GruppeKind } from './lib/types'

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

interface WorkspaceProps extends NorwayTopology {
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
  const [medHavgrense, setMedHavgrense] = useState(false)
  const [inndeling, setInndeling] = useState<Inndeling>('administrativ')

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
  // BA-regioner) are listed under a fylke.
  const seksjoner = useMemo(
    () =>
      gruppeKind !== 'fylker' && DISTRIKT_KINDS[gruppeKind].listeEtterFylke
        ? fylkeSeksjoner(groups, kommunerByGroup, fylkeGrupper)
        : undefined,
    [gruppeKind, groups, kommunerByGroup, fylkeGrupper],
  )

  const { topology: simplifiedTopology, minWeight } = useSimplifiedTopology(topology, detailPercent)

  const kommuneByNummer = useMemo(() => new Map(kommuner.map((k) => [k.kommunenummer, k])), [kommuner])
  const grunnkretser = useGrunnkretsUtvalg({
    kommuner,
    kommuneByNummer,
    selectedKommuner: selection.selectedKommuner,
    gruppeKind,
    medHavgrense,
    minWeight,
  })
  const kommunerMedBydeler = useMemo(
    () =>
      kommuner.filter(
        (k) => selection.selectedKommuner.has(k.kommunenummer) && bydelsByKommune.has(k.kommunenummer),
      ),
    [kommuner, selection.selectedKommuner, bydelsByKommune],
  )

  const eksport = useExport({
    topology,
    simplifiedTopology,
    kommuner,
    bydelsByKommune,
    distrikter,
    medHavgrense,
    gruppeKind,
    groups,
    kommunerByGroup,
    selection,
    grunnkretser,
  })
  const { granularity, featureCount, download, dataRows, dataExample } = eksport

  const { omrader, onHandling } = useKartOmrader({
    simplifiedTopology,
    medHavgrense,
    gruppeKind,
    kommunerByGroup,
    bydelsByKommune,
    kommuneByNummer,
    selection,
    grunnkretser,
    granularity,
  })

  const fitTarget = featureCount > 0 && granularity !== gruppeKind ? eksport.features : eksport.gruppeFeatures
  const fitKey = [
    gruppeKind,
    granularity,
    [...selection.selectedGroups].sort().join(','),
    selection.selectedKommuner.size,
    selection.selectedBydeler.size,
    grunnkretser.utelatte.size,
    featureCount,
  ].join('|')

  // --- Text for the map card and the «Data i filen» button ---
  const nokkel = nokkelKolonne(granularity)
  const kortTittel = utvalgTittel(groups.filter((g) => selection.selectedGroups.has(g.id)).map((g) => g.navn))
  const kortDetaljer =
    grunnkretser.state.loading.length > 0
      ? 'Laster grunnkretser …'
      : utvalgDetaljer(granularity, featureCount, dataColumns(dataRows, dataExample).length)

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
        sections={seksjoner}
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
          kommuner={grunnkretser.valgteKommuner}
          enabled={grunnkretser.enabled}
          onEnabledChange={grunnkretser.setEnabled}
          nivå={grunnkretser.nivå}
          onNivåChange={grunnkretser.setNivå}
          state={grunnkretser.state}
          underomraderByKommune={grunnkretser.underomrader}
          utelatte={grunnkretser.utelatte}
          onUtelatteChange={grunnkretser.changeUtelatte}
        />
        {!grunnkretser.active && (
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
    data: <DataTabell granularity={granularity} rows={dataRows} example={dataExample} onDownloadCsv={eksport.downloadCsv} />,
  })

  const map = (mobileVariant: boolean) => (
    <MapView
      omrader={omrader}
      onHandling={onHandling}
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
