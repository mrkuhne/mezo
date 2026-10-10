import { describe, expect, it } from 'vitest'
// Vite `?raw` import — the CSS source as a string, resolved via the `@/` alias (no fs/path,
// cwd-independent, works identically in vitest and the browser build).
import rawCss from '@/styles/folyadek-nap-rogzites.css?raw'

/**
 * Reduced-motion guard audit (mezo-mzbz, R4 — spec §9; re-pointed in Folyadék F2, mezo-n4wf5.2).
 * The Napzárás `/ritual` flow and the quick-log surfaces carry their page-level rules in
 * `folyadek-nap-rogzites.css` (the `.nrz-*` and `.nqk-*` families). The Folyadék rule (style bible
 * §8, builder rule 5) is stricter than the old one: the BASE rule is the final, still frame, and
 * every animation and transition is OPT-IN inside `@media (prefers-reduced-motion: no-preference)`
 * — so under `reduce` nothing has to be switched off, because nothing was ever switched on.
 *
 * This is the executable form of that audit: it parses the stylesheet and asserts that
 *   (a) no rule OUTSIDE a `no-preference` block declares an active `animation` or a `transition`;
 *   (b) the file does carry opt-in motion (so the check cannot pass vacuously on a parser regression);
 *   (c) every `@keyframes` the opt-in rules name is defined in the file.
 * The kit's own motion (`.fo-*`: the waves, the filling vials) is guarded the same way in
 * `folyadek-kit.css` and is not this test's subject.
 *
 * A future dev adding an unguarded `.nrz-*` / `.nqk-*` animation fails this test in the normal
 * `pnpm test` gate (both modes).
 *
 * Limitation (documented, not present in the current file): a rule nested inside a non-`@media`
 * block at-rule (`@supports`, `@layer`) would be skipped by the parser. If that ever gets
 * introduced, extend `parseRules` to treat it as a context push.
 */

type MediaCtx = 'reduce' | 'no-preference' | 'other'
type Rule = { selector: string; body: string; media: MediaCtx | null }

/** True if a selector targets this area's families (`.nrz-*` Napzárás, `.nqk-*` quick log). */
function isAreaSelector(sel: string): boolean {
  return sel.includes('.nrz') || sel.includes('.nqk')
}

/** The animation value if the body starts an ACTIVE animation (shorthand or `animation-name`),
 *  or null. `animation: none` and the sub-longhands (`animation-delay`, etc.) do not count. */
function activeAnimation(body: string): string | null {
  const m = body.match(/animation(?:-name)?\s*:\s*([^;]+)/)
  if (!m) return null
  const value = m[1].trim()
  return /^none\b/.test(value) ? null : value
}

/** True if the body declares a `transition` that is not `none`. */
function hasTransition(body: string): boolean {
  const m = body.match(/(?:^|[;\s])transition\s*:\s*([^;]+)/)
  return !!m && !/^none\b/.test(m[1].trim())
}

function splitSelectorList(selectorList: string): string[] {
  return selectorList.split(',').map((s) => s.trim()).filter(Boolean)
}

/** Minimal brace-aware CSS scanner: emits every style rule with the reduced-motion media
 *  context it sits in. `@keyframes`/`@font-face`/other non-`@media` block at-rules are skipped
 *  wholesale (their contents are never selector rules we audit). */
function parseRules(css: string): Rule[] {
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const rules: Rule[] = []
  const mediaStack: MediaCtx[] = []
  let buf = ''
  let i = 0
  while (i < noComments.length) {
    const ch = noComments[i]
    if (ch === '{') {
      const header = buf.trim()
      buf = ''
      if (header.startsWith('@media')) {
        let media: MediaCtx = 'other'
        if (/prefers-reduced-motion\s*:\s*reduce/.test(header)) media = 'reduce'
        else if (/prefers-reduced-motion\s*:\s*no-preference/.test(header)) media = 'no-preference'
        mediaStack.push(media)
        i++
      } else if (header.startsWith('@')) {
        // @keyframes / @font-face / etc. — skip the whole (possibly nested) block.
        let depth = 1
        i++
        while (i < noComments.length && depth > 0) {
          if (noComments[i] === '{') depth++
          else if (noComments[i] === '}') depth--
          i++
        }
      } else {
        // A style rule — capture its body up to the matching close brace.
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
        rules.push({ selector: header, body, media: mediaStack[mediaStack.length - 1] ?? null })
      }
    } else if (ch === '}') {
      mediaStack.pop()
      buf = ''
      i++
    } else {
      buf += ch
      i++
    }
  }
  return rules
}

const rules = parseRules(rawCss)

// Rules that move OUTSIDE the opt-in block: each one is a violation.
const unguarded: Array<{ selector: string; what: string }> = []
// Rules that move INSIDE it: the sanctioned place.
const optIn: Array<{ selector: string; animation: string | null }> = []
for (const rule of rules) {
  const animation = activeAnimation(rule.body)
  const transition = hasTransition(rule.body)
  if (!animation && !transition) continue
  for (const selector of splitSelectorList(rule.selector)) {
    if (rule.media === 'no-preference') optIn.push({ selector, animation })
    else unguarded.push({ selector, what: animation ? `animation: ${animation}` : 'transition' })
  }
}

const keyframes = new Set([...rawCss.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]))

describe('reduced-motion guard — Napzárás + quick log motion (mezo-mzbz, Folyadék F2)', () => {
  it('parses the stylesheet and finds this area\'s rules (guards against a vacuous pass)', () => {
    expect(rules.filter((r) => splitSelectorList(r.selector).some(isAreaSelector)).length).toBeGreaterThanOrEqual(30)
    expect(optIn.filter((o) => o.animation).length).toBeGreaterThanOrEqual(1)
    expect(optIn.every((o) => isAreaSelector(o.selector))).toBe(true)
  })

  it('declares every animation and transition inside prefers-reduced-motion: no-preference', () => {
    expect(
      unguarded,
      `Motion outside the opt-in block: ${unguarded.map((u) => `${u.selector} (${u.what})`).join('; ')}. ` +
        'Move it into the `@media (prefers-reduced-motion: no-preference)` block at the tail of ' +
        'folyadek-nap-rogzites.css — the base rule must be the final, still frame.',
    ).toEqual([])
  })

  it('never needs a reduce block: nothing is switched on outside the opt-in', () => {
    expect(rules.filter((r) => r.media === 'reduce')).toEqual([])
  })

  it('defines every keyframes animation the opt-in rules name', () => {
    for (const { selector, animation } of optIn) {
      if (!animation) continue
      const name = animation.split(/\s+/)[0]
      expect(keyframes.has(name), `${selector} runs \`${name}\`, which this file does not define`).toBe(true)
    }
  })
})
