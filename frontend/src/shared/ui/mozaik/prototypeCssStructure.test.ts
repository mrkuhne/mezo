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
 * dashes" (see e.g. fuel-mai titanium :11767/:12549, titan-dark scope :13503/:13649) — this is
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
 * Section registration (mezo-88iwa.13, T12 Task 2): the `GlassBox` shared 3D glass
 * primitive's `.gl-*` section, registered the same way the `train mai titanium` block
 * above is — open/close comment markers, both present and in order, with the class
 * family actually inside the span.
 */
describe('the titanium glass primitive section is registered (mezo-88iwa.13)', () => {
  const START_MARKER = 'titanium glass primitive'
  const END_MARKER = '/titanium glass primitive'
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

  test('the section actually carries the gl- class family, not just the markers', () => {
    const start = rawCss.indexOf(START_MARKER)
    const end = rawCss.indexOf(END_MARKER)
    const section = start > -1 && end > start ? rawCss.slice(start, end) : ''
    for (const cls of ['.gl-backdrop', '.gl-card', '.gl-head', '.gl-x', '.gl-anim']) {
      expect(section, `${cls} missing from the titanium glass primitive section`).toContain(cls)
    }
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
  test('the section actually carries the pl- class family, not just the markers', () => {
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
      '.pl-poster', '.pl-ring', '.pl-arc', '.pl-day', '.pl-dest', '.pl-dhero',
      '.pl-ex', '.pl-item', '.pl-scale-bar', '.pl-versus',
    ]) {
      expect(section, `${cls} missing from the terv titanium section`).toContain(cls)
    }
  })
})
