# Datapipeline

Bygger `src/assets/norge-grenser.topojson`, hovedfilen appen laster ved
oppstart, og grunnkretsfilene i `src/assets/grunnkretser/` som appen bare
henter ved behov. Alt skjer offline mot ferdig nedlastede filer — appen selv gjør
ingen kall til Geonorge, SSB, DSB eller andre API-er.

## Kjøre hele pipelinen

```sh
npm run data:build
```

Dette kjører, i rekkefølge:

| Steg | Script | Hva det gjør |
| --- | --- | --- |
| 1 | `data:download` | Laster ned kommune- og fylkedatasettene fra Geonorge, og SSBs kommune- og fylkesnavn (`data-pipeline/raw/`) |
| 2 | `data:normalize` | Renser bort alle felter unntatt nummer og navn for kommune og fylke (norsk og fullt offisielt navn) (`data-pipeline/work/`) |
| 3 | `data:topology` | Slår sammen til delt topologi, forenkler geometrien til ~20 % og skriver TopoJSON med presimplifiseringsdata |
| 4 | `data:copy` | Kopierer resultatet til `src/assets/norge-grenser.topojson` |
| 5 | `data:distrikter` | Merker kommunene med distriktene sine i elleve inndelinger (SSB, og DSB for 110), og legger til distriktlag slått sammen av kommunene, direkte i `src/assets/norge-grenser.topojson` |
| 6 | `data:grunnkretser` | Bygger én fil per fylke med grunnkretser og delområder (`src/assets/grunnkretser/<fylkesnummer>.topojson` + `index.json`), med og uten havgrense |

`data-pipeline/raw/` og `data-pipeline/work/` er mellomlagre (gitignored —
se `.gitignore`) og kan trygt slettes; de bygges på nytt neste gang pipelinen
kjøres.

## Beslutninger verdt å vite om

- **Kilde og koordinatsystem**: Vi laster ned Geonorges "hele Norge"-filer i
  EPSG:4258 (ETRS89, geografisk lat/lon), ikke EPSG:25833 (UTM). For
  Fastlands-Norge er forskjellen mellom EPSG:4258 og WGS84 (EPSG:4326) på
  centimeter-nivå — godt innenfor det som er relevant for visualisering eller
  forenkling. Dermed trengs ingen reprojisering: koordinatene kan brukes som
  WGS84 direkte, slik GeoJSON (RFC 7946) uansett forutsetter. Hvis Geonorge
  slutter å tilby direkte nedlasting, er det dokumentert en fallback til
  Kartverkets WFS i `scripts/01-download.mjs` (krever da en GML→GeoJSON-
  konvertering, f.eks. via `ogr2ogr`, siden WFS-tjenesten kun returnerer GML).
- **Navnenormalisering**: 22 kommuner og 5 fylker har offisielle navn på flere
  språk (f.eks. «Guovdageaidnu - Kautokeino», «Troms - Romsa - Tromssa»).
  `kommunenavn`/`fylkesnavn` er det norske navnet fra
  `administrativenhetnavn`-feltet — triveligere i lister, filnavn og på
  kartet — mens `kommunenavnOffisielt`/`fylkesnavnOffisielt` har det fulle
  offisielle navnet med samiske og kvenske navn, i offisiell rekkefølge.
  Kartverkets uttrekk kan henge etter de offisielle navnene, så steg 1 henter
  SSBs navn per uttrekksdato og per i dag, og steg 2 bruker SSBs navn når
  enten SSB-navnet er endret etter uttrekket og Kartverket har det gamle (Oslo
  ble «Oslo - Oslove» 1.1.2026), eller SSB-navnet er Kartverkets navn pluss
  flere språk (samiske navn vedtatt i 2024 for Rana, Sørfold, Levanger og
  Gratangen). Andre avvik beholder Kartverkets navn: SSB skriver f.eks.
  «Herøy (Nordland)», har annen rekkefølge for Røros og mangler «ŋ» i Porsanger.
  Når Kartverket oppdaterer, slutter overstyringen av seg selv.
- **Forenkling og delt topologi**: Fylke- og kommunelagene importeres sammen
  («combine-files») slik at mapshaper bygger delt topologi — sammenfallende
  grenser får identiske koordinater. Forenkling av denne delte topologien
  (Visvalingam, ~20 %, `keep-shapes` så små kommuner som Utsira ikke
  forsvinner) holder nabogrenser justert, uten gap eller overlapp.
- **`presimplify` i stedet for flere oppløsninger**: Output skrives med
  mapshapers `presimplify`-flagg, som merker hvert arc-punkt med terskelen det
  ville blitt fjernet ved (samme spesifikasjon som pakken `topojson-simplify`
  bruker). Dermed kan appen by på en "juster detaljnivå"-glidebryter helt i
  nettleseren — `topojson-simplify`s `simplify()` forenkler videre fra det
  bunte datasettet, uten at vi må sende med flere ferdig-forenklede versjoner
  eller kjøre mapshaper i nettleseren.
- **`geo2topo` droppet**: Planen nevnte opprinnelig en egen konverterings-jobb
  med `geo2topo`. mapshapers innebygde TopoJSON-eksport gjør imidlertid jobben
  i samme steg som forenklingen — og gjenbruker topologien som allerede er
  bygget, som gir et ryddigere resultat enn å bygge topologi på nytt fra to
  uavhengig prosesserte filer. `geo2topo` er derfor ikke lenger en avhengighet.
- **Distriktinndelinger (steg 5)**: Alle består av hele kommuner, så i stedet
  for egen geometri merkes hver kommune med distriktet sitt, og distriktlagene
  bygges med `topojson-client`s `mergeArcs`. Inndelingene er listet i
  `DISTRIKTER` i skriptet: SSB-inndelinger med koblingstabell mot
  kommuneinndelingen (politidistrikt 109, valgdistrikt 543, økonomiske regioner
  108, helseregioner 105, familievern 557, barnevern 563, reiseliv 527, samiske
  valgkretser 581, sentralitet 128) eller fylkesinndelingen (landsdeler 106),
  og DSBs 110-distrikter. Sentralitet er en gruppering etter sentralitetsindeks,
  ikke geografiske regioner, så «distriktene» der er ikke sammenhengende. Er SSB-tabellen eldre enn dagens kommunenumre (helseregionene
  har bare tabell mot Kommuneinndeling 2020), oversettes kommunekodene med SSBs
  liste over kommuneendringer. De
  refererer dermed bare til kommunelagenes eksisterende buer: grensene sammenfaller
  nøyaktig, havgrense-valget virker automatisk, og filen vokser lite.
  Politidistrikt hentes fra SSBs nyeste koblingstabell mellom klassifikasjon 109
  og kommuneinndelingen. SSBs 110-klassifikasjon (427) er fra 2019 og har ingen
  kommunekobling, så 110-distriktene hentes fra DSBs Brannalarmsentraler-WFS og
  kommunene tilordnes etter arealoverlapp. Steget feiler heller enn å gjette hvis
  en kommune ikke ligger minst 98 % i ett distrikt.
  To fallgruver: `mergeArcs` kjøres mot en 2D-kopi av buene, fordi den ellers
  sammenligner endepunkter med og uten presimplify-vekten og aldri får lukket
  ringene. Og steget skriver rett i `src/assets/`-filen og er idempotent, så det
  kan kjøres alene uten å bygge geometrien på nytt.
- **Geonorges filformat**: Filene publisert fra juli 2026 har nye filnavn i
  zip-arkivene (`…_Fylker_…` i stedet for `…_Fylke_…`), er en vanlig
  FeatureCollection i stedet for å ligge under en `Fylke`-nøkkel, og blander
  flatene (`objtype` «Fylke»/«Kommune») med grenselinjene (`objtype`
  «Grense»). Steg 1 finner derfor GeoJSON-filen i arkivet selv, og steg 2
  godtar begge oppsettene og beholder bare flatene. Geometrien er uendret: et
  nytt bygg i oktober 2026 ga en byte-identisk fil.
- **Grunnkretser (steg 6)**: 14 126 grunnkretser er for mye å legge i
  hovedfilen uten at hele appen blir tregere, så de ligger i én fil per fylke
  (0,4–1,9 MB, totalt ~16 MB / ~4 MB komprimert) som appen bare henter når
  noen ber om grunnkretser. Kilden er Kartverkets «Statistiske enheter
  grunnkretser», hentet via Geonorges bestillings-API (datasettet har ingen
  fast nedlastingslenke), og delområdenavn fra SSBs klassifikasjon 1.
  Grunnkretsene følger kommunegrensene *med* havgrense; varianten langs
  kystlinjen klippes mot kommunene uten havgrense. Hele landet forenkles under
  ett (samme 20 % som hovedfilen) før det deles per fylke, slik at grenser
  mellom fylker er like i begge filene. Steget feiler hvis et grunnkretsnummer
  er ugyldig, duplisert eller ikke starter med kommunenummeret, hvis en kommune
  mangler grunnkretser eller delområdenavn, eller hvis grunnkretsene ikke
  dekker kommunens areal innenfor 0,5 % (med og uten havgrense).
  Fallgruve: mapshapers `-clip` endrer laget som klippes selv når resultatet
  legges i et nytt lag (`+ name=…`) — arealet i Ås og Årdal vokste 0,5–0,7 % —
  så klippingen gjøres i en egen kjøring. To grunnkretser (Feistein og
  Sjysletta) ligger helt i sjøen og finnes bare i varianten med havgrense.
  Delområdene (1 547) er grunnkretsene slått sammen per delområde med
  `mergeArcs`, som distriktene i steg 5, og deler derfor grenser nøyaktig med
  grunnkretsene. SSBs 1 906 delområdekoder inkluderer 358 «uoppgitt»
  (xxxx9900) og Svalbard.
  SSB lister i tillegg «Uoppgitt grunnkrets» (xxxx9999) per kommune og
  Svalbards tre grunnkretser; de har ingen geometri og er ikke med.
