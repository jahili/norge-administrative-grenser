// Builds the single bundled data file the app ships with:
//
//   1. Import both normalized layers together ("combine-files") so mapshaper
//      builds *shared topology* — coincident kommune/fylke borders snap to
//      the same vertices.
//   2. Simplify that shared topology to ~5% of its original vertex count
//      (Visvalingam, "keep-shapes" so small kommuner like Utsira don't
//      vanish). Because the topology is shared, simplification keeps
//      neighbouring borders aligned — no slivers or gaps between kommuner,
//      or between a kommune and its fylke outline.
//   3. Export as TopoJSON with `presimplify`. This stamps every arc vertex
//      with the simplification threshold at which it would be removed,
//      using the same encoding as the `topojson-simplify` package's
//      `presimplify()`. The bundled file therefore supports *additional*,
//      smooth, client-side simplification via `topojson-simplify`'s
//      `simplify()` — which is how the in-app "adjust detail" slider works
//      without shipping multiple resolutions of the same data.
//
// Note: this single mapshaper invocation does the job originally split
// between mapshaper (simplify) and the `geo2topo` CLI (topology-building) —
// mapshaper's own TopoJSON writer builds equivalent (arguably better, since
// it reuses the already-shared topology) output in one step, so geo2topo
// isn't needed in the final pipeline.

import { createRequire } from 'node:module'
import { mkdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const mapshaper = require('mapshaper')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const workDir = path.join(__dirname, '..', 'work')
const outFile = path.join(workDir, 'norge-grenser.topojson')

await mkdir(workDir, { recursive: true })

// Calling mapshaper's Node API directly (rather than shelling out to its CLI)
// sidesteps Windows path/quoting issues with spaces in "C:\Users\Jan Hiroshi\...".
const args = [
  '-i',
  'combine-files',
  path.join(workDir, 'fylker.geojson'),
  path.join(workDir, 'kommuner.geojson'),
  '-simplify',
  'visvalingam',
  'keep-shapes',
  '5%',
  '-o',
  outFile,
  'format=topojson',
  'presimplify',
  'quantization=1e5',
  'force',
]

console.log(`[run] mapshaper ${args.join(' ')}`)
await new Promise((resolve, reject) => {
  mapshaper.runCommands(args, (err) => (err ? reject(err) : resolve()))
})

const { size } = await stat(outFile)
console.log(`[done] wrote ${path.relative(process.cwd(), outFile)} (${(size / 1024 / 1024).toFixed(2)} MB)`)
