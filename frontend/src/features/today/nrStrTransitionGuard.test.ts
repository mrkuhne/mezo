import { describe, expect, test } from 'vitest'
// Vite `?raw` import — the CSS source as a string, resolved via the `@/` alias (no fs/path,
// cwd-independent, works identically in vitest and the browser build) — the same mechanism
// `features/ritual/reducedMotionGuard.test.ts` / `todayReducedMotion.test.ts` use.
import rawCss from '@/styles/prototype.css?raw'

/**
 * Guard (mezo-3zue.5, whole-branch review finding 7): `.nr-str div` (the lánc-erő bar on
 * `/nap/rutin`) got a NEW `transition: width 380ms …` on the base rule, so a pipa's fresh
 * `strengthPct` glides in rather than jumping (mezo-3zue.5, §2 "erő-csík csusszanás"). The
 * existing reduced-motion scanners (`reducedMotionGuard.test.ts`, `todayReducedMotion.test.ts`)
 * only score ANIMATION longhands (`animation`/`animation-name`) — a `transition` is a different
 * property family, so neither of them would notice if this transition's own reduced-motion
 * override (`transition: none` inside `@media (prefers-reduced-motion: reduce)`, alongside the
 * pre-existing `animation: none` there) went missing: the rest of the suite stays green either
 * way, because no other test asserts on `.nr-str div`'s `transition` value in either mode.
 *
 * This is a narrow, dedicated pin for exactly those two lines.
 */
const BASE_RULE_RE = /\.nr-str div \{([\s\S]*?)\}/
const REDUCED_BLOCKS = [...rawCss.matchAll(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/g)]
  .map((m) => m[1])
  .join('\n')

describe('.nr-str div keeps its width transition guarded under reduced motion (finding 7)', () => {
  test('the base rule declares the 380ms width transition (the glide itself)', () => {
    const m = rawCss.match(BASE_RULE_RE)
    expect(m, '.nr-str div base rule not found in prototype.css').not.toBeNull()
    expect(m![1]).toMatch(/transition:\s*width\s*380ms/)
  })

  test('prefers-reduced-motion: reduce neutralises .nr-str div with transition: none', () => {
    // The selector list in the reduce block is `.nr-str div, .mz-play .nr-str div { … }` —
    // match the rule body that contains `.nr-str div` as one of its selectors.
    const ruleMatch = [...REDUCED_BLOCKS.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .find(([, selectorList]) => selectorList.split(',').map((s) => s.trim()).includes('.nr-str div'))
    expect(ruleMatch, '.nr-str div has no rule inside @media (prefers-reduced-motion: reduce)').toBeDefined()
    expect(ruleMatch![2]).toMatch(/transition:\s*none/)
  })
})
