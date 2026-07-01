// Usage: node scripts/refactor/absolutify-imports.mjs   (run from frontend/)
// Converts every relative import/export/vi.mock/vi.importActual specifier to the
// move-invariant '@/…' absolute form, so subsequent file moves become pure string remaps.
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import path from 'node:path'

const SRC = path.resolve('src')
const files = execSync('git ls-files src', { encoding: 'utf8' })
  .trim().split('\n').filter(f => /\.(ts|tsx)$/.test(f)) // all depths incl. top-level src/*.tsx

// matches: from '…'  |  import '…'  |  vi.mock('…'  |  vi.importActual('…'  |  import('…'
const SPEC = /((?:from|import|vi\.mock|vi\.importActual)\s*\(?\s*)(['"])(\.\.?\/[^'"]+)\2/g
const TSJS = /\.(ts|tsx|js|jsx|mts|cts)$/

let changed = 0
for (const file of files) {
  const dir = path.dirname(path.resolve(file))
  const src = readFileSync(file, 'utf8')
  const out = src.replace(SPEC, (m, pre, q, rel) => {
    const abs = path.resolve(dir, rel)
    let relToSrc = path.relative(SRC, abs).split(path.sep).join('/') // posix
    relToSrc = relToSrc.replace(TSJS, '')                            // strip TS/JS ext; keep .css etc.
    return `${pre}${q}@/${relToSrc}${q}`
  })
  if (out !== src) { writeFileSync(file, out); changed++ }
}
console.log(`absolutified imports in ${changed} files`)
