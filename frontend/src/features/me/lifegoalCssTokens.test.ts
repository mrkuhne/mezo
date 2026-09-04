import { describe, expect, test } from 'vitest'
// Vite `?raw` import — the CSS source as a string, the same fixture the sibling
// `todayCssTokens` / `mozaikCssTokens` guards read.
import rawCss from '@/styles/prototype.css?raw'

/**
 * Guards for the life-goal (`lg-*`) CSS family — the two bugs of mezo-7eq0 / mezo-hhdo, both of
 * which shipped through every existing gate and were only found by measuring the real page.
 *
 * WHY THE EXISTING GATES WERE BLIND TO THEM:
 *  - `mozaikCssTokens` pins the theme-readiness of `--mz-*` ONLY, so the `lg-*` family could
 *    hardcode light hexes (`#fff` grounds, `#6E6257`/`#A2958A` inks) and read white-on-white in
 *    dark mode without a single test noticing (mezo-hhdo).
 *  - the Playwright visual suite runs with `reducedMotion: 'reduce'`, and the reduced-motion
 *    guard settles the entrance choreography — so a broken choreography renders CORRECTLY in
 *    every golden while being invisible in a real browser (mezo-7eq0). Screenshots can never
 *    catch this class of bug; only a source-level invariant can.
 */

/** The `lg-*` rules: from the first dimension-token rule to the Today section that follows. */
function lifegoalBlock(css: string): string {
  const start = css.indexOf('\n.lg-d-p')
  const end = css.indexOf('Today · maradék sheet-nyelv', start)
  expect(start).toBeGreaterThan(-1)
  expect(end).toBeGreaterThan(start)
  return css.slice(start, end)
}

/** CSS comments stripped — a selector named inside prose is documentation, not a rule. */
function withoutComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

function blockBody(css: string, selector: RegExp): string {
  const m = css.match(selector)
  if (!m) throw new Error(`block not found: ${selector}`)
  return m[1]
}

function declared(body: string): Set<string> {
  return new Set([...body.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)].map((m) => m[1]))
}

describe('life-goal CSS is theme-ready at the token level (mezo-hhdo)', () => {
  test('every --lg-* token the block reads is declared in :root AND overridden for dark', () => {
    const block = lifegoalBlock(rawCss)
    // `--dc`/`--dw`/`--dw2`/`--ds` are LOCAL: the `.lg-d-*` rules declare them on the same
    // element that reads them, mapping a dimension onto the global tokens below.
    const local = new Set(['--dc', '--dw', '--dw2', '--ds', '--d', '--i', '--p'])
    const used = new Set(
      [...block.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)/g)].map((m) => m[1]).filter((p) => !local.has(p)),
    )
    expect(used.size).toBeGreaterThan(10)

    const light = declared(blockBody(rawCss, /(?:^|\n):root[ \t]*\{([^}]*)\}/))
    const dark = declared(blockBody(rawCss, /(?:^|\n):root\[data-theme="dark"\][ \t]*\{([^}]*)\}/))

    // Everything the block reads must at least EXIST globally (the `--td-gut` trap).
    expect([...used].filter((p) => !light.has(p)).sort()).toEqual([])
    // Only the family's OWN tokens must additionally flip with the theme. A shared global like
    // `--ff-display` (a font stack) or `--gradient-cta` is deliberately theme-independent.
    const own = [...used].filter((p) => p.startsWith('--lg-'))
    expect(own.length).toBeGreaterThan(10)
    expect(own.filter((p) => !dark.has(p)).sort()).toEqual([])
  })

  test('the block carries no raw hex colour — a light hex in a rule cannot follow the theme', () => {
    const offenders = lifegoalBlock(rawCss)
      .split('\n')
      .filter((line) => /#[0-9A-Fa-f]{3,8}\b/.test(line))
      .map((line) => line.trim())
    expect(offenders).toEqual([])
  })
})

describe('life-goal entrance choreography is armed and degrades visible (mezo-7eq0)', () => {
  test('the arming class is `mz-play` — a bare `.play` selector never matches anything', () => {
    // `EntranceGroup` (shared/ui/mozaik/motion.tsx) puts `mz-play` on the wrapper. The original
    // rules said `.play`, so they matched NOTHING: the dots and the PERMAH ring arcs sat at
    // their hidden base state forever, on every surface that renders them.
    const stray = withoutComments(rawCss)
      .split('\n')
      .filter((line) => /(?<![-\w])\.play\s/.test(line))
      .map((line) => line.trim())
    expect(stray).toEqual([])
  })

  test('the HIDDEN start state is scoped under .mz-play, never unconditional', () => {
    // The house pattern (`.mz-play .rise { opacity: 0 }`): without the arming class the element
    // renders SETTLED, i.e. visible. An unconditional hidden base state is a permanent
    // disappearance on any render that is not armed — and `EntranceGroup` deliberately withholds
    // the class on a pop arrival (swipe-back, mezo-kuwj), which is the common navigation.
    const block = lifegoalBlock(rawCss)

    const dotBase = block.match(/\n\.lg-wk7 i \{[^}]*\}/)?.[0] ?? ''
    expect(dotBase).not.toBe('')
    expect(dotBase).not.toMatch(/transform:\s*scale\(0\)/)

    const arcBase = block.match(/\n\.lg-ring \.arc \{[^}]*\}/)?.[0] ?? ''
    expect(arcBase).not.toBe('')
    expect(arcBase).not.toMatch(/stroke-dasharray:\s*0\s/)

    // …and the armed rules must carry it instead.
    expect(block).toMatch(/\.mz-play \.lg-wk7 i \{[^}]*transform:\s*scale\(0\)/)
    expect(block).toMatch(/\.mz-play \.lg-ring \.arc \{[^}]*stroke-dasharray:\s*0 /)
  })
})
