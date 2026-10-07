// Builds the grunnkrets files the app loads on demand, one per fylke:
// src/assets/grunnkretser/<fylkesnummer>.topojson, plus index.json.
//
// Grunnkretser (14 000+) are far too many to bundle with the main topology
// without slowing down everything else, so they live in separate files that
// the app only fetches for the fylker a user actually wants grunnkretser in.
//
// Each file holds four objects sharing one set of arcs:
//   - grunnkretser:              as published, extending out to the
//                                havgrense like the kommune borders do
//   - grunnkretserUtenHavgrense: clipped to the coastline (the same land
//                                mask as kommunerUtenHavgrense), so the app's
//                                havgrense toggle works for grunnkretser too
//   - delomrader / delomraderUtenHavgrense: the grunnkretser merged per
//                                delområde (topojson-client's mergeArcs), so
//                                delområder share borders exactly with them
//
// Properties: grunnkretsnummer (8 digits: kommunenummer + delområde + krets),
// grunnkretsnavn, delomradenummer (the first 6 digits), delomradenavn,
// kommunenummer. Everything kommune-level (names, fylke, every district
// division) is joined from the main topology in the app instead of being
// repeated here.
//
// Sources:
//   - Kartverket "Statistiske enheter grunnkretser", whole country, GeoJSON in
//     EPSG:4258 — ordered through Geonorge's download API, which has no
//     fixed file URL for this dataset.
//   - Delområde names from SSB's "Standard for delområde- og
//     grunnkretsinndeling" (classification 1). SSB also lists one
//     "Uoppgitt grunnkrets" (xxxx9999) per kommune and Svalbard's three, which
//     have no geometry and are not included. Grunnkrets names are Kartverket's
//     (following the place name register); SSB often capitalises differently.
//
// The whole country is simplified in one go and only then split per fylke, so
// borders shared by neighbouring fylker are simplified identically in both
// files. Run after data:download (it needs the raw kommune layers for the
// coastline and the area check) and data:distrikter.
//
// Validation — the step fails rather than writing questionable data:
//   - every grunnkrets has a unique number starting with its kommunenummer,
//     and every kommune in the main topology has grunnkretser (and no others)
//   - every grunnkrets has a delområde name in SSB's classification
//   - per kommune, the grunnkretser cover the kommune's area (with havgrense)
//     and, once clipped, its coastline-clipped area

import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const mapshaper = require('mapshaper')
const topojsonClient = require('topojson-client')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rawDir = path.join(__dirname, '..', 'raw')
const outDir = path.join(__dirname, '..', '..', 'src', 'assets', 'grunnkretser')
const mainTopologyFile = path.join(__dirname, '..', '..', 'src', 'assets', 'norge-grenser.topojson')

const GRUNNKRETS_METADATA_UUID = '51d279f8-e2be-4f5e-9f72-1a53f7535ec1'
const DELOMRADE_CLASSIFICATION_ID = 1
/** Simplification matching the main topology (03-build-topology). */
const SIMPLIFY_PERCENT = '20%'
/** Allowed area mismatch per kommune between grunnkretser and the kommune. */
const MAX_AREA_DEVIATION = 0.005

await mkdir(rawDir, { recursive: true })

const mainTopology = JSON.parse(await readFile(mainTopologyFile, 'utf-8'))
const kommuner = new Map(mainTopology.objects.kommuner.geometries.map((g) => [g.properties.kommunenummer, g.properties]))

const raw = await downloadGrunnkretser()
const delomradenavn = await downloadDelomrader()

// --- Normalize and validate ---

const features = raw.features.map((feature) => {
  const { grunnkretsnummer, grunnkretsnavn, kommunenummer } = feature.properties
  const delomradenummer = grunnkretsnummer.slice(0, 6)
  return {
    type: 'Feature',
    properties: {
      grunnkretsnummer,
      grunnkretsnavn,
      delomradenummer,
      delomradenavn: delomradenavn.get(delomradenummer),
      kommunenummer,
      fylkesnummer: kommunenummer.slice(0, 2),
    },
    geometry: feature.geometry,
  }
})

const problems = []
const seen = new Set()
for (const { properties: p } of features) {
  if (!/^\d{8}$/.test(p.grunnkretsnummer)) problems.push(`invalid grunnkretsnummer "${p.grunnkretsnummer}"`)
  if (seen.has(p.grunnkretsnummer)) problems.push(`duplicate grunnkretsnummer ${p.grunnkretsnummer}`)
  seen.add(p.grunnkretsnummer)
  if (!p.grunnkretsnummer.startsWith(p.kommunenummer)) {
    problems.push(`${p.grunnkretsnummer} is not in its kommune ${p.kommunenummer}`)
  }
  if (!kommuner.has(p.kommunenummer)) problems.push(`${p.grunnkretsnummer} has unknown kommune ${p.kommunenummer}`)
  if (!p.delomradenavn) problems.push(`${p.grunnkretsnummer} has no delområde ${p.delomradenummer} in SSB`)
}
const kommunerMedGrunnkretser = new Set(features.map((f) => f.properties.kommunenummer))
for (const kommunenummer of kommuner.keys()) {
  if (!kommunerMedGrunnkretser.has(kommunenummer)) problems.push(`kommune ${kommunenummer} has no grunnkretser`)
}
failIf(problems, 'Grunnkrets data does not match the kommuner')
console.log(`[done] ${features.length} grunnkretser in ${kommunerMedGrunnkretser.size} kommuner, all with a delområde`)

// --- Clip, check areas, simplify and split per fylke ---

const kommuneLayer = await readKommuner('kommuner.geojson')
const kommuneUtenLayer = await readKommuner('kommuner-uten-havgrense.geojson')

// mapshaper's -clip alters the layer it clips even when the result goes to a
// new layer ("+ name=…"): grunnkretser in Ås and Årdal grew by 0.5–0.7 %. So
// the coastline-clipped copy is made in a run of its own, and the published
// grunnkretser are combined with it untouched in a second run.
console.log('[run] clipping to the coastline')
const clipped = await mapshaper.applyCommands(
  [
    '-i grunnkretser.json land.json combine-files',
    // The coastline: every kommune without havgrense, as one land mask.
    '-dissolve target=land',
    '-clip land target=grunnkretser',
    '-filter "!this.isNull" target=grunnkretser',
    '-o uten.json format=geojson target=grunnkretser',
  ].join(' '),
  { 'grunnkretser.json': { type: 'FeatureCollection', features }, 'land.json': kommuneUtenLayer },
)

console.log('[run] checking areas, simplifying')
const output = await mapshaper.applyCommands(
  [
    '-i grunnkretser.json grunnkretserUtenHavgrense.json kommuner.json kommunerUten.json combine-files',
    // Area of every grunnkrets and kommune, for the coverage check.
    '-each "areal=this.area" target=grunnkretser,grunnkretserUtenHavgrense,kommuner,kommunerUten',
    ...['grunnkretser', 'grunnkretserUtenHavgrense', 'kommuner', 'kommunerUten'].map(
      (layer) => `-o areal-${layer}.json format=json target=${layer}`,
    ),
    '-each "delete areal" target=grunnkretser,grunnkretserUtenHavgrense',
    `-simplify visvalingam keep-shapes ${SIMPLIFY_PERCENT} target=grunnkretser,grunnkretserUtenHavgrense`,
    '-o grunnkretser.topojson format=topojson presimplify quantization=1e5 target=grunnkretser,grunnkretserUtenHavgrense',
  ].join(' '),
  {
    'grunnkretser.json': { type: 'FeatureCollection', features },
    'grunnkretserUtenHavgrense.json': JSON.parse(clipped['uten.json']),
    'kommuner.json': kommuneLayer,
    'kommunerUten.json': kommuneUtenLayer,
  },
)

checkAreas((layer) => JSON.parse(output[`areal-${layer}.json`]))
const national = JSON.parse(output['grunnkretser.topojson'])
const utenCount = national.objects.grunnkretserUtenHavgrense.geometries.length
console.log(
  `[done] ${features.length - utenCount} grunnkretser lie entirely at sea and are left out of grunnkretserUtenHavgrense`,
)

// Delområder: the grunnkretser merged per delområde. As in 05-add-distrikter,
// mergeArcs runs on a 2D copy of the arcs, because it cannot stitch arcs that
// carry presimplify weights; the result only references arc indices.
const national2d = { ...national, arcs: national.arcs.map((arc) => arc.map(([x, y]) => [x, y])) }
for (const [source, target] of [
  ['grunnkretser', 'delomrader'],
  ['grunnkretserUtenHavgrense', 'delomraderUtenHavgrense'],
]) {
  const groups = new Map()
  for (const geometry of national.objects[source].geometries) {
    const group = groups.get(geometry.properties.delomradenummer) ?? []
    group.push(geometry)
    groups.set(geometry.properties.delomradenummer, group)
  }
  national.objects[target] = {
    type: 'GeometryCollection',
    geometries: [...groups.values()]
      .map((group) => {
        const { delomradenummer, delomradenavn, kommunenummer, fylkesnummer } = group[0].properties
        return {
          ...topojsonClient.mergeArcs(national2d, group),
          properties: { delomradenummer, delomradenavn, kommunenummer, fylkesnummer },
        }
      })
      .sort((a, b) => a.properties.delomradenummer.localeCompare(b.properties.delomradenummer)),
  }
}
console.log(
  `[done] merged grunnkretser into ${national.objects.delomrader.geometries.length} delområder ` +
    `(${national.objects.delomraderUtenHavgrense.geometries.length} without havgrense)`,
)

// Split the national topology per fylke, keeping only the arcs each file uses.
await rm(outDir, { recursive: true, force: true })
await mkdir(outDir, { recursive: true })
const index = {}
const fylker = [...new Set(features.map((f) => f.properties.fylkesnummer))].sort()
for (const fylkesnummer of fylker) {
  const topology = subsetTopology(national, (props) => props.fylkesnummer === fylkesnummer)
  const file = path.join(outDir, `${fylkesnummer}.topojson`)
  await writeFile(file, JSON.stringify(topology))
  const { size } = await stat(file)
  index[fylkesnummer] = {
    grunnkretser: topology.objects.grunnkretser.geometries.length,
    delomrader: topology.objects.delomrader.geometries.length,
    bytes: size,
  }
}
await writeFile(path.join(outDir, 'index.json'), JSON.stringify(index, null, 2))

const total = Object.values(index).reduce((sum, f) => sum + f.bytes, 0)
console.log(
  `[done] wrote ${fylker.length} fylke files to ${path.relative(process.cwd(), outDir)} ` +
    `(${(total / 1e6).toFixed(1)} MB in total; ` +
    Object.entries(index)
      .map(([nr, f]) => `${nr}: ${(f.bytes / 1e6).toFixed(2)} MB`)
      .join(', ') +
    ')',
)

// --- Helpers ---

function failIf(problems, heading) {
  if (problems.length === 0) return
  throw new Error(`${heading} (${problems.length}):\n  ${problems.slice(0, 20).join('\n  ')}`)
}

/** A raw Kartverket kommune layer from 01-download, reduced to kommunenummer. */
async function readKommuner(file) {
  const json = JSON.parse((await readFile(path.join(rawDir, file), 'utf-8')).replace(/^﻿/, ''))
  return {
    type: 'FeatureCollection',
    features: json.features
      .filter((f) => !f.properties.objtype || f.properties.objtype === 'Kommune')
      .map((f) => ({ type: 'Feature', properties: { kommunenummer: f.properties.kommunenummer }, geometry: f.geometry })),
  }
}

/** Per kommune, the grunnkretser must cover the kommune — with and without havgrense. */
function checkAreas(records) {
  const sumByKommune = (layer) => {
    const sums = new Map()
    for (const { kommunenummer, areal } of records(layer)) sums.set(kommunenummer, (sums.get(kommunenummer) ?? 0) + areal)
    return sums
  }
  const problems = []
  for (const [grunnkretsLayer, kommuneLayerName] of [
    ['grunnkretser', 'kommuner'],
    ['grunnkretserUtenHavgrense', 'kommunerUten'],
  ]) {
    const actualByKommune = sumByKommune(grunnkretsLayer)
    const expectedByKommune = sumByKommune(kommuneLayerName)
    for (const kommunenummer of kommuner.keys()) {
      const expected = expectedByKommune.get(kommunenummer)
      const actual = actualByKommune.get(kommunenummer) ?? 0
      if (!(Math.abs(actual - expected) / expected <= MAX_AREA_DEVIATION)) {
        problems.push(
          `${kommunenummer} ${kommuner.get(kommunenummer).kommunenavn}: grunnkretser cover ` +
            `${((actual / expected) * 100).toFixed(2)} % of the kommune (${kommuneLayerName}; ` +
            `${(actual / 1e6).toFixed(2)} vs ${(expected / 1e6).toFixed(2)} km², ` +
            `${records(grunnkretsLayer).filter((r) => r.kommunenummer === kommunenummer).length} grunnkretser, ` +
            `${records(kommuneLayerName).filter((r) => r.kommunenummer === kommunenummer).length} kommune features)`,
        )
      }
    }
  }
  failIf(problems, `Grunnkretser do not cover their kommuner within ${MAX_AREA_DEVIATION * 100} %`)
  console.log(`[done] per kommune, grunnkretser cover the kommune within ${MAX_AREA_DEVIATION * 100} %, with and without havgrense`)
}

/**
 * A copy of `topology` with only the geometries whose properties match, and
 * only the arcs they use (renumbered). The `fylkesnummer` helper property is
 * dropped from the output.
 */
function subsetTopology(topology, matches) {
  const objects = {}
  const used = new Map()
  const remap = (arc) => {
    const index = arc < 0 ? ~arc : arc
    if (!used.has(index)) used.set(index, used.size)
    const next = used.get(index)
    return arc < 0 ? ~next : next
  }
  const remapArcs = (arcs) => (typeof arcs[0] === 'number' ? arcs.map(remap) : arcs.map(remapArcs))
  for (const [name, object] of Object.entries(topology.objects)) {
    objects[name] = {
      type: 'GeometryCollection',
      geometries: object.geometries
        .filter((g) => matches(g.properties))
        .map(({ properties: { fylkesnummer, ...properties }, arcs, ...geometry }) => ({
          ...geometry,
          arcs: remapArcs(arcs),
          properties,
        })),
    }
  }
  const arcs = new Array(used.size)
  for (const [oldIndex, newIndex] of used) arcs[newIndex] = topology.arcs[oldIndex]
  return { type: 'Topology', arcs, transform: topology.transform, objects }
}

async function fetchJson(url, init) {
  const response = await fetch(url, { headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, ...init })
  if (!response.ok) throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`)
  return response.json()
}

/** Kartverket's grunnkretser for the whole country, via Geonorge's order API (cached in raw/). */
async function downloadGrunnkretser() {
  const finalPath = path.join(rawDir, 'grunnkretser.geojson')
  if (existsSync(finalPath)) {
    console.log('[skip] grunnkretser.geojson already present')
  } else {
    const order = await fetchJson('https://nedlasting.geonorge.no/api/order', {
      method: 'POST',
      body: JSON.stringify({
        email: '',
        orderLines: [
          {
            metadataUuid: GRUNNKRETS_METADATA_UUID,
            areas: [{ code: '0000', type: 'landsdekkende', name: 'Hele landet' }],
            projections: [{ code: '4258' }],
            formats: [{ name: 'GeoJSON' }],
          },
        ],
      }),
    })
    const file = order.files?.find((f) => f.status === 'ReadyForDownload')
    if (!file) throw new Error(`Geonorge order returned no downloadable file: ${JSON.stringify(order).slice(0, 300)}`)

    console.log(`[download] ${file.name}`)
    const zipPath = path.join(rawDir, 'grunnkretser.zip')
    const extractDir = path.join(rawDir, 'grunnkretser')
    const response = await fetch(file.downloadUrl)
    if (!response.ok) throw new Error(`Failed to download ${file.downloadUrl}: HTTP ${response.status}`)
    await writeFile(zipPath, Buffer.from(await response.arrayBuffer()))

    await rm(extractDir, { recursive: true, force: true })
    await mkdir(extractDir, { recursive: true })
    execFileSync('unzip', ['-o', '-q', zipPath, '-d', extractDir], { stdio: 'inherit' })
    // The zip also holds the border lines (…_Grense_…); we want the areas.
    const [areas] = (await readdir(extractDir)).filter((f) => /Grunnkrets.*\.geojson$/.test(f))
    if (!areas) throw new Error('No grunnkrets GeoJSON in the Geonorge zip')
    const text = (await readFile(path.join(extractDir, areas), 'utf-8')).replace(/^﻿/, '')
    await writeFile(finalPath, text, 'utf-8')
    await rm(zipPath, { force: true })
    await rm(extractDir, { recursive: true, force: true })
  }
  const json = JSON.parse(await readFile(finalPath, 'utf-8'))
  return { ...json, features: json.features.filter((f) => !f.properties.objtype || f.properties.objtype === 'Grunnkrets') }
}

/** Delområde names from SSB, keyed by the 6-digit delområdenummer (cached in raw/). */
async function downloadDelomrader() {
  const finalPath = path.join(rawDir, `ssb-${DELOMRADE_CLASSIFICATION_ID}-delomrader.json`)
  let codes
  if (existsSync(finalPath)) {
    console.log(`[skip] ${path.basename(finalPath)} already present`)
    codes = JSON.parse(await readFile(finalPath, 'utf-8'))
  } else {
    const today = new Date().toISOString().slice(0, 10)
    const url = `https://data.ssb.no/api/klass/v1/classifications/${DELOMRADE_CLASSIFICATION_ID}/codesAt?date=${today}`
    console.log(`[download] ${url}`)
    codes = (await fetchJson(url)).codes.filter((c) => c.level === '1')
    await writeFile(finalPath, JSON.stringify(codes, null, 2), 'utf-8')
  }
  // SSB writes delområder as 8 digits ending in "00" (e.g. 03010100).
  return new Map(codes.map((c) => [c.code.slice(0, 6), c.name]))
}
