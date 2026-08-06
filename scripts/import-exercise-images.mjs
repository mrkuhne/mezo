#!/usr/bin/env node
// ============================================================
// Mezo · import-exercise-images (mezo-8xdl.2)
//
// Vendors the demo stills for the exercise catalog: for every slug in
// scripts/data/exercise-image-map.json it downloads that exercise's TWO frames
// (start + end position) from the public-domain free-exercise-db and writes them
// to frontend/public/exercises/{slug}-a.jpg | {slug}-b.jpg, then (with
// --write-catalog) stamps the relative paths onto content/exercise-catalog.json
// so the startup loader seeds them.
//
// Run by hand when the map changes — NOT in CI. The images are committed; this
// script exists to make the mapping reproducible, not to run on every build.
//
//   node scripts/import-exercise-images.mjs                 # download missing frames, report
//   node scripts/import-exercise-images.mjs --write-catalog # + stamp the catalog JSON
//   node scripts/import-exercise-images.mjs --force         # re-download everything
//
// Deliberately dependency-free (node 20+ global fetch, no sharp/imagemagick):
// the source frames are already ~35 KB at 850×569, and re-encoding them at 560 px
// saved ~4 KB per file — not worth a toolchain dependency, and the larger source
// is the better hero image on a 3× phone screen.
// ============================================================
import { readFile, writeFile, mkdir, access } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')
const MAP_FILE = join(REPO, 'scripts/data/exercise-image-map.json')
const CATALOG_FILE = join(REPO, 'backend/src/main/resources/content/exercise-catalog.json')
const OUT_DIR = join(REPO, 'frontend/public/exercises')
const DATASET = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json'
const RAW = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises'
/** Public URL prefix the catalog rows store — same-origin, served from frontend/public. */
const PUBLIC_PREFIX = '/exercises'

const force = process.argv.includes('--force')
const writeCatalog = process.argv.includes('--write-catalog')

const exists = (p) => access(p).then(() => true, () => false)

async function main() {
  const map = JSON.parse(await readFile(MAP_FILE, 'utf8'))
  const catalog = JSON.parse(await readFile(CATALOG_FILE, 'utf8'))
  const slugs = new Set(catalog.map((e) => e.slug))

  console.log(`↓ fetching the free-exercise-db dataset …`)
  const dataset = await fetch(DATASET).then((r) => {
    if (!r.ok) throw new Error(`dataset fetch failed: ${r.status}`)
    return r.json()
  })
  const byName = new Map(dataset.map((e) => [e.name, e]))

  // Validate the whole map BEFORE downloading anything: a typo'd slug or a renamed
  // upstream exercise must fail loudly, not silently produce a half-imported set.
  const entries = Object.entries(map).filter(([slug]) => !slug.startsWith('_'))
  const badSlugs = entries.filter(([slug]) => !slugs.has(slug)).map(([slug]) => slug)
  const badNames = entries.filter(([, name]) => !byName.has(name)).map(([slug, name]) => `${slug} → "${name}"`)
  if (badSlugs.length || badNames.length) {
    if (badSlugs.length) console.error(`✗ not in the catalog: ${badSlugs.join(', ')}`)
    if (badNames.length) console.error(`✗ not in the dataset: ${badNames.join(', ')}`)
    process.exit(1)
  }

  await mkdir(OUT_DIR, { recursive: true })
  let written = 0
  let skipped = 0
  for (const [slug, name] of entries) {
    const frames = byName.get(name).images
    for (const [i, suffix] of [[0, 'a'], [1, 'b']]) {
      const out = join(OUT_DIR, `${slug}-${suffix}.jpg`)
      if (!force && (await exists(out))) {
        skipped++
        continue
      }
      const res = await fetch(`${RAW}/${frames[i]}`)
      if (!res.ok) throw new Error(`${slug}: ${frames[i]} → ${res.status}`)
      await writeFile(out, Buffer.from(await res.arrayBuffer()))
      written++
    }
  }

  if (writeCatalog) {
    for (const row of catalog) {
      if (map[row.slug]) {
        row.imageStartUrl = `${PUBLIC_PREFIX}/${row.slug}-a.jpg`
        row.imageEndUrl = `${PUBLIC_PREFIX}/${row.slug}-b.jpg`
      } else {
        delete row.imageStartUrl
        delete row.imageEndUrl
      }
    }
    // One row per line, reproducing the file's hand-authored spacing exactly — a
    // compact JSON.stringify would rewrite all 161 lines and bury the real diff.
    const body = catalog
      .map((r) => '  { ' + Object.entries(r).map(([k, v]) => `"${k}": ${JSON.stringify(v)}`).join(', ') + ' }')
      .join(',\n')
    await writeFile(CATALOG_FILE, `[\n${body}\n]\n`)
    console.log(`✎ stamped ${entries.length} catalog rows (and cleared the rest)`)
  }

  const unmapped = catalog.map((e) => e.slug).filter((s) => !map[s])
  console.log(`\n✓ ${entries.length} mapped exercises · ${written} frame(s) written · ${skipped} already present`)
  console.log(`○ ${unmapped.length} catalog rows have NO image and render imageless:`)
  console.log(`  ${unmapped.join(', ')}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
