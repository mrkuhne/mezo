import { describe, expect, test } from 'vitest'
// Vite `?raw` import — the CSS source as a string, resolved via the `@/` alias (no fs/path,
// cwd-independent, works identically in vitest and the browser build) — the same mechanism
// `features/ritual/reducedMotionGuard.test.ts` uses.
import rawCss from '@/styles/prototype.css?raw'

/**
 * Guard (mezo-1khu heritage, re-anchored onto the three-islands CSS by mezo-euze): the `.isl-*`
 * blob morph, floating capsules and L1 row stagger must be neutralized under
 * `prefers-reduced-motion`, or the Playwright goldens (which run `reducedMotion: 'reduce'`)
 * flake on in-flight frames.
 *
 * Two subjects this file used to guard are GONE after the Design 2.0 cleanup (mezo-d20.9.1),
 * and their tests went with the CSS they measured:
 *   · Today's `.dayview` fade-in (`isl-phasein`) — deleted with `TodayPage` and its daypart views;
 *   · `WindowIsland` — retired by the Fuel hub's window swimlane, so the surviving `.isl-*`
 *     rules are carried by Fuel's own belt/keret surfaces.
 * The file keeps its name and its home under `features/today/` because the cascade scanner
 * below is the general-purpose part and still guards Fuel's three families in the same
 * stylesheet.
 *
 * Structural contract carried over from the retired `.faceswap` guard: every modifier
 * qualifier (delay variants, nth-child stagger) is `:where()`-wrapped, so no active selector
 * can outrank its reduce-block override — the override wins on the source-order tie-break
 * at equal (or higher) specificity, on EVERY animation longhand including `animation-delay`.
 */
const REDUCED_BLOCKS = [...rawCss.matchAll(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/g)]
  .map((m) => m[1])
  .join('\n')

describe('the island family (Fuel-owned) is reduced-motion safe', () => {
  // These three are Fuel's — the `.isl`/`.isl-l1` shell lives in `shared/ui/Island.tsx` and
  // Fuel's belt/keret components now, not Today.
  test.each([
    ':where(.isl.isl-big) .isl-blob',
    ':where(.isl:not(.isl-big))',
    ':where(.isl-l1) .itemrow',
  ])('%s is disabled under prefers-reduced-motion', (selector) => {
    expect(REDUCED_BLOCKS).toContain(selector)
  })

  test('the retired Today day-view motion really is gone from the stylesheet (no orphan rule ' +
    'left running unguarded)', () => {
    expect(rawCss).not.toContain('.dayview')
    expect(rawCss).not.toContain('isl-phasein')
  })

  test('every island-motion keyframe (Fuel) has a matching reduce rule', () => {
    for (const name of ['isl-morph', 'isl-floaty', 'isl-rowin']) {
      expect(rawCss).toContain(`@keyframes ${name}`)
    }
    expect(REDUCED_BLOCKS).toMatch(/animation:\s*none/)
  })
})

// ============================================================================
// The cascade guard (fix round 1 heritage): string-presence checks cannot see a CASCADE
// failure — an active selector at higher specificity than its reduce override keeps its
// animation longhands under `prefers-reduced-motion` regardless of what the override says.
// The scanner below scores every active island-motion selector against its family's reduce
// override: a future selector that reintroduces `[data-face="x"]` or `:nth-child(n)` WITHOUT
// `:where()` fails here even though every string-presence check above still passes.
// ============================================================================

type MediaCtx = 'reduce' | 'no-preference' | 'other' | null
type Rule = { selector: string; body: string; media: MediaCtx; start: number }

/** Brace-aware CSS scanner (same shape as `features/ritual/reducedMotionGuard.test.ts`). */
function parseRules(css: string): Rule[] {
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const rules: Rule[] = []
  const mediaStack: MediaCtx[] = []
  let buf = ''
  let bufStart = 0
  let i = 0
  while (i < noComments.length) {
    const ch = noComments[i]
    if (ch === '{') {
      const header = buf.trim()
      const headerStart = bufStart
      buf = ''
      if (header.startsWith('@media')) {
        let media: MediaCtx = 'other'
        if (/prefers-reduced-motion\s*:\s*reduce/.test(header)) media = 'reduce'
        else if (/prefers-reduced-motion\s*:\s*no-preference/.test(header)) media = 'no-preference'
        mediaStack.push(media)
        i++
        bufStart = i
      } else if (header.startsWith('@')) {
        let depth = 1
        i++
        while (i < noComments.length && depth > 0) {
          if (noComments[i] === '{') depth++
          else if (noComments[i] === '}') depth--
          i++
        }
        bufStart = i
      } else {
        let depth = 1
        let body = ''
        i++
        while (i < noComments.length && depth > 0) {
          const c = noComments[i]
          if (c === '{') depth++
          else if (c === '}') {
            depth--
            if (depth === 0) { i++; break }
          }
          body += c
          i++
        }
        rules.push({ selector: header, body, media: mediaStack[mediaStack.length - 1] ?? null, start: headerStart })
        bufStart = i
      }
    } else if (ch === '}') {
      mediaStack.pop()
      buf = ''
      i++
      bufStart = i
    } else {
      buf += ch
      i++
    }
  }
  return rules
}

function splitSelectorList(selectorList: string): string[] {
  return selectorList.split(',').map((s) => s.trim()).filter(Boolean)
}

/** Minimal (id, class/attr/pseudo-class, type) CSS specificity — `:where(...)` is stripped
 *  BEFORE counting (it always contributes zero specificity), so a selector that forgets to
 *  wrap a qualifier in `:where()` is correctly scored higher. */
function specificity(selector: string): [number, number, number] {
  const s = selector.replace(/:where\((?:[^()]|\([^()]*\))*\)/g, '')
  const ids = (s.match(/#[\w-]+/g) ?? []).length
  const classes = (s.match(/\.[\w-]+/g) ?? []).length
  const attrs = (s.match(/\[[^\]]*\]/g) ?? []).length
  const pseudoClasses = (s.match(/:(?!:)[\w-]+(\([^()]*\))?/g) ?? []).length
  const stripped = s
    .replace(/#[\w-]+/g, '')
    .replace(/\.[\w-]+/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/:(?!:)[\w-]+(\([^()]*\))?/g, '')
  const types = stripped.split(/[\s>+~]+/).map((t) => t.trim()).filter((t) => t && t !== '*').length
  return [ids, classes + attrs + pseudoClasses, types]
}

function cmpSpecificity(a: [number, number, number], b: [number, number, number]): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]
  return 0
}

const rules = parseRules(rawCss)
const isActive = (r: Rule) => r.media !== 'reduce' && r.media !== 'no-preference'

/** The three island motion families (Fuel-owned: `shared/ui/Island.tsx` +
 *  Fuel's belt/keret surfaces): which ACTIVE selectors belong to each (by token) and which
 *  reduce-block override must dominate them. Three families this guard used to cover are
 *  retired: the evening `.isl-phase` swap (with the island components, mezo-puci), Today's
 *  `.dayview` phase-in (with TodayPage, mezo-d20.9.1) and WindowIsland (with the Fuel
 *  swimlane, mezo-d20.9.1). */
const FAMILIES = [
  { name: 'blob morph', token: '.isl-blob', override: ':where(.isl.isl-big) .isl-blob' },
  { name: 'capsule floaty', token: ':not(.isl-big)', override: ':where(.isl:not(.isl-big))' },
  { name: 'L1 row stagger', token: '.isl-l1', override: ':where(.isl-l1) .itemrow' },
] as const

describe('the Fuel island reduced-motion overrides cannot be outranked (cascade guard)', () => {
  const animating = rules
    .filter(isActive)
    .filter((r) => /animation(-\w+)?\s*:/.test(r.body))
    .flatMap((r) => splitSelectorList(r.selector).map((sel) => ({ sel, start: r.start })))
    .filter(({ sel }) => sel.includes('.isl'))

  test('parses a non-trivial set of animating island selectors (guards against a vacuous pass)', () => {
    // blob + floaty base + rowin base + 7 stagger steps (nth-child 2-7 + open tail) = 10.
    expect(animating.length).toBeGreaterThanOrEqual(10)
  })

  test.each(FAMILIES.map((f) => [f.name, f] as const))('%s: override exists, dominates and is declared last', (_n, family) => {
    const overrideRule = rules.find(
      (r) => r.media === 'reduce' && splitSelectorList(r.selector).some((s) => s === family.override),
    )
    expect(overrideRule, `no reduce override rule for ${family.override}`).toBeTruthy()
    const overrideSpec = specificity(family.override)
    const members = animating.filter(({ sel }) => sel.includes(family.token))
    expect(members.length, `no active selectors matched token ${family.token}`).toBeGreaterThan(0)
    const outranking = members.filter(({ sel }) => cmpSpecificity(specificity(sel), overrideSpec) > 0)
    expect(
      outranking.map((o) => o.sel),
      `Selector(s) with HIGHER specificity than the reduced-motion override — wrap the ` +
        `qualifier in :where(...)`,
    ).toEqual([])
    const tooLate = members.filter(({ start }) => start > overrideRule!.start)
    expect(
      tooLate.map((o) => o.sel),
      'An active island motion rule is declared AFTER its reduced-motion override — move the reduce block below it.',
    ).toEqual([])
  })

  test('sanity: the specificity check DOES fail for an un-:where()-wrapped qualifier', () => {
    expect(cmpSpecificity(specificity('.isl[data-face="este"]:not(.isl-big)'), specificity(':where(.isl:not(.isl-big))'))).toBeGreaterThan(0)
    expect(cmpSpecificity(specificity('.isl-l1 .itemrow:nth-child(3)'), specificity(':where(.isl-l1) .itemrow'))).toBeGreaterThan(0)
  })
})

// ============================================================================
// The stagger ladder must leave no child un-delayed, however many rows an L1 renders —
// the `.faceswap` :nth-child(n+8) open-tail lesson, carried over verbatim.
// ============================================================================

function parseNthChild(arg: string): { a: number; b: number } | null {
  const t = arg.trim()
  if (/^\d+$/.test(t)) return { a: 0, b: Number(t) }
  if (/^n$/.test(t)) return { a: 1, b: 0 }
  const m = t.match(/^(-?\d*)n\s*([+-]\s*\d+)?$/)
  if (!m) return null
  const a = m[1] === '' ? 1 : m[1] === '-' ? -1 : Number(m[1])
  const b = m[2] ? Number(m[2].replace(/\s+/g, '')) : 0
  return { a, b }
}

function nthChildMatches(pos: number, formula: { a: number; b: number }): boolean {
  const { a, b } = formula
  if (a === 0) return pos === b
  const k = (pos - b) / a
  return Number.isInteger(k) && k >= 0
}

describe('the L1 stagger leaves no row un-delayed, however many render', () => {
  const delayRules = rules.filter(
    (r) => isActive(r) && splitSelectorList(r.selector).some((s) => s.includes('.isl-l1')) && /animation-delay\s*:/.test(r.body),
  )
  const formulas = delayRules
    .flatMap((r) => [...r.selector.matchAll(/:nth-child\(([^)]*)\)/g)].map((m) => parseNthChild(m[1])))
    .filter((f): f is { a: number; b: number } => f !== null)

  test('parses the explicit ladder plus an open-ended tail rule', () => {
    expect(formulas.length).toBeGreaterThanOrEqual(7)
    expect(formulas.some((f) => f.a !== 0)).toBe(true) // at least one UNBOUNDED formula
  })

  test.each([2, 3, 5, 7, 8, 9, 13, 18, 30, 100])(
    'row position %i has a matching animation-delay rule',
    (pos) => {
      expect(
        formulas.some((f) => nthChildMatches(pos, f)),
        `Position ${pos} matches no :nth-child formula in the L1 stagger — it would fall ` +
          `back to the base rule's implicit 0ms delay and pop in un-staggered.`,
      ).toBe(true)
    },
  )

  test('deep positions all share the SAME capped tail delay (no unbounded growth)', () => {
    const tailFormula = formulas.find((f) => f.a !== 0)!
    const matches = [8, 9, 13, 18, 50, 500].map((pos) => nthChildMatches(pos, tailFormula))
    expect(matches.every(Boolean)).toBe(true)
  })
})
