// Usage: node scripts/refactor/apply-moves.mjs --to <prefix> [--to <prefix>...] [--from <prefix>...]
//   Selects manifest rows whose `to` starts with any --to prefix OR `from` starts with any --from prefix.
//   For each selected row: git mv (skipped if from==to or already moved), then remaps the `@/` import
//   specifier and applies the symbol rename across ALL src files. Imports are in absolute `@/` form
//   (run absolutify-imports.mjs first), so the path remap is an exact, quote-bounded string replace.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import path from 'node:path'

const args = process.argv.slice(2)
const toPrefixes = [], fromPrefixes = []
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--to') toPrefixes.push(args[++i])
  else if (args[i] === '--from') fromPrefixes.push(args[++i])
}
const noExt = p => p.replace(/\.(ts|tsx)$/, '')

const rows = readFileSync('scripts/refactor/movemap.tsv', 'utf8')
  .trim().split('\n').map(l => { const [from, to, rename] = l.split('\t'); return { from, to, rename: rename || '' } })

const selected = rows.filter(r =>
  toPrefixes.some(p => r.to.startsWith(p)) || fromPrefixes.some(p => r.from.startsWith(p)))
if (!selected.length) { console.error('no rows selected'); process.exit(1) }

// 1) git mv (skip no-move rows and rows already moved by an earlier task)
let moved = 0
for (const r of selected) {
  if (r.from === r.to || !existsSync(r.from)) continue
  mkdirSync(path.dirname(r.to), { recursive: true })
  execSync(`git mv "${r.from}" "${r.to}"`)
  moved++
}

// 2) build path + symbol remap tables from the selected rows
const pathMap = new Map()   // '@/oldNoExt' -> '@/newNoExt'
const symMap = []           // { from:'Old', to:'New' }
for (const r of selected) {
  if (r.from !== r.to) pathMap.set('@/' + noExt(r.from).replace(/^src\//, ''), '@/' + noExt(r.to).replace(/^src\//, ''))
  if (r.rename) { const [a, b] = r.rename.split('->'); symMap.push({ from: a.trim(), to: b.trim() }) }
}

// 3) rewrite ALL src files
const all = execSync('git ls-files src', { encoding: 'utf8' }).trim().split('\n').filter(f => /\.(ts|tsx)$/.test(f))
let touched = 0
for (const file of all) {
  const orig = readFileSync(file, 'utf8')
  let src = orig
  for (const [oldP, newP] of pathMap) {
    // quote-bounded to avoid prefix bleed (e.g. @/data/fuel vs @/data/fuelWeek)
    src = src.split(`'${oldP}'`).join(`'${newP}'`).split(`"${oldP}"`).join(`"${newP}"`)
  }
  for (const { from, to } of symMap) src = src.replace(new RegExp(`\\b${from}\\b`, 'g'), to)
  if (src !== orig) { writeFileSync(file, src); touched++ }
}
console.log(`moved ${moved} files; rewrote ${touched} files; ${pathMap.size} path remaps; ${symMap.length} symbol renames`)
