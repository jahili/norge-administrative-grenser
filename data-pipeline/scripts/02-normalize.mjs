// Reads the raw Geonorge GeoJSON for fylker and kommuner and rewrites each
// feature with a small, flat set of properties:
//   fylke:    fylkesnummer, fylkesnavn, fylkesnavnOffisielt
//   kommune:  kommunenummer, kommunenavn, kommunenavnOffisielt,
//             fylkesnummer, fylkesnavn, fylkesnavnOffisielt
//
// Two normalizations worth calling out:
//
// 1. 22 kommuner and 5 fylker have official names in several languages, e.g.
//    "Guovdageaidnu - Kautokeino" or "Troms - Romsa - Tromssa" (Norwegian,
//    Sami languages, Kven). That's unwieldy for display, lists and filenames,
//    so `kommunenavn`/`fylkesnavn` is the Norwegian name from the
//    `administrativenhetnavn` array, while `…Offisielt` keeps the full
//    official name — every language, in the official order (`rekkefolge`).
//    Kartverket's extract can lag behind the official names, so SSB's name
//    (raw/ssb-navn.json, from 01-download) is used instead when either
//      - SSB renamed the code after the extract and Kartverket still has the
//        old name (Oslo became "Oslo - Oslove" on 2026-01-01), or
//      - SSB's name is Kartverket's names plus more languages (the Sami names
//        adopted in 2024 for Rana, Sørfold, Levanger and Gratangen).
//    Other differences are left alone: SSB adds disambiguations like
//    "Herøy (Nordland)", orders some names differently, and lacks letters such
//    as "ŋ" — Kartverket is right about those.
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
import { existsSync } from 'node:fs'
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

/**
 * Reads a Geonorge collection and keeps only the area features of `objtype`.
 *
 * Geonorge has shipped two layouts: older files wrapped the areas in a key
 * named after the object type (`{ "Fylke": { features } }`), while the files
 * published from July 2026 are a plain FeatureCollection that mixes the areas
 * ("Fylke"/"Kommune" MultiPolygons) with their border lines ("Grense"
 * LineStrings). Accept both, and drop everything that isn't an area of the
 * requested type. Features without `objtype` are kept, for sources that don't
 * carry it.
 */
async function readGeonorgeCollection(file, objtype) {
  const text = await readFile(path.join(rawDir, file), 'utf-8')
  const json = JSON.parse(text)
  const collection = json.features ? json : json[objtype]
  if (!collection?.features) throw new Error(`${file}: found neither "features" nor a "${objtype}" collection`)
  return {
    ...collection,
    features: collection.features.filter((f) => !f.properties.objtype || f.properties.objtype === objtype),
  }
}

function primaryName(properties, combinedField) {
  const names = properties.administrativenhetnavn ?? []
  const norwegian = names.find((n) => n.sprak === 'nor')
  if (norwegian) return norwegian.navn
  const combined = properties[combinedField]
  return combined ? combined.split(' - ')[0] : combined
}

const ssbNavnPath = path.join(rawDir, 'ssb-navn.json')
const ssbNavn = existsSync(ssbNavnPath)
  ? JSON.parse(await readFile(ssbNavnPath, 'utf-8'))
  : (console.warn('[warn] raw/ssb-navn.json missing; using Kartverket\'s names only'), { kommuner: {}, fylker: {} })
const navnFraSsb = new Set()

/**
 * The full official name: every language's name, in the official order —
 * or SSB's name, when Kartverket's extract is behind (see the top comment).
 */
function officialName(properties, combinedField, level, code) {
  const names = [...(properties.administrativenhetnavn ?? [])]
  const kartverket =
    names.length === 0
      ? properties[combinedField]
      : names
          .sort((a, b) => Number(a.rekkefolge) - Number(b.rekkefolge))
          .map((n) => n.navn)
          .join(' - ')
  const ssb = ssbNavn[level][code]
  if (!ssb || ssb.naa === kartverket) return kartverket

  const renamedAfterExtract = ssb.vedUttak !== ssb.naa && ssb.vedUttak === kartverket
  const kartverketParts = new Set(kartverket.split(' - '))
  const ssbParts = new Set(ssb.naa.split(' - '))
  const moreLanguages =
    ssbParts.size > kartverketParts.size && [...kartverketParts].every((part) => ssbParts.has(part))
  if (!renamedAfterExtract && !moreLanguages) return kartverket

  navnFraSsb.add(`${code} "${kartverket}" → "${ssb.naa}"`)
  return ssb.naa
}

const fylkeRaw = await readGeonorgeCollection('fylker.geojson', 'Fylke')
const kommuneRaw = await readGeonorgeCollection('kommuner.geojson', 'Kommune')

const fylkeFeatures = fylkeRaw.features.map((feature) => {
  const fylkesnummer = feature.properties.fylkesnummer
  const fylkesnavn = primaryName(feature.properties, 'fylkesnavn')
  const fylkesnavnOffisielt = officialName(feature.properties, 'fylkesnavn', 'fylker', fylkesnummer)
  return {
    type: 'Feature',
    properties: { fylkesnummer, fylkesnavn, fylkesnavnOffisielt },
    geometry: feature.geometry,
  }
})

const fylkeByNummer = new Map(fylkeFeatures.map((f) => [f.properties.fylkesnummer, f.properties]))

function normalizeKommune(properties, geometry) {
  const { kommunenummer } = properties
  const kommunenavn = primaryName(properties, 'kommunenavn')
  const kommunenavnOffisielt = officialName(properties, 'kommunenavn', 'kommuner', kommunenummer)
  const fylkesnummer = kommunenummer.slice(0, 2)
  const fylke = fylkeByNummer.get(fylkesnummer)
  if (!fylke) {
    throw new Error(
      `Kommune ${kommunenummer} (${kommunenavn}) has no matching fylke ${fylkesnummer}`,
    )
  }
  return {
    type: 'Feature',
    properties: {
      kommunenummer,
      kommunenavn,
      kommunenavnOffisielt,
      fylkesnummer,
      fylkesnavn: fylke.fylkesnavn,
      fylkesnavnOffisielt: fylke.fylkesnavnOffisielt,
    },
    geometry,
  }
}

function byNummer(field) {
  return (a, b) => a.properties[field].localeCompare(b.properties[field])
}

const kommuneFeatures = kommuneRaw.features
  .map((feature) => normalizeKommune(feature.properties, feature.geometry))
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
if (navnFraSsb.size > 0) {
  console.log(`[done] official names from SSB, where Kartverket's extract is behind: ${[...navnFraSsb].join('; ')}`)
}

// --- "Uten havgrense" layers (coastline-clipped, no maritime border extension) ---

const kommuneUtenRaw = await readGeonorgeCollection('kommuner-uten-havgrense.geojson', 'Kommune')

const kommuneFeaturesUtenHavgrense = kommuneUtenRaw.features
  .map((feature) => normalizeKommune(feature.properties, feature.geometry))
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

const fylkeUtenRaw = await readGeonorgeCollection('fylker-uten-havgrense.geojson', 'Fylke')

const fylkeFeaturesUtenHavgrense = fylkeUtenRaw.features
  .map((feature) => ({
    type: 'Feature',
    properties: {
      fylkesnummer: feature.properties.fylkesnummer,
      fylkesnavn: primaryName(feature.properties, 'fylkesnavn'),
      fylkesnavnOffisielt: officialName(feature.properties, 'fylkesnavn', 'fylker', feature.properties.fylkesnummer),
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
