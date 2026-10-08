# Norge – administrative grenser

En web-app for å velge norske **fylker, kommuner og bydeler** — eller kommuner gruppert etter
**politidistrikter, valgdistrikter, helseregioner og åtte andre inndelinger** — på et kart og
laste dem ned
som GeoJSON eller TopoJSON — klare til bruk i Power BI, QGIS, Leaflet, D3 eller andre
kart- og analyseverktøy.

**Prøv appen:** <https://jahili.github.io/norge-administrative-grenser/>

## Hva kan du gjøre?

- Velge ett eller flere **fylker**, deretter **kommuner**, og for seks byer også **bydeler**
  (Bergen, Fredrikstad, Kristiansand, Oslo, Stavanger og Trondheim)
- Gruppere etter **politidistrikter**, **110-distrikter**, **valgdistrikter**, **økonomiske
  regioner**, **landsdeler**, **helseregioner**, **familievernregioner**, **barnevernsregioner**,
  **reiselivsregioner**, **samiske valgkretser** eller **sentralitet** i stedet for fylker — og
  velge kommuner og bydeler innenfor dem på samme måte
- Laste ned **grunnkretser** (SSBs minste statistiske enheter, 14 126 i hele landet) eller
  **delområder** (grupper av grunnkretser, 1 547) for de valgte kommunene, med mulighet til å utelate
  delområder
- Se utvalget på et kart før du laster ned
- Velge om grensene skal **følge kystlinjen** eller strekke seg ut til
  **territorialgrensen i havet** («havgrensen»)
- Justere **detaljnivået** på geometrien — full detalj for analyse, forenklet for
  raskere visualisering og mindre filer
- Laste ned som **GeoJSON** eller **TopoJSON** i WGS84 (EPSG:4326)

Nedlastingsnivået følger valgene dine: velger du bare et fylke får du fylkesgrensen,
velger du kommuner får du kommunene, og velger du bydeler får du bydelene. Velger du
en annen inndeling, for eksempel politidistrikter, gjelder det samme: bare distrikter gir
distriktsgrensene, og velger du kommuner i dem, får du kommunene.

Alt skjer i nettleseren — ingen data sendes til noen server.

## Slik bruker du appen

Sidekolonnen til venstre har fire steg, og kartet fyller resten av skjermen:

1. **Inndeling** — fylker (med kommuner og bydeler), eller en annen inndeling som
   politidistrikter, så grupperes kommunene etter den i stedet
2. **Fylker** (eller distrikter) — velg med knappene, eller klikk i kartet
3. **Kommuner** — kommunene i valgte fylker, med søk på navn eller nummer. Kommuner med
   bydelsdata er merket med en liten prikk. Under listen kan du velge **bydeler**, eller
   **grunnkretser og delområder** (og utelate delområder)
4. **Geometri** — følg kysten eller gå ut til havgrensen, og velg detaljnivå

**Last ned** nederst i sidekolonnen: velg format, juster filnavnet om du vil, og trykk på
knappen. I kartet kan du klikke på områder for å legge dem til i eller fjerne dem fra utvalget,
og **Data i filen** viser kolonnene og nøkkelkolonnen du kobler egne data på. På mobil ligger
kartet øverst og kontrollene i et panel med fanene Utvalg, Geometri og Kolonner.

## Teknisk

### Stack

- [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vite.dev/)
- [Tailwind CSS v4](https://tailwindcss.com/) (mørk modus følger OS-innstillingen, med manuell overstyring)
- [Leaflet](https://leafletjs.com/) / react-leaflet for kartvisning, med
  [CARTO](https://carto.com/attributions) Positron/Dark Matter som bakgrunnskart (gratis API-nøkkel
  fra [carto.com/basemaps/apikey](https://carto.com/basemaps/apikey/), satt i `src/components/MapPreview.tsx`)
- [topojson-client](https://github.com/topojson/topojson-client) og
  [topojson-server](https://github.com/topojson/topojson-server) for konvertering i nettleseren
- Selvhostede fonter: [Schibsted Grotesk](https://github.com/schibsted/schibsted-grotesk) og [JetBrains Mono](https://www.jetbrains.com/lp/mono/) (ingen eksterne font-kall)

### Arkitektur

Appen laster én ferdigbygd TopoJSON-fil (~5,6 MB, ~1,8 MB komprimert) med 27 lag som
deler samme buesett (arcs):

| Lag | Innhold |
| --- | --- |
| `fylker` | Fylkesgrenser med havgrense |
| `fylkerUtenHavgrense` | Fylkesgrenser klippet etter kystlinjen |
| `kommuner` | Kommunegrenser med havgrense |
| `kommunerUtenHavgrense` | Kommunegrenser klippet etter kystlinjen |
| `bydeler` | 68 bydeler/delområder i de seks byene |
| `politidistrikter` / `…UtenHavgrense` | 12 politidistrikter |
| `distrikter110` / `…UtenHavgrense` | 12 110-distrikter |
| `valgdistrikter` / `…UtenHavgrense` | 19 valgdistrikter (stortingsvalg) |
| `okonomiskeRegioner` / `…UtenHavgrense` | 85 økonomiske regioner |
| `landsdeler` / `…UtenHavgrense` | 6 landsdeler |
| `helseregioner` / `…UtenHavgrense` | 4 helseregioner |
| `familievernregioner` / `…UtenHavgrense` | 5 familievernregioner (Bufetat) |
| `barnevernsregioner` / `…UtenHavgrense` | 6 barnevernsregioner (Bufetat, Oslo egen region) |
| `reiselivsregioner` / `…UtenHavgrense` | 65 reiselivsregioner |
| `samiskeValgkretser` / `…UtenHavgrense` | 7 samiske valgkretser (sametingsvalg) |
| `sentralitet` / `…UtenHavgrense` | 6 sentralitetsgrupper — ikke sammenhengende områder, men alle kommuner med samme sentralitet |
| `baregioner` / `…UtenHavgrense` | 159 bo- og arbeidsmarkedsregioner (TØI, kodet om til 2024, se under) |

Distriktlagene er satt sammen av kommunene. Kommunelagene har i tillegg et nummer- og
navnefelt per inndeling (`politidistriktnummer`/`politidistriktnavn`, `distrikt110id`/`distrikt110navn`,
`valgdistriktnummer`/`valgdistriktnavn`, `okonomiskregionnummer`/`okonomiskregionnavn`,
`landsdelnummer`/`landsdelnavn`, `helseregionnummer`/`helseregionnavn` osv., se `DISTRIKT_KINDS`
i `src/lib/distrikter.ts`), så en kommuneeksport viser hvilke distrikter hver kommune hører til.

Grunnkretsene og delområdene ligger ikke i denne filen, men i én fil per fylke
(`src/assets/grunnkretser/`, 0,4–1,9 MB) som appen bare henter når noen slår på grunnkretser for
kommuner i fylket. Resten av
appen blir dermed ikke tregere av dem. Grunnkretsene får kommune- og fylkesfeltene (og distriktet
når man grupperer etter en inndeling) fra hovedfilen ved nedlasting, og forenkles med samme
terskel som hovedfilen. Store utvalg (over 2 000 områder) bygges først når man trykker last ned.

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
npm run data:distrikter  # 05: legg distriktlagene (politi, 110, valg m.fl.) til i src/assets/-filen
npm run data:grunnkretser # 06: bygg grunnkretsfilene, én per fylke (src/assets/grunnkretser/)
npm run data:build       # alle seks stegene i rekkefølge
```

Steg 05 kan kjøres alene mot den ferdigbygde filen. Det henter SSBs koblingstabeller mot
kommune- eller fylkesinndelingen og DSBs 110-distrikter, merker hver kommune med
distriktene sine, og slår kommunene sammen til distriktlag (`topojson-client`s
`mergeArcs`) — slik at distriktene deler grenser nøyaktig med kommunene. Inndelingene er
beskrevet i én liste (`DISTRIKTER`) i skriptet; en ny SSB-inndeling er én oppføring der og
én i `src/lib/distrikter.ts`. Steget feiler hvis en kommune mangler distrikt, ligger i flere,
eller (for 110) ikke ligger minst 98 % i ett DSB-distrikt.

Kommuner og fylker har både norsk navn (`kommunenavn`/`fylkesnavn`) og fullt offisielt navn med
samiske og kvenske navn (`kommunenavnOffisielt`/`fylkesnavnOffisielt`, f.eks.
«Guovdageaidnu - Kautokeino»). Normaliseringen håndterer også at bydel-kildene har ulike skjemaer (bl.a. syntetiske
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
- **Politidistrikter, valgdistrikter, økonomiske regioner, helseregioner, familievern- og
  barnevernsregioner, reiselivsregioner, samiske valgkretser og sentralitet:** SSBs klassifikasjoner
  [109](https://www.ssb.no/klass/klassifikasjoner/109), [543](https://www.ssb.no/klass/klassifikasjoner/543),
  [108](https://www.ssb.no/klass/klassifikasjoner/108), [105](https://www.ssb.no/klass/klassifikasjoner/105),
  [557](https://www.ssb.no/klass/klassifikasjoner/557), [563](https://www.ssb.no/klass/klassifikasjoner/563),
  [527](https://www.ssb.no/klass/klassifikasjoner/527), [581](https://www.ssb.no/klass/klassifikasjoner/581) og
  [128](https://www.ssb.no/klass/klassifikasjoner/128) (koblingstabeller mot kommuneinndelingen;
  helseregionenes tabell er fra 2020 og oversettes til dagens kommunenumre med SSBs liste over
  kommuneendringer)
- **Bo- og arbeidsmarkedsregioner:** [Transportøkonomisk institutt (TØI), «Inndeling av kommuner i
  bo- og arbeidsmarkedsregioner»](https://www.regjeringen.no/no/dokumenter/inndeling-av-kommuner-i-bo--og-arbeidsmarkedsregioner/id2662614/),
  på oppdrag fra Kommunal- og moderniseringsdepartementet (2019) — 159 BA-regioner for
  kommunestrukturen 2020 ([rapport](https://www.regjeringen.no/contentassets/735944a205424d14afef809bc039d76b/inndeling_ba-regioner_2020.pdf),
  [regneark](https://www.regjeringen.no/contentassets/735944a205424d14afef809bc039d76b/baregioner_2020.xlsx)).
  Inndelingen er kodet om til kommunestrukturen og kommunenumrene fra 2024, og Haram
  (skilt ut fra Ålesund i 2024) er plassert i Ålesund-regionen
  ([`data-pipeline/source/bo_og_arbeidsmarkedsregioner_2024.csv`](data-pipeline/source/bo_og_arbeidsmarkedsregioner_2024.csv)).
  Tabellen har også TØIs reisetid, pendling og inkluderingsgrunnlag per kommune; appen bruker bare
  regionen
- **Landsdeler:** [SSB, Standard for landsdelsinndeling](https://www.ssb.no/klass/klassifikasjoner/106)
  (koblingstabell mot fylkesinndelingen)
- **110-distrikter:** [DSB, Brannalarmsentraler](https://kartkatalog.geonorge.no/metadata/c4436a5f-1e22-461a-8209-786f7052acb5)
  (SSBs egen 110-klassifikasjon er fra 2019 og mangler kobling mot kommuner)
- Klipping og konvertering av kildedata er gjort i [Mapshaper](https://mapshaper.org/)

Kartverkets data er tilgjengelig under åpen lisens (CC BY 4.0) — se
[Geonorge](https://kartkatalog.geonorge.no/) for vilkår per datasett.
