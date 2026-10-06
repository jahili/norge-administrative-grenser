# Datapipeline

Bygger `src/assets/norge-grenser.topojson`, den eneste geografiske datafilen
appen bruker. Alt skjer offline mot ferdig nedlastede filer — appen selv gjør
ingen kall til Geonorge, SSB, DSB eller andre API-er.

## Kjøre hele pipelinen

```sh
npm run data:build
```

Dette kjører, i rekkefølge:

| Steg | Script | Hva det gjør |
| --- | --- | --- |
| 1 | `data:download` | Laster ned kommune- og fylkedatasettene fra Geonorge (`data-pipeline/raw/`) |
| 2 | `data:normalize` | Renser bort alle felter unntatt `kommunenummer`, `kommunenavn`, `fylkesnummer`, `fylkesnavn` (`data-pipeline/work/`) |
| 3 | `data:topology` | Slår sammen til delt topologi, forenkler geometrien til ~5 % og skriver TopoJSON med presimplifiseringsdata |
| 4 | `data:copy` | Kopierer resultatet til `src/assets/norge-grenser.topojson` |
| 5 | `data:distrikter` | Merker kommunene med politidistrikt (SSB) og 110-distrikt (DSB), og legger til distriktlag slått sammen av kommunene, direkte i `src/assets/norge-grenser.topojson` |

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
- **Navnenormalisering**: Geonorges `fylkesnavn` er noen ganger en
  bindestrek-separert liste over offisielle navn på flere språk
  (f.eks. «Troms - Romsa - Tromssa»). Vi bruker i stedet det primære norske
  navnet fra `administrativenhetnavn`-feltet — vesentlig triveligere i lister,
  filnavn og på kartet.
- **Forenkling og delt topologi**: Fylke- og kommunelagene importeres sammen
  («combine-files») slik at mapshaper bygger delt topologi — sammenfallende
  grenser får identiske koordinater. Forenkling av denne delte topologien
  (Visvalingam, ~5 %, `keep-shapes` så små kommuner som Utsira ikke
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
- **Politidistrikter og 110-distrikter (steg 5)**: Begge består av hele
  kommuner, så i stedet for egen geometri merkes hver kommune med distriktet
  sitt, og distriktlagene bygges med `topojson-client`s `mergeArcs`. De
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
