import { describe, expect, test } from 'vitest'
import rawCss from '@/styles/prototype.css?raw'
import frameCss from '@/styles/folyadek-frame.css?raw'
import napEpitesCss from '@/styles/folyadek-nap-epites.css?raw'
import kitCss from '@/styles/folyadek-kit.css?raw'
import edzesKozosCss from '@/styles/folyadek-edzes-kozos.css?raw'
import edzesMaiCss from '@/styles/folyadek-edzes-mai.css?raw'
import edzesTerhelesCss from '@/styles/folyadek-edzes-terheles.css?raw'
import edzesSportCss from '@/styles/folyadek-edzes-sport.css?raw'
import edzesTervCss from '@/styles/folyadek-edzes-terv.css?raw'
import edzesNapszerkCss from '@/styles/folyadek-edzes-napszerk.css?raw'
import edzesSablonCss from '@/styles/folyadek-edzes-sablon.css?raw'
import edzesRiportCss from '@/styles/folyadek-edzes-riport.css?raw'
import edzesEligazitasCss from '@/styles/folyadek-edzes-eligazitas.css?raw'
import edzesKozbenCss from '@/styles/folyadek-edzes-kozben.css?raw'
import edzesKozbenLapokCss from '@/styles/folyadek-edzes-kozben-lapok.css?raw'
import edzesLezarasCss from '@/styles/folyadek-edzes-lezaras.css?raw'
import edzesOsszegzesCss from '@/styles/folyadek-edzes-osszegzes.css?raw'
import fuelKozosCss from '@/styles/folyadek-fuel-kozos.css?raw'
import fuelMaiCss from '@/styles/folyadek-fuel-mai.css?raw'
import fuelLogCss from '@/styles/folyadek-fuel-log.css?raw'
import fuelEtkezesCss from '@/styles/folyadek-fuel-etkezes.css?raw'
import fuelTanulasCss from '@/styles/folyadek-fuel-tanulas.css?raw'
import fuelKiegCss from '@/styles/folyadek-fuel-kieg.css?raw'
import fuelTrendekCss from '@/styles/folyadek-fuel-trendek.css?raw'
import fuelKamraCss from '@/styles/folyadek-fuel-kamra.css?raw'
import fuelReceptCss from '@/styles/folyadek-fuel-recept.css?raw'
import fuelBeallitasCss from '@/styles/folyadek-fuel-beallitas.css?raw'

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
describe('the train mai section keeps only the shared eyebrow (mezo-ju4j6.11 → U11 mezo-dr0h8)', () => {
  const START_MARKER = '── train mai ('
  const END_MARKER = '── /train mai '
  const section = () => slice(START_MARKER, END_MARKER)

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

  test('the section still carries .tr-eyebrow, which the plan, template and report pages wear', () => {
    expect(stripComments(section())).toMatch(/\.tr-eyebrow \{/)
  })

  test('the pre-üveg Mai poster families are gone from the whole stylesheet (U4 renders .trm-*)', () => {
    const css = stripComments(rawCss)
    for (const cls of ['.tr-day', '.tr-start', '.tr-alt', '.tr-energy', '.tr-mus', '.daychip', '.daystrip', '.mesorow', '.todaycard', '.typetag', '.metapill']) {
      expect(css, `${cls} is dead since U4 and must not come back`).not.toMatch(new RegExp(`\\${cls}(?![\\w-])`))
    }
  })
})

// The `train session` block (`.wo-*`) left with the Folyadék in-workout flow (mezo-n4wf5.4): its guards — markers, the
// light dock, the centred tick, the 24px verdict marks — are rewritten to the new truth in RETIRED_KOZBEN_BLOCKS and
// „the Folyadék in-workout sheets keep the truths…" below.

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
    for (const cls of ['.gl-backdrop', '.gl-card', '.gl-head-title', '.gl-anim']) {
      expect(section, `${cls} missing from the glassbox section`).toContain(cls)
    }
  })

  test('the section keeps geometry only; the skin is the U10 glass (U11, mezo-6661l)', () => {
    const start = rawCss.indexOf(START_MARKER)
    const end = rawCss.indexOf(END_MARKER)
    const rules = stripComments(rawCss.slice(start, end))
    // the pre-üveg light sheet skin (veil, tint radial, white top edge) is gone …
    expect(rules).not.toMatch(/\.gl-card \{[^}]*background/)
    expect(rules).not.toMatch(/\.gl-backdrop \{[^}]*background/)
    // … and the head / close button are dressed by the uveg reteg ablak block only
    expect(stripComments(rawCss)).toMatch(/\.uv-gb \.gl-x \{/)
    expect(stripComments(rawCss)).toMatch(/\.gl-card\.glass\.uv-gb \{/)
  })
})

/**
 * The old Fuel skin retired in Folyadék F5 (mezo-n4wf5.5). Fuel renders the kit now (`fo-*`), the Fuel-shared
 * pieces (`.fx-*`, styles/folyadek-fuel-kozos.css) and one stylesheet per area (`.fa- .fg- .fe- .ft- .fk- .fr- .fp-
 * .fc- .fb-` in styles/folyadek-fuel-*.css); the rules nothing renders any more were deleted from prototype.css with a
 * zero-usage proof (bible F1.13 / F4.11: 2 849 rules, 20 978 → 15 236 lines).
 *
 * This block replaces the guards that used to REQUIRE those rules — the restored-world blocks `fuel-mai` (`fmx-`),
 * `fuel-stack` (`fsx-`), `fuel-trendek` (`ftx-`), `fuel-konyha` (`fkx-`), the Üveg blocks `uveg fuel konyha / receptek
 * / log / stack / trendek`, the meal ceremony in `uveg reteg unnep` (`fcx-`), the learning pages (`fln-`, `fwl-`) and
 * the lines other blocks carried for Fuel. Each entry: the block's marker name (null = no block of its own, or the
 * block survives cut down) and selectors that must have NO rule left anywhere in the stylesheet (comments stripped —
 * surviving prose may still name them). What the retired guards PROTECTED is re-pointed at the Folyadék sheets in
 * „the Folyadék Fuel sheets keep the truths…" further down.
 */
function slice(start: string, end: string) {
  const marker = rawCss.indexOf(start)
  const s = marker > -1 ? rawCss.lastIndexOf('/*', marker) : -1
  const e = rawCss.indexOf(end)
  return s > -1 && e > s ? rawCss.slice(s, e) : ''
}
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '')

const RETIRED_FUEL_BLOCKS: Array<[string | null, string, string[]]> = [
  ['fuel-mai', 'Mai, étkezés, értékelés, étkezési óra, vércukor-doboz (fmx-)', ['.fmx-', '@keyframes fmx-', '--block-color',
    '--nt-color', '--dim-color']],
  ['fuel-stack', 'Kiegészítők, Protokoll, Új elem (fsx-)', ['.fsx-', '@keyframes fsx-', '--fsx-']],
  ['fuel-trendek', 'Trendek (ftx-)', ['.ftx-', '@keyframes ftx-', '--ftx-']],
  ['fuel-konyha', 'Konyha, Kamra, Receptek, Műhely (fkx-)', ['.fkx-', '@keyframes fkx-']],
  ['fuel overflow guard', 'a szövegsorok túlcsordulás-őre', ['.fmx-', '.fsx-', '.ftx-', '.fkx-']],
  ['uveg fuel konyha', 'Konyha, Kamra, Kamra-tétel és lapjai (Üveg)', ['.fkk-']],
  ['uveg fuel receptek', 'Receptek, recept, szerkesztő, Műhely (Üveg)', ['.wsh-', '.recipe-save-bar', '@keyframes wsh-']],
  ['uveg fuel log', 'logolás, összeállító, választók, víz, energia (Üveg)', ['.logflow-', '.flognew-', '.flp-', '.fkp-',
    '@keyframes flp-']],
  ['uveg fuel stack', 'Kiegészítők, Protokoll, Új elem, Gyógyszer (Üveg)', ['.fmd-', '.stk-', '@keyframes stk-']],
  ['uveg fuel trendek', 'Trendek, napkártya, Fuel beállítások, étkezési ablakok (Üveg)', ['.fset-', '.fsl-',
    '@keyframes fset-']],
  ['uveg reteg unnep', 'a kaja-ünneplés (fcx-)', ['.fcx-', '@keyframes fcx-']],
  ['heti tanulás', 'heti tanulás (fwl-)', ['.fwl-']],
  ['„Hogy tanultam?” oldal', 'Tanulás oldal (fln-)', ['.fln-', '@keyframes fln-']],
  [null, 'a pre-Üveg családok (hub, Stack v2 / 3.0, Kamra v2, pont-bontás, Terv, ablak-sziget, kész-kapszula)', ['.fh-',
    '.km-', '.sb-', '.fpl-', '.isl-mealchip', '.kdone', '.zcard', '.zrow', '.chip-tap', '.fuelchips', '.gauge-p', '.slot .mrow']],
  [null, 'Fuel sorai a megmaradó közös blokkokban (lapok, rögzítés, kihagyás)', ['.uvl-fuel', '.uvl-kamra', '.capture-water-',
    '.capture-tone-water', '.trm-whysheet', '.trm-whyg', '.trm-whyc', '.trm-whynote', '.trm-inpmic']],
]

describe.each(RETIRED_FUEL_BLOCKS)('the retired Fuel skin stays out: %s — %s (Folyadék F5, mezo-n4wf5.5)', (marker, _what, sels) => {
  test('its marker pair is gone (or, for a surviving block, still paired)', () => {
    if (marker) {
      expect(rawCss).not.toContain(`── ${marker} (`)
      expect(rawCss).not.toContain(`── /${marker} `)
    } else {
      // the blocks Fuel only had lines in survive for the other domains, each with BOTH markers (bible F4.11)
      for (const name of ['uveg nap rogzites', 'uveg edzes mai', 'uveg reteg lap']) {
        expect(rawCss.split(`── ${name} (mezo-`).length - 1).toBe(1)
        expect(rawCss.split(`── /${name} ──`).length - 1).toBe(1)
      }
    }
  })

  test('none of its selectors has a rule left anywhere in the stylesheet', () => {
    const rules = stripComments(rawCss)
    const left = sels.filter((sel) => rules.includes(sel))
    expect(left, `retired Fuel selectors are back in prototype.css: ${left.join(', ')}`).toEqual([])
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
 * The pre-Folyadék Edzés skin retired in Folyadék F3 (mezo-n4wf5.3). Edzés renders the kit now (`fo-*`),
 * the Edzés-shared pieces (`.ex-*`, styles/folyadek-edzes-kozos.css) and one stylesheet per area
 * (`.em- .et- .es- .ep- .ee- .ew- .er-` in styles/folyadek-edzes-*.css); the old rules nothing
 * renders any more were deleted from prototype.css with a zero-usage proof (bible F1.13).
 *
 * This block replaces the guards that used to REQUIRE those rules: `train terheles` (`ld-`),
 * `train izomjel` (`mm-`), `train gyakorlatok` (`gy-`), `terv` (`pl-`, incl. the `.pl-info` 44px
 * hit box — the explain trigger is the kit's text link now, see `.fo-lk::after` below), `train sport`
 * (`sp-`), the sport form CTA (`.sp-foot`), and the Üveg blocks `uveg edzes terheles / sport /
 * gyakorlatok`, `uveg edzes2 *`, `uveg sajat edzes`, `uveg lezaras edzes`. Each entry: the block's
 * marker name (null = the block survives, cut down) and selectors that must have NO rule left
 * anywhere in the stylesheet (comments stripped — surviving prose may still name them).
 *
 * What is NOT retired here (other domains still wear it): the shared `.tr-eyebrow`, and from `uveg edzes mai` the
 * duration row of the shared RecoveryDurationRow (`.trm-kmd*`). The reason sheet's chips (`.trm-why*`, `.trm-inpmic`)
 * left with Fuel's own sheet in Folyadék F5 — pinned as gone in RETIRED_FUEL_BLOCKS.
 */
const RETIRED_EDZES_BLOCKS: Array<[string | null, string, string[]]> = [
  ['train terheles', 'Terhelés (ld-)', ['.ld-hero', '.ld-map', '.ld-group', '.ld-sport', '.ld-move', '.ld-glass', '.ld-h3',
    '.ld-eyebrow', '.ld-event', '.ld-legend', '@keyframes ld-']],
  ['train izomjel', 'Minden izomjel (mm-)', ['.mm-head', '.mm-region', '.mm-grid', '.mm-cell']],
  ['train gyakorlatok', 'Gyakorlatok + medálok (gy-)', ['.gy-card', '.gy-rec', '.gy-curve', '.gy-medal', '.gy-hero', '.gy-list',
    '.gy-search', '.gy-next']],
  ['terv', 'Terv (pl-)', ['.pl-poster', '.pl-week', '.pl-phase', '.pl-ring', '.pl-arc', '.pl-day', '.pl-dest', '.pl-item',
    '.pl-dhero', '.pl-ex', '.pl-scale', '.pl-lhero', '.pl-lib', '.pl-tpl', '.pl-wload', '.pl-versus', '.pl-stars', '.pl-h3',
    '.pl-info {', '.pl-info::after', '.pl-info .icon', '@keyframes pl-']],
  ['train sport', 'Sport-rögzítés (sp-)', ['.sp-page', '.sp-head', '.sp-grid', '.sp-tile', '.sp-form', '.sp-field', '.sp-chips',
    '.sp-range', '.sp-number', '.sp-kcal', '.sp-note', '.sp-foot']],
  ['uveg edzes terheles', '/train/week + /train/gym (Üveg)', ['.tw-load', '.tw-map', '.tw-move', '.tw-glass', '.tw-custom',
    '.tw-signals']],
  ['uveg edzes sport', '/train/sport, /train/futas (Üveg)', ['.uvs-', '.spw-', '.stag-run', '.capture-tone-sport',
    '.capture-tone-run', '.uv-gb-kcal']],
  ['uveg edzes gyakorlatok', '/train/medals, /train/exercises (Üveg)', ['.gyx-']],
  ['uveg edzes2 terv', 'a terv hete (Üveg)', ['.tv-day', '.tv-dayrest']],
  ['uveg edzes2 run', 'a futó terv oldala (Üveg)', ['.tv-run', '.mz-wdots', '.mz-arcline', '.mz-phchip', '.mz-coach', '.mz-wmini',
    '.mz-rollchips', '.mz-mband', '.mz-livebanner', '.mz-livedot']],
  ['uveg edzes2 nap', 'egy nap + szerkesztője (Üveg)', ['.tv-day-page', '.tv-dayedit', '.mz-band', '.mz-tchip', '.mz-stepchip',
    '.mz-habnote', '.mz-dsteps', '.mz-dstep', '.mz-dnum', '.mz-dcells', '.mz-dcell', '.mz-dadj', '.mz-eff', '.mz-confbar']],
  ['uveg edzes2 izmok', 'heti vizsgálat + egy izom (Üveg)', ['.tv-week', '.tv-muscle']],
  ['uveg edzes2 konyvtar', 'könyvtár, futamok, riport, összevetés (Üveg)', ['.tv-lib', '.tv-runs', '.tv-report', '.tv-cmp']],
  ['uveg edzes2 sablonok', 'sablonok, sablon-szerkesztő, új terv (Üveg)', ['.tv-tpl', '.tv-wizard', '.mz-dst', '.mz-lt-', '.mz-zb',
    '.mz-lcard', '.mz-exc', '.mz-wbhero', '.mz-dayrow', '.mz-dayhero', '.mz-addex', '.mz-draftfoot', '.mz-confirm',
    '.mz-stepcard', '.mz-lint', '.mz-arr-', '.mz-eb-', '.mz-dct', '.mz-dcgrid', '.mz-daypick', '.mz-dtile', '.mz-wfoot']],
  ['uveg edzes2 het', 'izomtérkép, izomjelek, minden mozgás (Üveg)', ['.ld-map-page', '.tw-map .']],
  ['uveg sajat edzes', 'saját edzés (Üveg)', ['.uvx-cw']],
  ['uveg lezaras edzes', 'az U11 záró javításai', ['.tv-wizard .mz-wfoot', '.pl-poster .pl-week', '.tw-move .ld-move-box']],
  [null, 'Mai (az `uveg edzes mai` blokkból)', ['.trm .', '.trm-hero', '.trm-start', '.trm-sess', '.trm-energy', '.trm-mus',
    '.trm-alt', '.trm-add', '.trm-day', '.trm-stpill', '.trm-skipd', '.trm-kmq', '.trm-kmrel', '.trm-cbsets', '.trd', '.mtr',
    '.donebar', '.uvl-cw', '.uvl-new']],
  [null, 'a gyakorlatválasztó és a régi lapok (az `uveg reteg lap` blokkból)', ['.uvl-edzes', '.uvl-exlist', '.uvl-exitem',
    '.uvl-exrow', '.uvl-stim', '.uvl-subh', '.uvl-none', '.exdemo']],
]

describe.each(RETIRED_EDZES_BLOCKS)('the retired Edzés skin stays out: %s — %s (Folyadék F3, mezo-n4wf5.3)', (marker, _what, sels) => {
  test('its marker pair is gone (or, for a surviving block, still paired)', () => {
    if (marker) {
      expect(rawCss).not.toContain(`── ${marker} (`)
      expect(rawCss).not.toContain(`── /${marker} `)
    } else {
      for (const name of ['uveg edzes mai', 'uveg reteg lap']) {
        expect(rawCss.split(`── ${name} (mezo-`).length - 1).toBe(1)
        expect(rawCss.split(`── /${name} ──`).length - 1).toBe(1)
      }
    }
  })

  test('none of its selectors has a rule left anywhere in the stylesheet', () => {
    const rules = stripComments(rawCss)
    const left = sels.filter((sel) => rules.includes(sel))
    expect(left, `retired Edzés selectors are back in prototype.css: ${left.join(', ')}`).toEqual([])
  })
})

/**
 * Folyadék F4 (mezo-n4wf5.4) — the in-workout flow (Eligazítás, the session page and its sheets, both closing
 * ceremonies, the review) left `prototype.css`. This replaces the guards that used to REQUIRE those rules: `train
 * session` (`.wo-*`: both describes — the re-dress and the structural invariants), `train ceremony` (`.cer-*`), and the
 * Üveg blocks `uveg edzes session` / `uveg edzes zaras`, plus the lines other blocks carried for these screens (the
 * sport ceremony in `uveg reteg unnep`, the return button in `uveg reteg ablak`, the record toast's `.toast-solo`).
 * Same shape as above: the marker name (null = no block of its own) and selectors with NO rule left anywhere.
 * Still here on purpose: `GlassBox` (`.gl-*`, incl. its unused `is-menu` / `is-confirm` variants), `VoiceField`, the
 * level-up overlay (`.levelup` / `.lvu-*`), `ProgressionBanner`'s `.pobanner`. (The meal ceremony's `.fcx-*` left in
 * Folyadék F5 — RETIRED_FUEL_BLOCKS.)
 */
const RETIRED_KOZBEN_BLOCKS: Array<[string | null, string, string[]]> = [
  ['train session', 'a kártyalista, a dokk és az üveg-belsők (wo-)', ['.wo-card', '.wo-row', '.wo-rows', '.wo-field', '.wo-check',
    '.wo-verdict', '.wo-finish', '.wo-dock', '.wo-overload', '.wo-list', '.wo-menu', '.wo-rec', '.wo-last', '.wo-glass-',
    '.wo-confirm', '.wo-close-', '.wo-video', '.wo-', '@keyframes wo-']],
  ['train ceremony', 'a záró ceremónia (cer-)', ['.cer-stars', '.cer-bar', '.cer-counters', '.cer-card', '.cer-tally',
    '.cer-verdict', '.cer-fill', '.cer-sky', '.cer-record', '.cer-kcal', '.cer-mstar', '.cer-cta', '.cer-', '.cer ', '.cer{',
    '@keyframes cer-']],
  ['uveg edzes session', '/train/session (Üveg)', ['.wos ', '.wos-', '.wbr', '.mz-chload', '.wk-top', '.wkx-', '.warmstrip',
    '@keyframes wos-', '@keyframes mz-chload']],
  ['uveg edzes zaras', 'a ceremónia és az összegzés (Üveg)', ['.wsum', '.wr-', '.uv-cer', '.cer-sport', '@keyframes wsum-']],
  [null, 'a visszatérő gomb és a rekord-toast', ['.float-fab', '.float-return', '.float-', '@keyframes float-pop',
    '@keyframes abl-fab-breathe', '.toast-solo']],
  [null, 'a régi szett-léptető, pihenősáv és szett-jegyzet', ['.steprow', '.restbar', '.setnote', '.rirrow']],
]

describe.each(RETIRED_KOZBEN_BLOCKS)('the retired in-workout skin stays out: %s — %s (Folyadék F4, mezo-n4wf5.4)', (marker, _what, sels) => {
  test('its marker pair is gone', () => {
    if (!marker) return
    expect(rawCss).not.toContain(`── ${marker} (`)
    expect(rawCss).not.toContain(`── /${marker} `)
  })

  test('none of its selectors has a rule left anywhere in the stylesheet', () => {
    const rules = stripComments(rawCss)
    const left = sels.filter((sel) => rules.includes(sel))
    expect(left, `retired in-workout selectors are back in prototype.css: ${left.join(', ')}`).toEqual([])
  })
})

/**
 * Where the Edzés rules live now, and the truths the retired guards protected, re-pointed:
 *  · one stylesheet per area, each speaking its own prefix (bible F2.3);
 *  · motion only for people who accept it (was: „every added animation has a reduced-motion branch");
 *  · the domain accent comes from the frame's tokens — never the Titanium `--tag-gym`, never glass;
 *  · the 44px touch area of the explain link is the kit's (was: `.pl-info::after`);
 *  · one recipe per thing: the pieces folded into the kit do not grow local copies again.
 */
const EDZES_SHEETS: Array<[string, string, string]> = [
  ['kozos', '.ex-', edzesKozosCss], ['mai', '.em-', edzesMaiCss], ['terheles', '.et-', edzesTerhelesCss],
  ['sport', '.es-', edzesSportCss], ['terv', '.ep-', edzesTervCss], ['napszerk', '.ee-', edzesNapszerkCss],
  ['sablon', '.ew-', edzesSablonCss], ['riport', '.er-', edzesRiportCss],
  // Folyadék F4 (mezo-n4wf5.4) — the in-workout flow
  ['eligazitas', '.ei-', edzesEligazitasCss], ['kozben', '.ek-', edzesKozbenCss], ['kozben-lapok', '.el-', edzesKozbenLapokCss],
  ['lezaras', '.ec-', edzesLezarasCss], ['osszegzes', '.eo-', edzesOsszegzesCss],
]

describe.each(EDZES_SHEETS)('the Folyadék Edzés sheet folyadek-edzes-%s.css (%s) (mezo-n4wf5.3)', (_name, prefix, raw) => {
  const css = stripComments(raw)

  test('carries rules of its own prefix and scans clean', () => {
    expect(css).toContain(prefix)
    const scan = scanCss(raw)
    expect(scan.unclosedBraces).toEqual([])
    expect(scan.strayCloseBraces).toEqual([])
    expect(scan.unterminatedComment).toBeNull()
    expect(scan.strayCommentEnds).toEqual([])
  })

  test('wears the light kit: no glass, no Titanium accent, no dark-skin halo', () => {
    expect(css).not.toMatch(/\.glass\b/)
    expect(css).not.toContain('--tag-gym')
    expect(css).not.toMatch(/\.uv-(halo|empty|flat|sheet)\b/)
  })

  test('motion lives only in a prefers-reduced-motion branch', () => {
    const still = css.replace(/@media\s*\(prefers-reduced-motion:\s*(?:no-preference|reduce)\)\s*\{(?:[^{}]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\})*[^{}]*\}/g, '')
    expect(still).not.toMatch(/animation\s*:\s*(?!none)[a-z]/)
  })

  test('does not rebuild a piece the kit owns (one recipe per thing)', () => {
    if (prefix === '.ex-') return // the Edzés-shared sheet IS the one home of `.ex-sjl` and friends
    const local = ['-back {', '-hg {', '-ft {', '-art {', '-rowbar', '-in {', '-sjl {', '-numin', '-actnote', '-heronote', '-hint {',
      '-rowchev', '-end {', '-bad', '-evc', '-roll',
      // folded at the F4 integration: the chrome-free title row (`TitleRow`), a row's two-part end (`RowEnd`), the
      // switched-off pair tile (`Pair disabled`), visually hidden text (`.sr-only`)
      '-top {', '-top.', '-top ', '-rr {', '-rr.', '-pair', '-sr {', '-scope-caps'].map((tail) => prefix + tail.replace(/^-/, ''))
    const back = local.filter((sel) => css.includes(sel))
    expect(back, `folded pieces are local again: ${back.join(', ')}`).toEqual([])
  })
})

/**
 * Folyadék F5 · Fuel (mezo-n4wf5.5): one stylesheet per build area, each speaking its own prefix (bible F2.3), planted by the
 * foundation step before the parallel builders. An area sheet may still be empty (only its marker comment) while its builder
 * works — the prefix rule holds from its first rule on. `kozos` is the home of the Fuel-shared pieces (`.fx-`).
 */
const FUEL_SHEETS: Array<[string, string, string]> = [
  ['kozos', '.fx-', fuelKozosCss], ['mai', '.fa-', fuelMaiCss], ['log', '.fg-', fuelLogCss], ['etkezes', '.fe-', fuelEtkezesCss], ['tanulas', '.ft-', fuelTanulasCss],
  ['kieg', '.fk-', fuelKiegCss], ['trendek', '.fr-', fuelTrendekCss], ['kamra', '.fp-', fuelKamraCss], ['recept', '.fc-', fuelReceptCss], ['beallitas', '.fb-', fuelBeallitasCss],
]

describe.each(FUEL_SHEETS)('the Folyadék Fuel sheet folyadek-fuel-%s.css (%s) (mezo-n4wf5.5)', (name, prefix, raw) => {
  const css = stripComments(raw)

  test('opens with its block marker and scans clean', () => {
    expect(raw.startsWith(`/* ── Folyadék · Fuel · ${name} (mezo-n4wf5.5, slice F5) ──`)).toBe(true)
    expect(raw).toContain(`\`${prefix}\``)
    const scan = scanCss(raw)
    expect(scan.unclosedBraces).toEqual([])
    expect(scan.strayCloseBraces).toEqual([])
    expect(scan.unterminatedComment).toBeNull()
    expect(scan.strayCommentEnds).toEqual([])
  })

  test('speaks its own prefix once it carries rules', () => {
    if (css.trim() === '') return // planted, not built yet
    expect(css).toContain(prefix)
    // no other Fuel area's prefix is DEFINED here (a rule may still dress `.fo-` / `.fx-` pieces inside its own classes)
    const foreign = FUEL_SHEETS.map(([, p]) => p).filter((p) => p !== prefix && p !== '.fx-')
      .filter((p) => new RegExp(`(^|[\\s,}])\\${p}[a-z]`, 'm').test(css.replace(/\{[^{}]*\}/g, '{}')))
    expect(foreign, `rules of another area's prefix in folyadek-fuel-${name}.css`).toEqual([])
  })

  test('wears the light kit: no glass, no Titanium accent, no dark-skin halo', () => {
    expect(css).not.toMatch(/\.glass\b/)
    expect(css).not.toContain('--tag-fuel')
    expect(css).not.toMatch(/\.uv-(halo|empty|flat|sheet)\b/)
  })

  // Was (per old block): „every animation lives in the no-preference branch, the reduce branch switches them off"
  // (fuel-mai, fuel-stack, fuel-trendek, uveg fuel stack, the Stack 3.0 contract). The Folyadék sheets write the final
  // frame as the base rule, so there is nothing to switch off: motion AND transitions exist only for people who accept them.
  test('motion and transitions live only in the no-preference branch', () => {
    const still = css.replace(/@media\s*\(prefers-reduced-motion:\s*(?:no-preference|reduce)\)\s*\{(?:[^{}]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\})*[^{}]*\}/g, '')
    expect(still).not.toMatch(/animation\s*:\s*(?!none)[a-z]/)
    expect(still).not.toMatch(/transition\s*:\s*(?!none)[a-z]/)
  })

  // The app is light only (bible §1): a Fuel sheet never carries a dark branch of its own.
  test('has no dark-scheme branch', () => {
    expect(css).not.toMatch(/prefers-color-scheme\s*:\s*dark/)
    expect(css).not.toMatch(/\[data-theme=["']?dark/)
  })

  // Was: „the feature section stays scoped to stk selectors" (Stack 3.0 contract) — a Fuel sheet never restyles a bare
  // kit / house class for the whole app. Every selector carries the sheet's own prefix (or the Fuel-shared one); the
  // shared sheet may also set its `:root` tokens.
  test('every rule is scoped to the sheet\'s own classes', () => {
    const flat = css.replace(/@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '').replace(/@media[^{]*\{/g, '')
    const loose: string[] = []
    let seen = 0
    for (const m of flat.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
      for (const sel of m[1].split(/,(?![^(]*\))/).map((x) => x.trim()).filter(Boolean)) {
        seen++
        if (sel.includes(prefix) || sel.includes('.fx-') || (prefix === '.fx-' && sel === ':root')) continue
        loose.push(sel)
      }
    }
    expect(seen, 'the scan saw no selector at all').toBeGreaterThan(10)
    expect(loose, `unscoped selectors in folyadek-fuel-${name}.css`).toEqual([])
  })
})

/**
 * The truths the retired Fuel guards protected, re-pointed at the Folyadék material (mezo-n4wf5.5). Per old guard:
 *  · `uveg fuel stack` „the tick keeps its 44px hit area" + Stack 3.0 „44px hit areas cover intake, management and add
 *    actions" → the intake tick is the kit's `.fo-tk` (drawn 30 px, the kit's `::after` gives it 44 px), the managed
 *    rows are kit rows, the small round controls of the Fuel sheets carry their own 44 px `::after`;
 *  · `fuel-stack` „the due band is the only infinite loop", `fuel-trendek` / `fuel-konyha` „no infinite loop" → the only
 *    endless motion in Fuel is a waving liquid surface (the Folyadék idiom), and only for people who accept motion;
 *  · `fuel-trendek` + `uveg fuel trendek` „shame-free: over-target is amber, an unlogged day is a hatched gap, never an
 *    error" → the over-segment and the legend wear the warn tone, the gap is a dashed outline, Trendek carries no error
 *    colour at all;
 *  · `uveg fuel trendek` „the Σ budget pill is coral when off" → a split that does not add up is the ONE error state of
 *    the settings pages;
 *  · `fuel-mai` / `uveg fuel trendek` / `uveg fuel konyha` „empty and free states are dashed, with no glass" → a free
 *    block is a lighter card on an inset line with no drop; a suggestion and a confirm are dashed, never a shelf object;
 *  · the meal ceremony „rises by the frame-driven --rise, never by a CSS transition" + „every transition sits in the
 *    no-preference branch" → the cup's level follows `--p` (ONE rAF pass), no transition ever touches it; and its layer:
 *    the ceremony owns the screen (240: above sheets 200–211 and GlassBox 220/221, below toasts 300), the „Mit ettél?"
 *    overlay sits at the page-takeover tier (60: above the bottom bar 40, below the sheets it hosts);
 *  · `uveg fuel konyha` / `uveg fuel stack` „glass that must stay put restates its geometry" (the sheet frame must not
 *    scroll) → Fuel's sheets are the kit's `.sheet.fo-sheet`, whose scroller is pinned in „the kit owns the pieces the
 *    in-workout areas shared" above; a nested picker keeps its tier through the house `.sheet.sheet-nested` rule;
 *  · the depth & focus ranking (one hero, the rest below it) → no Fuel sheet draws a second lifted surface: the kit's
 *    card drop is the only lift, an area class never adds a drop shadow of its own to a card-sized box (the „exactly one
 *    `.fo-hero` per hub" half is a runtime check: tests/layout/fuel-folyadek.spec.ts);
 *  · `fuel-konyha` „the raised type gets a 360px step-down" → every sheet with a fixed-size numeral steps down at 360 px
 *    (and the runtime half — no horizontal overflow at 320 px — is in tests/layout/fuel-folyadek.spec.ts).
 */
describe('the Folyadék Fuel sheets keep the truths the retired Fuel guards protected (mezo-n4wf5.5)', () => {
  const kit = stripComments(kitCss)
  const sheet = (raw: string) => stripComments(raw)
  /** Every declaration block whose selector list names `selector` exactly, joined in source order. */
  const rule = (css: string, selector: string) => {
    const bodies = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter((m) => m[1].split(/,(?![^(]*\))/).some((sel) => sel.trim() === selector))
      .map((m) => m[2])
    expect(bodies.length, `${selector} rule not found`).toBeGreaterThan(0)
    return bodies.join(' ')
  }
  const ungated = (css: string) => css.replace(/@media\s*\(prefers-reduced-motion:\s*no-preference\)\s*\{(?:[^{}]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\})*[^{}]*\}/g, '')

  test('44px touch areas: the intake tick is the kit\'s, the small round controls carry their own', () => {
    const m = /([^{}]*\.fo-tk::after[^{}]*)\{([^}]*)\}/.exec(kit)
    expect(m, 'the kit rule carrying .fo-tk::after is gone — the intake tick lost its touch area').not.toBeNull()
    expect(m![2]).toMatch(/width:\s*max\(100%,\s*44px\)/)
    expect(m![2]).toMatch(/height:\s*max\(100%,\s*44px\)/)
    expect(m![1]).toContain('button.fo-row::after') // a managed row is tappable on its whole height
    expect(rule(kit, '.fo-btn')).toMatch(/min-height:\s*44px/)
    // the controls drawn smaller than 44 px in the Fuel sheets
    for (const [raw, sel] of [[fuelKozosCss, 'button.fx-chip::after'], [fuelKozosCss, '.fx-x::after'], [fuelKozosCss, '.fx-add::after'],
      [fuelMaiCss, '.fa-dn-step::after'], [fuelMaiCss, '.fa-clock::after'], [fuelMaiCss, '.fa-mn::after'],
      [fuelLogCss, '.fg-tuh::after'], [fuelLogCss, '.fg-stp > button:not(.fg-stp-v)::after'],
      [fuelReceptCss, '.fc-cmp > button::after'], [fuelBeallitasCss, '.fb-rm::after']] as const) {
      expect(rule(sheet(raw), sel), `${sel} must give a 44px touch area`).toMatch(/height:\s*44px/)
    }
    expect(rule(sheet(fuelLogCss), '.fg-modes > button')).toMatch(/min-height:\s*44px/)
    expect(rule(sheet(fuelTanulasCss), '.ft-hits > button')).toMatch(/min-height:\s*44px/)
    expect(rule(sheet(fuelEtkezesCss), '.fe-mclock')).toMatch(/width:\s*44px;\s*height:\s*44px/)
  })

  test('the only endless motion is a waving liquid surface, inside the no-preference branch', () => {
    const waves = ['fx-wv', 'fg-cupwv']
    for (const [name, , raw] of FUEL_SHEETS) {
      const css = sheet(raw)
      expect(ungated(css), `an endless loop outside the motion gate in folyadek-fuel-${name}.css`).not.toContain('infinite')
      for (const m of css.matchAll(/animation:\s*([a-z0-9-]+)[^;]*infinite/g)) {
        expect(waves, `${m[1]} loops for ever in folyadek-fuel-${name}.css — only a liquid surface may`).toContain(m[1])
      }
    }
  })

  test('shame-free: over the target is the warn tone, an unlogged day is a dashed gap, Trendek has no error colour', () => {
    const trendek = sheet(fuelTrendekCss)
    expect(rule(trendek, '.fr-tb > s')).toContain('var(--fo-warn)')
    const gap = rule(trendek, '.fr-wd.gap > .fr-tb')
    expect(gap).toMatch(/background:\s*none/)
    expect(gap).toMatch(/outline:\s*1\.5px dashed/)
    expect(trendek).not.toMatch(/--fo-bad|is-error|\bred\b/)
    const kozos = sheet(fuelKozosCss)
    expect(rule(kozos, '.fx-lg > span > i.over')).toContain('var(--fo-warn)')
    expect(rule(kozos, '.fx-lg > span > i.gap')).toMatch(/dashed/)
    // a skipped / out-of-window meal on the timeline is warn, never the error colour
    expect(sheet(fuelEtkezesCss)).not.toContain('--fo-bad')
  })

  test('the ONE error state of the Fuel settings: a split that does not add up', () => {
    const css = sheet(fuelBeallitasCss)
    expect(rule(css, '.fb-sum > b.off')).toContain('var(--fo-bad)')
    const bad = [...css.matchAll(/([^{}]+)\{[^{}]*--fo-bad[^{}]*\}/g)].map((m) => m[1].trim())
    expect(bad.sort()).toEqual(['.fb-alert', '.fb-sum > b.off'])
  })

  test('free and suggested things are not shelf objects: a lighter card on a line, or a dashed outline — no lift', () => {
    const open = rule(sheet(fuelMaiCss), '.fa-blk.open')
    expect(open).toMatch(/box-shadow:\s*inset/)
    expect(open).not.toMatch(/box-shadow:[^;]*\d+px \d+px -?\d+px/)
    expect(rule(sheet(fuelKamraCss), '.fp-swap')).toMatch(/border:\s*1\.5px dashed/)
    expect(rule(sheet(fuelKiegCss), '.fk-stop')).toMatch(/outline:\s*1\.5px dashed/)
  })

  test('the meal ceremony: the level is frame-driven, never a CSS transition; its layer owns the screen', () => {
    const log = sheet(fuelLogCss)
    expect(rule(log, '.fg-cup .lq')).toMatch(/transform:\s*translateY\(calc\(\(1 - var\(--p, 0\) \* var\(--k, 1\)\) \* 108px\)\)/)
    // no transition / animation rule ever names the level
    const moving = [...log.matchAll(/([^{}]+)\{[^{}]*(?:transition|animation)\s*:[^{}]*\}/g)].map((m) => m[1])
    expect(moving.filter((sel) => /\.lq\b/.test(sel))).toEqual([])
    // layers: tab bar 40 · page takeover 60 · sheets 200–211 · GlassBox 220/221 · ceremony 240 · toasts 300
    const z = (body: string) => Number([...body.matchAll(/z-index:\s*(\d+)/g)].pop()?.[1]) // the later rule wins
    const overlay = rule(log, '.fg-flow')
    expect([...overlay.matchAll(/z-index/g)]).toHaveLength(1)
    expect(z(overlay)).toBe(60)
    expect(overlay).toMatch(/position:\s*absolute;\s*inset:\s*0/)
    // the overlay is its own scroller: it never pushes the page sideways and never chains its scroll to the page under it
    expect(overlay).toMatch(/overflow-x:\s*hidden/)
    expect(overlay).toMatch(/overscroll-behavior:\s*contain/)
    const cer = z(rule(log, '.fg-cers'))
    expect(cer).toBe(240)
    const house = stripComments(rawCss)
    const nested = Number(/\.sheet\.sheet-nested \{[^}]*z-index:\s*(\d+)/.exec(house)?.[1])
    const glassCard = Number(/\.gl-card\s*\{[^}]*z-index:\s*(\d+)/.exec(house)?.[1])
    expect(nested).toBe(211) // Fuel's nested pickers (`fo-sheet sheet-nested`) ride one tier above the sheet that opened them
    expect(cer).toBeGreaterThan(Math.max(nested, glassCard))
    expect(cer).toBeLessThan(300)
  })

  test('one lift per page: no Fuel area class adds a drop shadow to a card-sized box', () => {
    for (const [name, prefix, raw] of FUEL_SHEETS) {
      if (prefix === '.fx-') continue // the shared sheet owns the bowl / cup drop (an SVG filter, not a card)
      const lifted = [...sheet(raw).matchAll(/([^{}]+)\{[^{}]*box-shadow:\s*0 (?:1[0-9]|[2-9][0-9])px (?:\d+)px[^{}]*\}/g)]
        .map((m) => m[1].trim())
        .filter((sel) => !/\.fo-btn|> button|button\b|\.on\b|\.dot\b/.test(sel))
      expect(lifted, `a second lifted surface in folyadek-fuel-${name}.css`).toEqual([])
    }
  })

  test('big numerals step down at 360px instead of pushing the page sideways', () => {
    for (const raw of [fuelKozosCss, fuelMaiCss, fuelLogCss, fuelEtkezesCss, fuelTanulasCss, fuelKiegCss, fuelTrendekCss,
      fuelKamraCss, fuelBeallitasCss]) {
      expect(sheet(raw)).toMatch(/@media \(max-width: 360px\)/)
    }
    expect(sheet(fuelReceptCss)).toMatch(/@media \(max-width: 3[56]0px\)/)
  })
})

test('the kit and the Fuel-shared sheet own the pieces the Fuel areas share (mezo-n4wf5.5)', () => {
  const kit = stripComments(kitCss)
  for (const sel of ['.fo-stat {', '.fo-stats {', '.fo-sw {', '.fo-sw::before {', '.fo-srch {', '.fo-srch > input {']) {
    expect(kit, `${sel} missing from folyadek-kit.css`).toContain(sel)
  }
  const kozos = stripComments(fuelKozosCss)
  for (const sel of ['.fx-bg {', '.fx-cup {', '.fx-cells {', '.fx-m3 {', '.fx-chip {', 'button.fx-chip::after {', '.fx-gb {', '.fx-tags > em {',
    '.fx-it > .fx-l2 {', '.fx-ln {', '.fx-x::after {', '.fx-kv {', '.fx-tip {', '.fx-lg {', '.fx-ng {', '.fx-kms {', '.fx-split {']) {
    expect(kozos, `${sel} missing from folyadek-fuel-kozos.css`).toContain(sel)
  }
  // the Fuel macro colours are tokens of the shared sheet, on :root (the log flow and the water sheet open outside Fuel)
  expect(kozos).toMatch(/:root\s*\{[^}]*--fx-protein:[^}]*--fx-carb:[^}]*--fx-fat:[^}]*--fx-fiber:[^}]*--fx-water:/)
})

test('the kit owns the pieces the Edzés areas shared (mezo-n4wf5.3)', () => {
  const kit = stripComments(kitCss)
  for (const sel of ['.fo-backpill {', '.fo-hero-art {', '.fo-hero.big .fo-hero-verdict {', '.fo-hero-g {', '.fo-ft {',
    '.fo-hero-acts > .fo-note {', '.fo-row-end {', '.fo-rowbar {', '.fo-under {', '.fo-log {', '.fo-evc {', '.fo-lk.bad',
    '.fo-btn.bad {', '.fo-lk:disabled {', '.fo-stp input {', '.fo-tags > span {', '.fo-sortable ']) {
    expect(kit, `${sel} missing from folyadek-kit.css`).toContain(sel)
  }
  // the old descendant selector dressed the bubble INSIDE a tag as a tag
  expect(kit).not.toMatch(/\.fo-tags span\b/)
  const kozos = stripComments(edzesKozosCss)
  for (const sel of ['.ex-sjl {', '.ex-sjp {', '.ex-sw {', '.ex-cv {', '.ex-medal ', '.ex-stars {']) {
    expect(kozos, `${sel} missing from folyadek-edzes-kozos.css`).toContain(sel)
  }
})

test('the kit owns the pieces the in-workout areas shared (mezo-n4wf5.4)', () => {
  const kit = stripComments(kitCss)
  for (const sel of ['.fo-ptop {', '.fo-ptop .fo-ib::after {', '.fo-ptop::before {', '.fo-rr {', '.fo-rr.cl {',
    '.fo-pair > button:disabled {', '.sheet.fo-sheet > .sheet-scroll {']) {
    expect(kit, `${sel} missing from folyadek-kit.css`).toContain(sel)
  }
  // one sheet-ending-link fix for every light sheet — no per-area copy of it
  for (const raw of [edzesKozbenLapokCss, edzesSportCss, edzesNapszerkCss]) {
    expect(stripComments(raw)).not.toMatch(/\.fo-sheet[^{]*\{[^}]*padding-bottom/)
  }
})

/**
 * The truths the retired `train session` / `train ceremony` guards protected, re-pointed at the Folyadék material
 * (mezo-n4wf5.4):
 *  · „the dock is a LIGHT bar, not a black glass strip" → the dock is the kit's white foot (`.fo-foot.ex-dock`), with no
 *    dark literal and no backdrop filter of its own;
 *  · „the tick is CENTRED" → the set grid's tick cell is a grid with centred content;
 *  · „the choreography stays one-shot, with its reduced-motion branch" → the ceremony's level / stars / counters are
 *    written by ONE rAF pass, never a CSS transition on the level, and every transition of the stage sits in the
 *    no-preference branch;
 *  · „no neon glow, no clipped-gradient numerals" → the closing sheets carry neither.
 */
describe('the Folyadék in-workout sheets keep the truths the retired session / ceremony guards protected (mezo-n4wf5.4)', () => {
  const kozos = stripComments(edzesKozosCss)
  const kit = stripComments(kitCss)

  test('the dock is the kit\'s light foot: positioned in the phone frame, no dark literal, no filter of its own', () => {
    const dock = /\.fo-foot\.ex-dock \{([^}]*)\}/.exec(kozos)
    expect(dock, '.fo-foot.ex-dock rule missing').not.toBeNull()
    expect(dock![1]).toContain('position: absolute')
    expect(dock![1]).not.toMatch(/background|backdrop-filter/)
    const dockRules = kozos.split('}').filter((r) => /\.ex-(dock|rest|rv)\b/.test(r.split('{')[0] ?? '')).join('}')
    expect(dockRules).not.toMatch(/#0[0-9a-f]{5}\b|rgba\(0, 0, 0|backdrop-filter/i)
  })

  test('the set grid\'s tick is centred in its cell', () => {
    const tick = /\.ex-sets \.tk \{([^}]*)\}/.exec(kozos)
    expect(tick, '.ex-sets .tk rule missing').not.toBeNull()
    expect(tick![1]).toMatch(/display: (inline-)?grid; place-items: center|place-items: center/)
  })

  test('the ceremony level is never a CSS transition; the stage\'s transitions live in the no-preference branch', () => {
    const still = kit.replace(/@media\s*\(prefers-reduced-motion:\s*no-preference\)\s*\{(?:[^{}]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\})*[^{}]*\}/g, '')
    const stage = still.split('}').filter((r) => /\.fo-(cer|cup)\b/.test(r.split('{')[0] ?? '')).join('}')
    expect(stage.length).toBeGreaterThan(0)
    expect(stage).not.toMatch(/transition|animation\s*:\s*(?!none)[a-z]/)
    // the cup's level follows --p directly (the rAF pass writes it)
    expect(kit).toMatch(/\.fo-cup \.lq \{[^}]*var\(--p, 0\)/)
    expect(kit).not.toMatch(/\.fo-cup \.lq \{[^}]*transition/)
  })

  test('the closing and review sheets carry no neon glow and no clipped-gradient numeral', () => {
    for (const raw of [edzesLezarasCss, edzesOsszegzesCss]) {
      const css = stripComments(raw)
      expect(css).not.toContain('background-clip: text')
      expect(css).not.toMatch(/box-shadow:[^;]*0 0 \d{2,}px [^;]*#ff/i)
      expect(css).not.toContain('grayscale(')
    }
  })
})

test("the explain link keeps a 44px touch area: the kit's `.fo-lk::after` (was `.pl-info::after`, mezo-b516k)", () => {
  const kit = stripComments(kitCss)
  const m = /([^{}]*\.fo-lk::after[^{}]*)\{([^}]*)\}/.exec(kit)
  expect(m, 'the kit rule carrying .fo-lk::after is gone — the text links lost their touch area').not.toBeNull()
  expect(m![2]).toMatch(/width:\s*max\(100%,\s*44px\)/)
  expect(m![2]).toMatch(/height:\s*max\(100%,\s*44px\)/)
  // and the legacy override pair that kept `.pl-info` alive on the new chip is gone with it
  expect(stripComments(edzesKozosCss)).not.toContain('.pl-info')
})

// `train session` (structural invariants, mezo-88iwa.7) and `train ceremony` (mezo-ju4j6.13) were REQUIRED here until
// the Folyadék in-workout flow (mezo-n4wf5.4). Both blocks are deleted; see RETIRED_KOZBEN_BLOCKS above.

// `fuel-konyha` (mezo-ju4j6.9) and the meal ceremony in `uveg reteg unnep` (`.fcx-*`, mezo-bqwyo → mezo-me75u.10) were
// REQUIRED here until Folyadék F5 (mezo-n4wf5.5). Both are deleted (RETIRED_FUEL_BLOCKS above); what they protected —
// the 360px step-down, no endless loop, the frame-driven ceremony level and its layer — is pinned on the Folyadék
// sheets in „the Folyadék Fuel sheets keep the truths the retired Fuel guards protected".

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
  // Was: three Fuel ranking tests — „Kiegészítők: the ring halo is the hero, the due band out-glows its glass siblings",
  // „Trendek: the day card's dimensions stay flat below its own numeral", „Konyha: the captures and posters keep a
  // house-grade base". Fuel wears Folyadék since mezo-n4wf5.5: the ranking is the page skeleton itself (ONE hero vessel,
  // numbered white cards below it), so no surface can be promoted by a material. Pinned as „one lift per page" in „the
  // Folyadék Fuel sheets keep the truths…" above and, at runtime, as „exactly one `.fo-hero` on a hub" in
  // tests/layout/fuel-folyadek.spec.ts. (`expectHouseGrade` left with its last users.)

  // Was: „Train · in-workout list: finished work recedes, the remaining work stays washed" on `.wo-card`. The card
  // list is gone (Folyadék F4, mezo-n4wf5.4): ONE exercise is the hero, the others are kit rows. The ranking it protected
  // holds in the new material — a skipped / swapped-out exercise is the kit's dim row (never red, never a warning
  // colour), and the page's own sheet adds no second surface recipe for a row.
  test('Train · in-workout page: a set-aside exercise recedes as the kit\'s dim row — never red', () => {
    const kit = stripComments(kitCss)
    expect(kit).toMatch(/\.fo-row\.dim\b[^{]*\{[^}]*opacity/)
    const page = stripComments(edzesKozbenCss)
    const rowRules = page.split('}').filter((r) => /\.ek-row\b/.test(r.split('{')[0] ?? ''))
    expect(rowRules.length).toBeGreaterThan(0)
    for (const r of rowRules) {
      expect(r, 'a row of „A mai sor" must not carry a fill, a shadow or a warning colour of its own').not.toMatch(/background|box-shadow|--fo-bad|--fo-warn/)
    }
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

  // Was: „the domain switcher marks WHERE YOU ARE with the only wash tile". The switcher is gone
  // (Folyadék frame, mezo-n4wf5.1); WHERE YOU ARE is said by the bottom bar itself — the active
  // domain is the only item in ink and bold, the rest stay faint — and by the one filled pill
  // on the top tabs.
  test('the shell: the bottom bar and the top tabs mark WHERE YOU ARE with the only lit item', () => {
    const frame = stripComments(frameCss)
    expect(frame).toMatch(/\.fo-nav-item \{[^}]*color: var\(--fo-faint\)/)
    expect(frame).toMatch(/\.fo-nav-item\.on \{[^}]*color: var\(--fo-ink\); font-weight: 800/)
    expect(frame).toMatch(/\.fo-tabs a\.on \{[^}]*background: linear-gradient\(135deg, var\(--liq1\), var\(--liq2\)\)/)
    expect(frame).not.toMatch(/\.fo-tabs a \{[^}]*background:/)
    // no rule of the retired switcher is left in either sheet
    expect(stripComments(rawCss) + frame).not.toMatch(/\.domain-(row|switcher|list|all|eyebrow)/)
  })
})

/**
 * Üvegesítés U1 (mezo-me75u.1) → Folyadék F1 (mezo-n4wf5.1, Task 3): the ONE card recipe every
 * slice reuses. The class names are unchanged (361 files wear them) but the material is a LIGHT
 * card now: white body, soft domain-tinted drop, no frosting, no gradient frame, no aurora. A
 * second recipe or the dark glass leaking back into the light world is what this guards. The two
 * dark pockets (/ritual, /me/sleep/night) keep the old glass through weightless `:where()` rules.
 */
describe('the uveg kit section is registered and carries the light card recipe (mezo-n4wf5.1)', () => {
  const START_MARKER = '── uveg kit ('
  const END_MARKER = '── /uveg kit '
  const section = () => slice(START_MARKER, END_MARKER)
  const rules = () => stripComments(section())
  /** One rule's declarations, matched at the line start so the `:where(…dark…) .glass` pocket
   *  fallback is never mistaken for the light recipe. */
  const decls = (selector: string) => {
    const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`^${esc} \\{([^}]*)\\}`, 'm').exec(rules())?.[1] ?? null
  }

  test('both markers are present, in order', () => {
    expect(rawCss.indexOf(START_MARKER)).toBeGreaterThan(-1)
    expect(rawCss.indexOf(END_MARKER)).toBeGreaterThan(rawCss.indexOf(START_MARKER))
  })

  test('the F1:KIT markers frame the block, in order; the F1:CHROME block is gone (task 5)', () => {
    const open = rawCss.indexOf('/* ▼▼ F1:KIT */')
    const close = rawCss.indexOf('/* ▲▲ F1:KIT */')
    expect(open).toBeGreaterThan(-1)
    expect(close).toBeGreaterThan(open)
    expect(rawCss.indexOf(START_MARKER)).toBeGreaterThan(open)
    expect(rawCss.indexOf(END_MARKER)).toBeLessThan(close)
    // the old glass chrome was replaced by the Folyadék frame (styles/folyadek-frame.css)
    expect(rawCss).not.toContain('F1:CHROME')
  })

  test('the card is white with a soft drop: no frosting, no gradient frame', () => {
    const glass = decls('.glass')
    expect(glass, '.glass rule not found in the kit').not.toBeNull()
    expect(glass).toContain('background: #fff')
    expect(glass).toContain('color: var(--fo-ink)')
    expect(glass).toContain('--c: var(--dom)')
    expect(glass).not.toContain('backdrop-filter')
    expect(glass).not.toContain('gradient')
    expect(decls('.glass::before')).toMatch(/content: none/)
    // the ::after geometry stays for feature overlays, dormant
    expect(decls('.glass::after')).toMatch(/opacity: 0/)
  })

  test('the aurora is retired and the secondary surfaces are light tints of the accent', () => {
    expect(decls('.uv-aurora')).toMatch(/display: none/)
    expect(decls('.uv-flat')).toMatch(/background: color-mix\(in srgb, var\(--c, var\(--dom\)\) 7%, #fff\)/)
    expect(decls('.uv-well')).toMatch(/background: color-mix\(in srgb, var\(--c, var\(--dom\)\) 8%, #fff\)/)
    expect(decls('.uv-empty')).toMatch(/1\.5px dashed[^;]*;\s*background: transparent; box-shadow: none/)
    expect(decls('.uv-halo::before')).toMatch(/background: none/)
  })

  test('the macro band no longer has a dark override in the kit', () => {
    expect(rules()).not.toMatch(/--macro-(protein|carbs|fat|fiber):/)
    expect(rules()).toMatch(/^:root \{ --uv-ease:/m)
  })

  test('the dark pockets keep the old glass through weightless :where() rules only', () => {
    const css = rules()
    expect(css).toMatch(/^:where\(:root\[data-theme="dark"\]\) \.glass \{[^}]*backdrop-filter: blur\(16px\) saturate\(1\.5\)/m)
    expect(css).toMatch(/^:where\(:root\[data-theme="dark"\]\) \.glass::before \{[^}]*mask-composite: exclude/m)
    // never a plain dark-scoped kit rule: that would outrank every page-level override
    expect(css).not.toMatch(/^:root\[data-theme="dark"\] \.(glass|uv-)/m)
  })

  test('there is exactly ONE .glass recipe in the whole stylesheet', () => {
    expect(stripComments(rawCss).match(/^\.glass \{/gm) ?? []).toHaveLength(1)
  })

  test('glass never runs the recurring sheen, regardless of motion preference', () => {
    const css = rules()
    expect(stripComments(rawCss)).not.toContain('uv-sheen')
    expect(css).toMatch(/\.glass\.is-still::after, \.glass\.is-round::after \{[^}]*display: none/)
  })

  test('the ground is the warm graphite, never the cold Titanium one', () => {
    const css = rules()
    for (const cold of ['#0B0D12', '#13151D', '#20222A']) expect(css).not.toContain(cold)
  })

  test('the glass Toggle (.uv-tgl) lives here once, motion gated (U11, mezo-7txw6)', () => {
    const css = rules()
    expect(css).toMatch(/^\.uv-tgl \{/m)
    expect(css).toMatch(/^\.uv-tgl\.is-on \{/m)
    const gate = css.lastIndexOf('@media (prefers-reduced-motion: no-preference)')
    expect(css.indexOf('.uv-tgl { transition:')).toBeGreaterThan(gate)
    // no page keeps a copy of the kit switch; the tudástár's sage variant is a deliberate restyle
    const copies = stripComments(rawCss).match(/^\.(ntf-page|uv-admin) \.uv-tgl\b/gm) ?? []
    expect(copies).toEqual([])
  })
})

// Was: „the uveg chrome section is registered (mezo-me75u.1)". The glass chrome block of
// prototype.css is gone; the app chrome is the Folyadék frame (mezo-n4wf5.1), in its own sheet.
describe('the folyadék frame sheet carries the app chrome (mezo-n4wf5.1)', () => {
  const frame = stripComments(frameCss)

  test('it styles the title bar, the top tabs, the bottom bar and the FAB', () => {
    for (const sel of ['.fo-top {', '.fo-top::before {', '.fo-top.sub {', '.fo-trow.hub', '.fo-eb', '.fo-btns {', '.fo-ib {', '.fo-h {',
      '.fo-help {', '.fo-tabs {', '.fo-tabs a.on {', '.fo-nav {', '.fo-nav-item {', '.fo-fab {',
      '.fo-top > .nap-ntfpanel {']) {
      expect(frame, `${sel} missing from folyadek-frame.css`).toContain(sel)
    }
  })

  test('the values are the approved prototype’s (vilagos/kit.js + foly.js)', () => {
    expect(frame).toMatch(/\.fo-top \{[^}]*padding: 18px 18px 0;/)
    expect(frame).toMatch(/\.fo-top::before \{[^}]*background: color-mix\(in srgb, #F8FCFD 78%, transparent\)/)
    expect(frame).toMatch(/\.fo-h \{[^}]*font-size: 36px; font-weight: 800; letter-spacing: -1\.4px/)
    expect(frame).toMatch(/\.fo-tabs a \{[^}]*padding: 8px 14px; border-radius: 999px/)
    expect(frame).toMatch(/\.fo-nav \{[^}]*left: 10px; right: 10px;[^}]*border-radius: 30px/)
    expect(frame).toMatch(/\.fo-fab \{[^}]*width: 54px; height: 54px/)
  })

  test('at ≤360px the five buttons take their own line above the context line, and titles shrink', () => {
    const small = frame.slice(frame.indexOf('@media (max-width: 360px)'))
    expect(small).toContain('.fo-trow.hub { flex-wrap: wrap; row-gap: 8px; }')
    expect(small).toContain('.fo-trow.hub .fo-btns { margin-left: auto; order: 1; }')
    expect(small).toContain('.fo-trow.hub .fo-eb { order: 2; flex: 0 0 100%; }')
    expect(small).toContain('.fo-h:not(.sm) { font-size: 25px;')
  })

  test('every animation and transition of the frame lives inside the reduced-motion gate', () => {
    const gate = frame.indexOf('@media (prefers-reduced-motion: no-preference)')
    expect(gate).toBeGreaterThan(-1)
    const before = frame.slice(0, gate).replace(/@keyframes [\s\S]*?\}\s*\}/g, '')
    expect(before).not.toMatch(/\banimation\s*:/)
    expect(before).not.toMatch(/\btransition\s*:/)
    expect(frame.slice(gate)).toContain('.fo-top > .nap-ntfpanel { animation: fo-ntfpop')
  })

  test('there is no day-part switcher in the chrome', () => {
    expect(frame + stripComments(rawCss)).not.toContain('nap-dpmenu')
  })

  test('no rule of the retired chrome is left in prototype.css', () => {
    const css = stripComments(rawCss)
    const styled = (cls: string) => new RegExp('\\.' + cls.split('.').join('\\.') + '(?![\\w-])').test(css)
    for (const cls of ['tab-bar', 'tab-item', 'tab-boop', 'tb-dot', 'app-head', 'nap-head', 'nap-roundbtn',
      'nap-avatar', 'nap-badge', 'nap-offnow', 'nap-q', 'quicklog-fab', 'nap-ntfscrim', 'nap-ntfpanel.glass']) {
      expect(styled(cls), `.${cls} is still styled in prototype.css`).toBe(false)
    }
    expect(css).not.toContain('is-cond')
    // the check itself can see a class that IS styled
    expect(styled('nap-ntfrow')).toBe(true)
  })

  // The day orb's sprite-era drawing (shared/ui/DayOrb) is no longer in the bar, but the
  // component and its rules stay until its last consumer decision — its wave is still gated.
  test('the DayOrb wave only moves inside the reduced-motion gate', () => {
    const css = stripComments(rawCss)
    expect(css).toMatch(/@media \(prefers-reduced-motion: no-preference\) \{\s*\.dayorb-wave \{ animation: uv-orbwave/)
    expect(css.match(/\.dayorb-wave \{ animation/g)).toHaveLength(1)
  })
})

// `uveg fuel konyha` and `uveg fuel stack` (mezo-me75u.2) were REQUIRED here until Folyadék F5 (mezo-n4wf5.5); both are
// deleted (RETIRED_FUEL_BLOCKS). Their guarantees — a sheet frame that does not scroll, the 44px tick, nothing lifted
// inside a lifted surface, motion only for people who accept it — are pinned on the kit and the Folyadék Fuel sheets.

/**
 * Üvegesítés U3 (mezo-me75u.3) — the Nap area (prototypes/uveg-nap.html). It had one block per
 * surface group: the Mai hub, the four sub-pages, the quick-log + capture sheets, the Mezo messages
 * + notification panel, and the Napzárás acts.
 *
 * Folyadék F2 (mezo-n4wf5.2) converted the whole Nap domain to the Folyadék kit (`fo-*` + the
 * `nm- nn- nb- nr2- nck2- nqk- nrz- rb-` families in styles/folyadek-nap-*.css), and the Üveg rules
 * nothing renders any more were deleted with a zero-usage proof. Two blocks survive, cut down to
 * what OTHER domains still wear: the shared capture sheets (water, weight, sleep, sport, run,
 * journal) and the shared evidence list. The three that are gone are pinned as gone below
 * (`RETIRED_NAP_BLOCKS`), so the old skin cannot be pasted back.
 */
const U3_BLOCKS: Array<[string, string[]]> = [
  ['rogzites', ['.sheet.capture-sheet.glass', '.capture-hero-value', '.capture-scale-cell', '.capture-rating-scale',
    '.cta-primary']],
  ['uzenetek', ['.nap-obs-evid', '.nap-ev-row', '.nap-ev-shift', '.nap-sh-h']],
]

/**
 * The Üveg Nap skin retired in Folyadék F2 (mezo-n4wf5.2). Each entry: the block's marker name
 * and the selectors the old guard used to REQUIRE there — now each must be absent from the
 * rules of the whole stylesheet (comments stripped: the surviving prose may still name them).
 * `uveg nap rogzites` / `uveg nap uzenetek` survive as blocks, so only their retired selectors
 * are listed (marker: null).
 */
const RETIRED_NAP_BLOCKS: Array<[string | null, string, string[]]> = [
  ['uveg nap mai', 'Nap · Mai hub', ['.nap-hub', '.nap-center', '.nap-fuel', '.nap-personal', '.nap-moment-',
    '.nap-companion', '.nap-hero', '.nap-node-']],
  ['uveg nap oldalak', 'Check-in · Életjel · Küldetések · Rutin', ['.nck-', '.ej-tile', '.ej-warn', '.ej-rr', '.nq-card',
    '.nq-empty', '.nr-vcard', '.nr-row', '.nr-str', '.nap-glass-sheet', '.reflect-opt', '.shcreed', '.creedchip']],
  ['uveg nap napzaras', 'Napzárás', ['.rz-screen', '.rz-exit', '.rz-cta', '.rz-reflect-box', '.rz-loop', '.rz-xp-num',
    '.rz-skill-row', '.rz-note', '.rz-handoff', '--rz-sky-2', '@keyframes rz-']],
  ['uveg napom', 'A napom', ['.napom-page', '.napom-wd', '.napom-tick', '.napom-hero', '.napom-drow',
    '@keyframes napom-', '.nap-zcard', '.nap-zdone']],
  ['uveg en2 rutin', 'Rutin építése', ['.rt-hub', '.rt-nextcard', '.rt-bigtick', '.rt-chaintile', '.rt-door', '.rt-lanc',
    '.rt-macard', '.rt-szokasok', '.rt-htile', '.rt-szokas', '.rt-poster', '.rt-ctxgrid', '.rt-wiz', '.rt-fwcard',
    '.rt-sheet', '.rt-cal', '.gr-chain']],
  [null, 'gyors rögzítés + check-in lap (az `uveg nap rogzites` blokkból)', ['.quicklog', '.nap-gyors', '.ck-chips',
    '.ck-sum', '.capture-tone-checkin', '.capture-check-', '.capture-stepl', '.capture-stepnav', '.capture-quest',
    '.capture-gotit', '.capture-skillchip', '.capture-xp']],
  [null, 'Üzenetek · Életjelek · Észrevételek (az `uveg nap uzenetek` blokkból)', ['.nap-mzmsg', '.nap-mzrow',
    '.nap-mz-cta', '.nap-ejstrip', '.nap-ejcell', '.nap-obs.glass', '.nap-obs-empty']],
]

describe.each(RETIRED_NAP_BLOCKS)('the retired Üveg Nap skin stays out: %s — %s (Folyadék F2, mezo-n4wf5.2)', (marker, _what, sels) => {
  test('its marker pair is gone (or, for a surviving block, still paired)', () => {
    if (marker) {
      expect(rawCss).not.toContain(`── ${marker} (`)
      expect(rawCss).not.toContain(`── /${marker} `)
    } else {
      for (const name of ['rogzites', 'uzenetek']) {
        expect(rawCss.split(`── uveg nap ${name} (mezo-`).length - 1).toBe(1)
        expect(rawCss.split(`── /uveg nap ${name} ──`).length - 1).toBe(1)
      }
    }
  })

  test('none of its selectors has a rule left anywhere in the stylesheet', () => {
    const rules = stripComments(rawCss)
    const left = sels.filter((sel) => rules.includes(sel))
    expect(left, `retired Üveg Nap selectors are back in prototype.css: ${left.join(', ')}`).toEqual([])
  })
})

describe.each(U3_BLOCKS)('the uveg nap %s section carries the glass ranking (mezo-me75u.3)', (name, sels) => {
  const section = () => stripComments(slice(`── uveg nap ${name} (`, `── /uveg nap ${name} `))

  test('the block exists and dresses every surface of the group', () => {
    const css = section()
    for (const sel of sels) expect(css, `${sel} missing from the uveg nap ${name} block`).toContain(sel)
  })

  test('never glass inside glass (U1 rule 5)', () => {
    expect(section()).not.toMatch(/\.glass [^{,]*\.glass[\s,{]/)
  })
})

test('the U3 capture sheet floats under `.glass` (U1 rules 1–3, U2 rule 15)', () => {
  const css = stripComments(slice('── uveg nap rogzites (', '── /uveg nap rogzites '))
  expect(css).toMatch(/\.sheet\.capture-sheet\.glass[^{]*\{[^}]*position: absolute;/)
  // the scroll now lives on the inner `.sheet-scroll` (mezo-zz91i follow-up); the outer frame
  // stays non-scrolling so its `.glass::before` hairline never scrolls away.
  expect(css).toMatch(/\.sheet\.capture-sheet\.glass[^{]*\{[^}]*overflow-y: hidden;/)
})

/**
 * Üvegesítés U4 (mezo-me75u.4) — Edzés I (prototypes/uveg-edzes.html). One block per surface group
 * so six builders could work in parallel: Mai, the in-workout screen, the closing ceremony + review,
 * Terhelés, Sport + Futás, Medálok + Gyakorlatok. Heroes are frameless halos; primary objects glass
 * in ONE accent (workout cards and exercise rows take their muscle colour); rows, chips and cells
 * inside them flat or lit; free space dashed; the dock never sweeps; never glass in glass.
 */
const U4_BLOCKS: Array<[string, string[]]> = [
  // 'mai' is cut down to the duration row of the shared RecoveryDurationRow (Folyadék F3, mezo-n4wf5.3); the reason
  // sheet's `.trm-why*` chips left with Fuel's own sheet (Folyadék F5, mezo-n4wf5.5 — RETIRED_FUEL_BLOCKS)
  ['mai', ['.trm-kmdur-eb', '.trm-kmdc > button', '.trm-kmdc > button.on']],
  // 'session' and 'zaras' left in Folyadék F4 (mezo-n4wf5.4): the in-workout flow wears `.ei-` / `.ek-` / `.el-` /
  // `.ec-` / `.eo-` (styles/folyadek-edzes-*.css); their absence is pinned in RETIRED_KOZBEN_BLOCKS above.
  // 'terheles', 'sport' and 'gyakorlatok' left in Folyadék F3 (mezo-n4wf5.3): those pages wear `.et-` / `.es-` / `.er-`
  // (styles/folyadek-edzes-*.css); their absence is pinned in RETIRED_EDZES_BLOCKS above.
]

describe.each(U4_BLOCKS)('the uveg edzes %s section carries the glass ranking (mezo-me75u.4)', (name, sels) => {
  const section = () => stripComments(slice(`── uveg edzes ${name} (`, `── /uveg edzes ${name} `))

  test('the block exists and dresses every surface of the group', () => {
    const css = section()
    for (const sel of sels) expect(css, `${sel} missing from the uveg edzes ${name} block`).toContain(sel)
  })

  test('never glass inside glass (U1 rule 5)', () => {
    expect(section()).not.toMatch(/\.glass [^{,]*\.glass[\s,{]/)
  })
})


/**
 * Üvegesítés U6 (mezo-me75u.6) — Én I (prototypes/uveg-en.html). One block per surface group so six
 * builders could work in parallel: the Én hub, Célok (+ Cél, wizard, Jelek, pillar sheet), the weight
 * goal and its sub-pages, the daily weight page, Alvás + night mode, and the week pages. Heroes are
 * frameless halos; primary objects glass in ONE accent; cells and chips inside flat or lit; free
 * space dashed; never glass in glass.
 */
const U6_BLOCKS: Array<[string, string[]]> = [
  // mezo-lhqw7: the hub is „Hol tartok" — flat identity strip, the week hero halo, Életvonal,
  // Célok állása, the tiles. The identity hero / XP ring / title-chip selectors retired with it.
  ['hub', ['.enh-hub .enh-idstrip', '.enh-hub .enh-wkhero.uv-halo', '.enh-hub .enh-wkcta', '.enh-hub .enh-elv',
    '.enh-hub .enh-elv-curve', '.enh-hub .enh-elv-stn', '.enh-hub .enh-elv.enh-elv-empty.uv-empty',
    '.enh-hub .enh-goalcard.glass', '.enh-hub .enh-goalcard .enh-grow', '.enh-hub .enh-newgoal.uv-empty',
    '.enh-hub .mz-tile.enh-tile.glass']],
  ['celok', ['.enc-celok .enc-tile.glass', '.enc-celok .enc-hero.uv-halo', '.enc-celok .enc-xrow.glass',
    '.enc-celok .enc-newtile.uv-empty', '.enc-celok .enc-wgoal-skel.glass', '.enc-cel .lg-pillar.glass', '.enc-cel .lg-why.glass',
    '.enc-wiz .lg-fcard.glass', '.sheet.glass.enc-pcat']],
  ['sulycel', ['.goal-hub-page .goal-course-hero.uv-halo', '.goal-hub-page .goal-hub-mosaic .mz-tile.glass',
    '.goal-hub-page .goal-empty-new.uv-empty', '.uv-goal .goal-detail-card.glass', '.goal-gate .goal-gate-card.glass',
    '.goal-planner-page .gp-traj.glass', '.sheet.glass.goal-attach-sheet']],
  ['suly', ['.wt-page .wt-chart.glass', '.wt-page .wt-week.glass', '.wt-page .wt-chart.wt-chart-empty',
    '.wt-page .wt-dayrow', '.wt-page .wt-ask', '.wt-page .wt-seg-btn.is-on']],
  ['alvas', ['.alv-page .alv-goal.glass', '.alv-page .alv-ring.glass', '.alv-page .sstat.glass', '.alv-page .sesc.glass',
    '.alv-page .alv-last.glass', '.alv-page .alv-night.glass', '.sheet.glass.sst-sheet', '.alv-page .slr.is-warn']],
  ['het', ['.wkh-page .wkh-wide.glass', '.wkh-page .wkh-sm.glass', '.wkh-page .lg-wcard.glass', '.wkh-page .wkn-card.glass',
    '.wk-analysis-page .wka-rev.glass', '.wkd-page .wkd-tile.glass', '.wkd-page .wkd-tile.uv-empty',
    '.wkf-page .wkd-tile.glass', '.wkt-page .wkt-card.glass']],
]

describe.each(U6_BLOCKS)('the uveg en %s section carries the glass ranking (mezo-me75u.6)', (name, sels) => {
  const section = () => stripComments(slice(`── uveg en ${name} (`, `── /uveg en ${name} `))

  test('the block exists and dresses every surface of the group', () => {
    const css = section()
    for (const sel of sels) expect(css, `${sel} missing from the uveg en ${name} block`).toContain(sel)
  })

  test('never glass inside glass (U1 rule 5)', () => {
    expect(section()).not.toMatch(/\.glass [^{,]*\.glass[\s,{]/)
  })

  test('the ground is written as a token that exists (--canvas, never the undefined --page)', () => {
    expect(section()).not.toContain('var(--page)')
  })
})

/**
 * Én IA (mezo-lhqw7) — blocks added by the Én information-architecture redesign. Append a
 * `[name, selectors]` pair per `── uveg en <name> (mezo-lhqw7)` block.
 */
const LHQW7_BLOCKS: Array<[string, string[]]> = [
  ['test', ['.ent-head', '.ent-seg-btn.is-on', '.ent-bio']],
]

describe.each(LHQW7_BLOCKS)('the uveg en %s section (mezo-lhqw7)', (name, sels) => {
  const section = () => stripComments(slice(`── uveg en ${name} (`, `── /uveg en ${name} `))

  test('the block exists and dresses every surface of the group', () => {
    const css = section()
    for (const sel of sels) expect(css, `${sel} missing from the uveg en ${name} block`).toContain(sel)
  })

  test('never glass inside glass (U1 rule 5)', () => {
    expect(section()).not.toMatch(/\.glass [^{,]*\.glass[\s,{]/)
  })
})

/**
 * Üvegesítés U8a (mezo-me75u.13) — the „Miből látszik?" deep pages (prototypes/uveg-uzenofal.html
 * #minta/*, #elore/*, #kiserlet-oldal/*): pattern detail (laborfüzet, catalog, saved observation),
 * prediction and experiment. ONE glass hero per page, everything else flat, empty/error/loading
 * dashed; the evidence log is upright. The Mozaik-wash `.pdt-*` blocks it replaced are gone.
 */
describe('the uveg mezo mibol section carries the glass ranking (mezo-me75u.13)', () => {
  const section = () => stripComments(slice('── uveg mezo mibol (', '── /uveg mezo mibol '))

  test('the block exists and dresses every surface of the three pages', () => {
    const css = section()
    for (const sel of ['.pdt-page .pdt-hero.glass', '.pdt-pill', '.pdt-ring', '.pdt-dec', '.pdt-flat', '.pdt-fold',
      '.pdt-event-you p', '.pdt-vs', '.pdt-dcells span.is-done', '.pdt-feedback .chip',
      '.pdt-state.uv-empty', '.pdt-log-empty.uv-empty', '.pdt-body']) {
      expect(css, `${sel} missing from the uveg mezo mibol block`).toContain(sel)
    }
  })

  test('the hero is the ONLY glass surface the block dresses, and never glass in glass', () => {
    const css = section()
    const glassSelectors = (css.match(/[^{}]*\.glass[^{}]*\{/g) ?? []).map((s) => s.trim())
    expect(glassSelectors).toEqual(['.pdt-page .pdt-hero.glass {'])
    expect(css).not.toMatch(/\.glass [^{,]*\.glass[\s,{]/)
  })

  test('the evidence log is upright prose (bible U23) and the ground token exists', () => {
    const css = section()
    expect(css).not.toMatch(/font-style:\s*italic/)
    expect(css).not.toContain('var(--ff-serif)')
    expect(css).not.toContain('var(--page)')
  })

  test('the Mozaik-wash pattern-detail blocks it replaced are gone', () => {
    expect(rawCss).not.toContain('Minta-részlet — közérthető bizonyítékfolyam')
    expect(rawCss).not.toContain('Laborfüzet — a reflexiós hipotézis részletoldala')
    expect(stripComments(rawCss)).not.toMatch(/\.pdt-state-card\b|\.pdt-belief-ring\b|\.pdt-hero-decision\b/)
  })

  // mezo-rstt7: the pattern detail was retold on the `pmx-*` parts (one reading, one layout) —
  // the test-plan tiles, the old scatter/strength charts, the group and story tiles are gone.
  test('the pattern-detail parts the retelling replaced are gone (mezo-rstt7)', () => {
    expect(stripComments(rawCss)).not.toMatch(
      /\.pdt-(plan|compare|story|belief|chart|dot-|median|trend|latest-ring|group-label|days|str)\b/)
  })
})

// U7 · Én II (mezo-me75u.7, prototypes/uveg-en2.html): six parallel builders, and two of them
// saved the whole stylesheet once (bible rule 41) — the key selectors below were verified at
// integration and pin each block so a later whole-file save that drops one fails CI.
const U7_BLOCKS: Array<[string, string[]]> = [
  ['novekedes', ['.grs-page .gr-band.glass', '.grs-page .gr-skl-ic.mono', '.grs-page .gr-skl-lv', '.grn-page .gr-day.glass',
    '.grn-page .gr-jrow .gr-jdot i', '.gra-page .gr-streak.gr-band::before', '.gra-page .gr-titcard.glass',
    '.gra-page .gr-bdg .gr-ring svg', '.gra-page .gr-perks.glass', '.mz-tile.gr-tile.glass']],
  // 'rutin' left in Folyadék F2 (mezo-n4wf5.2): the routine builder wears `.rb-*`
  // (styles/folyadek-nap-epites.css); the block's absence is pinned in RETIRED_NAP_BLOCKS above.
  ['naplo', ['.mzj-page .mz-pgact.mzj-newbtn', '.mzj-page .mzj-grat.glass', '.mzj-page .mzj-deccard.glass',
    '.mzj-page .mzj-rate .mzj-rate-cta', '.mzj-page .mzj-decdone', '.mzj-page .mzj-note', '.mzj-page .mzj-empty.uv-empty',
    '.mzj-decsheet .mzj-dsh-head']],
  ['emberek', ['.ppl-hub .ppl-hub-tile.glass', '.ppl-kor .ppl-tile.glass', '.ppl-jel .ppl-candt.glass',
    '.ppl-eml .ppl-rhythm.glass', '.ppl-eml .ppl-mrowt.ppl-tw-jo', '.ppl-heti .ppl-dirt.glass', '.ppl-heti .ppl-quietcard.glass',
    '.ppl-detail .mz-page-hero.ppl-phero.uv-halo', '.ppl-detail .ppl-tlcard.glass', '.sheet.glass.ppl-sheet']],
  ['ertesitesek', ['.nf-page .nf-row.unread', '.nf-page .nf-row .nf-dot', '.nf-page .nf-ico.uv-well',
    '.nf-page .nf-empty.uv-empty', '.ntf-page .ntf-prev.glass', '.ntf-page .ntf-prev-bars i.hot',
    '.ntf-page .ntf-masterrow.glass', '.ntf-page .ntf-cats.glass', '.ntf-page .ntf-gate.glass']],
  ['beallitasok', ['.settings-page .settings-back.glass', '.settings-page .settings-hero::before',
    '.settings-page .settings-current.glass', '.settings-page .settings-domain.glass:last-child',
    '.settings-page .settings-rows.glass', '.settings-page .settings-row-art.uv-well', '.settings-page .settings-day.is-on',
    '.settings-page .personal-context-list.glass', '.sheet.glass.settings-guard-sheet',
    '.goal-detail-settings-page .goal-pace-editor.glass', '.goal-detail-settings-page .goal-settings-grid.glass']],
]

describe.each(U7_BLOCKS)('the uveg en2 %s section carries the glass ranking (mezo-me75u.7)', (name, sels) => {
  const section = () => stripComments(slice(`── uveg en2 ${name} (`, `── /uveg en2 ${name} `))

  test('the block exists and dresses every surface of the group', () => {
    const css = section()
    for (const sel of sels) expect(css, `${sel} missing from the uveg en2 ${name} block`).toContain(sel)
  })

  test('never glass inside glass (U1 rule 5)', () => {
    expect(section()).not.toMatch(/\.glass [^{,]*\.glass[\s,{]/)
  })

  test('the ground is written as a token that exists (--canvas, never the undefined --page)', () => {
    expect(section()).not.toContain('var(--page)')
  })
})

// Re-pointed in Folyadék F2 (mezo-n4wf5.2): the habit history is the `.rb-g28` vial grid in
// styles/folyadek-nap-epites.css now (`HabitFormationHistory`: `i.p` done · `i.m` missed · `i.s` not due).
test('a missed habit day stays neutral, never failure-red (ADR 0010)', () => {
  const css = stripComments(napEpitesCss)
  const at = css.indexOf('.rb-g28 i.m')
  expect(at, 'the missed-day cell rule (.rb-g28 i.m) is gone from folyadek-nap-epites.css').toBeGreaterThan(-1)
  const rule = css.slice(at, css.indexOf('}', at))
  expect(rule).not.toMatch(/coral|--error|--danger|\bred\b/)
})

// U8 · Mezo I (mezo-me75u.8, prototypes/uveg-mezo.html): seven parallel builders, one block each. The key
// selectors below were verified present at integration (bible rule 41) and pin each block.
const U8_BLOCKS: Array<[string, string[]]> = [
  ['chat', ['.mzc-u8 .mzc-chathead', '.mzc-u8 .mzc-hdisc.glass', '.mzc-u8 .mzc-horb.uv-well', '.mzc-u8 .mzc-msg-a.glass',
    '.mzc-u8 .mzc-bub-u', '.mzc-u8 .mzc-bub-err', '.mzc-u8 .chat-composer.glass', '.fbk-chips.is-3d .chip', '.sheet.glass.mzc-sheet']],
  ['coaching', ['.coach-page.mz-page', '.coach-hub .coach-gauge', '.coach-hub .coach-win.glass', '.coach-hub .coach-door',
    '.coach-obs .mzo-daysw', '.coach-obs .mzo-rule.glass', '.coach-page .coach-chip', '.coach-card .coach-dcard.glass',
    '.coach-card .coach-applied']],
  ['diagnozis', ['.dgx-page.mz-page', '.dgx-cert', '.dgx-szam-card',
    '.dgx-page .dgx-susp.is-lead.glass', '.dgx-probe', '.dgx-actual', '.dgx-empty.uv-empty']],
  ['kiserletek', ['.exl-page .exl-filter.is-on', '.exl-page .exl-card.glass', '.exl-page .exl-card.is-flat[data-status="proposed"]',
    '.exl-page .exl-chip', '.exl-page .exl-dots i.is-done', '.exl-page .exl-new']],
  ['emlekek', ['.eml-page .eml-memo.glass', '.eml-page .eml-drow', '.eml-page .eml-dblk', '.eml-search .eml-srch',
    '.eml-search .eml-simrow', '.eml-search .eml-simring', '.eml-emlek .eml-article.glass', '.eml-emlek .eml-pager']],
  ['memoar', ['.mmo-page .mmo-article.glass', '.mmo-page .mmo-ttl', '.mmo-page .reftag-3d', '.mmo-page .mmo-anniv',
    '.mmo-page .mmo-chap', '.mmo-page .mmo-wkb', '.mmo-page .mmo-pager', '.mmo-page .mmo-pg.is-empty.uv-empty']],
  ['memoria', ['.mmr-page .mmr-layer.glass', '.mmr-page .mmr-audit.glass', '.mmr-page .mmr-segbar', '.mmr-page .mmr-seg button.on',
    '.mmr-page .mmr-ring::before', '.mmr-page .mmr-day.focused', '.mmr-page .mmr-tcols i', '.mmr-page .mmr-note.uv-empty']],
]

describe.each(U8_BLOCKS)('the uveg mezo1 %s section carries the glass ranking (mezo-me75u.8)', (name, sels) => {
  const section = () => stripComments(slice(`── uveg mezo1 ${name} (`, `── /uveg mezo1 ${name} `))

  test('the block exists and dresses every surface of the group', () => {
    const css = section()
    for (const sel of sels) expect(css, `${sel} missing from the uveg mezo1 ${name} block`).toContain(sel)
  })

  test('never glass inside glass (U1 rule 5)', () => {
    expect(section()).not.toMatch(/\.glass [^{,]*\.glass[\s,{]/)
  })

  test('the ground is written as a token that exists (--canvas, never the undefined --page)', () => {
    expect(section()).not.toContain('var(--page)')
  })
})

// U9 · Mezo II (mezo-me75u.9): Karakter + Rólad, Konzílium, Gépterem, Tudástár, Minták + Előrejelzések —
// dressed in the csapatfal material (the tf-* kit in boop-world.css) with each page's own prefix. Five
// parallel builders; every block's key selectors are pinned so a later whole-file save that drops one
// fails CI (bible rule 41).
const U9_BLOCKS: Array<[string, string[]]> = [
  ['karakter', ['.kr9-page .kr9-dhead .tf-back', '.kr9-page .kr9-cta', '.kr9-page .kr9-filt button[aria-pressed="true"]',
    '.kr9-page .kr9-bub', '.kr9-page .kr9-chip.is-main', '.kr9-page .kr9-links button', '.kr9-page .kr9-portrait',
    '.kr9-page .kr9-bootring svg', '.kr9-rolad .kr9-rhead', '.kr9-rolad .kr9-quote', '.kr9-rolad .kr9-chip.is-main',
    '.kr9-rolad .kr9-gone', '.kr9-rolad .kr9-quiet', '.kr9-rolad .kr9-lifer']],
  ['konzilium', ['.kz-step .kz-date', '.kz-seg button.on', '.kz-outcells .kz-outcell', '.kz-page .kz-round.hot', '.kz-thhead',
    '.kz-cmt', '.kz-chip.cha', '.kz-page .kz-ruling', '.kz-arcrow.on']],
  ['gepterem', ['.gtm-page .gtm-lede', '.gtm-menu-page .gtm-menu', '.gtm-menu-page .gtm-tile', '.gtm-futasok .gtm-wmenu',
    '.gtm-futasok .gtm-run.gtm-incomplete', '.gtm-run-page .gtm-flow-cell', '.gtm-run-page .gtm-chain-num', '.gtm-run-page .gtm-pill',
    '.gtm-adat .gtm-seg button.on', '.gtm-page .gtm-det']],
  ['tudastar', ['.tud9 .tud9-bignum', '.tud9 .tud9-sech', '.tud9 .tud9-fact.off .tf-ttx', '.tud9 .uv-tgl.is-on',
    '.tud9 .tud9-kind .tud9-kn', '.tud9 .tud9-kind-empty', '.tud9 .tud9-qa', '.tud9-node .tud9-edges li',
    // U9b Task 11 (mezo-zpxv7): the inbox cards render on Rólad ONLY now — the Tudástár shows the
    // pointer instead, so their rules (conflict/checkbox/refine/accepted/etc.) are `.kr9-rolad`-only.
    '.kr9-rolad .tud9-conflict', '.kr9-rolad .tud9-chk input:checked + i',
    '.kr9-rolad .tud9-btn.is-main', '.kr9-rolad .tud9-no', '.kr9-rolad .tud9-accepted']],
  ['mintak', ['.m9m-root .m9m-big b', '.m9m-root .m9m-lcel.is-selected', '.m9m-root .m9m-lcel.hot b', '.m9m-root .m9m-act.is-no',
    '.m9m-root .m9m-tile.is-mute', '.m9m-root .m9m-covtile', '.sheet.glass.m9m-sheet', '.m9e-root .m9e-acc',
    '.m9e-root .m9e-filt button.on', '.m9e-root .m9e-st']],
]

describe.each(U9_BLOCKS)('the uveg mezo2 %s section carries the glass ranking (mezo-me75u.9)', (name, sels) => {
  const section = () => stripComments(slice(`── uveg mezo2 ${name} (`, `── /uveg mezo2 ${name} `))

  test('the block exists and dresses every surface of the group', () => {
    const css = section()
    for (const sel of sels) expect(css, `${sel} missing from the uveg mezo2 ${name} block`).toContain(sel)
  })

  test('never glass inside glass (U1 rule 5)', () => {
    expect(section()).not.toMatch(/\.glass [^{,]*\.glass[\s,{]/)
  })

  test('the ground is written as a token that exists (--canvas, never the undefined --page)', () => {
    expect(section()).not.toContain('var(--page)')
  })

  test('motion lives only in the no-preference branch (bible §6)', () => {
    const css = section().replace(/@media\s*\(prefers-reduced-motion:\s*no-preference\)\s*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '')
    expect(css).not.toMatch(/animation\s*:\s*(?!none)[a-z]/)
  })
})

// U10 · Rétegek és ünnepek (mezo-me75u.10): ceremonies, level-up, GlassBox + small overlays, sheets + toasts,
// kalauz + T0 welcome, auth + Minden oldal, admin. Seven parallel builders, one block each; every block's key
// selectors are pinned so a later whole-file save that drops one fails CI (bible rule 41). The kit's
// `<Sheet glass>` recipe is pinned in the uveg kit block.
test('the uveg kit carries the shared floating glass sheet (mezo-me75u.10)', () => {
  const kit = stripComments(slice('── uveg kit (', '── /uveg kit '))
  expect(kit).toContain('.sheet.glass.uv-sheet {')
  expect(kit).toContain('.sheet.glass.uv-sheet::after { display: none; }')
})

const U10_BLOCKS: Array<[string, string[]]> = [
  // 'unnep' is gone: the sport ceremony left with the Folyadék closing screens (mezo-n4wf5.4), the meal ceremony
  // (`.fcx-*`) with Fuel (mezo-n4wf5.5) — its absence is pinned in RETIRED_FUEL_BLOCKS.
  ['szint', ['.levelup.lvu {', '.lvu-chip {', '.lvu-xp {', '.levelup.lvu .lvu-row.glass {', '.lvu-badge {', '.lvu-perk {',
    '.lvu-cell {', '.lvu-robust {', '.levelup.lvu .lvu-cta.glass {']],
  ['ablak', ['.gl-card.glass.uv-gb {', '.uv-gb .gl-x {', '.abl-pill {', '.dp-cal.glass {', '.dp-day.is-sel',
    // (the workout's return button `.float-fab` / `.float-return` is the Edzés-shared `ReturnFab` now, mezo-n4wf5.4)
    '.abl-err.glass {']],
  ['lap', [// `.uvl-edzes` left with the Edzés sheets (Folyadék F3, mezo-n4wf5.3 — they are kit sheets now)
    // `.uvl-fuel` / `.uvl-kamra` left with the Fuel sheets (Folyadék F5, mezo-n4wf5.5 — kit sheets too)
    '.sheet.glass.uv-sheet.uvl-en',
    '.sheet.glass.uv-sheet.uvl-fiok', '.uvl-cta', '.uvl-err', '.toast-stack .toast.glass.uvl-tst', '.toast-stack .uvl-tst .t-lvup']],
  ['kalauz', ['.sheet.glass.uv-sheet.kalauz-sheet', '.kalauz-sheet .kalauz-art .kalauz-art-ico', '.kalauz-sheet .kalauz-fogalom',
    '.kalauz-sheet .kalauz-cta', '.welcome.uv-welcome', '.uv-welcome .wel-dpart.glass', '.uv-welcome .wel-domvoice.glass',
    '.uv-welcome .wel-qpulse.glass']],
  ['belepes', ['.auth-page', '.auth-mark', '.auth-card.glass', '.auth-card.glass.is-gold', '.auth-err', '.auth-notice',
    '.auth-cta', '.auth-down::before', '.mno-u10 .mno-domain.glass', '.mno-u10 .mno-group a.mno-l']],
  ['admin', ['.uv-admin .ad-rail.glass {', '.uv-admin .ad-rail .ad-rail-link.on {', '.uv-admin .mz-tile.ad-gt {',
    '.uv-admin .ad-chip.on {', '.uv-admin .ad-table th {', '.uv-admin .ad-status.allok.glass {',
    '.uv-admin .am-inspector.glass {', '.uv-admin .ad-acrow.glass {']],
]

describe.each(U10_BLOCKS)('the uveg reteg %s section carries the glass ranking (mezo-me75u.10)', (name, sels) => {
  const section = () => stripComments(slice(`── uveg reteg ${name} (`, `── /uveg reteg ${name} `))

  test('the block exists and dresses every surface of the group', () => {
    const css = section()
    for (const sel of sels) expect(css, `${sel} missing from the uveg reteg ${name} block`).toContain(sel)
  })

  test('never glass inside glass (U1 rule 5)', () => {
    expect(section()).not.toMatch(/\.glass [^{,]*\.glass[\s,{]/)
  })

  test('the ground is written as a token that exists (--canvas, never the undefined --page)', () => {
    expect(section()).not.toContain('var(--page)')
  })

  test('motion lives only in the no-preference branch (bible §6)', () => {
    const css = section().replace(/@media\s*\(prefers-reduced-motion:\s*no-preference\)\s*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '')
    expect(css).not.toMatch(/animation\s*:\s*(?!none)[a-z]/)
  })
})

// U11 · Lezárás (mezo-me75u.11): the app-wide sweep's fixes — two builders, one block each. Pinned so a
// later whole-file save that drops one fails CI (bible rule 41).
const U11_BLOCKS: Array<[string, string[]]> = [
  // 'edzes' left in Folyadék F3 (mezo-n4wf5.3): every page it patched wears the kit; pinned as gone in RETIRED_EDZES_BLOCKS.
  ['egyeb', ['.alv-page .alv-sec-head .eyebrow', '.gr-ma .gr-chip .gr-chip-mk.gr-mk3d', '.enc-celok .lg-dimchip.empty',
    // the two `.napom-page` fixes left with the page's Üveg skin (Folyadék F2, mezo-n4wf5.2), the Kiegészítők tick
    // fix (`.fsx-band.glass .fsx-check`) with Fuel's (Folyadék F5, mezo-n4wf5.5)
  ]],
]

describe.each(U11_BLOCKS)('the uveg lezaras %s section (mezo-me75u.11)', (name, sels) => {
  const section = () => stripComments(slice(`── uveg lezaras ${name} (`, `── /uveg lezaras ${name} `))

  test('the block exists and carries its fixes', () => {
    const css = section()
    for (const sel of sels) expect(css, `${sel} missing from the uveg lezaras ${name} block`).toContain(sel)
  })

  test('never glass inside glass, never the undefined --page, motion only in the no-preference branch', () => {
    const css = section()
    expect(css).not.toMatch(/\.glass [^{,]*\.glass[\s,{]/)
    expect(css).not.toContain('var(--page)')
    expect(css.replace(/@media\s*\(prefers-reduced-motion:\s*no-preference\)\s*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, ''))
      .not.toMatch(/animation\s*:\s*(?!none)[a-z]/)
  })
})

/**
 * Sheet-wrapper direct-child guard (mezo-y72o3 follow-up).
 *
 * `<Sheet>` (shared/ui/Sheet.tsx) wraps its children in a `.sheet-scroll` div; the outer
 * `.sheet` box (the frame carrying the glass hairline/handle) never scrolls and is no longer
 * the immediate parent of a sheet's own content. Two regressions slipped through because a
 * selector still assumed the old flat shape:
 *   1. `.sheet.glass.kalauz-sheet .sheet-scroll > .kalauz-peekbar` — geometry-only regression:
 *      `.glass > *` (§3) made `.sheet-scroll` `position: relative`, moving the peek bar's
 *      containing block off `.sheet` and clipping it in `.is-peek`. Fixed by restating
 *      `.sheet.glass.kalauz-sheet .sheet-scroll { position: static; }`.
 *   2. `.wos-sheet > .wos-primary` — a plain selector-form bug: the button is a grandchild of
 *      `.wos-sheet` now (inside `.sheet-scroll`), so the direct-child combinator never matched
 *      at all. Fixed by retargeting to `.wos-sheet .sheet-scroll > .wos-primary`.
 *
 * This guard catches bug #2's SHAPE for every sheet family: any selector where a compound
 * token ending in "sheet" (the Sheet's own frame class, e.g. `.wos-sheet`, `.kalauz-sheet`,
 * `.gyx-sheet`) is immediately followed by a direct-child combinator `>` into anything other
 * than the allow-listed wrapper children (`.sheet-scroll`, `.sheet-handle-zone`, `.sheet-handle`)
 * — which is exactly the family of selector #2 was, and exactly what a pre-retarget version of
 * #1 (`.sheet.glass.kalauz-sheet > .kalauz-peekbar`, before the mezo-zz91i follow-up) would
 * also have been.
 */
test('no "<sheet-frame-class> > <child>" selector bypasses .sheet-scroll (mezo-y72o3 guard)', () => {
  const css = stripComments(rawCss)
  const ALLOWED_TARGETS = ['.sheet-scroll', '.sheet-handle-zone', '.sheet-handle']
  const offenders: string[] = []

  const ruleRe = /([^{}]+)\{[^{}]*\}/g
  let m: RegExpExecArray | null
  while ((m = ruleRe.exec(css))) {
    for (const rawSel of m[1].split(',')) {
      const sel = rawSel.trim()
      if (!sel || !/>/.test(sel) || !/sheet/i.test(sel)) continue

      const parts = sel.split('>').map((p) => p.trim())
      for (let i = 0; i < parts.length - 1; i++) {
        const leftLastToken = parts[i].split(/\s+/).pop() ?? ''
        const rightFirstToken = parts[i + 1].split(/\s+/)[0] ?? ''
        // A compound token is several `.class` chunks glued together with no separator
        // (`.sheet.glass.kalauz-sheet`). Only the token immediately left of `>` matters, and
        // only if one of ITS OWN class chunks IS "sheet" or ENDS in "-sheet" (the Sheet.tsx
        // frame's own class) — not merely contains "sheet" as a raw substring somewhere inside
        // an unrelated compound class name (e.g. `.fkx-rsheet` — a plain grid wrapper rendered
        // INSIDE a sheet, never the Sheet root itself; or `.rt-shh`, `.mzj-dsh-head`).
        const classChunks = leftLastToken.split('.').filter(Boolean).map((c) => c.split(':')[0])
        const leftIsSheetFrame = classChunks.some((c) => c === 'sheet' || c.endsWith('-sheet'))
        if (!leftIsSheetFrame) continue
        if (ALLOWED_TARGETS.some((t) => rightFirstToken.startsWith(t))) continue
        offenders.push(`"${sel}" (left: ${leftLastToken}, right: ${rightFirstToken})`)
      }
    }
  }

  expect(
    offenders,
    `selector(s) target a sheet frame's direct child, bypassing the .sheet-scroll wrapper:\n${offenders.join('\n')}`,
  ).toEqual([])
})
