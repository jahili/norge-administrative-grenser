// Reads the raw Geonorge GeoJSON for fylker and kommuner and rewrites each
// feature with a small, flat set of properties:
//   fylke:    fylkesnummer, fylkesnavn
//   kommune:  kommunenummer, kommunenavn, fylkesnummer, fylkesnavn
//
// Two normalizations worth calling out:
//
// 1. Geonorge's `fylkesnavn` is sometimes a hyphen-joined list of official
//    names in several languages, e.g. "Troms - Romsa - Tromssa" (Norwegian,
//    Northern Sami, Kven). That's unwieldy for display, lists and filenames,
//    so we use the primary Norwegian Bokmål/Nynorsk name from the
//    `administrativenhetnavn` array instead (falling back to the combined
//    string, split on " - ", if no "nor" entry exists).
//
// 2. The kommune dataset doesn't carry fylkesnummer/fylkesnavn directly.
//    Norway's kommunenummer encodes the fylke as its first two digits, so we
//    derive fylkesnummer from it and look up the matching fylke's name from
//    the (already-normalized) fylke dataset.
//
// The "uten havgrense" layers are user-provided Basisdata files (committed to
// data-pipeline/source/) clipped to the actual coastline. They share the same
// property format as the main Basisdata files, so the same normalization
// functions apply to both variants.

import { createRequire } from 'node:module'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { feature: topoFeature } = require('topojson-client')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rawDir = path.join(__dirname, '..', 'raw')
const sourceDir = path.join(__dirname, '..', 'source')
const workDir = path.join(__dirname, '..', 'work')
await mkdir(workDir, { recursive: true })

async function readGeonorgeCollection(file, wrapperKey) {
  const text = await readFile(path.join(rawDir, file), 'utf-8')
  const json = JSON.parse(text)
  return wrapperKey ? json[wrapperKey] : json
}

function primaryName(properties, combinedField) {
  const names = properties.administrativenhetnavn ?? []
  const norwegian = names.find((n) => n.sprak === 'nor')
  if (norwegian) return norwegian.navn
  const combined = properties[combinedField]
  return combined ? combined.split(' - ')[0] : combined
}

const fylkeRaw = await readGeonorgeCollection('fylker.geojson', 'Fylke')
const kommuneRaw = await readGeonorgeCollection('kommuner.geojson', null)

const fylkeFeatures = fylkeRaw.features.map((feature) => {
  const fylkesnummer = feature.properties.fylkesnummer
  const fylkesnavn = primaryName(feature.properties, 'fylkesnavn')
  return {
    type: 'Feature',
    properties: { fylkesnummer, fylkesnavn },
    geometry: feature.geometry,
  }
})

const fylkesnavnByNummer = new Map(
  fylkeFeatures.map((f) => [f.properties.fylkesnummer, f.properties.fylkesnavn]),
)

function normalizeKommune(kommunenummer, kommunenavn, geometry) {
  const fylkesnummer = kommunenummer.slice(0, 2)
  const fylkesnavn = fylkesnavnByNummer.get(fylkesnummer)
  if (!fylkesnavn) {
    throw new Error(
      `Kommune ${kommunenummer} (${kommunenavn}) has no matching fylke ${fylkesnummer}`,
    )
  }
  return {
    type: 'Feature',
    properties: { kommunenummer, kommunenavn, fylkesnummer, fylkesnavn },
    geometry,
  }
}

function byNummer(field) {
  return (a, b) => a.properties[field].localeCompare(b.properties[field])
}

const kommuneFeatures = kommuneRaw.features
  .map((feature) =>
    normalizeKommune(
      feature.properties.kommunenummer,
      primaryName(feature.properties, 'kommunenavn'),
      feature.geometry,
    ),
  )
  .sort(byNummer('kommunenummer'))

fylkeFeatures.sort(byNummer('fylkesnummer'))

await writeFile(
  path.join(workDir, 'fylker.geojson'),
  JSON.stringify({ type: 'FeatureCollection', features: fylkeFeatures }),
)
await writeFile(
  path.join(workDir, 'kommuner.geojson'),
  JSON.stringify({ type: 'FeatureCollection', features: kommuneFeatures }),
)

console.log(`[done] normalized ${fylkeFeatures.length} fylker and ${kommuneFeatures.length} kommuner`)

// --- "Uten havgrense" layers (coastline-clipped, no maritime border extension) ---

const kommuneUtenRaw = await readGeonorgeCollection('kommuner-uten-havgrense.geojson', null)

const kommuneFeaturesUtenHavgrense = kommuneUtenRaw.features
  .map((feature) =>
    normalizeKommune(
      feature.properties.kommunenummer,
      primaryName(feature.properties, 'kommunenavn'),
      feature.geometry,
    ),
  )
  .sort(byNummer('kommunenummer'))

if (kommuneFeaturesUtenHavgrense.length !== kommuneFeatures.length) {
  throw new Error(
    `"Uten havgrense" kommune layer has ${kommuneFeaturesUtenHavgrense.length} features, ` +
      `expected ${kommuneFeatures.length} to match the main kommune layer`,
  )
}

await writeFile(
  path.join(workDir, 'kommuner-uten-havgrense.geojson'),
  JSON.stringify({ type: 'FeatureCollection', features: kommuneFeaturesUtenHavgrense }),
)

const fylkeUtenRaw = await readGeonorgeCollection('fylker-uten-havgrense.geojson', null)

const fylkeFeaturesUtenHavgrense = fylkeUtenRaw.features
  .map((feature) => ({
    type: 'Feature',
    properties: {
      fylkesnummer: feature.properties.fylkesnummer,
      fylkesnavn: primaryName(feature.properties, 'fylkesnavn'),
    },
    geometry: feature.geometry,
  }))
  .sort(byNummer('fylkesnummer'))

if (fylkeFeaturesUtenHavgrense.length !== fylkeFeatures.length) {
  throw new Error(
    `"Uten havgrense" fylke layer has ${fylkeFeaturesUtenHavgrense.length} features, ` +
      `expected ${fylkeFeatures.length} to match the main fylke layer`,
  )
}

await writeFile(
  path.join(workDir, 'fylker-uten-havgrense.geojson'),
  JSON.stringify({ type: 'FeatureCollection', features: fylkeFeaturesUtenHavgrense }),
)

console.log(
  `[done] normalized ${kommuneFeaturesUtenHavgrense.length} "uten havgrense" kommuner and ` +
    `${fylkeFeaturesUtenHavgrense.length} "uten havgrense" fylker`,
)

// --- Bydeler / delområder ---
//
// Six TopoJSON source files (committed to data-pipeline/source/bydeler/)
// cover 6 kommuner: Bergen, Fredrikstad, Kristiansand, Oslo, Stavanger,
// Trondheim. Each has a different property schema; we normalise all of them
// to: { bydelnummer, bydelnavn, kommunenummer }
//
// bydelnummer conventions by source:
//   Bergen / Stavanger / Trondheim  →  bydelnr field (e.g. "460107")
//                                       first 4 digits = kommunenummer
//   Oslo                            →  Kombinert field (e.g. "030117")
//                                       Marka is split into two polygons
//                                       (Nord + Øst) — merged into one
//                                       MultiPolygon here
//   Kristiansand                    →  delområdenummer (e.g. "420424")
//   Fredrikstad                     →  no official number (null) — we
//                                       synthesise "<kommunenummer><OBJECTID>"

async function readBydelTopo(filename) {
  const text = await readFile(path.join(sourceDir, 'bydeler', filename), 'utf-8')
  const topo = JSON.parse(text)
  const objectKey = Object.keys(topo.objects)[0]
  return topoFeature(topo, topo.objects[objectKey]).features
}

function mergeIntoMultiPolygon(geometries) {
  // Flatten multiple Polygon / MultiPolygon geometries into one MultiPolygon.
  const allRings = []
  for (const geom of geometries) {
    if (geom.type === 'Polygon') allRings.push(geom.coordinates)
    else if (geom.type === 'MultiPolygon') allRings.push(...geom.coordinates)
  }
  return { type: 'MultiPolygon', coordinates: allRings }
}

const bydelFeatures = []

// Bergen
for (const f of await readBydelTopo('bydeler-bergen.topojson')) {
  const { bydelnr, bydelnavn } = f.properties
  bydelFeatures.push({
    type: 'Feature',
    properties: { bydelnummer: bydelnr, bydelnavn, kommunenummer: bydelnr.slice(0, 4) },
    geometry: f.geometry,
  })
}

// Stavanger
for (const f of await readBydelTopo('bydeler-stavanger.topojson')) {
  const { bydelnr, bydelnavn } = f.properties
  bydelFeatures.push({
    type: 'Feature',
    properties: { bydelnummer: bydelnr, bydelnavn, kommunenummer: bydelnr.slice(0, 4) },
    geometry: f.geometry,
  })
}

// Trondheim
for (const f of await readBydelTopo('bydeler-trondheim.topojson')) {
  const { bydelnr, bydelnavn } = f.properties
  bydelFeatures.push({
    type: 'Feature',
    properties: { bydelnummer: bydelnr, bydelnavn, kommunenummer: bydelnr.slice(0, 4) },
    geometry: f.geometry,
  })
}

// Oslo — group by Kombinert to dissolve Marka Nord + Marka Øst into one feature
{
  const osloFeatures = await readBydelTopo('bydeler-oslo.topojson')
  const byKombinert = new Map()
  for (const f of osloFeatures) {
    const key = f.properties.Kombinert
    if (!byKombinert.has(key)) byKombinert.set(key, [])
    byKombinert.get(key).push(f)
  }
  for (const [kombinert, group] of byKombinert) {
    const geometry =
      group.length === 1
        ? group[0].geometry
        : mergeIntoMultiPolygon(group.map((f) => f.geometry))
    // For multi-polygon bydeler (Marka Nord + Øst) strip the directional suffix
    // to produce the canonical bydel name ("Marka").
    const rawNavn = group[0].properties.BYDELSNAVN
    const bydelnavn = group.length > 1 ? rawNavn.replace(/\s+(Nord|Øst|Vest|Sør)$/, '') : rawNavn
    bydelFeatures.push({
      type: 'Feature',
      properties: { bydelnummer: kombinert, bydelnavn, kommunenummer: group[0].properties.kommunenum },
      geometry,
    })
  }
}

// Kristiansand (delområder)
for (const f of await readBydelTopo('bydeler-kristiansand.topojson')) {
  const { delområdenummer, delområdenavn, kommunenummer } = f.properties
  bydelFeatures.push({
    type: 'Feature',
    properties: { bydelnummer: delområdenummer, bydelnavn: delområdenavn, kommunenummer },
    geometry: f.geometry,
  })
}

// Fredrikstad — BYDELSNUMMER is null for all features; synthesise from
// kommunenummer ("3107") + zero-padded OBJECTID.
{
  const FREDRIKSTAD_KOMMUNENUMMER = '3107'
  for (const f of await readBydelTopo('bydeler-fredrikstad.topojson')) {
    const { OBJECTID, BYDELSNAVN } = f.properties
    const bydelnavn = BYDELSNAVN.replace(/^Fredrikstad_/, '')
    const bydelnummer = FREDRIKSTAD_KOMMUNENUMMER + String(OBJECTID).padStart(2, '0')
    bydelFeatures.push({
      type: 'Feature',
      properties: { bydelnummer, bydelnavn, kommunenummer: FREDRIKSTAD_KOMMUNENUMMER },
      geometry: f.geometry,
    })
  }
}

bydelFeatures.sort((a, b) => a.properties.bydelnummer.localeCompare(b.properties.bydelnummer))

await writeFile(
  path.join(workDir, 'bydeler.geojson'),
  JSON.stringify({ type: 'FeatureCollection', features: bydelFeatures }),
)
console.log(`[done] normalized ${bydelFeatures.length} bydeler/delområder across 6 kommuner`)
