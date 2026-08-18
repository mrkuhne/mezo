import { describe, expect, test } from 'vitest'
// Vite `?raw` import — the CSS source as a string, resolved via the `@/` alias — same
// mechanism `todayReducedMotion.test.ts` uses to guard the same file.
import rawCss from '@/styles/prototype.css?raw'

/**
 * Guard (mezo-e26w code review, Task 1 fix round): the global "Tap target ≥ 44px" constraint
 * (task-1-brief.md) isn't enforced anywhere in the build, so a control whose CSS box doubles as
 * its own visible artwork — a 26px checkmark circle, a 38px segmented-control button — can ship
 * under-sized without any test catching it. That is exactly what happened on the first pass:
 * `.td-tick` was a 26×26 button and `.td-seg button` had `min-height: 38px`. This guard pins
 * both to a real ≥44px hit box, independent of the (deliberately unchanged, smaller) artwork
 * drawn inside them.
 */

/** Finds the FIRST `{selector} { ... }` rule body for an EXACT top-level selector string — not
 *  a prefix match, so `.td-tick` must not match `.td-tick.is-done` or `.td-tick::before`. Relies
 *  on every targeted selector starting its own source line (true for all of `prototype.css`). */
function ruleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`))
  if (!match) throw new Error(`No rule found for exact selector "${selector}"`)
  return match[1]
}

function pxDeclaration(body: string, prop: string): number {
  const match = body.match(new RegExp(`${prop}\\s*:\\s*(\\d+(?:\\.\\d+)?)px`))
  if (!match) throw new Error(`No "${prop}" declaration found in: ${body}`)
  return Number(match[1])
}

describe('Today tap targets are >= 44px (mezo-e26w code review fix)', () => {
  test('.td-seg button min-height is >= 44px (the track grows to 50px — intended)', () => {
    const body = ruleBody(rawCss, '.td-seg button')
    expect(pxDeclaration(body, 'min-height')).toBeGreaterThanOrEqual(44)
  })

  test('.td-tick is itself a real 44x44 box — the hit target is not the smaller artwork', () => {
    const body = ruleBody(rawCss, '.td-tick')
    expect(pxDeclaration(body, 'width')).toBeGreaterThanOrEqual(44)
    expect(pxDeclaration(body, 'height')).toBeGreaterThanOrEqual(44)
    // No margin pushing the box around: `.td-row`'s own `align-items: center` (plus the slack
    // from its 56px min-height) centers a 44px control without growing the row.
    expect(body).not.toMatch(/margin\s*:/)
  })

  test('.td-tick draws its 26px circle in ::before — the artwork size is unchanged', () => {
    const body = ruleBody(rawCss, '.td-tick::before')
    expect(pxDeclaration(body, 'width')).toBe(26)
    expect(pxDeclaration(body, 'height')).toBe(26)
    expect(body).toMatch(/border-radius:\s*50%/)
  })

  test('.td-tick keeps the checkmark glyph rendering in both states (base + is-done)', () => {
    // The `✓` lives in the button's own text content — `color: transparent` in the empty
    // state (present but invisible against the ::before ring), `--text-inverse` when done.
    const base = ruleBody(rawCss, '.td-tick')
    expect(base).toMatch(/color:\s*transparent/)
    const done = ruleBody(rawCss, '.td-tick.is-done')
    expect(done).toMatch(/color:\s*var\(--text-inverse\)/)
  })

  test('.td-tick isolates its stacking so the ::before ring cannot paint over the checkmark ' +
    'or escape behind the .td-list card', () => {
    const base = ruleBody(rawCss, '.td-tick')
    expect(base).toMatch(/isolation:\s*isolate/)
    const before = ruleBody(rawCss, '.td-tick::before')
    expect(before).toMatch(/z-index:\s*-1/)
  })

  test('.td-act (the ink text-button accessory — "Logolás"/"Naplózz"/"Koppints"/"Logold") is ' +
    'itself >= 44px tall, centering its label rather than growing the row (pre-merge review ' +
    'Finding 3 — the screen\'s most-tapped accessory was the one `.td-*` control the earlier ' +
    '`.td-tick`/`.td-seg button` guard missed)', () => {
    const body = ruleBody(rawCss, '.td-act')
    expect(pxDeclaration(body, 'min-height')).toBeGreaterThanOrEqual(44)
    // Flex-centered so the label stays vertically centered in the taller box — `.td-row`'s own
    // 56px min-height + `align-items: center` already keeps the row itself from growing.
    expect(body).toMatch(/display:\s*flex/)
    expect(body).toMatch(/align-items:\s*center/)
  })

  test('.td-row-hit stretches to the row\'s full 56px height — the chevron rows\' tap target ' +
    'is the whole row, not the collapsed content height', () => {
    // `.td-row` centers rather than stretches its children, so without an explicit
    // `align-self: stretch` the hit-area button collapses to its own content height
    // (~28px, the leading icon) instead of the row's 56px. The negative `margin-block`
    // + matching `padding-block` pair reaches back over `.td-row`'s own 9px vertical
    // padding so the click box covers the full row without moving any visible pixel.
    const body = ruleBody(rawCss, '.td-row-hit')
    expect(body).toMatch(/align-self:\s*stretch/)
    expect(body).toMatch(/margin-block:\s*-9px/)
    expect(body).toMatch(/padding-block:\s*9px/)
  })

  test('needs rings are 44px tap targets', () => {
    const body = ruleBody(rawCss, '.td-need')
    expect(pxDeclaration(body, 'min-width')).toBeGreaterThanOrEqual(44)
    expect(pxDeclaration(body, 'min-height')).toBeGreaterThanOrEqual(44)
  })
})
