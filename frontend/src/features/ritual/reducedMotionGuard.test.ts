import { describe, expect, it } from 'vitest'
// Vite `?raw` import — the CSS source as a string, resolved via the `@/` alias (no fs/path,
// cwd-independent, works identically in vitest and the browser build).
import rawCss from '@/styles/prototype.css?raw'

/**
 * Reduced-motion guard audit (mezo-mzbz, R4 — spec §9). The Napzárás `/ritual` flow and its
 * Today entry card lean heavily on CSS animation (the `rz-*`, `.ritcard*`, and shared
 * `.np-anim` families in `prototype.css`). ADR-0010-tone accessibility requires every one of
 * those animations to be neutralised under `@media (prefers-reduced-motion: reduce)` — and the
 * visual goldens (`tests/visual/visual.spec.ts`) only stay deterministic BECAUSE they are.
 *
 * This is the executable form of that audit: it parses `prototype.css`, finds every
 * ritual-family selector that declares an ACTIVE animation outside a reduced-motion media
 * query, and asserts each is neutralised under reduce by one of three sanctioned mechanisms:
 *   (a) an explicit `animation: none` on the same selector inside a `prefers-reduced-motion:
 *       reduce` block (the dominant pattern);
 *   (b) the animation is declared inside a `prefers-reduced-motion: no-preference` block, so it
 *       is opt-in and simply never runs under reduce (`.ritcard-moon`'s breathing);
 *   (c) the selector is in the explicit ANCESTOR_NEUTRALISED allowlist — its animation is killed
 *       by an ANCESTOR set to `display: none` under reduce, not by an `animation: none` on itself
 *       (`.rz-conf i` confetti, whose `.rz-conf` container is hidden). Each allowlist entry is
 *       re-verified below so it cannot rot silently.
 *
 * A future dev adding an unguarded `rz-*`/`ritcard`/`np-anim` animation fails this test in the
 * normal `pnpm test` gate (both modes), before it ever reaches the visual job.
 *
 * Limitation (documented, not present in the current file): a ritual animation nested inside a
 * non-`@media` block at-rule (`@supports`, `@layer`) would be skipped by the parser. If that
 * ever gets introduced, extend `parseRules` to treat it as a context push.
 */

type MediaCtx = 'reduce' | 'no-preference' | 'other'
type Rule = { selector: string; body: string; media: MediaCtx | null }

/** True if a selector targets a ritual-surface family (`.rz-*`, `.ritcard*`, `.np-anim`). */
function isRitualSelector(sel: string): boolean {
  return sel.includes('.rz-') || sel.includes('.ritcard') || sel.includes('.np-anim')
}

/** The animation value if the body starts an ACTIVE animation (shorthand or `animation-name`),
 *  or null. `animation: none` and the sub-longhands (`animation-delay`, etc.) do not count. */
function activeAnimation(body: string): string | null {
  const m = body.match(/animation(?:-name)?\s*:\s*([^;]+)/)
  if (!m) return null
  const value = m[1].trim()
  return /^none\b/.test(value) ? null : value
}

function bodyHas(body: string, prop: 'animation' | 'display', value: 'none'): boolean {
  return new RegExp(`${prop}\\s*:\\s*${value}\\b`).test(body)
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

// Selectors whose animation is killed by an ANCESTOR `display: none` under reduce (mechanism c),
// each with the ancestor that does it. Re-verified below so a stale entry fails the test.
const ANCESTOR_NEUTRALISED: Array<{ selector: string; ancestor: string }> = [
  // Confetti particles animate (rz-fall), but `.rz-conf` (their container) is display:none under
  // reduce — they never render, so no per-particle `animation: none` is needed.
  { selector: '.rz-conf i', ancestor: '.rz-conf' },
]

const rules = parseRules(rawCss)

// Individual selectors set to `animation: none` inside a reduce block (mechanism a).
const reduceAnimationNone = new Set<string>()
// Individual selectors set to `display: none` inside a reduce block (verifies mechanism c).
const reduceDisplayNone = new Set<string>()
for (const rule of rules) {
  if (rule.media !== 'reduce') continue
  if (bodyHas(rule.body, 'animation', 'none')) splitSelectorList(rule.selector).forEach((s) => reduceAnimationNone.add(s))
  if (bodyHas(rule.body, 'display', 'none')) splitSelectorList(rule.selector).forEach((s) => reduceDisplayNone.add(s))
}

// Ritual-family selectors with an ACTIVE animation OUTSIDE any reduced-motion media query
// (null or a non-reduced-motion `@media`). `no-preference` and `reduce` contexts are excluded:
// the former is opt-in (mechanism b), the latter is the guard itself.
const animatingRitualSelectors: Array<{ selector: string; animation: string }> = []
for (const rule of rules) {
  if (rule.media === 'reduce' || rule.media === 'no-preference') continue
  const animation = activeAnimation(rule.body)
  if (!animation) continue
  for (const sel of splitSelectorList(rule.selector)) {
    if (isRitualSelector(sel)) animatingRitualSelectors.push({ selector: sel, animation })
  }
}

describe('reduced-motion guard — ritual animation families (mezo-mzbz)', () => {
  it('parses a non-trivial set of ritual animations (guards against a vacuous pass)', () => {
    // The current file has 12 active ritual animations; a parser regression that found far
    // fewer would make the coverage assertion below pass vacuously.
    expect(animatingRitualSelectors.length).toBeGreaterThanOrEqual(10)
  })

  it('neutralises every ritual-family animation under prefers-reduced-motion: reduce', () => {
    const unguarded = animatingRitualSelectors.filter(({ selector }) => {
      if (reduceAnimationNone.has(selector)) return false // (a) explicit animation: none
      if (ANCESTOR_NEUTRALISED.some((e) => e.selector === selector)) return false // (c) ancestor display:none
      return true
    })
    expect(
      unguarded,
      `Ritual animation(s) with no reduced-motion guard: ${unguarded
        .map((u) => `${u.selector} (animation: ${u.animation})`)
        .join('; ')}. Add an \`animation: none\` for the selector inside the ` +
        '`@media (prefers-reduced-motion: reduce)` block at the tail of prototype.css, ' +
        'declare it under `no-preference`, or (if an ancestor hides it) add it to ' +
        'ANCESTOR_NEUTRALISED.',
    ).toEqual([])
  })

  it('keeps the ancestor-neutralised allowlist honest (each ancestor is display:none under reduce)', () => {
    for (const { selector, ancestor } of ANCESTOR_NEUTRALISED) {
      expect(
        reduceDisplayNone.has(ancestor),
        `${selector} is allowlisted as ancestor-neutralised, but its ancestor ${ancestor} is not ` +
          'set to `display: none` under prefers-reduced-motion: reduce.',
      ).toBe(true)
      // The allowlist entry must correspond to a real active animation (no stale entries).
      expect(
        animatingRitualSelectors.some((a) => a.selector === selector),
        `${selector} is in ANCESTOR_NEUTRALISED but no longer declares an active animation — remove the stale allowlist entry.`,
      ).toBe(true)
    }
  })
})
