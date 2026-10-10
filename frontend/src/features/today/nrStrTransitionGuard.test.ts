import { describe, expect, test } from 'vitest'
// Vite `?raw` import — the CSS source as a string, resolved via the `@/` alias (no fs/path,
// cwd-independent, works identically in vitest and the browser build).
import rawCss from '@/styles/folyadek-nap-rutin.css?raw'
import kitCss from '@/styles/folyadek-kit.css?raw'
import { NR_GLIDE_MS } from '@/features/today/nrGlide'

/**
 * Guard (mezo-3zue.5 finding 7, mezo-apwd; re-pointed in the Folyadék slice F2, mezo-n4wf5.2):
 * on `/nap/rutin` a tick's fresh `strengthPct` GLIDES in — the row's level (`Level`, the kit's
 * `.fo-level i`) slides to its new width while `NrPct` counts the number there. The intent is
 * „number and level move together": both read ONE figure, `NR_GLIDE_MS`.
 *
 * The Folyadék motion rule is the reverse of the old one: the base rule is the final frame and
 * motion exists ONLY inside `@media (prefers-reduced-motion: no-preference)`. So the pin is:
 *  1. the level's width transition is declared, with NR_GLIDE_MS, inside a no-preference block;
 *  2. it is declared nowhere outside one (a reduced-motion user gets no glide, and
 *     `useCountUpOnChange` snaps the number for them too);
 *  3. the kit itself does not animate `.fo-level i` — if it ever does, this page's rule and the
 *     count-up must be tied to the kit's figure instead.
 * No other test asserts on a `transition` value, so nothing else would notice a drift.
 */
const SELECTOR = '.nr2-page .fo-row .fo-level i'
const MOTION_BLOCK_RE = /@media \(prefers-reduced-motion: no-preference\) \{([\s\S]*?)\n\}/g
const motionBlocks = (css: string) => [...css.matchAll(MOTION_BLOCK_RE)].map((m) => m[1]).join('\n')
const rulesOf = (css: string, selector: string) =>
  [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, list]) => list.split(',').map((x) => x.trim().replace(/^\/\*[\s\S]*?\*\/\s*/, '')).includes(selector))
    .map(([, , body]) => body)

describe('the strength level and its number move together on /nap/rutin', () => {
  test(`the level glides for NR_GLIDE_MS (${NR_GLIDE_MS} ms), inside the no-preference block`, () => {
    const rules = rulesOf(motionBlocks(rawCss), SELECTOR)
    expect(rules, `${SELECTOR} has no rule inside @media (prefers-reduced-motion: no-preference)`).toHaveLength(1)
    expect(rules[0]).toMatch(new RegExp(`transition:\\s*width\\s*${NR_GLIDE_MS}ms`))
  })

  test('outside the no-preference block the level has no transition (reduced motion = the final frame)', () => {
    const outside = rawCss.replace(MOTION_BLOCK_RE, '')
    expect(outside).not.toMatch(/transition\s*:/)
    expect(outside).not.toMatch(/animation\s*:/)
  })

  test('the kit does not animate the level itself (else tie the count-up to the kit figure)', () => {
    const kitRules = [...kitCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter(([, list]) => /\.fo-level i\b/.test(list))
      .map(([, , body]) => body)
    for (const body of kitRules) expect(body).not.toMatch(/transition|animation/)
  })
})
