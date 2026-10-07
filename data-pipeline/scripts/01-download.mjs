// Downloads the official whole-of-Norway kommune and fylke datasets from
// Geonorge as GeoJSON, in EPSG:4258 (ETRS89 geographic / lat-lon).
//
// Why EPSG:4258 and not EPSG:25833 (UTM)? Geonorge offers each dataset in
// several CRSes. EPSG:4258 is geographic (lat/lon), and for mainland Norway
// it differs from WGS84 (EPSG:4326) by at most a few centimetres — far
// below visualisation or simplification tolerances. Picking the geographic
// variant up front means no lossy reprojection step is needed later: we can
// treat the coordinates as WGS84 directly, which is also what GeoJSON
// (RFC 7946) assumes by default.
//
// If these Geonorge "nedlasting" endpoints ever stop serving files directly,
// fall back to the Kartverket WFS at
// https://wfs.geonorge.no/skwms1/wfs.administrative_enheter (FeatureTypes
// app:Fylke / app:Kommune) — note that service only returns GML, so an extra
// GML → GeoJSON conversion step (e.g. via ogr2ogr) would be required.
//
// The coastline-clipped ("uten havgrense") layers are not available for free
// download from Kartverket's APIs at adequate precision for Norway's complex
// fjord coastline. Instead, they are committed as source files in
// data-pipeline/source/ and copied here into raw/ for use by the pipeline.

import { copyFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createWriteStream, existsSync } from 'node:fs'
import { Readable } from 'node:stream'
import { finished } from 'node:stream/promises'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rawDir = path.join(__dirname, '..', 'raw')
const sourceDir = path.join(__dirname, '..', 'source')

const zipSources = [
  {
    name: 'fylker',
    url: 'https://nedlasting.geonorge.no/geonorge/Basisdata/Fylker/GeoJSON/Basisdata_0000_Norge_4258_Fylker_GeoJSON.zip',
  },
  {
    name: 'kommuner',
    url: 'https://nedlasting.geonorge.no/geonorge/Basisdata/Kommuner/GeoJSON/Basisdata_0000_Norge_4258_Kommuner_GeoJSON.zip',
  },
]

// Files in source/ are committed to the repository and simply copied to raw/.
const fileSources = [
  { name: 'kommuner-uten-havgrense' },
  { name: 'fylker-uten-havgrense' },
]

await mkdir(rawDir, { recursive: true })

for (const source of zipSources) {
  const zipPath = path.join(rawDir, `${source.name}.zip`)
  const extractDir = path.join(rawDir, source.name)
  const finalPath = path.join(rawDir, `${source.name}.geojson`)

  if (existsSync(finalPath)) {
    console.log(`[skip] ${source.name}.geojson already present`)
    continue
  }

  console.log(`[download] ${source.url}`)
  const response = await fetch(source.url)
  if (!response.ok) {
    throw new Error(`Failed to download ${source.url}: HTTP ${response.status}`)
  }
  await finished(Readable.fromWeb(response.body).pipe(createWriteStream(zipPath)))

  console.log(`[extract] ${source.name}.zip`)
  await rm(extractDir, { recursive: true, force: true })
  await mkdir(extractDir, { recursive: true })
  execFileSync('unzip', ['-o', zipPath, '-d', extractDir], { stdio: 'inherit' })

  // Geonorge has renamed the file inside the zip before (…_Fylke_… →
  // …_Fylker_…), so locate the single GeoJSON file rather than hardcoding it.
  const geojsonFiles = (await readdir(extractDir)).filter((f) => f.endsWith('.geojson'))
  if (geojsonFiles.length !== 1) {
    throw new Error(`Expected one .geojson file in ${source.name}.zip, found: ${geojsonFiles.join(', ') || 'none'}`)
  }
  const extractedPath = path.join(extractDir, geojsonFiles[0])
  let text = await readFile(extractedPath, 'utf-8')
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1) // strip BOM

  await writeFile(finalPath, text, 'utf-8')
  await rm(zipPath, { force: true })
  await rm(extractDir, { recursive: true, force: true })
  console.log(`[done] wrote ${path.relative(process.cwd(), finalPath)}`)
}

for (const source of fileSources) {
  const srcPath = path.join(sourceDir, `${source.name}.geojson`)
  const dstPath = path.join(rawDir, `${source.name}.geojson`)

  if (existsSync(dstPath)) {
    console.log(`[skip] ${source.name}.geojson already present`)
    continue
  }

  if (!existsSync(srcPath)) {
    throw new Error(`Missing source file: ${srcPath} — commit it to data-pipeline/source/ first`)
  }

  console.log(`[copy] ${source.name}.geojson from source/`)
  await copyFile(srcPath, dstPath)
  console.log(`[done] copied ${source.name}.geojson`)
}

// --- SSB's kommune and fylke names (SSB KLASS) ---
//
// Kartverket's Basisdata files are an extract (`datauttaksdato`) that can lag
// behind the official names: Oslo became "Oslo - Oslove" on 2026-01-01, but
// the extract from 2025-12-10 still says "Oslo", and the Sami names adopted in
// 2024 for Rana, Sørfold, Levanger and Gratangen are missing entirely. SSB's
// kommune (131) and fylke (104) classifications have them, so we record SSB's
// name for every code both at Kartverket's extract date and today;
// 02-normalize decides when SSB's name should win.

{
  const finalPath = path.join(rawDir, 'ssb-navn.json')
  if (existsSync(finalPath)) {
    console.log('[skip] ssb-navn.json already present')
  } else {
    const kommuner = JSON.parse(await readFile(path.join(rawDir, 'kommuner.geojson'), 'utf-8'))
    const uttak = kommuner.features
      .filter((f) => f.properties.objtype === 'Kommune' && f.properties.datauttaksdato)
      .map((f) => f.properties.datauttaksdato.slice(0, 10))
      .sort()
      .at(-1)
    if (!uttak) throw new Error('kommuner.geojson has no datauttaksdato to compare SSB names against')
    const today = new Date().toISOString().slice(0, 10)

    const namesAt = async (classificationId, date) => {
      const url = `https://data.ssb.no/api/klass/v1/classifications/${classificationId}/codesAt?date=${date}`
      const response = await fetch(url, { headers: { Accept: 'application/json' } })
      if (!response.ok) throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`)
      const { codes } = await response.json()
      return new Map(codes.map((c) => [c.code, c.name]))
    }

    const navn = { kartverketUttak: uttak, ssbPer: today }
    for (const [level, classificationId] of [['kommuner', 131], ['fylker', 104]]) {
      console.log(`[download] SSB classification ${classificationId} names at ${uttak} and ${today}`)
      const [vedUttak, naa] = await Promise.all([namesAt(classificationId, uttak), namesAt(classificationId, today)])
      navn[level] = Object.fromEntries([...naa].map(([code, name]) => [code, { vedUttak: vedUttak.get(code), naa: name }]))
    }

    await writeFile(finalPath, JSON.stringify(navn, null, 2), 'utf-8')
    console.log(`[done] wrote ssb-navn.json (SSB names at ${uttak} and ${today})`)
  }
}
