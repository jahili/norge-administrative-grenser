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

import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rawDir = path.join(__dirname, '..', 'raw')
const workDir = path.join(__dirname, '..', 'work')

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

const kommuneFeatures = kommuneRaw.features.map((feature) => {
  const kommunenummer = feature.properties.kommunenummer
  const kommunenavn = primaryName(feature.properties, 'kommunenavn')
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
    geometry: feature.geometry,
  }
})

fylkeFeatures.sort((a, b) => a.properties.fylkesnummer.localeCompare(b.properties.fylkesnummer))
kommuneFeatures.sort((a, b) =>
  a.properties.kommunenummer.localeCompare(b.properties.kommunenummer),
)

await writeFile(
  path.join(workDir, 'fylker.geojson'),
  JSON.stringify({ type: 'FeatureCollection', features: fylkeFeatures }),
)
await writeFile(
  path.join(workDir, 'kommuner.geojson'),
  JSON.stringify({ type: 'FeatureCollection', features: kommuneFeatures }),
)

console.log(`[done] normalized ${fylkeFeatures.length} fylker and ${kommuneFeatures.length} kommuner`)
