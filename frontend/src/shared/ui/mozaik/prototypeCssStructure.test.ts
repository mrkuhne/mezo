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
