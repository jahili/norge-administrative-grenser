# Norske grenser – arbeidsnotater

Web-app (Vite + React + TypeScript + Leaflet) for å velge norske administrative inndelinger og laste dem
ned som GeoJSON/TopoJSON. Publisert på https://jahili.github.io/norge-administrative-grenser/.
Brukerrettet dokumentasjon: `README.md`. Datapipelinen: `data-pipeline/README.md`.

Språk: brukergrensesnitt, README og commit-diskusjon på norsk; kode, kommentarer og commit-meldinger
på engelsk.

## Kommandoer

```sh
npm run dev        # utviklingsserver
npm run build      # tsc -b + vite build (tar sekunder – tar det minutter, se «Fallgruver»)
npm run lint       # eslint, inkl. react-hooks og react-refresh
npm run deploy     # bygger og publiserer dist/ til gh-pages (--no-history: grenen har bare siste versjon)
npm run data:build # hele datapipelinen, steg 01–06
```

Før commit: `npx tsc -b && npx eslint . && npm run build`. `npm ci` skal fungere (hold
`package-lock.json` i takt med `package.json`).

## Arkitektur

**Data (bygges av `data-pipeline/`, committes):**
- `src/assets/norge-grenser.topojson` (~5,9 MB) – hovedfilen appen laster ved oppstart: fylker,
  kommuner, bydeler og alle distriktinndelingene, med og uten havgrense, i én delt topologi.
- `src/assets/grunnkretser/<fylkesnummer>.topojson` + `index.json` – grunnkretser og delområder,
  én fil per fylke, som appen bare henter når noen slår på grunnkretser.

**Pipeline-steg:** 01 last ned (Geonorge + SSBs kommune-/fylkesnavn) → 02 normaliser → 03 delt
topologi og forenkling (mapshaper) → 04 kopier til `src/assets` → 05 distrikter → 06 grunnkretser.
Steg 05 og 06 kan kjøres alene mot den ferdigbygde hovedfilen. Nedlastinger caches i
`data-pipeline/raw/` (gitignored); slett den for å hente på nytt.

**Distriktinndelinger** (politidistrikter, 110-distrikter, valgdistrikter, BA-regioner m.fl.):
- Alle består av hele kommuner. Steg 05 merker hver kommune med distriktet sitt og slår kommunene
  sammen til distriktlag med `topojson-client` `mergeArcs`, så grensene sammenfaller nøyaktig.
- Én oppføring i `DISTRIKTER` i `data-pipeline/scripts/05-add-distrikter.mjs` + én i
  `DISTRIKT_KINDS` i `src/lib/distrikter.ts` + navnet i `DistriktKind` i `src/lib/types.ts`.
  Kildetyper: `ssb-kommune` (KLASS-koblingstabell), `ssb-fylke`, `dsb-110`, `csv-kommune`
  (tabell i `data-pipeline/source/`).
- Steget feiler hvis en kommune mangler distrikt, står i flere, eller koden er ukjent – det er
  meningen; ikke svekk valideringen for å få det til å gå.

**App (`src/`):**
- `App.tsx` – `Workspace` holder all tilstand og avledet data (utvalg, eksportmål, kartlag,
  filnavn) og velger desktop- eller mobiloppsett (`useMediaQuery`, < 768 px).
- `hooks/useSelection.ts` – utvalg per inndeling (gruppe → kommuner → bydeler), én tilstand per
  inndeling så de ikke påvirker hverandre.
- Eksportnivået følger det dypeste valget: grunnkretser/delområder > bydeler > kommuner > grupper.
- `components/MapView.tsx` – kartet tegner alle områder selv (`lib/kartlag.ts`); klikk slår valg
  av og på. Bakgrunnsfliser: CARTO uten stedsnavn, med API-nøkkel (offentlig i koden, som alle
  nettleser-kartnøkler; bytt den der hvis kvoten misbrukes).
- Designtokens (lyst/mørkt) i `src/index.css`; komponenter bruker Tailwind-klassene `bg-surface`,
  `text-ink`, `text-muted`, `border-line`, `text-accent` osv. Designreferansen er «redesign A»
  (kartet først).

## Fallgruver vi har gått i

- **Tailwind-skanning:** Tailwind leter etter klassenavn i alle prosjektfiler. Kartdataene (én
  linje på mange MB) gjorde bygget 20+ minutter. `src/index.css` har derfor
  `@source not "./assets"` og `@source not "../data-pipeline"` – ikke fjern dem.
- **`mergeArcs` og presimplify:** Kartfilene har en tredje verdi (forenklingsvekt) i hvert punkt.
  `mergeArcs` klarer da ikke å lime buene sammen. Kjør den mot en 2D-kopi av buene (se steg 05/06).
- **mapshaper `-clip`:** endrer laget den klipper fra, selv når resultatet går til et nytt lag
  (`+ name=…`). Klipp i en egen `applyCommands`-kjøring (se steg 06).
- **Detaljglidebryteren** kan vrenge små holmer; `buildExport` retter omløpsretningen ved
  nedlasting.
- **Geonorges filformat** endret seg i 2026 (nye filnavn i zip, flater og grenselinjer i samme fil).
  Steg 01/02 håndterer begge oppsettene.
- **Kartverket henger etter på navn:** Steg 01 henter SSBs kommune- og fylkesnavn, og steg 02 bruker
  SSBs navn når det er endret etter Kartverkets uttrekk eller har flere språk (f.eks. «Oslo - Oslove»).
- **Lint:** `react-hooks` forbyr å lese refs under rendering, og `react-refresh` krever at
  komponentfiler bare eksporterer komponenter – hjelpefunksjoner hører hjemme i `src/lib/`.
- **Bash på Windows:** heredocs med mange anførselstegn og `${…}` blir lett feiltolket; skriv heller
  et skript til fil og kjør det.

## Årlig dataoppdatering (ved nyttår)

Kommuner, grunnkretser og navn endres som regel 1. januar.

1. Slett `data-pipeline/raw/` og kjør `npm run data:build`.
2. Les kontrollene i utskriften: kommuner uten distrikt (SSB-tabeller som ikke er oppdatert ennå),
   arealkontrollen for grunnkretser, og hvilke navn som er hentet fra SSB.
3. **BA-regionene** (`data-pipeline/source/bo_og_arbeidsmarkedsregioner_2024.csv`) er TØIs inndeling
   fra 2019, kodet om til kommunestrukturen 2024. Endres kommunestrukturen, må tabellen kodes om
   (nye kommunenumre, sammenslåinger, delinger) – ellers stopper steg 05.
4. Sammenlign med forrige versjon (antall lag, kommuner, endrede felter), oppdater «Kartdata 2026»
   (`KARTDATA_AAR` i `src/components/Header.tsx`) og lasteteksten med filstørrelsen i `App.tsx`.
5. `npx tsc -b && npx eslint . && npm run build`, commit, `npm run deploy`.

## Praktisk

- Push og publisering krever GitHub-kontoen **jahili** (`gh auth switch` hvis en annen er aktiv).
- Ingen CI: bygging og publisering skjer lokalt med `npm run deploy`.
- Åpne oppgaver ligger som issues på GitHub.
