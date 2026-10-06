# Norge – administrative grenser

En web-app for å velge norske **fylker, kommuner og bydeler** — eller **politidistrikter og
110-distrikter** — på et kart og laste dem ned
som GeoJSON eller TopoJSON — klare til bruk i Power BI, QGIS, Leaflet, D3 eller andre
kart- og analyseverktøy.

**Prøv appen:** <https://jahili.github.io/norge-administrative-grenser/>

## Hva kan du gjøre?

- Velge ett eller flere **fylker**, deretter **kommuner**, og for seks byer også **bydeler**
  (Bergen, Fredrikstad, Kristiansand, Oslo, Stavanger og Trondheim)
- Gruppere etter **politidistrikter** eller **110-distrikter** i stedet for fylker — og
  velge kommuner og bydeler innenfor dem på samme måte
- Se utvalget på et kart før du laster ned
- Velge om grensene skal **følge kystlinjen** eller strekke seg ut til
  **territorialgrensen i havet** («havgrensen»)
- Justere **detaljnivået** på geometrien — full detalj for analyse, forenklet for
  raskere visualisering og mindre filer
- Laste ned som **GeoJSON** eller **TopoJSON** i WGS84 (EPSG:4326)

Nedlastingsnivået følger valgene dine: velger du bare et fylke får du fylkesgrensen,
velger du kommuner får du kommunene, og velger du bydeler får du bydelene. Velger du
inndelingen politidistrikter eller 110-distrikter, gjelder det samme: bare distrikter gir
distriktsgrensene, og velger du kommuner i dem, får du kommunene.

Alt skjer i nettleseren — ingen data sendes til noen server.

## Slik bruker du appen

1. **Velg fylker** — kryss av for de fylkene du er interessert i (eller bytt inndeling til
   politidistrikter eller 110-distrikter øverst, så grupperes kommunene etter dem i stedet)
2. **Velg kommuner** — kommunene i valgte fylker (eller distrikter) dukker opp, med søkefelt for store fylker.
   Kommuner med bydelsdata er merket med en liten prikk
3. **Velg bydeler** (valgfritt) — vises bare når en valgt kommune har bydeler
4. **Last ned** — velg format, juster filnavnet om du vil, og trykk på knappen

## Teknisk

### Stack

- [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vite.dev/)
- [Tailwind CSS v4](https://tailwindcss.com/) (mørk modus følger OS-innstillingen, med manuell overstyring)
- [Leaflet](https://leafletjs.com/) / react-leaflet for kartvisning, med Esris
  Light/Dark Gray Canvas som bakgrunnskart (krever ingen API-nøkkel)
- [topojson-client](https://github.com/topojson/topojson-client) og
  [topojson-server](https://github.com/topojson/topojson-server) for konvertering i nettleseren
- Selvhostet [Inter](https://rsms.me/inter/)-font (ingen eksterne font-kall)

### Arkitektur

Appen laster én ferdigbygd TopoJSON-fil (~3,7 MB) med ni lag som deler samme
buesett (arcs):

| Lag | Innhold |
| --- | --- |
| `fylker` | Fylkesgrenser med havgrense |
| `fylkerUtenHavgrense` | Fylkesgrenser klippet etter kystlinjen |
| `kommuner` | Kommunegrenser med havgrense |
| `kommunerUtenHavgrense` | Kommunegrenser klippet etter kystlinjen |
| `bydeler` | 68 bydeler/delområder i de seks byene |
| `politidistrikter` / `politidistrikterUtenHavgrense` | 12 politidistrikter, satt sammen av kommunene |
| `distrikter110` / `distrikter110UtenHavgrense` | 12 110-distrikter, satt sammen av kommunene |

Kommunelagene har i tillegg feltene `politidistriktnummer`, `politidistriktnavn`,
`distrikt110id` og `distrikt110navn`, så en kommuneeksport viser hvilket distrikt hver
kommune hører til.

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
npm run data:distrikter  # 05: legg politidistrikter og 110-distrikter til i src/assets/-filen
npm run data:build       # alle fem stegene i rekkefølge
```

Steg 05 kan kjøres alene mot den ferdigbygde filen. Det henter SSBs koblingstabell
mellom politidistrikt og kommune og DSBs 110-distrikter, merker hver kommune med
distriktene sine, og slår kommunene sammen til distriktlag (`topojson-client`s
`mergeArcs`) — slik at distriktene deler grenser nøyaktig med kommunene. DSB-polygonene
brukes bare til å avgjøre hvilket distrikt en kommune hører til (etter arealoverlapp);
steget feiler hvis en kommune ikke ligger minst 98 % i ett distrikt, eller hvis SSB-tabellen
ikke dekker nøyaktig de samme kommunene.

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
- **Politidistrikter:** [SSB, Standard for politidistrikt](https://www.ssb.no/klass/klassifikasjoner/109)
  (koblingstabell mot kommuneinndelingen)
- **110-distrikter:** [DSB, Brannalarmsentraler](https://kartkatalog.geonorge.no/metadata/c4436a5f-1e22-461a-8209-786f7052acb5)
  (SSBs egen 110-klassifikasjon er fra 2019 og mangler kobling mot kommuner)
- Klipping og konvertering av kildedata er gjort i [Mapshaper](https://mapshaper.org/)

Kartverkets data er tilgjengelig under åpen lisens (CC BY 4.0) — se
[Geonorge](https://kartkatalog.geonorge.no/) for vilkår per datasett.
