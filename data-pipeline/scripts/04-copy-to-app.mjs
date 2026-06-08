// Copies the final bundled topology into src/assets, where Vite picks it up
// as a static asset.

import { copyFile, mkdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const src = path.join(__dirname, '..', 'work', 'norge-grenser.topojson')
const destDir = path.join(__dirname, '..', '..', 'src', 'assets')
const dest = path.join(destDir, 'norge-grenser.topojson')

await mkdir(destDir, { recursive: true })
await copyFile(src, dest)

const { size } = await stat(dest)
console.log(`[done] copied to ${path.relative(process.cwd(), dest)} (${(size / 1024).toFixed(0)} kB)`)
