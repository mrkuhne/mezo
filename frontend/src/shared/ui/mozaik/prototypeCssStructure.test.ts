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
describe('the train mai section is registered and re-dressed (mezo-ju4j6.11)', () => {
  const START_MARKER = '── train mai ('
  const END_MARKER = '── /train mai '
  const section = () => slice(START_MARKER, END_MARKER)
  const rules = () => stripComments(section())

  test('both the opening and the closing comment markers are present, in order', () => {
    const start = rawCss.indexOf(START_MARKER)
    const end = rawCss.indexOf(END_MARKER)
    expect(start, `opening marker "${START_MARKER}" not found`).toBeGreaterThan(-1)
    expect(end, `closing marker "${END_MARKER}" not found`).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
  })

  test('the Titanium-era marker name is gone — one block, renamed', () => {
    expect(rawCss).not.toContain('train mai titanium')
  })

  test('the section actually carries the tr- class family, not just the markers', () => {
    for (const cls of ['.tr-day', '.tr-start', '.tr-alt', '.tr-energy', '.tr-mus', '.tr-mus-track']) {
      expect(section(), `${cls} missing from the train mai section`).toContain(cls)
    }
  })

  test('no Titanium material the style bible forbids', () => {
    const css = rules()
    // A prototípus áttetsző fehérjei (#ffffffXX) SÖTÉT alapra készültek — világos lapon
    // láthatatlanok. A blokkban ezért nem maradhat nyers fehér-alfa vagy fekete árnyék.
    expect(css).not.toMatch(/#ffffff[0-9a-f]{2}/i)
    expect(css).not.toContain('var(--surface-glass)')
    expect(css).not.toContain('backdrop-filter')
    expect(css).not.toContain('drop-shadow')
  })

  test('the day poster is a wash tile and the CTA is the house primary (§2.2 A, §3.1)', () => {
    const css = rules()
    expect(css).toContain('box-shadow: var(--mz-shadow-coral)')
    expect(css).toContain('border: 0.5px solid rgba(43, 33, 24, 0.06)')
    expect(css).toContain('background: var(--gradient-cta)')
    expect(css).toContain('box-shadow: var(--shadow-cta)')
  })

  test('the kcal figure is ONE display-200 tabular numeral (§3.2)', () => {
    const css = rules()
    expect(css).toMatch(/\.tr-energy-main strong \{[^}]*font-weight: 200;/)
    expect(css).toMatch(/\.tr-energy-main strong \{[^}]*font-variant-numeric: tabular-nums;/)
  })
})

describe('the train session section is registered and re-dressed (mezo-ju4j6.11)', () => {
  const START_MARKER = '── train session ('
  const END_MARKER = '── /train session '
  const section = () => slice(START_MARKER, END_MARKER)
  const rules = () => stripComments(section())

  test('both the opening and the closing comment markers are present, in order', () => {
    const start = rawCss.indexOf(START_MARKER)
    const end = rawCss.indexOf(END_MARKER)
    expect(start, `opening marker "${START_MARKER}" not found`).toBeGreaterThan(-1)
    expect(end, `closing marker "${END_MARKER}" not found`).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
  })

  test('the Titanium-era marker name is gone — one block, renamed', () => {
    expect(rawCss).not.toContain('train session titanium')
  })

  test('the section actually carries the wo- class family, not just the markers', () => {
    for (const cls of ['.wo-card', '.wo-rows', '.wo-field', '.wo-check', '.wo-verdict',
      '.wo-finish', '.wo-dock', '.wo-overload']) {
      expect(section(), `${cls} missing from the train session section`).toContain(cls)
    }
  })

  test('the dark-ground literals are gone — this screen lives in the LIGHT world now', () => {
    const css = rules()
    // A blokk tele volt sötét alapra tervezett beégetett színekkel (#0c1014 dokk, #090e13
    // beviteli mező, #e6ead9 / #c8e895 világos tinták). Világos lapon ezek vagy
    // olvashatatlanok voltak, vagy fekete csíkként ültek a krém oldalon.
    expect(css).not.toMatch(/#ffffff[0-9a-f]{2}/i)
    expect(css).not.toContain('#0c1014')
    expect(css).not.toContain('#090e13')
    expect(css).not.toContain('#c8e895')
    expect(css).not.toContain('#e6ead9')
    expect(css).not.toContain('backdrop-filter')
    expect(css).not.toContain('drop-shadow')
  })

  test('the dock is a LIGHT bar with an upward lift (§7.4), not a black glass strip', () => {
    const css = rules()
    expect(css).toMatch(/\.wo-dock \{[^}]*background: var\(--surface-1\)/)
    expect(css).toContain('box-shadow: 0 -17px 31px -17px rgba(43, 33, 24, 0.28)')
  })

  test('the set fields and the tick are light surfaces, and the tick is CENTRED', () => {
    const css = rules()
    expect(css).toMatch(/\.wo-field input \{[^}]*background: var\(--surface-1\)/)
    // Az elcsúszott pipa oka: a doboznak nem volt rácsa (owner 2026-09-19).
    expect(css).toMatch(/\.wo-check \{[^}]*display: grid; place-items: center;/)
  })

  test('the verdict marks have room: the clay icons render at 24px', () => {
    const css = rules()
    expect(css).toContain('.wo-verdict-mark svg { width: 24px; height: 24px; }')
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
    // The rule grew in the depth & focus sweep (mezo-ju4j6.19): the other three bands
    // dropped to the house grade, so the due one carries the wash as well as the ring.
    expect(css).toMatch(/\.fsx-band\.is-due \{[^}]*border: 1px solid var\(--dv-coral\)/)
    expect(css).toMatch(/\.fsx-band\.is-due \{[^}]*box-shadow: var\(--mz-shadow-coral\)/)
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
 * Section registration (mezo-88iwa.13, T12 Task 3 · re-dressed mezo-ju4j6.12): the
 * Terhelés (TrainWeekPage) face's `.ld-*` section — the hero halo band, the two doorway
 * cards, the group cards and the group-glass body. The marker lost its `titanium` suffix
 * with the re-dress and this describe moved in the SAME commit, as the house rule requires.
 * It also carries the banished-material guards (style bible A.2 rule 4), so the dark-ground
 * literals and the accent glows this pass removed cannot creep back onto this slice.
 */
describe('the train terheles section is registered and re-dressed (mezo-ju4j6.12)', () => {
  const START_MARKER = '── train terheles ('
  const END_MARKER = '── /train terheles '
  const section = () => slice(START_MARKER, END_MARKER)
  const rules = () => stripComments(section())

  test('both the opening and the closing comment markers are present, in order', () => {
    const start = rawCss.indexOf(START_MARKER)
    const end = rawCss.indexOf(END_MARKER)
    expect(start, `opening marker "${START_MARKER}" not found`).toBeGreaterThan(-1)
    expect(end, `closing marker "${END_MARKER}" not found`).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
  })

  test('the Titanium-era marker name is gone — one block, renamed', () => {
    expect(rawCss).not.toContain('train terheles titanium')
  })

  test('the section actually carries the ld- class family, not just the markers', () => {
    for (const cls of [
      '.ld-hero', '.ld-hero-bar', '.ld-hero-pct', '.ld-eyebrow', '.ld-map-card',
      '.ld-move-card', '.ld-groups', '.ld-group-bar', '.ld-group-note', '.ld-sport', '.ld-glass-rows',
    ]) {
      expect(section(), `${cls} missing from the train terheles section`).toContain(cls)
    }
  })

  // A blokk 13 `#ffffffXX` fóliát vitt — mindet egy SÖTÉT alapra tervezve. A `.titan-dark`
  // hatókör a 2. fázisban megszűnt, úgyhogy ezek világos lapon vagy láthatatlanok, vagy
  // szürke hártyát húznak a mosott csempére. Kommentek nélkül nézzük: a blokk saját prózája
  // NEVEZI a száműzött anyagokat.
  test('the white-film literals are gone — this screen lives in the LIGHT world now', () => {
    expect(rules()).not.toMatch(/#ffffff[0-9a-f]{2}/i)
  })

  // §2.3: nincs akcens-izzás. A hős sávja 16px-es neon szórást vitt, a Titán gyűrűk pedig
  // végtelenül forogtak — mindkettő a rossz irány jellegzetes jele.
  test('no accent glow and no infinite spin survive on this slice', () => {
    const css = rules()
    expect(css).not.toMatch(/box-shadow:\s*0 0 \d+px/)
    expect(css).not.toMatch(/animation:[^;]*ld-spin[^;]*infinite/)
  })

  // A doménszín a ház Edzés-akcense, nem a Titán nav-lime (`--tag-gym`) — A.2 1. szabály.
  test('the domain accent is --dv-coral, not the Titanium --tag-gym', () => {
    expect(rules()).toContain('--ld-accent: var(--dv-coral)')
  })

  // A hős a stíluskönyv §2.2 C halo-sávja: keret és doboz nélküli atmoszféra.
  test('the hero is a halo band, not a bordered poster', () => {
    expect(rules()).toMatch(/\.ld-hero \{[^}]*background: var\(--halo-coral\)/)
  })

  // The bars are drawn-on-reveal: the FINAL width is the base rule (so the portaled
  // group glass and a settled 'pop' arrival both show a full bar), and only the armed
  // `.mz-play` subtree animates the growth — the `.gr-tbar` idiom. A future edit that
  // flips this (base scaleX(0)) silently blanks every bar outside an entrance group.
  test('the ld- bars default to their final width and only grow inside .mz-play', () => {
    expect(rawCss).toContain('.mz-play .ld-hero-bar i, .mz-play .ld-group-bar i')
    expect(rawCss).toMatch(/@keyframes ld-fill \{ from \{ transform: scaleX\(0\); \}/)
  })

  // §8.6 „egy lendület, aztán nyugalom": minden, amit ez a szelet animál, kap egy
  // csökkentett-mozgás ágat ugyanabban a blokkban.
  test('every added animation has a reduced-motion branch', () => {
    const css = rules()
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
    for (const sel of ['.ld-hero-art i', '.ld-hero-pct', '.body-map-shape']) {
      expect(reduced, `${sel} has no reduced-motion branch`).toContain(sel)
    }
  })
})

/**
 * Section registration (mezo-lf3cv, P2 Task 1 · re-dressed mezo-ju4j6.12): the „Minden
 * izomjel" subpage's `.mm-*` section — the head, the six region boxes, their 3-wide grid
 * and the muscle cells. Re-dressed with its Terhelés parent, so it carries the same guard.
 */
describe('the train izomjel section is registered and re-dressed (mezo-ju4j6.12)', () => {
  const START_MARKER = '── train izomjel ('
  const END_MARKER = '── /train izomjel '
  const section = () => slice(START_MARKER, END_MARKER)
  const rules = () => stripComments(section())

  test('both the opening and the closing comment markers are present, in order', () => {
    const start = rawCss.indexOf(START_MARKER)
    const end = rawCss.indexOf(END_MARKER)
    expect(start, `opening marker "${START_MARKER}" not found`).toBeGreaterThan(-1)
    expect(end, `closing marker "${END_MARKER}" not found`).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
  })

  test('the Titanium-era marker name is gone — one block, renamed', () => {
    expect(rawCss).not.toContain('train izomjel titanium')
  })

  test('the section actually carries the mm- class family, not just the markers', () => {
    for (const cls of ['.mm-head', '.mm-region', '.mm-grid', '.mm-cell']) {
      expect(section(), `${cls} missing from the train izomjel section`).toContain(cls)
    }
  })

  test('the white-film literal and the black icon shadow are gone', () => {
    const css = rules()
    expect(css).not.toMatch(/#ffffff[0-9a-f]{2}/i)
    expect(css).not.toMatch(/rgba\(0, ?0, ?0/)
  })
})

/**
/**
 * Section registration (mezo-lf3cv, P2 Task 3 · re-dressed mezo-ju4j6.13): the Gyakorlatok
 * tab's own `.gy-*` section — the catalogue rows, the detail hero, the record stat cards,
 * the `.gy-next` nudge, the strength-curve graphic and the medal rows. The marker lost its
 * `titanium` suffix with the re-dress and this describe moved in the SAME commit, as the
 * house rule requires; it also carries the banished-material guards (style bible A.2 rule 4)
 * and the §3.4 ranking this slice was actually about.
 */
describe('the train gyakorlatok section is registered and re-dressed (mezo-ju4j6.13)', () => {
  const START_MARKER = '── train gyakorlatok ('
  const END_MARKER = '── /train gyakorlatok '
  const section = () => slice(START_MARKER, END_MARKER)
  const rules = () => stripComments(section())

  test('both the opening and the closing comment markers are present, in order', () => {
    const start = rawCss.indexOf(START_MARKER)
    const end = rawCss.indexOf(END_MARKER)
    expect(start, `opening marker "${START_MARKER}" not found`).toBeGreaterThan(-1)
    expect(end, `closing marker "${END_MARKER}" not found`).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
  })

  test('the Titanium-era marker name is gone — one block, renamed', () => {
    expect(rawCss).not.toContain('train gyakorlatok titanium')
  })

  test('the section actually carries the gy- class family, not just the markers', () => {
    for (const cls of [
      '.gy-card', '.gy-rec', '.gy-curve', '.gy-medal', '.gy-next', '.gy-hero',
    ]) {
      expect(section(), `${cls} missing from the train gyakorlatok section`).toContain(cls)
    }
  })

  // A blokk a prototípus fehér-alfáit hozta, mind SÖTÉT alapra tervezve. A `.titan-dark`
  // hatókör a 2. fázisban megszűnt; világos lapon ezek vagy láthatatlanok, vagy szürke
  // hártyát húznak a lapra (C 11. szabály).
  test('the white-film literals are gone — this tab lives in the LIGHT world now', () => {
    expect(rules()).not.toMatch(/#ffffff[0-9a-f]{2}/i)
  })

  // §8.6: a hős mögötti két végtelen szaggatott pörgés volt az utolsó hurok a blokkban,
  // és az `ld-spin` keyframe vele együtt ment (A.3 6. szabály: a re-dress nem hagy maga
  // után halott `@keyframes`-t).
  test('the infinite spins are gone, and so is the keyframe they orphaned', () => {
    expect(rules()).not.toContain('infinite')
    expect(rawCss).not.toContain('@keyframes ld-spin')
  })

  // A.2 1. szabály: a doménszín a ház akcense, nem a Titán `--tag-gym`.
  test('the runtime hue falls back to --dv-coral, not the Titanium --tag-gym', () => {
    const css = rules()
    expect(css).toContain('var(--mus-color, var(--dv-coral))')
    expect(css).not.toContain('--tag-gym')
  })

  // §3.4 — EZ a szelet lényege. A katalógus sora ház-sor (a poszter a hangos felület),
  // a becsült maximum viszont mosott csempe a §3.2 számjeggyel.
  test('the catalogue row is a house row, not a wash tile', () => {
    const card = /\.gy-card \{([^}]*)\}/.exec(rules())
    expect(card, '.gy-card rule not found').not.toBeNull()
    expect(card![1]).toContain('background: var(--surface-1)')
    expect(card![1]).toContain('inset 0 0 0 1px var(--border-subtle)')
  })

  test('the estimated 1RM is the hero: a wash tile with the §3.2 numeral', () => {
    const css = rules()
    expect(css).toMatch(/\.gy-rec:first-child \{[^}]*linear-gradient\(150deg/)
    expect(css).toMatch(/\.gy-rec:first-child strong \{[^}]*font-weight: 200;/)
    expect(css).toMatch(/\.gy-rec:first-child strong \{[^}]*font-variant-numeric: tabular-nums;/)
    // …and the two lesser records sit a grade below it, side by side.
    expect(css).toMatch(/\.gy-recs \{[^}]*grid-template-columns: 1fr 1fr;/)
    expect(css).toMatch(/\.gy-rec:nth-child\(n \+ 2\) \{[^}]*background: var\(--surface-1\)/)
  })

  // A.2 5. szabály: minden méret-lépés után 320px-ellenőrzés, és a lépcső a blokkon belül.
  test('the two-up record cells step back to one column on a narrow phone', () => {
    expect(rules()).toMatch(/@media \(max-width: 360px\) \{[^@]*\.gy-recs \{ grid-template-columns: 1fr; \}/)
  })
})

/**
 * Same registration guard (mezo-88iwa.10, T9 · re-dressed mezo-ju4j6.12) for the Terv
 * tab's `.pl-*` section — the mesocycle landing poster, the day-by-day week list, a day's
 * own hero + exercise cells, and the muscle detail's gauge. The marker lost its `titanium`
 * suffix with the re-dress and this describe moved in the SAME commit, as the house rule
 * requires; it also carries the banished-material guards (style bible A.2 rule 4).
 */
describe('the terv section is registered and re-dressed (mezo-ju4j6.12)', () => {
  const START_MARKER = '── terv ('
  const END_MARKER = '── /terv '
  const section = () => slice(START_MARKER, END_MARKER)
  const rules = () => stripComments(section())

  test('both the opening and the closing comment markers are present, in order', () => {
    const start = rawCss.indexOf(START_MARKER)
    const end = rawCss.indexOf(END_MARKER)
    expect(start, `opening marker "${START_MARKER}" not found`).toBeGreaterThan(-1)
    expect(end, `closing marker "${END_MARKER}" not found`).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
  })

  test('the Titanium-era marker name is gone — one block, renamed', () => {
    expect(rawCss).not.toContain('terv titanium')
  })

  test('the section actually carries the pl- class family, not just the markers', () => {
    for (const cls of [
      '.pl-poster', '.pl-ring', '.pl-arc', '.pl-day', '.pl-dest', '.pl-dhero',
      '.pl-ex', '.pl-item', '.pl-scale-bar', '.pl-versus',
    ]) {
      expect(section(), `${cls} missing from the terv section`).toContain(cls)
    }
  })

  // T10 Task 1: the plan library families the T9 port stopped short of — the library
  // hero/cards, the star rating, the template-detail exercise rows, the wizard's load
  // bars (ported renamed to .pl-wload/.pl-wload-row) and the small quiet-row idiom.
  test('the T10 library sub-block carries its own class family', () => {
    for (const cls of [
      '.pl-lib-card', '.pl-lhero', '.pl-stars', '.pl-tpl-ex', '.pl-wload', '.pl-row',
    ]) {
      expect(section(), `${cls} missing from the terv section`).toContain(cls)
    }
  })

  // A blokk 40 fölötti `#ffffffXX` fóliát vitt, mind SÖTÉT alapra tervezve. A `.titan-dark`
  // hatókör a 2. fázisban megszűnt; világos lapon ezek vagy láthatatlanok, vagy szürke
  // hártyát húznak a mosott csempére.
  test('the white-film literals are gone — this tab lives in the LIGHT world now', () => {
    expect(rules()).not.toMatch(/#ffffff[0-9a-f]{2}/i)
  })

  // §2.3: nincs fém-csillanás, nincs akcens-izzás, és nincs végtelen hurok (§8.6 — az
  // egyetlen engedett hurok a „most"-pulzus és a companion-orb lélegzése).
  test('the sheen, the accent glows and the infinite spins are gone', () => {
    const css = rules()
    expect(css).not.toMatch(/box-shadow: 0 0 \d+px/)
    expect(css).not.toMatch(/filter: drop-shadow\(0 0 /)
    expect(css).not.toContain('infinite')
    expect(css).not.toContain('pl-sheen')
  })

  // A doménszín a ház Edzés-akcense, nem a Titán `--tag-gym` (A.2 1. szabály).
  test('the domain accent is --dv-coral, not the Titanium --tag-gym', () => {
    const css = rules()
    expect(css).toContain('--tr-accent: var(--dv-coral)')
    expect(css).not.toContain('--tag-gym')
  })

  // A poszter a stíluskönyv §2.2 C halo-sávja: keret és doboz nélküli atmoszféra.
  test('the poster is a halo band, not a bordered poster', () => {
    expect(rules()).toMatch(/\.pl-poster \{[^}]*background: var\(--halo-coral\)/)
  })

  // §4.4: a pihenőnap SZAGGATOTT keretet kap, nem 45%-ra halványítást — a régi világ nem
  // opacitással mond „kevésbé fontosat".
  test('the rest day is dashed, never dimmed', () => {
    const rest = /\.pl-day\.is-rest \{([^}]*)\}/.exec(rules())
    expect(rest, '.pl-day.is-rest rule not found').not.toBeNull()
    expect(rest![1]).toContain('dashed')
    expect(rest![1]).not.toContain('opacity: .45')
  })

  // mezo-b516k Task 1: the ⓘ explain layer's own sub-block — the 22px icon-only
  // button (ported from plan.css:313-314) and the glass copy paragraph (ported from
  // load.css:179's `.info-glass-copy`, renamed with the house `pl-` prefix).
  test('the explain-layer sub-block carries .pl-info and .pl-info-copy', () => {
    for (const cls of ['.pl-info', '.pl-info-copy']) {
      expect(section(), `${cls} missing from the terv section`).toContain(cls)
    }
  })

  // The prototype's glyph is 22px; the house tap-target rule is 44px. The button must
  // grow its HIT AREA, not the glyph — a `::after` hit box, so a future edit that
  // "simplifies" it back to a bare 22px control fails here instead of shipping a
  // 22px touch target.
  test('.pl-info keeps the 22px glyph but carries a 44px hit box', () => {
    const ruleMatch = /(?:^|\n)\.pl-info \{([^}]*)\}/.exec(section())
    expect(ruleMatch, '.pl-info standalone rule not found in the terv section').not.toBeNull()
    expect(ruleMatch![1]).toContain('width: 22px')
    const hit = /(?:^|\n)\.pl-info::after \{([^}]*)\}/.exec(section())
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
describe('the train session section keeps its structural invariants (mezo-88iwa.7)', () => {
  // A blokk NEVE a visszaöltöztetéssel megváltozott (mezo-ju4j6.11) — az anyagát a fenti
  // re-dress describe őrzi, ez itt a SZERKEZETI kikötéseké marad.
  const START_MARKER = '── train session ('
  const END_MARKER = '── /train session '

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
      expect(section, `${cls} missing from the train session section`).toContain(cls)
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
    expect(ruleMatch, '.wo-row standalone rule not found in the train session section').not.toBeNull()
    const ruleStart = ruleMatch!.index
    const ruleEnd = section.indexOf('}', ruleStart)
    const rule = section.slice(ruleStart, ruleEnd)
    expect(rule).toContain('width: 100%')
  })
})

/**
/**
 * Section registration (mezo-88iwa.8, T7 Task 2 · re-dressed mezo-ju4j6.13): the workout-
 * close ceremony's `.cer-*` section — the score reveal, the settled result, and the
 * details/recap screen. The ceremony PATTERN stays canon (`docs/design_2.0/
 * 2026-09-15-ceremony-pattern.md`); only the material went back to polished stone and gold
 * (style bible §5). Marker renamed and this describe moved in the SAME commit.
 */
describe('the train ceremony section is registered and wears the restored materials (mezo-ju4j6.13)', () => {
  const START_MARKER = '── train ceremony ('
  const END_MARKER = '── /train ceremony '
  const section = () => slice(START_MARKER, END_MARKER)
  const rules = () => stripComments(section())

  test('both the opening and the closing comment markers are present, in order', () => {
    const start = rawCss.indexOf(START_MARKER)
    const end = rawCss.indexOf(END_MARKER)
    expect(start, `opening marker "${START_MARKER}" not found`).toBeGreaterThan(-1)
    expect(end, `closing marker "${END_MARKER}" not found`).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
  })

  test('the Titanium-era marker name is gone — one block, renamed', () => {
    expect(rawCss).not.toContain('train ceremony titanium')
  })

  test('the section actually carries the cer- class family, not just the markers', () => {
    for (const cls of [
      '.cer-stars', '.cer-bar', '.cer-counters', '.cer-mstar', '.cer-kcal', '.cer-starrow',
      '.cer-card', '.cer-tally', '.cer-verdict', '.cer-recap-chip',
    ]) {
      expect(section(), `${cls} missing from the train ceremony section`).toContain(cls)
    }
  })

  test('the white-film literals are gone — the ceremony is lit, not tinted glass', () => {
    expect(rules()).not.toMatch(/#ffffff[0-9a-f]{2}/i)
  })

  // §5: arany tónus-sáv a talajon, §2.2 C halo a hős mögött — se sötét poszter, se
  // `backdrop-filter`.
  test('the ground is a gold tone band and the hero sits on a halo', () => {
    const css = rules()
    expect(css).toContain('var(--mz-tone-gold)')
    expect(css).toMatch(/\.cer-sky \{[^}]*background: var\(--halo-amber\)/)
    expect(css).not.toContain('backdrop-filter')
  })

  // A „Ritmus" kő a stíluskönyv §5 meleg, 3-stopos radiális receptje (mezo-p2777): a
  // Titán-kori 4-stopos lineáris sötét `#322A29` sávja piszkos csíkként olvasott a
  // visszaállított világos talajon. Neon-glow és vágott arany számjegy továbbra sincs.
  test('the Ritmus stone is the warm §5 radial; no neon glow, no clipped-gradient numerals', () => {
    const css = rules()
    expect(css).toMatch(/\.cer-fill \{[^}]*radial-gradient\(85% 160% at 36% 30%, #FFE9A8 0%, #E0AC2F 55%, #A9770F 100%\)/)
    expect(css).not.toContain('#322A29')
    expect(css).not.toMatch(/box-shadow: 0 0 \d+px/)
    expect(css).not.toContain('background-clip: text')
    expect(css).not.toContain('filter: grayscale')
  })

  // §3.4 — a rangsor: a számlálók és a statisztika ház-anyag, az ÚJ REKORD az egyetlen
  // arany mosott csempe, a megnyert kalória pedig ZSÁLYA (A.2 1. szabály: az az Fuel
  // száma), nem a Titán-kori cián.
  test('the ranking holds: counters quiet, the record gold, the kcal sage', () => {
    const css = rules()
    expect(css).toMatch(/\.cer-counters span \{[^}]*background: none;/)
    expect(css).toMatch(/\.cer-record \{[^}]*background: var\(--mz-wash-gold\)/)
    expect(css).toMatch(/\.cer-kcal \{[^}]*background: var\(--mz-wash-sage\)/)
    expect(css).toMatch(/\.cer-kcal-line strong \{[^}]*font-weight: 200;/)
  })

  // Egylövetű koreográfia, végtelen hurok nélkül (§8.6) — a `no-preference`/`reduce`
  // ágpár marad, mert a ceremónia MINTÁJA az.
  test('the choreography stays one-shot, with its reduced-motion branch', () => {
    const css = rules()
    expect(css).not.toContain('infinite')
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    expect(css).toContain('@media (prefers-reduced-motion: no-preference)')
  })
})

/**
/**
 * Section registration (mezo-88iwa.9, T8 Task 3 · re-dressed mezo-ju4j6.13): the sport-
 * logging flow's own `.sp-*` section — the picker grid/tiles and the per-sport form. The
 * ceremony families are NOT here: the shared `.cer-*` section serves that. Marker renamed
 * and this describe moved in the SAME commit.
 */
describe('the train sport section is registered and re-dressed (mezo-ju4j6.13)', () => {
  const START_MARKER = '── train sport ('
  const END_MARKER = '── /train sport '
  const section = () => slice(START_MARKER, END_MARKER)
  const rules = () => stripComments(section())

  test('both the opening and the closing comment markers are present, in order', () => {
    const start = rawCss.indexOf(START_MARKER)
    const end = rawCss.indexOf(END_MARKER)
    expect(start, `opening marker "${START_MARKER}" not found`).toBeGreaterThan(-1)
    expect(end, `closing marker "${END_MARKER}" not found`).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
  })

  test('the Titanium-era marker name is gone — one block, renamed', () => {
    expect(rawCss).not.toContain('train sport titanium')
  })

  test('the section actually carries the sp- class family, not just the markers', () => {
    for (const cls of [
      '.sp-grid', '.sp-tile', '.sp-field', '.sp-chips', '.sp-kcal', '.sp-note',
    ]) {
      expect(section(), `${cls} missing from the train sport section`).toContain(cls)
    }
  })

  test('the white films and the dark input grounds are gone', () => {
    const css = rules()
    expect(css).not.toMatch(/#ffffff[0-9a-f]{2}/i)
    // `#090e1366` — the prototype's near-black field, a black strip on a cream page.
    expect(css).not.toMatch(/#090e13/i)
  })

  // §3.4 + A.5 10. szabály: a tizenegy csempe §2.2 B CELLA (lapos színfolt, árnyék
  // nélkül), nem mosott csempe — de nem is csupasz pajzs, mert minden sport ábrája
  // ugyanaz az agyaggömb, és a szín az egyetlen megkülönböztető jel.
  test('the picker tiles are flat colour cells, not wash tiles', () => {
    const tile = /\.sp-tile \{([^}]*)\}/.exec(rules())
    expect(tile, '.sp-tile rule not found').not.toBeNull()
    expect(tile![1]).toContain('box-shadow: none')
    expect(tile![1]).toContain('color-mix(in srgb, var(--sp-color) 18%, var(--surface-card))')
  })

  // A lap hőse a PERC: §2.2 A mosás + §3.2 számjegy, `[data-sp-key]` horgonyon
  // (SportLogPage `FieldRow`) — a mezősorrend sportonként más, ezért pozíciós szelektor
  // rossz választ adna.
  test('the minutes stepper is the one wash tile on the form', () => {
    const css = rules()
    expect(css).toMatch(/\.sp-field\[data-sp-key="minutes"\] \.sp-number \{[^}]*linear-gradient\(150deg/)
    expect(css).toMatch(/\.sp-field\[data-sp-key="minutes"\] \.sp-number input \{[^}]*font-size: 40px/)
    expect(css).toMatch(/\.sp-number \{[^}]*background: var\(--surface-1\)/)
  })
})

/**
 * C rule 13, found while re-dressing the sport form (mezo-ju4j6.13): `.sp-foot`'s
 * „Naplózom" CTA was reached by NEITHER `.gl-card .wo-close-cta` nor `.cer-cta
 * .wo-close-cta`, so on the restored light page it rendered as a bare, unstyled button.
 * It is the third arm of that rule now — the one big action is the house primary.
 */
describe('the sport form CTA is the house primary (mezo-ju4j6.13)', () => {
  test('.sp-foot joins the .wo-close-cta rule and takes --gradient-cta', () => {
    const rule = /\.gl-card \.wo-close-cta, \.cer-cta \.wo-close-cta, \.sp-foot \.wo-close-cta \{([^}]*)\}/.exec(rawCss)
    expect(rule, 'the three-armed .wo-close-cta rule not found').not.toBeNull()
    expect(rule![1]).toContain('background: var(--gradient-cta)')
    expect(rule![1]).toContain('box-shadow: var(--shadow-cta)')
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

  // Narrowed by the depth & focus sweep (mezo-ju4j6.19). The 5a–5d pass had made ALL five
  // Konyha surfaces §2.2 A wash tiles, and the page read flat: §3.4 says a wash tile is loud
  // only next to something that isn't one. The Receptműhely is now the page's single lifted
  // tile, so this guard checks THAT — a hue-token lift on the hero and the hairline idiom
  // still in use — rather than demanding every tile be lifted.
  test('the Receptműhely is the block\'s one lifted wash tile (§2.2 A + §3.4)', () => {
    const css = rules()
    expect(css.match(/border: 0\.5px solid rgba\(43, 33, 24, 0\.06\)/g) ?? []).not.toHaveLength(0)
    expect(css).toMatch(/\.fkx-poster\.is-workshop \{[^}]*box-shadow: var\(--mz-shadow-lav\)/)
    expect(css, 'a lifted tile must be lifted by a TOKEN, never a raw shadow').not.toMatch(
      /box-shadow: 0 \d+px [^;]*rgba\(0, 0, 0/)
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
    for (const cls of ['.fcx-screen', '.fcx-scrim', '.fcx-sheet', '.fcx-sky', '.fcx-stars',
      '.fcx-ring', '.fcx-counters', '.fcx-result', '.fcx-score', '.fcx-cta', '.fcx-close']) {
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

  // mezo-p2777: a kő a §5 meleg radiális receptje — a pont-gyűrű SVG-gradienseként a
  // komponensben él (FuelMealCeremony.test őrzi a stopokat), a lap felcsúszását pedig a rAF-menet írja a `--rise`-on
  // át — CSS-átmenet nélkül, mert a háttérbe tett webview azt a képernyőn KÍVÜL fagyasztaná.
  test('no Titanium stone band, and the sheet rises by the frame-driven --rise', () => {
    const css = rules()
    expect(css).not.toContain('#322A29')
    expect(css).toMatch(/\.fcx-sheet \{[^}]*transform: translateY\(calc\(var\(--rise, 0\) \* 105%\)\)/)
    expect(css).not.toMatch(/\.fcx-sheet \{[^}]*transition/)
  })

  test('the ignition honours reduced motion', () => {
    const css = rules()
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
  })
})

/**
 * Depth & focus sweep (`mezo-ju4j6.19`) — the retro-fit of style bible §3.4 across the
 * screens re-dressed BEFORE the rule existed. Every slice's first pass had turned each
 * surface into a §2.2 A wash tile, and each time the screen read flatter than the Titanium
 * one it replaced: a wash tile is loud only next to something that isn't one.
 *
 * These are RANKING guards, not material guards — they assert that a named surface sits at
 * the grade its screen's hierarchy needs, so a later slice cannot quietly promote it back.
 * Each one names the screen's hero in its own message.
 */
describe('the depth & focus ranking holds across the swept screens (mezo-ju4j6.19)', () => {
  const rule = (selector: string) => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const m = new RegExp(`(?:^|\\n)${escaped} \\{([^}]*)\\}`).exec(stripComments(rawCss))
    expect(m, `${selector} rule not found in prototype.css`).not.toBeNull()
    return m![1]
  }
  /** A demoted surface: the house row/card material — flat --surface-1 under a hairline. */
  const expectHouseGrade = (selector: string, hero: string) => {
    const body = rule(selector)
    expect(body, `${selector} must sit below "${hero}" — it needs the --surface-1 house grade`)
      .toContain('background: var(--surface-1)')
    expect(body, `${selector} must sit below "${hero}" — hairline inset, never a lift shadow`)
      .toContain('inset 0 0 0 1px var(--border-subtle)')
    expect(body, `${selector} must not carry a §2.2 A wash gradient`).not.toContain('linear-gradient(150deg')
  }
  /** A demoted surface that keeps its own hue: the §2.2 B cell — flat tint, no shadow. */
  const expectCellGrade = (selector: string, hue: string, hero: string) => {
    const body = rule(selector)
    expect(body, `${selector} must sit below "${hero}" as a §2.2 B cell`).toContain('box-shadow: none')
    expect(body, `${selector} keeps its own hue, flat`).toContain(`color-mix(in srgb, var(${hue})`)
    expect(body, `${selector} must not carry a §2.2 A wash gradient`).not.toContain('linear-gradient(150deg')
  }

  test('Fuel · étkezés-értékelés: the score is the hero, the six dimensions are cells', () => {
    expectCellGrade('.fmx-dim', '--dim-color', 'a 9,2 pontszám a halo-sávban')
  })

  test('Fuel · Kiegészítők: the ring + KÖVETKEZIK is the hero, the time bands are house rows', () => {
    expectHouseGrade('.fsx-band', 'a napi gyűrű és a KÖVETKEZIK sor')
    // …and the wash comes back on exactly one band: the one that is due now (§4.4).
    expect(stripComments(rawCss)).toMatch(/\.fsx-band\.is-due \{[^}]*linear-gradient\(150deg/)
    // §4.4: a finished band is never dimmed away.
    expect(rule('.fsx-band.is-complete')).toContain('opacity: 1')
  })

  test('Fuel · Trendek: the week picture is the hero, the glance tiles and split rows drop', () => {
    expectCellGrade('.ftx-tile', '--ftx-tile-color', 'a hét képe — halo-sáv + napi oszlopok')
    expectHouseGrade('.ftx-splitrow', 'a hét képe — halo-sáv + napi oszlopok')
    expectHouseGrade('.ftx-dim', 'az üvegdoboz saját 40px-es számjegye')
  })

  test('Fuel · Konyha: only the Receptműhely stays a wash tile', () => {
    expectHouseGrade('.fkx-capture', 'a Receptműhely')
    expectHouseGrade('.fkx-poster', 'a Receptműhely')
    expect(stripComments(rawCss)).toMatch(/\.fkx-poster\.is-workshop \{[^}]*linear-gradient\(150deg/)
    // §3.3: the hero's own promise wears the card-title ramp, not the neighbours' size.
    expect(rule('.fkx-ws-copy strong')).toContain('font-size: 24px')
  })

  test('Train · in-workout list: finished work recedes, the remaining work stays washed', () => {
    expectHouseGrade('.wo-card.is-complete', 'a még hátralévő gyakorlatok')
    // The live card itself keeps the §2.2 A wash — the demotion is state-driven, not global.
    expect(rule('.wo-card')).toContain('linear-gradient(150deg')
    // §4.4: skipped is dashed amber with no shadow — never opacity, never red.
    const skipped = rule('.wo-card.is-skipped')
    expect(skipped).toContain('opacity: 1')
    expect(skipped).toContain('dashed')
    expect(skipped).toContain('box-shadow: none')
  })

  test('Train · progression banner: a cell inside a card, not a second poster', () => {
    const body = rule('.pobanner')
    expect(body, 'a wash tile on top of a wash tile makes both disappear (§3.4)').toContain('box-shadow:none')
    expect(body).toContain('var(--mz-cell-coral-bg)')
    // A.4 rule 7: off the pre-`--dv-` palette, onto the house cell pairs, so dark mode follows.
    const block = stripComments(rawCss).slice(stripComments(rawCss).indexOf('.pobanner {'))
    const banner = block.slice(0, block.indexOf('.pobanner-cells .cval'))
    expect(banner).not.toMatch(/var\(--(coral|sage|amber)-deep\)/)
  })

  test('the shell: the domain switcher marks WHERE YOU ARE with the only wash tile', () => {
    expectHouseGrade('.domain-row', 'az a terület, ahol éppen állsz')
    expect(stripComments(rawCss)).toMatch(/\.domain-row\.current \{[^}]*background: var\(--mz-wash-sand\)/)
    expect(stripComments(rawCss)).toMatch(/\.domain-row\.current\[data-domain="fuel"\]\s*\{[^}]*var\(--mz-wash-sage\)/)
  })
})

/**
 * Üvegesítés U1 (mezo-me75u.1): the ONE glass recipe every slice reuses (üveg style bible §3).
 * A second glass recipe or palette is the failure mode this guards: the kit lives in one block,
 * carries all four layers of the card, and keeps its sheen inside the reduced-motion gate.
 */
describe('the uveg kit section is registered and carries the §3 recipe (mezo-me75u.1)', () => {
  const START_MARKER = '── uveg kit ('
  const END_MARKER = '── /uveg kit '
  const section = () => slice(START_MARKER, END_MARKER)
  const rules = () => stripComments(section())

  test('both markers are present, in order', () => {
    expect(rawCss.indexOf(START_MARKER)).toBeGreaterThan(-1)
    expect(rawCss.indexOf(END_MARKER)).toBeGreaterThan(rawCss.indexOf(START_MARKER))
  })

  test('the glass card has its four layers: body, gradient frame, top edge + glow, sheen', () => {
    const css = rules()
    expect(css).toMatch(/\.glass \{[^}]*backdrop-filter: blur\(16px\) saturate\(1\.5\)/)
    expect(css).toMatch(/\.glass \{[^}]*0 0 26px -6px color-mix\(in srgb, var\(--c\) 30%, transparent\)/)
    expect(css).toMatch(/\.glass \{[^}]*inset 0 1px 0 rgba\(255, 244, 230, 0\.10\)/)
    expect(css).toMatch(/\.glass::before \{[^}]*mask-composite: exclude/)
    expect(css).toMatch(/\.glass::after \{[^}]*skewX\(-20deg\)/)
  })

  test('there is exactly ONE .glass recipe in the whole stylesheet', () => {
    expect(stripComments(rawCss).match(/^\.glass \{/gm) ?? []).toHaveLength(1)
  })

  test('the sheen only runs inside the reduced-motion gate; still/round glass never sweeps', () => {
    const css = rules()
    const gate = css.indexOf('@media (prefers-reduced-motion: no-preference)')
    expect(gate).toBeGreaterThan(-1)
    expect(css.indexOf('animation: uv-sheen')).toBeGreaterThan(gate)
    expect(css).toMatch(/\.glass\.is-still::after, \.glass\.is-round::after \{[^}]*display: none/)
  })

  test('the ground is the warm graphite, never the cold Titanium one', () => {
    const css = rules()
    for (const cold of ['#0B0D12', '#13151D', '#20222A']) expect(css).not.toContain(cold)
  })
})
