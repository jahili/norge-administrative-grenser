// Adds SSB's levekårssoner (LKS) to the grunnkrets files built by
// 06-build-grunnkretser, in place: src/assets/grunnkretser/<fylkesnummer>.topojson
// plus their counts in index.json, and src/assets/levekarssoner.json with
// which version of the classification was used.
//
// A levekårssone is a group of whole grunnkretser within one kommune, so —
// like delområder — the zones are the grunnkretser merged with
// topojson-client's mergeArcs and share borders exactly with them. Each file
// gets two more objects:
//   - levekarssoner / levekarssonerUtenHavgrense: properties
//     levekarssonenummer (10 digits, starting with the kommunenummer),
//     levekarssonenavn and kommunenummer
// and every grunnkrets in a kommune with levekårssoner gets its zone's
// levekarssonenummer and levekarssonenavn, so grunnkrets data can be
// aggregated to zones.
//
// Source: SSB's "Kodeliste for levekårssoner (LKS)" (KLASS classification
// 745) and its correspondence table to the grunnkrets classification (1), as
// valid today. SSB publishes the zones a batch of kommuner at a time, so only
// some kommuner have them, and corrects single grunnkretser now and then —
// rerun this step (after deleting the cached raw/ssb-745-levekarssoner.json)
// to pick up a new version. FHI publishes statistics on exactly these codes.
//
// Run after data:grunnkretser, which rewrites the grunnkrets files without
// levekårssoner. Running this step twice gives the same files.
//
// Validation — the step fails rather than writing questionable data:
//   - every zone code has 10 digits and starts with the kommunenummer of
//     each of its grunnkretser
//   - every grunnkrets in the correspondence exists in the grunnkrets files
//     and belongs to one zone only
//   - in every kommune with zones, every grunnkrets belongs to a zone

import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const topojsonClient = require('topojson-client')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rawDir = path.join(__dirname, '..', 'raw')
const grunnkretsDir = path.join(__dirname, '..', '..', 'src', 'assets', 'grunnkretser')
const metadataFile = path.join(__dirname, '..', '..', 'src', 'assets', 'levekarssoner.json')

const LKS_CLASSIFICATION_ID = 745
const GRUNNKRETS_CLASSIFICATION_ID = 1

await mkdir(rawDir, { recursive: true })

const { version, items } = await downloadLevekarssoner()
const indexFile = path.join(grunnkretsDir, 'index.json')
const index = JSON.parse(await readFile(indexFile, 'utf-8'))
const fylker = Object.keys(index).sort()

// --- Read the grunnkrets files and validate the correspondence against them ---

const topologies = new Map()
const grunnkretsKommune = new Map()
for (const fylkesnummer of fylker) {
  const topology = JSON.parse(await readFile(path.join(grunnkretsDir, `${fylkesnummer}.topojson`), 'utf-8'))
  topologies.set(fylkesnummer, topology)
  for (const g of topology.objects.grunnkretser.geometries) {
    grunnkretsKommune.set(g.properties.grunnkretsnummer, g.properties.kommunenummer)
  }
}

const problems = []
/** grunnkretsnummer → { levekarssonenummer, levekarssonenavn } */
const soneByGrunnkrets = new Map()
for (const { sourceCode, sourceName, targetCode } of items) {
  // SSB's "Uoppgitt grunnkrets" (xxxx9999) has no geometry.
  if (targetCode.endsWith('9999')) continue
  if (!/^\d{10}$/.test(sourceCode)) problems.push(`invalid levekårssone code "${sourceCode}"`)
  const kommunenummer = grunnkretsKommune.get(targetCode)
  if (!kommunenummer) problems.push(`${sourceCode} ${sourceName}: grunnkrets ${targetCode} is not in the grunnkrets files`)
  else if (!sourceCode.startsWith(kommunenummer)) {
    problems.push(`${sourceCode} ${sourceName}: grunnkrets ${targetCode} is in another kommune (${kommunenummer})`)
  }
  const previous = soneByGrunnkrets.get(targetCode)
  if (previous && previous.levekarssonenummer !== sourceCode) {
    problems.push(`grunnkrets ${targetCode} is in two levekårssoner: ${previous.levekarssonenummer} and ${sourceCode}`)
  }
  soneByGrunnkrets.set(targetCode, { levekarssonenummer: sourceCode, levekarssonenavn: sourceName })
}
const kommunerMedSoner = new Set([...soneByGrunnkrets.keys()].map((nr) => grunnkretsKommune.get(nr)).filter(Boolean))
for (const [grunnkretsnummer, kommunenummer] of grunnkretsKommune) {
  if (kommunerMedSoner.has(kommunenummer) && !soneByGrunnkrets.has(grunnkretsnummer)) {
    problems.push(`grunnkrets ${grunnkretsnummer} in kommune ${kommunenummer} has no levekårssone`)
  }
}
failIf(problems, 'The levekårssoner do not match the grunnkretser')
const soneCount = new Set([...soneByGrunnkrets.values()].map((s) => s.levekarssonenummer)).size
console.log(
  `[done] ${soneCount} levekårssoner (${version.name}) cover all ${soneByGrunnkrets.size} grunnkretser ` +
    `in ${kommunerMedSoner.size} kommuner`,
)

// --- Add the zones to each fylke file ---

for (const fylkesnummer of fylker) {
  const topology = topologies.get(fylkesnummer)
  for (const name of ['grunnkretser', 'grunnkretserUtenHavgrense']) {
    for (const geometry of topology.objects[name].geometries) {
      geometry.properties = withSone(geometry.properties)
    }
  }

  // As in 06-build-grunnkretser: mergeArcs runs on a 2D copy of the arcs,
  // because it cannot stitch arcs that carry presimplify weights.
  const topology2d = { ...topology, arcs: topology.arcs.map((arc) => arc.map(([x, y]) => [x, y])) }
  for (const [source, target] of [
    ['grunnkretser', 'levekarssoner'],
    ['grunnkretserUtenHavgrense', 'levekarssonerUtenHavgrense'],
  ]) {
    const groups = new Map()
    for (const geometry of topology.objects[source].geometries) {
      const { levekarssonenummer } = geometry.properties
      if (!levekarssonenummer) continue
      groups.set(levekarssonenummer, [...(groups.get(levekarssonenummer) ?? []), geometry])
    }
    topology.objects[target] = {
      type: 'GeometryCollection',
      geometries: [...groups.values()]
        .map((group) => {
          const { levekarssonenummer, levekarssonenavn, kommunenummer } = group[0].properties
          return {
            ...topojsonClient.mergeArcs(topology2d, group),
            properties: { levekarssonenummer, levekarssonenavn, kommunenummer },
          }
        })
        .sort((a, b) => a.properties.levekarssonenummer.localeCompare(b.properties.levekarssonenummer)),
    }
  }

  const json = JSON.stringify(topology)
  await writeFile(path.join(grunnkretsDir, `${fylkesnummer}.topojson`), json)
  const { bytes } = index[fylkesnummer]
  index[fylkesnummer] = {
    grunnkretser: topology.objects.grunnkretser.geometries.length,
    delomrader: topology.objects.delomrader.geometries.length,
    levekarssoner: topology.objects.levekarssoner.geometries.length,
    bytes: Buffer.byteLength(json),
  }
  const added = index[fylkesnummer].levekarssoner
  if (added > 0) {
    console.log(
      `[done] ${fylkesnummer}: ${added} levekårssoner ` +
        `(${topology.objects.levekarssonerUtenHavgrense.geometries.length} without havgrense), ` +
        `${((index[fylkesnummer].bytes - bytes) / 1e3).toFixed(0)} kB more`,
    )
  }
}
await writeFile(indexFile, JSON.stringify(index, null, 2))

const metadata = {
  klassifikasjon: LKS_CLASSIFICATION_ID,
  versjon: version.id,
  navn: version.name,
  gyldigFra: version.validFrom,
  levekarssoner: soneCount,
  kommuner: [...kommunerMedSoner].sort(),
}
await writeFile(metadataFile, JSON.stringify(metadata, null, 2) + '\n')
console.log(`[done] wrote ${path.relative(process.cwd(), metadataFile)}`)

// --- Helpers ---

function failIf(problems, heading) {
  if (problems.length === 0) return
  throw new Error(`${heading} (${problems.length}):\n  ${problems.slice(0, 20).join('\n  ')}`)
}

/**
 * The grunnkrets's properties with its zone (if any) after the delområde,
 * replacing whatever zone an earlier run added.
 */
function withSone({ levekarssonenummer, levekarssonenavn, ...p }) {
  const { kommunenummer, ...before } = p
  return { ...before, ...soneByGrunnkrets.get(p.grunnkretsnummer), kommunenummer }
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`)
  return response.json()
}

/** The LKS version valid today and its grunnkretser (cached in raw/). */
async function downloadLevekarssoner() {
  const finalPath = path.join(rawDir, `ssb-${LKS_CLASSIFICATION_ID}-levekarssoner.json`)
  if (existsSync(finalPath)) {
    console.log(`[skip] ${path.basename(finalPath)} already present`)
    return JSON.parse(await readFile(finalPath, 'utf-8'))
  }
  const today = new Date().toISOString().slice(0, 10)
  const base = `https://data.ssb.no/api/klass/v1/classifications/${LKS_CLASSIFICATION_ID}`
  const { versions } = await fetchJson(base)
  const valid = versions.find((v) => v.validFrom <= today && (!v.validTo || today < v.validTo))
  if (!valid) throw new Error(`No version of KLASS classification ${LKS_CLASSIFICATION_ID} is valid on ${today}`)
  const url = `${base}/correspondsAt?targetClassificationId=${GRUNNKRETS_CLASSIFICATION_ID}&date=${today}`
  console.log(`[download] ${url}`)
  const { correspondenceItems } = await fetchJson(url)
  const result = {
    version: { id: valid.id, name: valid.name, validFrom: valid.validFrom },
    items: correspondenceItems.map(({ sourceCode, sourceName, targetCode }) => ({ sourceCode, sourceName, targetCode })),
  }
  await writeFile(finalPath, JSON.stringify(result, null, 2), 'utf-8')
  return result
}
