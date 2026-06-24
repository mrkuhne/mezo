import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// ============================================================
// Durable guard against the dual-mode seed-leak bug class (mezo-yew / mezo-0xl).
//
// The footgun: a `useQuery` destructure that defaults `data` to a mock/seed import —
// `const { data = SEED } = useQuery(...)` (in ANY property order, with or without
// siblings like `isLoading`/`isPending`, and with a `data: alias` rename). The default
// fires whenever `data` is undefined — which includes the ENTIRE real-mode loading
// window — so it flashes the Phase-1 demo seed onto a real (live) user's screen before
// the backend resolves. The sanctioned dual-mode read is `useDualQuery` (which returns
// `realEmpty`, never the seed, in real mode). An empty-literal default (`= []` / `= {}`)
// is SAFE and allowed; only an identifier default is the leak.
//
// This scans the ENTIRE src tree (not just src/data) so a future dual-mode hook placed
// anywhere is covered, and fails the build if the leaky pattern reappears.
// ============================================================

// Within a `{ ... } = useQuery` destructure (flat — useQuery results have no nested
// braces), does any `data`/`data: alias` property default to an IDENTIFIER (a seed)?
// `(?:^|,)` anchors the property at the start or after a comma, so siblings in any order
// are caught. An empty-literal default (`= []`/`= {}`) starts with `[`/`{`, not [A-Za-z_$],
// so it is correctly excluded.
const DATA_SEED_DEFAULT = /(?:^|,)\s*data(?:\s*:\s*\w+)?\s*=\s*[A-Za-z_$][\w$.]*/
const DESTRUCTURE = /\{([^{}]+)\}\s*=\s*useQuery/g

function hasSeedLeak(source: string): boolean {
  // strip block + line comments so the guard checks CODE, not prose (useDualQuery.ts's
  // own doc comment legitimately mentions the anti-pattern it replaces).
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  for (const m of code.matchAll(DESTRUCTURE)) {
    if (DATA_SEED_DEFAULT.test(m[1])) return true
  }
  return false
}

const SRC_DIR = dirname(dirname(fileURLToPath(import.meta.url))) // …/src
function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : walk(p)
    return /\.tsx?$/.test(e.name) && !e.name.includes('.test.') && !e.name.endsWith('.d.ts') ? [p] : []
  })
}
const sourceFiles = walk(SRC_DIR)

describe('dual-mode seed-leak guard', () => {
  it('detects the footgun in every spelling, and never on safe forms (not vacuous)', () => {
    // leaks — must be caught, including sibling props in any order + a `data:` rename
    expect(hasSeedLeak('const { data = mockData } = useQuery({')).toBe(true)
    expect(hasSeedLeak('const { data: recipes = mockRecipes } = useQuery({')).toBe(true)
    expect(hasSeedLeak('const { data = mockData, isLoading } = useQuery({')).toBe(true)
    expect(hasSeedLeak('const { isPending, data = mockData } = useQuery({')).toBe(true)
    expect(hasSeedLeak('const { data: blocks = blocksMock, isPending } = useQuery({')).toBe(true)
    // safe forms — must NOT be flagged
    expect(hasSeedLeak('const { data: weightLog = [] } = useQuery({')).toBe(false)
    expect(hasSeedLeak('const { data } = useQuery({')).toBe(false)
    expect(hasSeedLeak('const { data, isLoading } = useQuery({')).toBe(false)
    expect(hasSeedLeak('const { data: blocks, isPending } = useQuery({')).toBe(false)
    expect(hasSeedLeak('const q = useQuery({')).toBe(false) // useDualQuery's own form
  })

  it('no src file defaults a useQuery `data` to a mock seed — use useDualQuery', () => {
    expect(sourceFiles.length).toBeGreaterThan(50) // sanity: the scan actually found files
    const offenders = sourceFiles
      .filter((f) => hasSeedLeak(readFileSync(f, 'utf8')))
      .map((f) => relative(SRC_DIR, f))
    // Any offender leaks the Phase-1 seed into real mode during cold load — switch it to
    // useDualQuery({ ..., realEmpty }) (or an empty-literal default `= []`).
    expect(offenders).toEqual([])
  })
})
