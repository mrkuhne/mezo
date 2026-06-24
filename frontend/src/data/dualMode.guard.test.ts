import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// ============================================================
// Durable guard against the dual-mode seed-leak bug class (mezo-yew / mezo-0xl).
//
// The footgun: `const { data = SEED } = useQuery(...)` (or `{ data: x = SEED }`), where SEED is a
// mock/seed import. The destructuring default fires whenever `data` is undefined — which includes
// the ENTIRE real-mode loading window — so it flashes the Phase-1 demo seed onto a real (live)
// user's screen before the backend resolves. The sanctioned dual-mode read is `useDualQuery`
// (which returns `realEmpty`, never the seed, in real mode). An empty-literal default (`= []` /
// `= {}`) is SAFE and allowed; only an identifier default is the leak.
//
// This test fails the build if the leaky pattern reappears in any src/data hook.
// ============================================================

// `{ data = ident }` or `{ data: alias = ident }` followed by `= useQuery`. `ident` must start
// with a letter/$/_ (a seed import) — an empty literal `[]`/`{}` starts with `[`/`{` and is excluded.
const LEAK = /\{\s*data(?:\s*:\s*\w+)?\s*=\s*[A-Za-z_$][\w$.]*\s*\}\s*=\s*useQuery/

const DATA_DIR = dirname(fileURLToPath(import.meta.url))
const hookFiles = readdirSync(DATA_DIR).filter(
  (f) => f.endsWith('.ts') && !f.endsWith('.d.ts') && !f.includes('.test.'),
)

describe('dual-mode seed-leak guard', () => {
  it('the LEAK regex actually detects the footgun (not vacuous)', () => {
    expect('const { data = mockData } = useQuery({').toMatch(LEAK)
    expect('const { data: recipes = mockRecipes } = useQuery({').toMatch(LEAK)
    // safe forms must NOT match
    expect('const { data: weightLog = [] } = useQuery({').not.toMatch(LEAK)
    expect('const { data } = useQuery({').not.toMatch(LEAK)
  })

  it.each(hookFiles)(
    '%s does not leak a mock seed via a `{ data = seed } = useQuery` default — use useDualQuery',
    (file) => {
      // Strip block + line comments so the guard checks CODE, not prose (useDualQuery.ts's
      // own doc comment legitimately mentions the anti-pattern it replaces).
      const code = readFileSync(join(DATA_DIR, file), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '')
      expect(code).not.toMatch(LEAK)
    },
  )
})
