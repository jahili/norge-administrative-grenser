// Adds district divisions — politidistrikter, 110-distrikter, valgdistrikter,
// økonomiske regioner, landsdeler and helseregioner — to the bundled topology
// in src/assets/norge-grenser.topojson.
//
// Every division is made up of whole kommuner, so instead of shipping their
// own geometry we:
//
//   1. tag every kommune (both havgrense variants) with the district it
//      belongs to in each division, and
//   2. build two new objects per division (e.g. `valgdistrikter` and
//      `valgdistrikterUtenHavgrense`) by merging those kommuner with
//      topojson-client's `mergeArcs`.
//
// `mergeArcs` only references the kommune layers' existing arcs, so the new
// layers share borders exactly with every other layer, follow the coastline
// toggle for free, and barely grow the file.
//
// Sources (see DISTRIKTER below):
//   - SSB KLASS classifications with a kommune correspondence table: the
//     newest table is used. If it predates the current kommune numbers (the
//     helseregion table stops at Kommuneinndeling 2020), its kommune codes are
//     translated forward with SSB's own kommune change log.
//   - SSB KLASS classifications with a fylke correspondence table (landsdeler),
//     applied through each kommune's fylkesnummer.
//   - 110-distrikt: SSB's 110 classification (427) is stuck at the 2019
//     version with 14 sentraler and has no kommune correspondence, so we use
//     DSB's Brannalarmsentraler dataset, which carries the current districts as
//     polygons. Those polygons are only used to assign each kommune to a
//     district by area overlap; anything short of near-total overlap fails the
//     step rather than guessing.
//
// Every assignment must cover exactly the bundled kommuner, one district each,
// or the step fails.
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
const KOMMUNE_CLASSIFICATION_ID = 131
const DSB_110_WFS =
  'https://wfs.geonorge.no/skwms1/wfs.brannalarmsentraler?service=WFS&version=2.0.0&request=GetFeature&typeNames=app:Distrikt110'
/** Minimum share of a kommune's area that must fall inside one 110-distrikt. */
const MIN_110_SHARE = 0.98

/**
 * The divisions to add. `kind` is the topology object name (plus
 * `UtenHavgrense`), `idField`/`nameField` the properties added to kommuner and
 * districts, and `sortBy` the order districts are listed in.
 * Keep in sync with DISTRIKT_KINDS in src/lib/distrikter.ts.
 */
const DISTRIKTER = [
  {
    kind: 'politidistrikter',
    idField: 'politidistriktnummer',
    nameField: 'politidistriktnavn',
    sortBy: 'navn',
    source: { type: 'ssb-kommune', classificationId: 109 },
  },
  {
    kind: 'distrikter110',
    idField: 'distrikt110id',
    nameField: 'distrikt110navn',
    sortBy: 'navn',
    source: { type: 'dsb-110' },
  },
  {
    kind: 'valgdistrikter',
    idField: 'valgdistriktnummer',
    nameField: 'valgdistriktnavn',
    sortBy: 'nummer',
    source: { type: 'ssb-kommune', classificationId: 543 },
  },
  {
    kind: 'okonomiskeRegioner',
    idField: 'okonomiskregionnummer',
    nameField: 'okonomiskregionnavn',
    sortBy: 'nummer',
    source: { type: 'ssb-kommune', classificationId: 108 },
  },
  {
    kind: 'landsdeler',
    idField: 'landsdelnummer',
    nameField: 'landsdelnavn',
    sortBy: 'nummer',
    source: { type: 'ssb-fylke', classificationId: 106 },
  },
  {
    kind: 'helseregioner',
    idField: 'helseregionnummer',
    nameField: 'helseregionnavn',
    sortBy: 'navn',
    source: { type: 'ssb-kommune', classificationId: 105 },
  },
]

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
const kommunenumre = new Set(kommuner.map((k) => k.kommunenummer))

// Assign first, so a failing source leaves the topology file untouched.
const assignments = []
for (const distrikt of DISTRIKTER) {
  assignments.push({ distrikt, byKommune: await assign(distrikt) })
}

for (const layer of Object.values(kommuneLayers)) {
  for (const geometry of layer.geometries) {
    const { kommunenummer, kommunenavn, fylkesnummer, fylkesnavn } = geometry.properties
    geometry.properties = { kommunenummer, kommunenavn, fylkesnummer, fylkesnavn }
    for (const { distrikt, byKommune } of assignments) {
      const { id, navn } = byKommune.get(kommunenummer)
      geometry.properties[distrikt.idField] = id
      geometry.properties[distrikt.nameField] = navn
    }
  }
}

for (const distrikt of DISTRIKTER) {
  topology.objects[distrikt.kind] = mergeKommuner(kommuneLayers.med, distrikt)
  topology.objects[`${distrikt.kind}UtenHavgrense`] = mergeKommuner(kommuneLayers.uten, distrikt)
}

await writeFile(topologyFile, JSON.stringify(topology))
console.log(
  `[done] wrote ${DISTRIKTER.map((d) => `${topology.objects[d.kind].geometries.length} ${d.kind}`).join(', ')} ` +
    `to ${path.relative(process.cwd(), topologyFile)}`,
)

/** One merged geometry per district, ordered by `sortBy`. */
function mergeKommuner(layer, { idField, nameField, sortBy }) {
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
  const sortField = sortBy === 'nummer' ? idField : nameField
  geometries.sort((a, b) =>
    a.properties[sortField].localeCompare(b.properties[sortField], 'nb', { numeric: true }),
  )
  return { type: 'GeometryCollection', geometries }
}

/** District `{ id, navn }` per kommunenummer, validated to cover exactly our kommuner. */
async function assign(distrikt) {
  const { source } = distrikt
  const { label, byKommune } =
    source.type === 'dsb-110'
      ? await distrikt110Assignment()
      : source.type === 'ssb-fylke'
        ? await ssbFylkeAssignment(source.classificationId)
        : await ssbKommuneAssignment(source.classificationId)

  const missing = [...kommunenumre].filter((nr) => !byKommune.has(nr))
  if (missing.length > 0) {
    throw new Error(
      `${distrikt.kind}: "${label}" has no district for kommune ${missing.join(', ')}. ` +
        'Delete data-pipeline/raw/ to re-download, or wait for the source to cover the current kommuneinndeling.',
    )
  }
  const districtCount = new Set([...byKommune.values()].map((d) => d.id)).size
  console.log(`[done] ${distrikt.kind}: ${kommunenumre.size} kommuner in ${districtCount} districts from "${label}"`)
  return byKommune
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`)
  return response.json()
}

/** Reads `file` from raw/, or downloads it with `download()` and caches it there. */
async function cached(file, download) {
  const finalPath = path.join(rawDir, file)
  if (existsSync(finalPath)) {
    console.log(`[skip] ${file} already present`)
    return JSON.parse(await readFile(finalPath, 'utf-8'))
  }
  const data = await download()
  await writeFile(finalPath, JSON.stringify(data, null, 2), 'utf-8')
  return data
}

/**
 * The newest correspondence table between a classification's current version
 * and the `targetName` classification ("Kommuneinndeling"/"Fylkesinndeling"),
 * as `{ source, year, mappings: [{ code, navn, target }] }` where `target` is
 * the kommune- or fylkesnummer.
 */
function downloadCorrespondence(classificationId, targetName) {
  return cached(`ssb-${classificationId}-${targetName.toLowerCase()}.json`, async () => {
    const classification = await fetchJson(`${KLASS_API}/classifications/${classificationId}`)
    const currentVersion = classification.versions.find((v) => !v.validTo)
    if (!currentVersion) throw new Error(`No current version of classification ${classificationId}`)
    const version = await fetchJson(currentVersion._links.self.href)

    const pattern = new RegExp(`${targetName} (\\d{4})`)
    const [newest] = version.correspondenceTables
      .map((table) => ({ table, year: Number(pattern.exec(table.name)?.[1]) }))
      .filter(({ year }) => year > 0)
      .sort((a, b) => b.year - a.year)
    if (!newest) throw new Error(`No ${targetName} correspondence table in ${version.name}`)

    console.log(`[download] ${newest.table.name}`)
    const correspondence = await fetchJson(newest.table._links.self.href)
    return {
      source: newest.table.name,
      year: newest.year,
      mappings: correspondence.correspondenceMaps.map((m) => ({
        code: m.sourceCode,
        navn: m.sourceName,
        target: m.targetCode,
      })),
    }
  })
}

/** SSB's kommune change log from `year` until today: old kommunenummer → new kommunenumre. */
async function kommuneChangesSince(year) {
  const { codeChanges } = await cached(`ssb-kommune-endringer-${year}.json`, () =>
    fetchJson(
      `${KLASS_API}/classifications/${KOMMUNE_CLASSIFICATION_ID}/changes` +
        `?from=${year}-01-01&to=${new Date().toISOString().slice(0, 10)}`,
    ),
  )
  const next = new Map()
  for (const { oldCode, newCode } of codeChanges) {
    if (oldCode === newCode) continue
    next.set(oldCode, [...(next.get(oldCode) ?? []), newCode])
  }
  return next
}

/** The current kommunenumre an old kommunenummer became (several if it was split). */
function currentKommunenumre(code, next, seen = new Set()) {
  if (kommunenumre.has(code)) return [code]
  if (seen.has(code)) return []
  seen.add(code)
  return (next.get(code) ?? []).flatMap((newCode) => currentKommunenumre(newCode, next, seen))
}

/** District per kommune from an SSB kommune correspondence table, translated to today's kommunenumre. */
async function ssbKommuneAssignment(classificationId) {
  const { source, year, mappings } = await downloadCorrespondence(classificationId, 'Kommuneinndeling')
  const outdated = mappings.some((m) => /^\d{4}$/.test(m.target) && !m.target.startsWith('99') && !kommunenumre.has(m.target))
  const next = outdated ? await kommuneChangesSince(year) : new Map()

  const byKommune = new Map()
  for (const { code, navn, target } of mappings) {
    for (const kommunenummer of currentKommunenumre(target, next)) {
      const existing = byKommune.get(kommunenummer)
      if (existing && existing.id !== code) {
        throw new Error(`Kommune ${kommunenummer} is in both ${existing.id} and ${code} in "${source}"`)
      }
      byKommune.set(kommunenummer, { id: code, navn })
    }
  }
  return { label: outdated ? `${source}, translated to current kommunenumre` : source, byKommune }
}

/** District per kommune from an SSB fylke correspondence table, via each kommune's fylkesnummer. */
async function ssbFylkeAssignment(classificationId) {
  const { source, mappings } = await downloadCorrespondence(classificationId, 'Fylkesinndeling')
  const byFylke = new Map()
  for (const { code, navn, target } of mappings) {
    if (byFylke.has(target)) throw new Error(`Fylke ${target} is in more than one district in "${source}"`)
    byFylke.set(target, { id: code, navn })
  }
  const byKommune = new Map()
  for (const { kommunenummer, fylkesnummer } of kommuner) {
    if (byFylke.has(fylkesnummer)) byKommune.set(kommunenummer, byFylke.get(fylkesnummer))
  }
  return { label: source, byKommune }
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

/** 110-distrikt per kommune, by largest area overlap with DSB's polygons. */
async function distrikt110Assignment() {
  const distrikter = await cached('distrikter110.geojson', async () => {
    console.log(`[download] ${DSB_110_WFS}`)
    const response = await fetch(DSB_110_WFS)
    if (!response.ok) throw new Error(`Failed to download ${DSB_110_WFS}: HTTP ${response.status}`)
    const features = parseDistrikt110Gml(await response.text())
    if (features.length === 0) throw new Error('DSB WFS returned no Distrikt110 features')
    return { type: 'FeatureCollection', features }
  })
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
    byKommune.set(kommunenummer, { id: bestId, navn: distriktById.get(bestId).distrikt110navn })
  }
  if (problems.length > 0) {
    throw new Error(
      `These kommuner are not at least ${MIN_110_SHARE * 100} % inside one 110-distrikt: ${problems.join('; ')}`,
    )
  }

  const used = new Set([...byKommune.values()].map((v) => v.id))
  const unused = [...distriktById.values()].filter((d) => !used.has(d.distrikt110id))
  if (unused.length > 0) {
    throw new Error(`110-distrikter without any kommune: ${unused.map((d) => d.distrikt110navn).join(', ')}`)
  }

  return { label: 'DSB Brannalarmsentraler (Distrikt110)', byKommune }
}
