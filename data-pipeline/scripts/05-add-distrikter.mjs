// Adds politidistrikter and 110-distrikter to the bundled topology in
// src/assets/norge-grenser.topojson.
//
// Both divisions are made up of whole kommuner, so instead of shipping their
// own geometry we:
//
//   1. tag every kommune (both havgrense variants) with the politidistrikt and
//      110-distrikt it belongs to, and
//   2. build four new objects — politidistrikter, politidistrikterUtenHavgrense,
//      distrikter110, distrikter110UtenHavgrense — by merging those kommuner
//      with topojson-client's `mergeArcs`.
//
// `mergeArcs` only references the kommune layers' existing arcs, so the new
// layers share borders exactly with every other layer, follow the coastline
// toggle for free, and barely grow the file.
//
// Sources:
//   - Politidistrikt: SSB KLASS "Standard for politidistrikt" (classification
//     109), via its newest kommuneinndeling correspondence table.
//   - 110-distrikt: SSB's 110 classification (427) is stuck at the 2019
//     version with 14 sentraler and has no kommune correspondence, so we use
//     DSB's Brannalarmsentraler dataset, which carries the current districts as
//     polygons. Those polygons are only used to assign each kommune to a
//     district by area overlap; anything short of near-total overlap fails the
//     step rather than guessing.
//
// This step works on the already-built topology (rather than being folded into
// 02/03) and is idempotent: it overwrites the district fields and objects on
// every run.

import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const topojsonClient = require('topojson-client')
const mapshaper = require('mapshaper')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rawDir = path.join(__dirname, '..', 'raw')
const topologyFile = path.join(__dirname, '..', '..', 'src', 'assets', 'norge-grenser.topojson')

const KLASS_API = 'https://data.ssb.no/api/klass/v1'
const POLITIDISTRIKT_CLASSIFICATION_ID = 109
const DSB_110_WFS =
  'https://wfs.geonorge.no/skwms1/wfs.brannalarmsentraler?service=WFS&version=2.0.0&request=GetFeature&typeNames=app:Distrikt110'
/** Minimum share of a kommune's area that must fall inside one 110-distrikt. */
const MIN_110_SHARE = 0.98

await mkdir(rawDir, { recursive: true })

const topology = JSON.parse(await readFile(topologyFile, 'utf-8'))

// `mergeArcs` stitches arcs by stringifying their end points, but it reads the
// first point as stored ([x, y, weight] — the third value is the presimplify
// weight) and computes the last as [x, y], so with weighted arcs no two ends
// ever match. Merge against a 2D copy of the arcs instead; the result only
// references arc indices, so it applies unchanged to the real topology.
const topology2d = { ...topology, arcs: topology.arcs.map((arc) => arc.map(([x, y]) => [x, y])) }
const kommuneLayers = { med: topology.objects.kommuner, uten: topology.objects.kommunerUtenHavgrense }
const kommuner = kommuneLayers.med.geometries.map((g) => g.properties)

const politidistriktByKommune = await politidistriktAssignment()
const distrikt110ByKommune = await distrikt110Assignment()

for (const layer of Object.values(kommuneLayers)) {
  for (const geometry of layer.geometries) {
    const { kommunenummer, kommunenavn, fylkesnummer, fylkesnavn } = geometry.properties
    geometry.properties = {
      kommunenummer,
      kommunenavn,
      fylkesnummer,
      fylkesnavn,
      ...politidistriktByKommune.get(kommunenummer),
      ...distrikt110ByKommune.get(kommunenummer),
    }
  }
}

topology.objects.politidistrikter = mergeKommuner(kommuneLayers.med, 'politidistriktnummer', 'politidistriktnavn')
topology.objects.politidistrikterUtenHavgrense = mergeKommuner(
  kommuneLayers.uten,
  'politidistriktnummer',
  'politidistriktnavn',
)
topology.objects.distrikter110 = mergeKommuner(kommuneLayers.med, 'distrikt110id', 'distrikt110navn')
topology.objects.distrikter110UtenHavgrense = mergeKommuner(kommuneLayers.uten, 'distrikt110id', 'distrikt110navn')

await writeFile(topologyFile, JSON.stringify(topology))
console.log(
  `[done] wrote ${topology.objects.politidistrikter.geometries.length} politidistrikter and ` +
    `${topology.objects.distrikter110.geometries.length} 110-distrikter to ${path.relative(process.cwd(), topologyFile)}`,
)

/** One merged geometry per distinct `idField` value, sorted by name. */
function mergeKommuner(layer, idField, nameField) {
  const groups = new Map()
  for (const geometry of layer.geometries) {
    const id = geometry.properties[idField]
    const group = groups.get(id) ?? []
    group.push(geometry)
    groups.set(id, group)
  }
  const geometries = [...groups].map(([id, group]) => ({
    ...topojsonClient.mergeArcs(topology2d, group),
    properties: { [idField]: id, [nameField]: group[0].properties[nameField] },
  }))
  geometries.sort((a, b) => a.properties[nameField].localeCompare(b.properties[nameField], 'nb'))
  return { type: 'GeometryCollection', geometries }
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`)
  return response.json()
}

/** Downloads (once) SSB's newest politidistrikt ↔ kommune correspondence table. */
async function downloadPolitidistriktCorrespondence() {
  const finalPath = path.join(rawDir, 'politidistrikt-kommune.json')
  if (existsSync(finalPath)) {
    console.log('[skip] politidistrikt-kommune.json already present')
    return JSON.parse(await readFile(finalPath, 'utf-8'))
  }

  const classification = await fetchJson(`${KLASS_API}/classifications/${POLITIDISTRIKT_CLASSIFICATION_ID}`)
  const currentVersion = classification.versions.find((v) => !v.validTo)
  if (!currentVersion) throw new Error('No current version of the politidistrikt classification')
  const version = await fetchJson(currentVersion._links.self.href)

  const [newest] = version.correspondenceTables
    .map((table) => ({ table, year: Number(/Kommuneinndeling (\d{4})/.exec(table.name)?.[1]) }))
    .filter(({ year }) => year > 0)
    .sort((a, b) => b.year - a.year)
  if (!newest) throw new Error(`No kommune correspondence table in ${version.name}`)

  console.log(`[download] ${newest.table.name}`)
  const correspondence = await fetchJson(newest.table._links.self.href)
  const result = {
    source: newest.table.name,
    mappings: correspondence.correspondenceMaps.map((m) => ({
      politidistriktnummer: m.sourceCode,
      politidistriktnavn: m.sourceName,
      kommunenummer: m.targetCode,
    })),
  }
  await writeFile(finalPath, JSON.stringify(result, null, 2), 'utf-8')
  return result
}

/** Politidistrikt per kommunenummer; fails unless the table covers exactly our kommuner. */
async function politidistriktAssignment() {
  const { source, mappings } = await downloadPolitidistriktCorrespondence()
  const byKommune = new Map()
  for (const { kommunenummer, politidistriktnummer, politidistriktnavn } of mappings) {
    if (byKommune.has(kommunenummer)) {
      throw new Error(`Kommune ${kommunenummer} appears in more than one politidistrikt in "${source}"`)
    }
    byKommune.set(kommunenummer, { politidistriktnummer, politidistriktnavn })
  }

  const ours = new Set(kommuner.map((k) => k.kommunenummer))
  const missing = [...ours].filter((nr) => !byKommune.has(nr))
  const unknown = [...byKommune.keys()].filter((nr) => !ours.has(nr))
  if (missing.length > 0 || unknown.length > 0) {
    throw new Error(
      `"${source}" does not match the bundled kommuner — missing: ${missing.join(', ') || 'none'}, ` +
        `unknown: ${unknown.join(', ') || 'none'}. Delete data-pipeline/raw/politidistrikt-kommune.json ` +
        'to re-download, or wait for SSB to publish a table for the current kommuneinndeling.',
    )
  }

  console.log(`[done] assigned ${byKommune.size} kommuner to politidistrikter from "${source}"`)
  return byKommune
}

/**
 * Parses DSB's Distrikt110 GML. The features are plain Polygons in EPSG:4258
 * with lat/lon axis order, so a small targeted parser is enough — it throws on
 * anything else rather than silently dropping geometry.
 */
function parseDistrikt110Gml(gml) {
  const members = gml.match(/<app:Distrikt110 [\s\S]*?<\/app:Distrikt110>/g) ?? []
  return members.map((member) => {
    const distrikt110id = /<app:lokalId>([^<]+)</.exec(member)?.[1]
    const distrikt110navn = /<app:navn>([^<]+)</.exec(member)?.[1]
    const polygons = member.match(/<gml:Polygon[\s\S]*?<\/gml:Polygon>/g) ?? []
    if (!distrikt110id || !distrikt110navn || polygons.length !== 1 || /<gml:Multi/.test(member)) {
      throw new Error(`Unexpected Distrikt110 feature structure: ${member.slice(0, 300)}`)
    }
    if (!polygons[0].includes('srsName="urn:ogc:def:crs:EPSG::4258"')) {
      throw new Error(`Distrikt110 ${distrikt110navn} is not in EPSG:4258`)
    }
    const rings = [...polygons[0].matchAll(/<gml:posList[^>]*>([^<]+)</g)].map(([, posList]) => {
      const numbers = posList.trim().split(/\s+/).map(Number)
      const ring = []
      for (let i = 0; i < numbers.length; i += 2) ring.push([numbers[i + 1], numbers[i]])
      return ring
    })
    return {
      type: 'Feature',
      properties: { distrikt110id, distrikt110navn },
      geometry: { type: 'Polygon', coordinates: rings },
    }
  })
}

/** Downloads (once) DSB's 110-distrikt polygons as GeoJSON. */
async function downloadDistrikter110() {
  const finalPath = path.join(rawDir, 'distrikter110.geojson')
  if (existsSync(finalPath)) {
    console.log('[skip] distrikter110.geojson already present')
    return JSON.parse(await readFile(finalPath, 'utf-8'))
  }

  console.log(`[download] ${DSB_110_WFS}`)
  const response = await fetch(DSB_110_WFS)
  if (!response.ok) throw new Error(`Failed to download ${DSB_110_WFS}: HTTP ${response.status}`)
  const features = parseDistrikt110Gml(await response.text())
  if (features.length === 0) throw new Error('DSB WFS returned no Distrikt110 features')

  const collection = { type: 'FeatureCollection', features }
  await writeFile(finalPath, JSON.stringify(collection), 'utf-8')
  return collection
}

/** 110-distrikt per kommunenummer, by largest area overlap with DSB's polygons. */
async function distrikt110Assignment() {
  const distrikter = await downloadDistrikter110()
  const distriktById = new Map(distrikter.features.map((f) => [f.properties.distrikt110id, f.properties]))

  // The coastline-clipped kommuner, so open sea doesn't dilute the shares.
  const kommuneCollection = topojsonClient.feature(topology, kommuneLayers.uten)
  const output = await mapshaper.applyCommands(
    '-i kommuner.json distrikter.json combine-files ' +
      '-union fields=kommunenummer,distrikt110id ' +
      '-each "areal=this.area" ' +
      '-o union.json format=geojson',
    {
      'kommuner.json': {
        type: 'FeatureCollection',
        features: kommuneCollection.features.map((f) => ({
          type: 'Feature',
          properties: { kommunenummer: f.properties.kommunenummer },
          geometry: f.geometry,
        })),
      },
      'distrikter.json': distrikter,
    },
  )

  const arealByKommune = new Map()
  for (const { properties } of JSON.parse(output['union.json']).features) {
    if (!properties.kommunenummer) continue
    const byDistrikt = arealByKommune.get(properties.kommunenummer) ?? new Map()
    byDistrikt.set(properties.distrikt110id, (byDistrikt.get(properties.distrikt110id) ?? 0) + properties.areal)
    arealByKommune.set(properties.kommunenummer, byDistrikt)
  }

  const byKommune = new Map()
  const problems = []
  for (const { kommunenummer, kommunenavn } of kommuner) {
    const byDistrikt = arealByKommune.get(kommunenummer) ?? new Map()
    const total = [...byDistrikt.values()].reduce((sum, areal) => sum + areal, 0)
    const [bestId, bestAreal] = [...byDistrikt].filter(([id]) => id).sort((a, b) => b[1] - a[1])[0] ?? []
    const share = total > 0 && bestId ? bestAreal / total : 0
    if (share < MIN_110_SHARE) {
      problems.push(`${kommunenummer} ${kommunenavn} (${(share * 100).toFixed(1)} %)`)
      continue
    }
    byKommune.set(kommunenummer, { distrikt110id: bestId, distrikt110navn: distriktById.get(bestId).distrikt110navn })
  }
  if (problems.length > 0) {
    throw new Error(
      `These kommuner are not at least ${MIN_110_SHARE * 100} % inside one 110-distrikt: ${problems.join('; ')}`,
    )
  }

  const used = new Set([...byKommune.values()].map((v) => v.distrikt110id))
  const unused = [...distriktById.values()].filter((d) => !used.has(d.distrikt110id))
  if (unused.length > 0) {
    throw new Error(`110-distrikter without any kommune: ${unused.map((d) => d.distrikt110navn).join(', ')}`)
  }

  console.log(`[done] assigned ${byKommune.size} kommuner to ${distriktById.size} 110-distrikter`)
  return byKommune
}
