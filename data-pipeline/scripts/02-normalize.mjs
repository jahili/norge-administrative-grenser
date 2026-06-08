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

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rawDir = path.join(__dirname, '..', 'raw')
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
