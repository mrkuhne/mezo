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

// ============================================================
// Second guard: the "manual useDualQuery" shape (mezo-jcpt.10).
//
// `useDualQuery` forces every dual-mode read through a non-optional `realEmpty: T` —
// which is exactly right when a real "empty" value for `T` exists (`[]`, `null`, a
// zeroed struct), but WRONG when it doesn't: inventing one would itself be a fabricated
// value, the very thing `useDualQuery` exists to forbid. `dayEvaluationHooks.ts` is the
// first hook in that position — `DayEvaluationResponse` has no natural empty shape, and
// the hook's own contract is an OPTIONAL `data` (`undefined` while unresolved), not a
// non-null placeholder — so it talks to `useQuery` directly instead.
//
// The hand-rolled equivalent of `useDualQuery`'s invariant is `initialData: <mock-flag>
// ? <seed> : undefined` on a plain (non-destructured) `useQuery` call: mock seeds
// synchronously, real starts (and stays) `undefined` until the fetch resolves, never
// falling back to the seed. The FIRST guard above already passes such a hook — but only
// because it happens to not destructure `data` with a default, the same shape as
// `useDualQuery` itself (`const q = useQuery({` — see the "not vacuous" test above).
// That is an ACCIDENTAL pass: nothing checks that the hand-rolled `initialData` is
// actually gated. This second check makes the acceptance deliberate: any `useQuery`
// call that sets `initialData` must gate the value with `mock[ && <flag2>] ? … :
// undefined` (so it degrades to `undefined`, never the seed, whenever `mock` is false)
// — anything else is the same seed-leak bug class as above, just spelled without a
// destructure default.
//
// The gate is anchored to the LITERAL identifier `mock` (every real caller — `trainHooks.ts`,
// `authHooks.ts`, `dayEvaluationHooks.ts`, `useDualQuery.ts` itself — names its
// `isMockMode()` result exactly that), not an arbitrary identifier: checking only the
// SHAPE `<ident> ? seed : undefined` would let `true ? seed : undefined` (or any other
// always-true non-flag) read as "gated" while leaking the seed into real mode
// unconditionally — precisely the bug class this guard exists to catch.
//
// Excluded by construction (not by name): an `initialData` that lives INSIDE the TRUE
// branch of a `mock ? { … }` object-literal ternary (whole-call, e.g.
// `useQuery(mock ? {...} : {...})` in `trainHooks.ts`'s `useOpenWorkout`, or a partial
// spread, e.g. `...(mock ? { initialData: mockMe, … } : { … })` in `authHooks.ts`'s
// `useMe`) is already safe — it only exists when `mock` is true — so it is not
// re-checked against the ternary-ending-in-`undefined` shape. Redundant WRAPPING parens
// around a safe value (`(mock ? seed : undefined)`) are tolerated — harmless reformatting
// must not turn a green guard red.
// ============================================================

function extractBalancedParen(src: string, openIdx: number): string {
  let depth = 1
  let i = openIdx
  while (i < src.length && depth > 0) {
    if (src[i] === '(') depth++
    else if (src[i] === ')') depth--
    i++
  }
  return src.slice(openIdx, i - 1)
}

function findUseQueryArgs(source: string): string[] {
  const args: string[] = []
  const re = /useQuery\(/g
  let m: RegExpExecArray | null
  while ((m = re.exec(source))) {
    args.push(extractBalancedParen(source, m.index + m[0].length))
  }
  return args
}

function extractBalancedBraceEnd(src: string, openIdx: number): number {
  let depth = 0
  let i = openIdx
  do {
    if (src[i] === '{') depth++
    else if (src[i] === '}') depth--
    i++
  } while (i < src.length && depth > 0)
  return i
}

// Ranges of `{ … }` object literals that are the TRUE branch of a `mock[ && <flag2>] ? {`
// ternary — safe by construction, since the contents only apply when the flag is true.
//
// Anchored to the literal identifier `mock` (every real caller — `trainHooks.ts`,
// `authHooks.ts`, `dayEvaluationHooks.ts`, `useDualQuery.ts` itself — names its
// `isMockMode()` result exactly that): an arbitrary identifier here would accept
// `true ? seed : undefined` as "gated" when `true` is an always-true non-flag, letting the
// seed leak into real mode unconditionally while the guard stays green.
const MOCK_FLAG = /mock(\s*&&\s*[A-Za-z_$][\w$]*)*/
function mockGatedRanges(arg: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = []
  const re = new RegExp(`\\b${MOCK_FLAG.source}\\s*\\?\\s*\\{`, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(arg))) {
    const braceIdx = arg.indexOf('{', m.index)
    ranges.push([braceIdx, extractBalancedBraceEnd(arg, braceIdx)])
  }
  return ranges
}

function extractAllInitialData(arg: string): Array<{ value: string; index: number }> {
  const out: Array<{ value: string; index: number }> = []
  const re = /\binitialData\s*:/g
  let m: RegExpExecArray | null
  while ((m = re.exec(arg))) {
    const colonIdx = arg.indexOf(':', m.index)
    let i = colonIdx + 1
    let depth = 0
    const start = i
    while (i < arg.length) {
      const c = arg[i]
      if (c === '{' || c === '[' || c === '(') depth++
      else if (c === '}' || c === ']' || c === ')') {
        if (depth === 0) break
        depth--
      } else if (c === ',' && depth === 0) break
      i++
    }
    out.push({ value: arg.slice(start, i).trim(), index: m.index })
  }
  return out
}

// Strips redundant WRAPPING parens (`(mock ? seed : undefined)` ~ `mock ? seed : undefined`)
// so harmless reformatting can't turn a safe value into a false failure. Only strips a `(`
// whose matching `)` is the very last character — `(a) + (b)` is left alone.
function stripOuterParens(value: string): string {
  let v = value.trim()
  for (;;) {
    if (!v.startsWith('(') || !v.endsWith(')')) return v
    let depth = 0
    let matchesToEnd = true
    for (let i = 0; i < v.length; i++) {
      if (v[i] === '(') depth++
      else if (v[i] === ')') {
        depth--
        if (depth === 0 && i !== v.length - 1) {
          matchesToEnd = false
          break
        }
      }
    }
    if (!matchesToEnd) return v
    v = v.slice(1, -1).trim()
  }
}

// Safe iff `undefined` outright, or a ternary GATED ON THE LITERAL `mock` FLAG (mirroring
// `mockGatedRanges` above — an arbitrary identifier, e.g. `true ? seed : undefined`, would
// leak the seed into real mode unconditionally while reading as "gated") that DEGRADES to
// literal `undefined` in its real-mode arm.
function isSafeInitialData(valueText: string): boolean {
  const v = stripOuterParens(valueText)
  if (v === 'undefined') return true
  return new RegExp(`^${MOCK_FLAG.source}\\s*\\?[\\s\\S]*:\\s*undefined$`).test(v)
}

function ungatedSeedInitialData(source: string): string[] {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  const offenders: string[] = []
  for (const arg of findUseQueryArgs(code)) {
    const gated = mockGatedRanges(arg)
    for (const { value, index } of extractAllInitialData(arg)) {
      if (gated.some(([s, e]) => index >= s && index < e)) continue // inside a mock-only branch
      if (!isSafeInitialData(value)) offenders.push(value)
    }
  }
  return offenders
}

describe('manual useDualQuery (initialData) seed-leak guard', () => {
  it('flags an ungated seed, and never a properly-gated or mock-only one (not vacuous)', () => {
    // leaks — an initialData that is not `undefined` and not a flag-gated ternary ending
    // in `undefined` hands the seed to real mode unconditionally.
    expect(ungatedSeedInitialData('useQuery({ initialData: mockDayEvaluation(dateIso) })')).toEqual([
      'mockDayEvaluation(dateIso)',
    ])
    expect(
      ungatedSeedInitialData(
        'useQuery({ initialData: mock ? mockDayEvaluation(dateIso) : mockDayEvaluation(dateIso) })',
      ),
    ).toHaveLength(1)
    // an always-true "flag" is not a flag: `true ? seed : undefined` has the right SHAPE
    // but leaks the seed into real mode unconditionally — must be rejected, not accepted
    // as if it were gated on `mock`.
    expect(
      ungatedSeedInitialData('useQuery({ initialData: true ? mockDayEvaluation(dateIso) : undefined })'),
    ).toEqual(['true ? mockDayEvaluation(dateIso) : undefined'])
    // safe forms — must NOT be flagged
    expect(ungatedSeedInitialData('useQuery({ initialData: undefined })')).toEqual([])
    expect(ungatedSeedInitialData('useQuery({ initialData: mock ? seed : undefined })')).toEqual([])
    expect(
      ungatedSeedInitialData('useQuery({ initialData: mock && enabled ? seed : undefined })'),
    ).toEqual([])
    // redundant wrapping parens are harmless reformatting, not a leak — must not go red
    expect(
      ungatedSeedInitialData('useQuery({ initialData: (mock ? seed : undefined) })'),
    ).toEqual([])
    // mock-only branches — the whole-call two-literal ternary (trainHooks' useOpenWorkout)
    // and the partial-options spread (authHooks' useMe) are safe by construction.
    expect(
      ungatedSeedInitialData('useQuery(mock ? { initialData: seed } : { enabled: false })'),
    ).toEqual([])
    expect(
      ungatedSeedInitialData(
        'useQuery({ queryKey: [1], ...(mock ? { initialData: seed, staleTime: Infinity } : { enabled: false }) })',
      ),
    ).toEqual([])
  })

  it('no src file leaks a seed via an ungated useQuery `initialData`', () => {
    expect(sourceFiles.length).toBeGreaterThan(50) // sanity: the scan actually found files
    const offenders = sourceFiles
      .map((f) => ({ f: relative(SRC_DIR, f), hits: ungatedSeedInitialData(readFileSync(f, 'utf8')) }))
      .filter((r) => r.hits.length > 0)
    // Any offender hands its seed to a REAL-mode caller unconditionally — gate it with
    // `<mock-flag> ? seed : undefined` (dayEvaluationHooks.ts's pattern), or route the
    // hook through useDualQuery if `T` does have an honest realEmpty.
    expect(offenders).toEqual([])
  })
})
