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

import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
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
    extractedFile: 'Basisdata_0000_Norge_4258_Fylke_GeoJSON.geojson',
  },
  {
    name: 'kommuner',
    url: 'https://nedlasting.geonorge.no/geonorge/Basisdata/Kommuner/GeoJSON/Basisdata_0000_Norge_4258_Kommuner_GeoJSON.zip',
    extractedFile: 'Basisdata_0000_Norge_4258_Kommune_GeoJSON.geojson',
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

  const extractedPath = path.join(extractDir, source.extractedFile)
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
