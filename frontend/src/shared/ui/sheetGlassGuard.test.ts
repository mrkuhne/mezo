import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// ============================================================
// Guard: no live bottom sheet ships on the old skin (U10, mezo-me75u.10).
//
// Every `<Sheet>` in a live (non-test, non-dead) .tsx must wear the üveg material: either the
// kit's `glass` prop (`<Sheet glass>` → `.sheet.glass.uv-sheet`) or a className that already
// carries a glass recipe (`glass …`, the capture sheets, the Kamra sheet constant). A new sheet
// that forgets it fails here instead of shipping the flat pre-üveg sheet.
//
// Dead files (no importer up to a route — bible rule 18) are allowlisted by name; the guard
// also fails if one of them gains an importer, so a revived file must be dressed first.
// ============================================================

const SRC_DIR = dirname(dirname(dirname(fileURLToPath(import.meta.url)))) // …/src

/** Sheets with no live importer (verified 2026-09-26). Reviving one means dressing it. */
const DEAD_SHEET_FILES = [
  'features/insights/sheets/NodeDetailSheet.tsx',
  'features/fuel/sheets/MealScoreSheet.tsx',
  'features/fuel/sheets/RecipeScoreSheet.tsx',
  'features/today/components/DailyQuestsSheet.tsx',
  'features/today/components/MezoMessagesSheet.tsx',
]

/** className values (literal or expression text) that already carry a glass recipe. */
const DRESSED_CLASS = [
  /\bglass\b/, // any `glass …` class list
  /\bcapture-sheet\b/, // U3 capture sheets (they also pass `glass`)
  /\bKAMRA_SHEET_CLASS\b/, // 'fkk-sheet glass is-still' — asserted below
]

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return walk(p)
    return e.name.endsWith('.tsx') && !/\.test\.tsx$/.test(e.name) ? [p] : []
  })
}

/** Strip comments so prose mentioning `<Sheet>` is not a render site. A `//` only counts as a
 *  line comment at the line start or after whitespace (so `https://` survives). */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1')
}

/** Every `<Sheet …>` opening tag, brace/quote-aware (arrow props contain `>`). */
function sheetTags(src: string): string[] {
  const tags: string[] = []
  const re = /<Sheet(?=[\s>])/g
  for (let m = re.exec(src); m; m = re.exec(src)) {
    let depth = 0
    let quote: string | null = null
    let i = m.index + m[0].length
    for (; i < src.length; i++) {
      const ch = src[i]
      if (quote) { if (ch === quote && src[i - 1] !== '\\') quote = null; continue }
      if (ch === '"' || ch === "'" || ch === '`') quote = ch
      else if (ch === '{') depth++
      else if (ch === '}') depth--
      else if (ch === '>' && depth === 0) break
    }
    tags.push(src.slice(m.index, i + 1))
  }
  return tags
}

function wearsGlass(tag: string): boolean {
  if (/\sglass(?=[\s/>]|=\{true\})/.test(tag)) return true
  const cls = tag.match(/className=(\{[^]*?\}(?=\s+\w+=|\s*\/?>)|"[^"]*"|'[^']*')/)?.[1] ?? ''
  return DRESSED_CLASS.some((re) => re.test(cls))
}

const files = walk(SRC_DIR).map((abs) => ({ rel: relative(SRC_DIR, abs).split('\\').join('/'), src: code(readFileSync(abs, 'utf8')) }))
const sites = files
  .filter((f) => !DEAD_SHEET_FILES.includes(f.rel) && f.rel !== 'shared/ui/Sheet.tsx')
  .flatMap((f) => sheetTags(f.src).map((tag) => ({ file: f.rel, tag })))

describe('sheet glass guard (mezo-me75u.10)', () => {
  it('finds the live sheets (not vacuous)', () => {
    expect(sites.length).toBeGreaterThan(40)
  })

  it('every live <Sheet> wears glass', () => {
    const bare = sites.filter((s) => !wearsGlass(s.tag)).map((s) => `${s.file}: ${s.tag.replace(/\s+/g, ' ')}`)
    expect(bare).toEqual([])
  })

  it('the Kamra sheet constant still carries the glass recipe', () => {
    const kamra = readFileSync(join(SRC_DIR, 'features/fuel/sheets/KamraSheetHead.tsx'), 'utf8')
    expect(kamra).toMatch(/KAMRA_SHEET_CLASS = '[^']*\bglass\b[^']*'/)
  })

  it('the allowlisted dead sheets are still dead (no importer outside tests)', () => {
    for (const dead of DEAD_SHEET_FILES) {
      const name = dead.split('/').pop()!.replace(/\.tsx$/, '')
      const importers = files
        .filter((f) => f.rel !== dead && new RegExp(`from '[^']*/${name}'`).test(f.src))
        .map((f) => f.rel)
      expect(importers, `${name} gained an importer — dress it with <Sheet glass> and drop it from the allowlist`).toEqual([])
    }
  })

  it('the guard itself catches a bare sheet and passes a dressed one', () => {
    expect(wearsGlass('<Sheet onClose={() => close()} labelledBy="x">')).toBe(false)
    expect(wearsGlass('<Sheet onClose={onClose} className="fkx-rsheet-host">')).toBe(false)
    expect(wearsGlass('<Sheet glass onClose={() => setOpen(false)} className="uvl-fuel">')).toBe(true)
    expect(wearsGlass('<Sheet onClose={onClose} className="glass rt-sheet">')).toBe(true)
    expect(wearsGlass('<Sheet onClose={onClose} className={KAMRA_SHEET_CLASS}>')).toBe(true)
  })
})
