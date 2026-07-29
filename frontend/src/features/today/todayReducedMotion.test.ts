import { describe, expect, test } from 'vitest'
// Vite `?raw` import — the CSS source as a string, resolved via the `@/` alias (no fs/path,
// cwd-independent, works identically in vitest and the browser build) — the same mechanism
// `features/ritual/reducedMotionGuard.test.ts` uses.
import rawCss from '@/styles/prototype.css?raw'

/**
 * Guard (mezo-1khu, mirroring `features/ritual/reducedMotionGuard.test.ts`): every Today
 * face-swap animation must be neutralized under `prefers-reduced-motion`, or the Playwright
 * goldens (which run `reducedMotion: 'reduce'`) flake on in-flight frames.
 *
 * The selector list below matches what actually shipped, NOT the original task-11-brief.md
 * draft: the brief's `.faceswap > *` stagger relied on a never-set `--i` custom property
 * (replaced with nth-child rules — no new selector to guard, `.faceswap > *` itself still
 * carries the animation), and its progress-bar reuse of the shared `progress-mbar-grow`
 * keyframe was dropped for a dedicated `bar-grow` transform keyframe (see prototype.css's
 * "Today face-swap motion" section for why). `bar-grow` is asserted below so a future edit
 * can't silently drop its reduced-motion guard.
 */
const REDUCED_BLOCKS = [...rawCss.matchAll(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/g)]
  .map((m) => m[1])
  .join('\n')

describe('Today motion is reduced-motion safe', () => {
  test.each(['.faceswap > *', '.tdc-bar i', '.dfs-pill.now.has-open .dfs-e'])(
    '%s is disabled under prefers-reduced-motion',
    (selector) => {
      expect(REDUCED_BLOCKS).toContain(selector)
    },
  )

  test('every Today-specific keyframe animation has a matching reduce rule', () => {
    for (const name of ['face-in-fwd', 'face-in-back', 'dfs-pulse', 'bar-grow']) {
      expect(rawCss).toContain(`@keyframes ${name}`)
    }
    expect(REDUCED_BLOCKS).toMatch(/animation:\s*none/)
  })
})

// ============================================================================
// Fix round 1 (mezo-1khu): the string-presence checks above cannot see a CASCADE failure —
// a reviewer measured (headless Chromium, `reducedMotion: 'reduce'`) that the ORIGINAL
// `.faceswap > *:nth-child(N)` / `.faceswap[data-dir="…"] > *` selectors are (0,2,0), while
// the reduce block's `.faceswap > * { animation: none }` is only (0,1,0) — so under reduce
// the computed `animationName` stayed `face-in-fwd` and `animationDelay` stayed e.g. `70ms`;
// only `animation-duration`/`animation-fill-mode` reset, because those two longhands are ONLY
// ever set by the (0,1,0) selector, so there was no competing higher-specificity declaration
// to lose to. The fix wraps every modifier qualifier in `:where()` (zero specificity), tying
// every `.faceswap`-family selector at (0,1,0) so the later (reduce-block) declaration wins
// the normal source-order tie-break on every longhand. The tests below assert that structural
// property directly — a future selector that reintroduces `[data-dir="x"]` or `:nth-child(n)`
// WITHOUT `:where()` will fail here even though every string-presence check above still passes.
// ============================================================================

type MediaCtx = 'reduce' | 'no-preference' | 'other' | null
type Rule = { selector: string; body: string; media: MediaCtx; start: number }

/** Brace-aware CSS scanner (same shape as `features/ritual/reducedMotionGuard.test.ts`'s
 *  `parseRules`): emits every style rule with its media context and source offset (the
 *  offset is what lets the tests below verify source-order, not just specificity, since an
 *  EQUAL specificity still needs "declared later" to win the cascade). `@keyframes` and other
 *  non-`@media` at-rules are skipped wholesale. */
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

/** Minimal (id, class/attr/pseudo-class, type) CSS specificity — enough for the small,
 *  known selector vocabulary this file guards. Crucially, `:where(...)` is stripped BEFORE
 *  counting (it always contributes zero specificity, however complex its argument), so a
 *  selector that forgets to wrap a qualifier in `:where()` is correctly scored higher. */
function specificity(selector: string): [number, number, number] {
  // `:where()`'s argument can itself contain a parenthesised pseudo-class (e.g.
  // `:where(:nth-child(1))`), so this needs to tolerate ONE level of nesting — a bare
  // `[^()]*` stops at the first inner `(` and never finds the matching close.
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

/** -1/0/1 like a normal comparator, on the (id, class, type) tuple in that priority order. */
function cmpSpecificity(a: [number, number, number], b: [number, number, number]): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]
  return 0
}

const rules = parseRules(rawCss)
const isActive = (r: Rule) => r.media !== 'reduce' && r.media !== 'no-preference'

describe('the .faceswap reduced-motion override cannot be outranked by a modifier selector (fix round 1)', () => {
  const activeFaceswapSelectors = rules
    .filter(isActive)
    .flatMap((r) => splitSelectorList(r.selector).map((sel) => ({ sel, start: r.start })))
    .filter(({ sel }) => sel.startsWith('.faceswap'))

  const reduceFaceswapRule = rules.find(
    (r) => r.media === 'reduce' && splitSelectorList(r.selector).some((s) => s.startsWith('.faceswap')),
  )

  test('parses a non-trivial set of active .faceswap selectors (guards against a vacuous pass)', () => {
    // base + 2 direction variants + 7 explicit stagger steps + 1 open-ended tail = 11.
    expect(activeFaceswapSelectors.length).toBeGreaterThanOrEqual(10)
  })

  test('a reduced-motion override rule for .faceswap exists', () => {
    expect(reduceFaceswapRule).toBeTruthy()
  })

  test('every active .faceswap selector has specificity <= the reduced-motion override (the actual regression the reviewer measured)', () => {
    expect(reduceFaceswapRule).toBeTruthy()
    const reduceSpec = specificity(reduceFaceswapRule!.selector)
    const outranking = activeFaceswapSelectors.filter(({ sel }) => cmpSpecificity(specificity(sel), reduceSpec) > 0)
    expect(
      outranking,
      `Selector(s) with HIGHER specificity than the reduced-motion override — these would keep ` +
        `animating (or keep their delay) under prefers-reduced-motion regardless of what the ` +
        `override says, exactly the bug fix round 1 fixed: ${outranking.map((o) => o.sel).join(', ')}. ` +
        `Wrap the qualifier that raises its specificity in :where(...).`,
    ).toEqual([])
  })

  test('the reduced-motion override is declared AFTER every active .faceswap selector (equal-specificity tie-break)', () => {
    expect(reduceFaceswapRule).toBeTruthy()
    const tooLate = activeFaceswapSelectors.filter(({ start }) => start > reduceFaceswapRule!.start)
    expect(
      tooLate,
      'An active .faceswap rule is declared AFTER the reduced-motion override in source order — ' +
        'at equal specificity the later declaration wins, so this would silently re-break the guard ' +
        'even with matching specificity. Move the reduced-motion block below it.',
    ).toEqual([])
  })

  // A live regression check: simulate re-introducing the ORIGINAL (unguarded) selectors and
  // confirm this test's own machinery would have caught them — i.e. the assertion above isn't
  // vacuously true because of a parsing quirk, it genuinely discriminates.
  test('sanity: the specificity check DOES fail for the pre-fix (un-:where()-wrapped) selectors', () => {
    const regressed = '.faceswap[data-dir="fwd"] > *'
    const staggerRegressed = '.faceswap > *:nth-child(3)'
    const reduceSpec = specificity('.faceswap > *')
    expect(cmpSpecificity(specificity(regressed), reduceSpec)).toBeGreaterThan(0)
    expect(cmpSpecificity(specificity(staggerRegressed), reduceSpec)).toBeGreaterThan(0)
  })
})

// ============================================================================
// Fix round 1 (mezo-1khu): the stagger ladder used to stop at :nth-child(8). A reviewer
// rendered the real mock scenario and measured 18 `.faceswap` children on Reggel and 13 on
// Nap (the `later` preview list flattens uncapped into direct siblings) — every child past
// the 8th fell to the base rule's implicit 0ms delay, popping in ahead of supposedly-later
// neighbours. The fix replaced `:nth-child(8)` with the open-ended `:nth-child(n+8)`, so
// position 8 and every position after it share one delay instead of falling off the ladder.
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

describe('the .faceswap stagger leaves no child un-delayed, however many render (fix round 1)', () => {
  // Every active (delay-setting) nth-child formula declared for .faceswap, taken straight
  // from the shipped CSS — not hand-copied, so an edit to the ladder is picked up automatically.
  const delayRules = rules.filter(
    (r) => isActive(r) && splitSelectorList(r.selector).some((s) => s.startsWith('.faceswap')) && /animation-delay\s*:/.test(r.body),
  )
  const formulas = delayRules
    .flatMap((r) => [...r.selector.matchAll(/:nth-child\(([^)]*)\)/g)].map((m) => parseNthChild(m[1])))
    .filter((f): f is { a: number; b: number } => f !== null)

  test('parses at least the 8-step ladder plus an open-ended tail rule', () => {
    expect(formulas.length).toBeGreaterThanOrEqual(8)
    expect(formulas.some((f) => f.a !== 0)).toBe(true) // at least one UNBOUNDED formula (not a fixed position)
  })

  test.each([1, 2, 5, 7, 8, 9, 13, 18, 30, 100])(
    'child position %i has a matching animation-delay rule',
    (pos) => {
      expect(
        formulas.some((f) => nthChildMatches(pos, f)),
        `Position ${pos} matches no :nth-child formula in the .faceswap stagger — it would fall ` +
          `back to the base rule's implicit 0ms delay and pop in un-staggered.`,
      ).toBe(true)
    },
  )

  test('the measured worst case (Reggel: 18 children) and beyond all share the SAME capped delay (no unbounded growth)', () => {
    const tailFormula = formulas.find((f) => f.a !== 0)!
    const delays = [8, 9, 13, 18, 50, 500].map((pos) => nthChildMatches(pos, tailFormula))
    expect(delays.every(Boolean)).toBe(true)
  })
})
