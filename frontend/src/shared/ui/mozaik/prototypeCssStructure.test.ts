import { describe, expect, test } from 'vitest'
import rawCss from '@/styles/prototype.css?raw'

/**
 * Structural guard for `styles/prototype.css` (mezo-d20.9.1).
 *
 * WHY THIS EXISTS — four times during the Design 2.0 redesign a multi-way union
 * merge of this file corrupted it in a way vitest could not see, because no test
 * ever parses the stylesheet:
 *
 *  1. the closing `}` of an `@media (prefers-reduced-motion: reduce)` block was
 *     swallowed, silently sucking every following rule into the media query —
 *     only `pnpm build` caught it, and once not even that;
 *  2. a comment whose body contained the sequence that closes a comment ended
 *     early, spilling its prose into the CSS and blowing up the Tailwind build
 *     with an unrelated-looking "Unterminated string" error.
 *
 * So: parse the whole file with a tiny CSS-aware scanner (comments, strings and
 * escapes are all tracked) and assert it is structurally intact. Every failure
 * message names the 1-based LINE NUMBER of the offending construct — the point
 * is that the next agent to hit this sees the cause in one second instead of
 * bisecting a confusing build error.
 */

/** 1-based line number of a character offset. */
function lineOf(css: string, index: number): number {
  let line = 1
  for (let i = 0; i < index; i++) if (css[i] === '\n') line++
  return line
}

interface Scan {
  /** unmatched `{` offsets left open at EOF */
  unclosedBraces: number[]
  /** offsets of `}` with no matching `{` */
  strayCloseBraces: number[]
  /** offset of an unterminated `/*`, if any */
  unterminatedComment: number | null
  /** offsets of a comment-close sequence found OUTSIDE any comment (the early-terminated-comment tell) */
  strayCommentEnds: number[]
  /** offsets of a string literal that never closes before the newline / EOF */
  unterminatedStrings: number[]
}

/**
 * Single pass over the stylesheet, tracking the three lexical states CSS has:
 * normal, inside a block comment, inside a `'`/`"` string.
 */
function scanCss(css: string): Scan {
  const out: Scan = {
    unclosedBraces: [],
    strayCloseBraces: [],
    unterminatedComment: null,
    strayCommentEnds: [],
    unterminatedStrings: [],
  }
  const braceStack: number[] = []
  let i = 0

  while (i < css.length) {
    const c = css[i]

    // ---- comment -------------------------------------------------------
    if (c === '/' && css[i + 1] === '*') {
      const start = i
      const end = css.indexOf('*/', i + 2)
      if (end === -1) {
        out.unterminatedComment = start
        break
      }
      i = end + 2
      continue
    }

    // A comment terminator reached in NORMAL state can only mean one thing: an
    // earlier comment closed sooner than its author intended and the tail of
    // its body is now being read as CSS.
    if (c === '*' && css[i + 1] === '/') {
      out.strayCommentEnds.push(i)
      i += 2
      continue
    }

    // ---- string --------------------------------------------------------
    if (c === '"' || c === "'") {
      const start = i
      let j = i + 1
      let closed = false
      while (j < css.length) {
        const s = css[j]
        if (s === '\\') {
          j += 2
          continue
        }
        if (s === '\n') break // unescaped newline: CSS strings may not span lines
        if (s === c) {
          closed = true
          break
        }
        j++
      }
      if (!closed) {
        out.unterminatedStrings.push(start)
        i = start + 1
        continue
      }
      i = j + 1
      continue
    }

    // ---- braces --------------------------------------------------------
    if (c === '{') braceStack.push(i)
    else if (c === '}') {
      if (braceStack.length === 0) out.strayCloseBraces.push(i)
      else braceStack.pop()
    }
    i++
  }

  out.unclosedBraces = braceStack
  return out
}

/** The `@media` / `@supports` / rule text a brace at `index` opens, for the message. */
function contextAt(css: string, index: number): string {
  const from = css.lastIndexOf('\n', index - 1) + 1
  return css.slice(from, index + 1).trim().slice(-120)
}

const scan = scanCss(rawCss)

describe('prototype.css stays structurally intact (mezo-d20.9.1)', () => {
  test('braces are balanced — no rule or @media block loses its closing brace', () => {
    const unclosed = scan.unclosedBraces.map(
      i => `line ${lineOf(rawCss, i)}: unclosed "{" opened by  ${contextAt(rawCss, i)}`,
    )
    const stray = scan.strayCloseBraces.map(
      i => `line ${lineOf(rawCss, i)}: "}" with no matching "{"`,
    )
    expect([...unclosed, ...stray]).toEqual([])
  })

  test('no git conflict markers survived a merge', () => {
    const markers = rawCss
      .split('\n')
      .map((line, n) => ({ line, n: n + 1 }))
      .filter(({ line }) => /^(<{7}|={7}|>{7})(\s|$)/.test(line))
      .map(({ line, n }) => `line ${n}: conflict marker ${line.slice(0, 7)}`)
    expect(markers).toEqual([])
  })

  test('every comment is terminated, and none is terminated early by its own body', () => {
    const problems: string[] = []
    if (scan.unterminatedComment !== null) {
      problems.push(
        `line ${lineOf(rawCss, scan.unterminatedComment)}: comment opened with "/*" is never closed`,
      )
    }
    for (const i of scan.strayCommentEnds) {
      problems.push(
        `line ${lineOf(rawCss, i)}: comment-close sequence outside any comment — ` +
          'an earlier comment body most likely contains it and ended the comment early, ' +
          'spilling prose into the stylesheet',
      )
    }
    expect(problems).toEqual([])
  })

  test('no string literal runs off its line (the "Unterminated string" build error)', () => {
    const problems = scan.unterminatedStrings.map(
      i => `line ${lineOf(rawCss, i)}: string opened with ${rawCss[i]} is never closed on that line`,
    )
    expect(problems).toEqual([])
  })

  test('the scanner actually sees the stylesheet (guard against an empty ?raw import)', () => {
    expect(rawCss.length).toBeGreaterThan(10_000)
    expect(rawCss).toContain('prefers-reduced-motion')
  })
})

/**
 * Section registration (mezo-88iwa.6, T5): the file's own convention for a named block is an
 * opening comment "dashes name dashes" and a matching closing comment "dashes slash-name
 * dashes" (see e.g. the `fuel-mai` and `glassbox` blocks) — this is
 * the same open/close pairing mozaikCssTokens.test.ts's mozaikSection() already leans on for
 * the Mozaik block. This guard registers the .tr-* Titanium section (the Mai day-poster/CTA/
 * energy/impact family) the same way: both markers must exist, in order, and the block
 * between them must be non-trivial — so a future merge that drops the CSS (the exact failure
 * mode this whole test file exists to catch) fails HERE with a one-line pointer, not as a
 * silent missing style downstream.
 */
describe('the train mai titanium section is registered (mezo-88iwa.6)', () => {
  const START_MARKER = 'train mai titanium'
  const END_MARKER = '/train mai titanium'

  test('both the opening and the closing comment markers are present, in order', () => {
    const start = rawCss.indexOf(START_MARKER)
    const end = rawCss.indexOf(END_MARKER)
    expect(start, `opening marker "${START_MARKER}" not found`).toBeGreaterThan(-1)
    expect(end, `closing marker "${END_MARKER}" not found`).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
  })

  test('the section actually carries the tr- class family, not just the markers', () => {
    const start = rawCss.indexOf(START_MARKER)
    const end = rawCss.indexOf(END_MARKER)
    const section = start > -1 && end > start ? rawCss.slice(start, end) : ''
    for (const cls of ['.tr-day', '.tr-start', '.tr-alt', '.tr-energy', '.tr-mus', '.tr-mus-track']) {
      expect(section, `${cls} missing from the train mai titanium section`).toContain(cls)
    }
  })
})

/**
 * Section registration (mezo-88iwa.13, T12 Task 2): the `GlassBox` shared glass
 * primitive's `.gl-*` section, registered the same way the `train mai titanium` block
 * above is — open/close comment markers, both present and in order, with the class
 * family actually inside the span.
 *
 * Renamed `titanium glass primitive` → `glassbox` in Phase 4 of the Boop
 * visszaöltöztetés (mezo-ju4j6.5), in the same commit as the CSS section itself:
 * the primitive stays, its Titanium skin does not.
 */
describe('the glassbox section is registered (mezo-88iwa.13, re-dressed mezo-ju4j6.5)', () => {
  const START_MARKER = 'glassbox'
  const END_MARKER = '/glassbox'

  test('both the opening and the closing comment markers are present, in order', () => {
    const start = rawCss.indexOf(START_MARKER)
    const end = rawCss.indexOf(END_MARKER)
    expect(start, `opening marker "${START_MARKER}" not found`).toBeGreaterThan(-1)
    expect(end, `closing marker "${END_MARKER}" not found`).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
  })

  test('the section actually carries the gl- class family, not just the markers', () => {
    const start = rawCss.indexOf(START_MARKER)
    const end = rawCss.indexOf(END_MARKER)
    const section = start > -1 && end > start ? rawCss.slice(start, end) : ''
    for (const cls of ['.gl-backdrop', '.gl-card', '.gl-head', '.gl-x', '.gl-anim']) {
      expect(section, `${cls} missing from the glassbox section`).toContain(cls)
    }
  })
})

/**
 * Section registration + re-dress guard (mezo-ju4j6.6, Boop visszaöltöztetés Phase 5a).
 *
 * The Fuel Mai family's block was named `fuel-mai titanium`; Phase 5a re-dressed the Mai
 * surfaces to the restored Mozaik/Clay world and renamed the block to `fuel-mai` — CSS and
 * marker in the SAME commit, the way `titanium glass primitive` → `glassbox` went in Phase 4.
 * Registered here so a merge that drops the block fails with a one-line pointer.
 *
 * The second test is the re-dress guard the style bible asks for: the Titanium materials it
 * forbids (§2.3 — decorative backdrop frosting, icon drop-shadow haloes, raw black card
 * shadows) must not come back, and the surfaces that became `--mz-cell-*` chips (§2.2 B)
 * must stay chips.
 *
 * Phase 5b (mezo-ju4j6.7) re-dressed the block's remaining sub-blocks — meal detail, AI
 * score, the camera-first logger and the glucose glass — so the guard now covers the WHOLE
 * block rather than the Mai slice only. That widening is the signal 5b is done.
 */
describe('the fuel-mai section is registered and re-dressed (mezo-ju4j6.6, widened .7)', () => {
  // The bare name also appears in a cross-reference comment far earlier in the file, so the
  // markers carry the block's own box-drawing frame — indexOf must land on the block itself.
  const START_MARKER = '── fuel-mai ('
  const END_MARKER = '── /fuel-mai '

  const section = () => {
    const start = rawCss.indexOf(START_MARKER)
    const end = rawCss.indexOf(END_MARKER)
    return start > -1 && end > start ? rawCss.slice(start, end) : ''
  }
  /** The block's RULES only: comments stripped, because the prose NAMES the materials it
   *  banished and a guard that scanned it would fail on its own documentation. */
  const rules = () => section().replace(/\/\*[\s\S]*?\*\//g, '')

  test('both the opening and the closing comment markers are present, in order', () => {
    const start = rawCss.indexOf(START_MARKER)
    const end = rawCss.indexOf(END_MARKER)
    expect(start, `opening marker "${START_MARKER}" not found`).toBeGreaterThan(-1)
    expect(end, `closing marker "${END_MARKER}" not found`).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
  })

  test('the section actually carries the fmx- class family, not just the markers', () => {
    for (const cls of ['.fmx-hero', '.fmx-gauge', '.fmx-rings', '.fmx-block', '.fmx-meal-row']) {
      expect(section(), `${cls} missing from the fuel-mai section`).toContain(cls)
    }
  })

  test('the whole block carries no Titanium material the style bible forbids', () => {
    const css = rules()
    expect(css.length).toBeGreaterThan(10_000)
    // §2.3: decorative frosting is gone. The ONE surviving backdrop-filter is the Fuel
    // GlassBox's own backdrop, where the blur is functional separation (§7.1b).
    expect(css).not.toContain('var(--surface-glass)')
    // Exactly one element still blurs — the Fuel GlassBox backdrop (prefixed pair) — and the
    // card it covers explicitly turns its own frosting off.
    expect(css.match(/backdrop-filter: blur\(/g) ?? []).toHaveLength(2)
    expect(css).toContain('backdrop-filter: none')
    // §6.1: clay icons carry their own volume — no drop-shadow haloes on them.
    expect(css).not.toContain('drop-shadow')
    // §2.2 A: card shadows are --mz-shadow* tokens, never a raw black drop.
    expect(css).not.toContain('rgba(0, 0, 0,')
  })

  test('the tappable chips are --mz-cell-* pairs, not bordered tint boxes (§2.2 B)', () => {
    const css = rules()
    for (const token of ['--mz-cell-sage-bg', '--mz-cell-lav-bg', '--mz-cell-amber-bg',
      '--mz-cell-sky-bg', '--mz-cell-coral-bg']) {
      expect(css, `${token} missing — a chip in this block is not a restored cell chip`).toContain(token)
    }
  })

  test('both sub-page heroes are halo bands, not glowing posters (§2.2 C)', () => {
    const css = rules()
    expect(css).toContain('background: var(--halo-violet)')       // the AI score hero
    expect(css).toContain('.fmx-score-glow { display: none; }')   // its decorative glow, retired
    expect(css).toContain('.fmx-detail-glow { display: none; }')  // the meal detail's, likewise
  })

  test('the hero is a halo band, not a framed poster (§2.2 C, §8.1)', () => {
    expect(rawCss).toContain('.fh-hero { border-radius: 21px; overflow: hidden; background: var(--halo-sage); }')
  })
})


/**
 * Phase 5c (mezo-ju4j6.8): the Kiegészítők and Trendek blocks are re-dressed to the restored
 * Mozaik/Clay world. Same shape of guard the fuel-mai block got in 5a — both markers present,
 * the class family actually inside them, and the banished Titanium materials unable to come
 * back on this slice. The RULES are scanned with comments stripped, because the blocks' own
 * prose NAMES the materials they banished — so the slice has to START at the header comment's
 * own `/*`, not at the marker inside it, or that prose survives the strip and the guard fails
 * on its own documentation.
 */
function slice(start: string, end: string) {
  const marker = rawCss.indexOf(start)
  const s = marker > -1 ? rawCss.lastIndexOf('/*', marker) : -1
  const e = rawCss.indexOf(end)
  return s > -1 && e > s ? rawCss.slice(s, e) : ''
}
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '')

describe('the fuel-stack section is registered and re-dressed (mezo-ju4j6.8)', () => {
  // The block's own name also occurs in cross-reference prose, so the markers carry the
  // box-drawing frame — indexOf must land on the block itself.
  const START_MARKER = '── fuel-stack ('
  const END_MARKER = '── /fuel-stack '
  const section = () => slice(START_MARKER, END_MARKER)
  const rules = () => stripComments(section())

  test('both the opening and the closing comment markers are present, in order', () => {
    const start = rawCss.indexOf(START_MARKER)
    const end = rawCss.indexOf(END_MARKER)
    expect(start, `opening marker "${START_MARKER}" not found`).toBeGreaterThan(-1)
    expect(end, `closing marker "${END_MARKER}" not found`).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
  })

  test('the section actually carries the fsx- class family, not just the markers', () => {
    for (const cls of ['.fsx-hero', '.fsx-ring', '.fsx-band', '.fsx-poster', '.fsx-proto-line',
      '.fsx-glass', '.fsx-pick']) {
      expect(section(), `${cls} missing from the fuel-stack section`).toContain(cls)
    }
  })

  test('the whole block carries no Titanium material the style bible forbids', () => {
    const css = rules()
    expect(css.length).toBeGreaterThan(8_000)
    // §2.3: decorative frosting is gone. The ONE surviving blur is the native <dialog>'s own
    // ::backdrop, where the blur is functional separation (§7.1b) — a prefixed pair.
    expect(css).not.toContain('var(--surface-glass)')
    expect(css.match(/backdrop-filter: blur\(/g) ?? []).toHaveLength(2)
    // §6.1: clay icons carry their own volume — no drop-shadow haloes on them.
    expect(css).not.toContain('drop-shadow')
    // §2.2 A: card shadows are --mz-shadow* tokens, never a raw black drop.
    expect(css).not.toContain('rgba(0, 0, 0,')
  })

  test('the hero is a halo band, not a glowing poster (§2.2 C)', () => {
    const css = rules()
    expect(css).toContain('background: var(--halo-sage)')
    expect(css).toContain('.fsx-glow { display: none; }')   // its decorative glow, retired
    expect(css).toContain('background: var(--halo-violet)') // the dose advice, likewise a halo
  })

  test('the chips and pills are --mz-cell-* pairs, not bordered tint boxes (§2.2 B)', () => {
    const css = rules()
    for (const token of ['--mz-cell-sage-bg', '--mz-cell-sage-ink', '--mz-cell-lav-bg',
      '--mz-cell-lav-ink', '--mz-cell-sky-ink']) {
      expect(css, `${token} missing — a chip in this block is not a restored cell chip`).toContain(token)
    }
  })

  test('the due band wears the §4.4 now-state, and it is the only infinite loop (§8.6)', () => {
    const css = rules()
    expect(css).toContain('.fsx-band.is-due { border: 1px solid var(--dv-coral); box-shadow: var(--mz-shadow-coral); }')
    expect(css).toContain('fsx-now-pulse')
    // the decorative hero-glow loop and its keyframes are gone with the material
    expect(css).not.toContain('fsx-glow 5s')
    expect(css).not.toContain('@keyframes fsx-glow')
    // exactly one `infinite` in the block — the now-pulse
    expect(css.match(/infinite/g) ?? []).toHaveLength(1)
  })
})

describe('the fuel-trendek section is registered and re-dressed (mezo-ju4j6.8)', () => {
  const START_MARKER = '── fuel-trendek ('
  const END_MARKER = '── /fuel-trendek '
  const section = () => slice(START_MARKER, END_MARKER)
  const rules = () => stripComments(section())

  test('both the opening and the closing comment markers are present, in order', () => {
    const start = rawCss.indexOf(START_MARKER)
    const end = rawCss.indexOf(END_MARKER)
    expect(start, `opening marker "${START_MARKER}" not found`).toBeGreaterThan(-1)
    expect(end, `closing marker "${END_MARKER}" not found`).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
  })

  test('the section actually carries the ftx- class family, not just the markers', () => {
    for (const cls of ['.ftx-hero', '.ftx-bars', '.ftx-tile', '.ftx-splitrow', '.ftx-dim',
      '.ftx-horizon', '.ftx-pattern']) {
      expect(section(), `${cls} missing from the fuel-trendek section`).toContain(cls)
    }
  })

  test('the whole block carries no Titanium material the style bible forbids', () => {
    const css = rules()
    expect(css.length).toBeGreaterThan(6_000)
    expect(css).not.toContain('var(--surface-glass)')
    expect(css).not.toContain('backdrop-filter')   // nothing on this page frosts at all
    expect(css).not.toContain('drop-shadow')
    expect(css).not.toContain('rgba(0, 0, 0,')
  })

  test('the weekly picture is a halo band and the week bars wear the Fuel accent (A.2 rule 1)', () => {
    const css = rules()
    expect(css).toContain('background: var(--halo-sage)')
    expect(css).toContain('.ftx-glow { display: none; }')
    // the bars and the long-horizon intake curve measure what the Mai arc measures → sage
    expect(css).toContain('stroke: var(--dv-sage)')
    expect(css).toMatch(/\.ftx-fill \{[^}]*var\(--dv-sage\)/s)
    // the weight series keeps rose: there the hue is MEANING (a second measure), not skin
    expect(css).toContain('stroke: var(--dv-rose)')
  })

  test('over-target stays amber and no error state is reachable (shame-free)', () => {
    const css = rules()
    expect(css).toContain('.ftx-day.is-over .ftx-fill')
    expect(css).toContain('var(--dv-amber)')
    expect(css).not.toContain('is-error')
  })

  test('the entrance choreography is one-shot — no infinite loop on this page (§8.6)', () => {
    expect(rules()).not.toContain('infinite')
  })
})

/**
 * Fix round 1 (mezo-88iwa.13, T12 Task 2 review): GlassBox is a Sheet-SIBLING
 * dialog — pages that host a <Sheet> may also open a GlassBox on top of it — so
 * two things a CSS-parsing test can actually pin down without a real browser
 * layout pass: it must sit above the Sheet's 200/201 pair (not the shared
 * page-takeover tier, 60), and the background-scroll lock must know about it.
 */
describe('GlassBox stacks correctly with Sheet (mezo-88iwa.13 fix round 1)', () => {
  test('the background-scroll-lock :has() selector includes .gl-backdrop', () => {
    expect(rawCss).toContain(
      '.phone-screen:has(.sheet-backdrop, .dd-backdrop, .gl-backdrop) .screen-content',
    )
  })

  test('.gl-backdrop / .gl-card sit above the Sheet pair (200/201), not at the page-takeover tier (60)', () => {
    const backdropMatch = rawCss.match(/\.gl-backdrop\s*\{[^}]*z-index:\s*(\d+)/)
    const cardMatch = rawCss.match(/\.gl-card\s*\{[^}]*z-index:\s*(\d+)/)
    expect(backdropMatch, '.gl-backdrop has no z-index in its own rule').not.toBeNull()
    expect(cardMatch, '.gl-card has no z-index in its own rule').not.toBeNull()
    const backdropZ = Number(backdropMatch![1])
    const cardZ = Number(cardMatch![1])
    expect(backdropZ).toBeGreaterThan(201) // above the Sheet backdrop/panel pair
    expect(cardZ).toBeGreaterThan(backdropZ) // the card rides above its own backdrop
    expect(cardZ).toBeLessThan(300) // stays below the toast stack
  })
})

/**
 * Section registration (mezo-88iwa.13, T12 Task 3): the Terhelés (TrainWeekPage) face's
 * `.ld-*` section — the full-bleed hero, the two doorway cards, the group cards and the
 * group-glass body — registered exactly like the two blocks above.
 */
describe('the train terheles titanium section is registered (mezo-88iwa.13)', () => {
  const START_MARKER = 'train terheles titanium'
  const END_MARKER = '/train terheles titanium'

  test('both the opening and the closing comment markers are present, in order', () => {
    const start = rawCss.indexOf(START_MARKER)
    const end = rawCss.indexOf(END_MARKER)
    expect(start, `opening marker "${START_MARKER}" not found`).toBeGreaterThan(-1)
    expect(end, `closing marker "${END_MARKER}" not found`).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
  })

  test('the section actually carries the ld- class family, not just the markers', () => {
    const start = rawCss.indexOf(START_MARKER)
    const end = rawCss.indexOf(END_MARKER)
    const section = start > -1 && end > start ? rawCss.slice(start, end) : ''
    for (const cls of [
      '.ld-hero', '.ld-hero-bar', '.ld-hero-pct', '.ld-eyebrow', '.ld-map-card',
      '.ld-move-card', '.ld-groups', '.ld-group-bar', '.ld-group-note', '.ld-sport', '.ld-glass-rows',
    ]) {
      expect(section, `${cls} missing from the train terheles titanium section`).toContain(cls)
    }
  })

  // The bars are drawn-on-reveal: the FINAL width is the base rule (so the portaled
  // group glass and a settled 'pop' arrival both show a full bar), and only the armed
  // `.mz-play` subtree animates the growth — the `.gr-tbar` idiom. A future edit that
  // flips this (base scaleX(0)) silently blanks every bar outside an entrance group.
  test('the ld- bars default to their final width and only grow inside .mz-play', () => {
    expect(rawCss).toContain('.mz-play .ld-hero-bar i, .mz-play .ld-group-bar i')
    expect(rawCss).toMatch(/@keyframes ld-fill \{ from \{ transform: scaleX\(0\); \}/)
  })
})

/**
 * Section registration (mezo-lf3cv, P2 Task 1): the „Minden izomjel" subpage's `.mm-*`
 * section — the head, the six region boxes, their 3-wide grid and the muscle cells,
 * ported from the prototype's `train-pages.css` `.mm-*` family.
 */
describe('the train izomjel titanium section is registered (mezo-lf3cv)', () => {
  const START_MARKER = 'train izomjel titanium'
  const END_MARKER = '/train izomjel titanium'

  test('both the opening and the closing comment markers are present, in order', () => {
    const start = rawCss.indexOf(START_MARKER)
    const end = rawCss.indexOf(END_MARKER)
    expect(start, `opening marker "${START_MARKER}" not found`).toBeGreaterThan(-1)
    expect(end, `closing marker "${END_MARKER}" not found`).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
  })

  test('the section actually carries the mm- class family, not just the markers', () => {
    const start = rawCss.indexOf(START_MARKER)
    const end = rawCss.indexOf(END_MARKER)
    const section = start > -1 && end > start ? rawCss.slice(start, end) : ''
    for (const cls of ['.mm-head', '.mm-region', '.mm-grid', '.mm-cell']) {
      expect(section, `${cls} missing from the train izomjel titanium section`).toContain(cls)
    }
  })
})

/**
 * Section registration (mezo-lf3cv, P2 Task 3): the Gyakorlatok tab's own `.gy-*`
 * section — the catalogue rows, the detail hero, the record stat cards, the `.gy-
 * next` nudge, the strength-curve graphic and the medal rows — ported from the
 * prototype's `gyak.css`, registered exactly like the blocks above.
 */
describe('the train gyakorlatok titanium section is registered (mezo-lf3cv)', () => {
  const START_MARKER = 'train gyakorlatok titanium'
  const END_MARKER = '/train gyakorlatok titanium'

  test('both the opening and the closing comment markers are present, in order', () => {
    const start = rawCss.indexOf(START_MARKER)
    const end = rawCss.indexOf(END_MARKER)
    expect(start, `opening marker "${START_MARKER}" not found`).toBeGreaterThan(-1)
    expect(end, `closing marker "${END_MARKER}" not found`).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
  })

  test('the section actually carries the gy- class family, not just the markers', () => {
    const start = rawCss.indexOf(START_MARKER)
    const end = rawCss.indexOf(END_MARKER)
    const section = start > -1 && end > start ? rawCss.slice(start, end) : ''
    for (const cls of [
      '.gy-card', '.gy-rec', '.gy-curve', '.gy-medal', '.gy-next', '.gy-hero',
    ]) {
      expect(section, `${cls} missing from the train gyakorlatok titanium section`).toContain(cls)
    }
  })
})

/**
 * Same registration guard (mezo-88iwa.10, T9) for the Terv tab's `.pl-*` Titanium section —
 * the mesocycle landing poster, the day-by-day week list, a day's own hero + exercise cells,
 * and the muscle detail's gauge, ported from the prototype's `plan.css`.
 */
describe('the terv titanium section is registered (mezo-88iwa.10)', () => {
  const START_MARKER = 'terv titanium'
  const END_MARKER = '/terv titanium'

  test('both the opening and the closing comment markers are present, in order', () => {
    const start = rawCss.indexOf(START_MARKER)
    const end = rawCss.indexOf(END_MARKER)
    expect(start, `opening marker "${START_MARKER}" not found`).toBeGreaterThan(-1)
    expect(end, `closing marker "${END_MARKER}" not found`).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
  })

  test('the section actually carries the pl- class family, not just the markers', () => {
    const start = rawCss.indexOf(START_MARKER)
    const end = rawCss.indexOf(END_MARKER)
    const section = start > -1 && end > start ? rawCss.slice(start, end) : ''
    for (const cls of [
      '.pl-poster', '.pl-ring', '.pl-arc', '.pl-day', '.pl-dest', '.pl-dhero',
      '.pl-ex', '.pl-item', '.pl-scale-bar', '.pl-versus',
    ]) {
      expect(section, `${cls} missing from the terv titanium section`).toContain(cls)
    }
  })

  // T10 Task 1: the plan library families the T9 port stopped short of — the library
  // hero/cards, the star rating, the template-detail exercise rows, the wizard's load
  // bars (ported renamed to .pl-wload/.pl-wload-row) and the small quiet-row idiom.
  test('the T10 library sub-block carries its own class family', () => {
    const start = rawCss.indexOf(START_MARKER)
    const end = rawCss.indexOf(END_MARKER)
    const section = start > -1 && end > start ? rawCss.slice(start, end) : ''
    for (const cls of [
      '.pl-lib-card', '.pl-lhero', '.pl-stars', '.pl-tpl-ex', '.pl-wload', '.pl-row',
    ]) {
      expect(section, `${cls} missing from the terv titanium section`).toContain(cls)
    }
  })

  // mezo-b516k Task 1: the ⓘ explain layer's own sub-block — the 22px icon-only
  // button (ported from plan.css:313-314) and the glass copy paragraph (ported from
  // load.css:179's `.info-glass-copy`, renamed with the house `pl-` prefix).
  test('the explain-layer sub-block carries .pl-info and .pl-info-copy', () => {
    const start = rawCss.indexOf(START_MARKER)
    const end = rawCss.indexOf(END_MARKER)
    const section = start > -1 && end > start ? rawCss.slice(start, end) : ''
    for (const cls of ['.pl-info', '.pl-info-copy']) {
      expect(section, `${cls} missing from the terv titanium section`).toContain(cls)
    }
  })

  // The prototype's glyph is 22px; the house tap-target rule is 44px. The button must
  // grow its HIT AREA, not the glyph — a `::after` hit box, so a future edit that
  // "simplifies" it back to a bare 22px control fails here instead of shipping a
  // 22px touch target.
  test('.pl-info keeps the 22px glyph but carries a 44px hit box', () => {
    const start = rawCss.indexOf(START_MARKER)
    const end = rawCss.indexOf(END_MARKER)
    const section = start > -1 && end > start ? rawCss.slice(start, end) : ''
    const ruleMatch = /(?:^|\n)\.pl-info \{([^}]*)\}/.exec(section)
    expect(ruleMatch, '.pl-info standalone rule not found in the terv titanium section').not.toBeNull()
    expect(ruleMatch![1]).toContain('width: 22px')
    const hit = /(?:^|\n)\.pl-info::after \{([^}]*)\}/.exec(section)
    expect(hit, '.pl-info::after hit box not found — the 44px tap target is gone').not.toBeNull()
    expect(hit![1]).toContain('44px')
  })
})

/**
 * Section registration (mezo-88iwa.7, T6 Task 2): the active-workout list phase's
 * `.wo-*` section — per-exercise cards, set rows, the rest dock, the finish CTA and
 * the glass-card interiors (menu, confirm, close, history/records), ported from the
 * prototype's `session.css`, registered exactly like the blocks above.
 */
describe('the train session titanium section is registered (mezo-88iwa.7)', () => {
  const START_MARKER = 'train session titanium'
  const END_MARKER = '/train session titanium'

  test('both the opening and the closing comment markers are present, in order', () => {
    const start = rawCss.indexOf(START_MARKER)
    const end = rawCss.indexOf(END_MARKER)
    expect(start, `opening marker "${START_MARKER}" not found`).toBeGreaterThan(-1)
    expect(end, `closing marker "${END_MARKER}" not found`).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
  })

  test('the section actually carries the wo- class family, not just the markers', () => {
    const start = rawCss.indexOf(START_MARKER)
    const end = rawCss.indexOf(END_MARKER)
    const section = start > -1 && end > start ? rawCss.slice(start, end) : ''
    for (const cls of [
      '.wo-card', '.wo-row', '.wo-dock', '.wo-finish', '.wo-menu-row', '.wo-rec',
    ]) {
      expect(section, `${cls} missing from the train session titanium section`).toContain(cls)
    }
  })

  // Regression for the T9 poster shrink-to-fit trap (owner screenshot, 2026-09-17): a
  // done row renders as a `<button>`, and a button with no explicit width shrinks to fit
  // its content instead of filling the shared `.wo-rows` grid track — its 1fr columns
  // then collapse. jsdom does not lay out flex/grid, so this asserts the RULE itself
  // rather than a measured pixel width.
  test('.wo-row carries an explicit width: 100% — a done <button>.wo-row must fill the grid, not shrink to fit', () => {
    const start = rawCss.indexOf(START_MARKER)
    const end = rawCss.indexOf(END_MARKER)
    const section = start > -1 && end > start ? rawCss.slice(start, end) : ''
    // The standalone `.wo-row { ... }` rule, not the earlier `.wo-rows-head, .wo-row {`
    // grid-definition selector (a plain indexOf('.wo-row {') would match inside that
    // combined selector too, since ", .wo-row {" contains it as a substring).
    const ruleMatch = /(?:^|\n)\.wo-row \{/.exec(section)
    expect(ruleMatch, '.wo-row standalone rule not found in the train session titanium section').not.toBeNull()
    const ruleStart = ruleMatch!.index
    const ruleEnd = section.indexOf('}', ruleStart)
    const rule = section.slice(ruleStart, ruleEnd)
    expect(rule).toContain('width: 100%')
  })
})

/**
 * Section registration (mezo-88iwa.8, T7 Task 2): the workout-close ceremony's
 * `.cer-*` section — the score reveal, the settled result, and the details/recap
 * screen (muscle-group star rows, the kcal-won tile), ported from the prototype's
 * session.css, registered exactly like the blocks above.
 */
describe('the train ceremony titanium section is registered (mezo-88iwa.8)', () => {
  const START_MARKER = 'train ceremony titanium'
  const END_MARKER = '/train ceremony titanium'

  test('both the opening and the closing comment markers are present, in order', () => {
    const start = rawCss.indexOf(START_MARKER)
    const end = rawCss.indexOf(END_MARKER)
    expect(start, `opening marker "${START_MARKER}" not found`).toBeGreaterThan(-1)
    expect(end, `closing marker "${END_MARKER}" not found`).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
  })

  test('the section actually carries the cer- class family, not just the markers', () => {
    const start = rawCss.indexOf(START_MARKER)
    const end = rawCss.indexOf(END_MARKER)
    const section = start > -1 && end > start ? rawCss.slice(start, end) : ''
    for (const cls of [
      '.cer-stars', '.cer-bar', '.cer-counters', '.cer-mstar', '.cer-kcal', '.cer-starrow',
    ]) {
      expect(section, `${cls} missing from the train ceremony titanium section`).toContain(cls)
    }
  })
})

/**
 * Section registration (mezo-88iwa.9, T8 Task 3): the sport-logging flow's own `.sp-*`
 * section — the sport picker grid/tiles, the per-sport form (mode toggle, numeric
 * stepper, chip picker, free text, range, the kcal estimate tile), ported from the
 * prototype's sport.css, registered exactly like the blocks above. The ceremony
 * families (`.sp-cer`, `.sp-keep`, `.sp-details`) are NOT re-ported here — T7's
 * `.cer-*` section already serves the shared close ceremony.
 */
describe('the train sport titanium section is registered (mezo-88iwa.9)', () => {
  const START_MARKER = 'train sport titanium'
  const END_MARKER = '/train sport titanium'

  test('both the opening and the closing comment markers are present, in order', () => {
    const start = rawCss.indexOf(START_MARKER)
    const end = rawCss.indexOf(END_MARKER)
    expect(start, `opening marker "${START_MARKER}" not found`).toBeGreaterThan(-1)
    expect(end, `closing marker "${END_MARKER}" not found`).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
  })

  test('the section actually carries the sp- class family, not just the markers', () => {
    const start = rawCss.indexOf(START_MARKER)
    const end = rawCss.indexOf(END_MARKER)
    const section = start > -1 && end > start ? rawCss.slice(start, end) : ''
    for (const cls of [
      '.sp-grid', '.sp-tile', '.sp-field', '.sp-chips', '.sp-kcal', '.sp-note',
    ]) {
      expect(section, `${cls} missing from the train sport titanium section`).toContain(cls)
    }
  })
})

/**
 * Phase 5d (mezo-ju4j6.9): the Konyha family — hub, the two libraries, the two detail pages
 * and the Receptműhely canvas — is re-dressed to the restored Mozaik/Clay world, and the block
 * loses its `titanium` suffix. Same guard shape as 5a/5c: both markers present, the class
 * family actually inside them, and the banished Titanium materials unable to come back on this
 * slice. Comments are stripped before scanning, because the block's own prose NAMES the
 * materials it banished.
 */
describe('the fuel-konyha section is registered and re-dressed (mezo-ju4j6.9)', () => {
  const START_MARKER = '── fuel-konyha ('
  const END_MARKER = '── /fuel-konyha '
  const section = () => slice(START_MARKER, END_MARKER)
  const rules = () => stripComments(section())

  test('both the opening and the closing comment markers are present, in order', () => {
    const start = rawCss.indexOf(START_MARKER)
    const end = rawCss.indexOf(END_MARKER)
    expect(start, `opening marker "${START_MARKER}" not found`).toBeGreaterThan(-1)
    expect(end, `closing marker "${END_MARKER}" not found`).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
  })

  test('the Titanium-era marker name is gone — one block, renamed, not a second copy', () => {
    expect(rawCss).not.toContain('fuel-konyha titanium')
  })

  test('the section actually carries the fkx- class family, not just the markers', () => {
    for (const cls of ['.fkx-capture', '.fkx-poster', '.fkx-bowls', '.fkx-split', '.fkx-legend',
      '.fkx-tile-grid', '.fkx-recipe', '.fkx-item', '.fkx-door', '.fkx-cta', '.fkx-stepper',
      '.fkx-ws-goals']) {
      expect(section(), `${cls} missing from the fuel-konyha section`).toContain(cls)
    }
  })

  test('the whole block carries no Titanium material the style bible forbids', () => {
    const css = rules()
    expect(css.length).toBeGreaterThan(8_000)
    // §2.3: decorative frosting and icon haloes are gone; this block frosts nothing at all.
    expect(css).not.toContain('var(--surface-glass)')
    expect(css).not.toContain('backdrop-filter')
    expect(css).not.toContain('drop-shadow')
    // §2.2 A: card shadows are --mz-shadow* tokens, never a raw black drop.
    expect(css).not.toContain('rgba(0, 0, 0,')
    // A.4 rule 7: the hue vocabulary is the --dv-* accent set, not the legacy aliases.
    expect(css).not.toMatch(/var\(--(lav|sage|amber|coral|sky|rose)\)/)
  })

  test('the tiles are wash tiles: hairline border + --mz-shadow* lift (§2.2 A)', () => {
    const css = rules()
    expect(css.match(/border: 0\.5px solid rgba\(43, 33, 24, 0\.06\)/g) ?? []).not.toHaveLength(0)
    for (const token of ['var(--mz-shadow)', 'var(--mz-shadow-lav)', 'var(--mz-shadow-gold)',
      'var(--mz-shadow-sage)']) {
      expect(css, `${token} missing — a tile in this block is not lifted by a token`).toContain(token)
    }
  })

  test('the poster wears the §3.2 anatomy: kiskapitális eyebrow + one display-200 numeral', () => {
    const css = rules()
    expect(css).toContain('.fkx-poster-title strong { font-size: 9.5px; font-weight: 800; letter-spacing: 0.16em;')
    expect(css).toMatch(/\.fkx-poster-main > strong \{[^}]*font-weight: 200;/)
    expect(css).toMatch(/\.fkx-poster-main > strong \{[^}]*font-variant-numeric: tabular-nums;/)
    // A.2 rule 5: the raised eyebrow type gets a 360px step-down rather than a retreat.
    expect(css).toContain('@media (max-width: 360px)')
  })

  test('the chips and shields are restored materials, not bordered tint boxes (§2.2 B, §3.1)', () => {
    const css = rules()
    for (const token of ['--mz-cell-sage-bg', '--mz-cell-sage-ink', '--mz-cell-gold-bg',
      '--mz-cell-gold-ink', '--mz-cell-lav-bg', '--mz-cell-coral-bg']) {
      expect(css, `${token} missing — a chip in this block is not a restored cell chip`).toContain(token)
    }
    expect(css).toContain('box-shadow: inset 0 0 0 1px var(--border-subtle)')
  })

  test('the workshop hero is a halo band and no infinite loop survives (§2.2 C, §8.6)', () => {
    const css = rules()
    expect(css).toContain('background: var(--halo-violet)')
    expect(css).toContain('.fkx-ws-glow { display: none; }')
    // the decorative float loop and its keyframes went with the material
    expect(css).not.toContain('@keyframes fkx-float')
    expect(css).not.toContain('infinite')
  })
})

/**
 * A kaja-ünneplés blokkja (mezo-bqwyo). A ceremónia MINTÁJA canon (ceremony-pattern doc), az
 * ANYAGA viszont a visszaállított világé — ezért ugyanaz az őr, mint a re-dress szeleteknél:
 * a szekció regisztrálva van, tényleg viseli az `fcx-` családot, és a Titán-anyagok nem
 * tudnak visszaszivárogni rá.
 */
describe('the fuel-ceremony section is registered and wears the restored materials (mezo-bqwyo)', () => {
  const START_MARKER = '── fuel-ceremony ('
  const END_MARKER = '── /fuel-ceremony '
  const section = () => slice(START_MARKER, END_MARKER)
  const rules = () => stripComments(section())

  test('both the opening and the closing comment markers are present, in order', () => {
    const start = rawCss.indexOf(START_MARKER)
    const end = rawCss.indexOf(END_MARKER)
    expect(start, `opening marker "${START_MARKER}" not found`).toBeGreaterThan(-1)
    expect(end, `closing marker "${END_MARKER}" not found`).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
  })

  test('the section carries the fcx- family, not just the markers', () => {
    for (const cls of ['.fcx-screen', '.fcx-sky', '.fcx-stars', '.fcx-bar', '.fcx-fill',
      '.fcx-counters', '.fcx-result', '.fcx-score', '.fcx-cta', '.fcx-close']) {
      expect(section(), `${cls} missing from the fuel-ceremony section`).toContain(cls)
    }
  })

  test('no Titanium material the style bible forbids', () => {
    const css = rules()
    expect(css).not.toContain('var(--surface-glass)')
    expect(css).not.toContain('backdrop-filter')
    expect(css).not.toContain('drop-shadow')
    expect(css).not.toContain('rgba(0, 0, 0,')
    expect(css).not.toMatch(/var\(--(lav|sage|amber|coral|sky|rose)\)/)
  })

  test('the bar fill IS the polished gold stone, and no text sits on it (§5 + minta §Materials)', () => {
    const css = rules()
    expect(css).toContain('#FFF0C8 0%, #AF9371 24%, #322A29 52%, #DBC4A0 100%')
    // a kitöltés szélességét a rAF-menet írja — CSS-átmenet nélkül (a fagyott webview tanulsága)
    expect(css).toMatch(/\.fcx-fill \{[^}]*width: calc\(var\(--p, 0\) \* 100%\)/)
    expect(css).not.toMatch(/\.fcx-fill \{[^}]*transition/)
  })

  test('the ignition honours reduced motion', () => {
    const css = rules()
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
  })
})
