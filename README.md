# Norge – administrative grenser

En web-app for å velge norske **fylker, kommuner og bydeler** på et kart og laste dem ned
som GeoJSON eller TopoJSON — klare til bruk i Power BI, QGIS, Leaflet, D3 eller andre
kart- og analyseverktøy.

**Prøv appen:** <https://jahili.github.io/norge-administrative-grenser/>

## Hva kan du gjøre?

- Velge ett eller flere **fylker**, deretter **kommuner**, og for seks byer også **bydeler**
  (Bergen, Fredrikstad, Kristiansand, Oslo, Stavanger og Trondheim)
- Se utvalget på et kart før du laster ned
- Velge om grensene skal **følge kystlinjen** eller strekke seg ut til
  **territorialgrensen i havet** («havgrensen»)
- Justere **detaljnivået** på geometrien — full detalj for analyse, forenklet for
  raskere visualisering og mindre filer
- Laste ned som **GeoJSON** eller **TopoJSON** i WGS84 (EPSG:4326)

Nedlastingsnivået følger valgene dine: velger du bare et fylke får du fylkesgrensen,
velger du kommuner får du kommunene, og velger du bydeler får du bydelene.

Alt skjer i nettleseren — ingen data sendes til noen server.

## Slik bruker du appen

1. **Velg fylker** — kryss av for de fylkene du er interessert i
2. **Velg kommuner** — kommunene i valgte fylker dukker opp, med søkefelt for store fylker.
   Kommuner med bydelsdata er merket med en liten prikk
3. **Velg bydeler** (valgfritt) — vises bare når en valgt kommune har bydeler
4. **Last ned** — velg format, juster filnavnet om du vil, og trykk på knappen

## Teknisk

### Stack

- [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vite.dev/)
- [Tailwind CSS v4](https://tailwindcss.com/) (mørk modus følger OS-innstillingen, med manuell overstyring)
- [Leaflet](https://leafletjs.com/) / react-leaflet for kartvisning, med
  [CARTO](https://carto.com/attributions) Positron/Dark Matter som bakgrunnskart
- [topojson-client](https://github.com/topojson/topojson-client) og
  [topojson-server](https://github.com/topojson/topojson-server) for konvertering i nettleseren
- Selvhostet [Inter](https://rsms.me/inter/)-font (ingen eksterne font-kall)

### Arkitektur

Appen laster én ferdigbygd TopoJSON-fil (~3,2 MB) med fem lag som deler samme
buesett (arcs):

| Lag | Innhold |
| --- | --- |
| `fylker` | Fylkesgrenser med havgrense |
| `fylkerUtenHavgrense` | Fylkesgrenser klippet etter kystlinjen |
| `kommuner` | Kommunegrenser med havgrense |
| `kommunerUtenHavgrense` | Kommunegrenser klippet etter kystlinjen |
| `bydeler` | 68 bydeler/delområder i de seks byene |

Topologien er forhåndsprosessert med `presimplify`, slik at detaljnivå-slideren kan
forenkle geometrien direkte i nettleseren uten ny nedlasting. Ved nedlasting bygges en
frisk TopoJSON (eller GeoJSON) av kun de valgte områdene.

### Datapipeline

Kildedataene bearbeides av skript i `data-pipeline/`:

```bash
npm run data:download    # 01: last ned kildedata
npm run data:normalize   # 02: normaliser til felles skjema (fylker, kommuner, bydeler)
npm run data:topology    # 03: bygg delt topologi med mapshaper + presimplify
npm run data:copy        # 04: kopier resultatet inn i appen (src/assets/)
npm run data:build       # alle fire stegene i rekkefølge
```

Normaliseringen håndterer at bydel-kildene har ulike skjemaer (bl.a. syntetiske
bydelsnumre for Fredrikstad og sammenslåing av Oslos to Marka-polygoner), og gir alle
bydeler et felles skjema: `bydelnummer`, `bydelnavn`, `kommunenummer`.

### Kjøre lokalt

```bash
npm install
npm run dev      # utviklingsserver
npm run build    # produksjonsbygg til dist/
npm run deploy   # publiser til GitHub Pages
```

## Datakilder

Grunnlagsdataene er samlet i [Kart-fylker-og-kommuner-json](https://github.com/jahili/Kart-fylker-og-kommuner-json)
— se den for full kildeoversikt. Kort oppsummert:

- **Fylkes- og kommunegrenser:** basert på GeoJSON utarbeidet av
  [Robert Hopland](https://github.com/robhop), som igjen bygger på
  [data fra Kartverket](https://kartkatalog.geonorge.no/)
- **Bydeler i Fredrikstad:** [Kartverket](https://kartkatalog.geonorge.no/)
- **Bydeler i Oslo:** Oslo kommune
- **Bydeler/delområder i Bergen, Stavanger, Trondheim og Kristiansand:** [SSB](https://kart.ssb.no/)
- Klipping og konvertering av kildedata er gjort i [Mapshaper](https://mapshaper.org/)

Kartverkets data er tilgjengelig under åpen lisens (CC BY 4.0) — se
[Geonorge](https://kartkatalog.geonorge.no/) for vilkår per datasett.
