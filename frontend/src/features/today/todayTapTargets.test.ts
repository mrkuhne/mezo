import { describe, expect, test } from 'vitest'
// Vite `?raw` import — the CSS source as a string, resolved via the `@/` alias — same
// mechanism `todayReducedMotion.test.ts` uses to guard the same file.
import rawCss from '@/styles/prototype.css?raw'

/**
 * Guard (mezo-e26w code review, Task 1 fix round): the global "Tap target ≥ 44px" constraint
 * (task-1-brief.md) isn't enforced anywhere in the build, so a control whose CSS box doubles as
 * its own visible artwork can ship under-sized without any test catching it.
 *
 * Scope after the Design 2.0 cleanup (mezo-d20.9.1): the Today LIST language this guard was
 * born for — `.td-seg button`, `.td-tick` (+ its `::before` artwork), `.td-act`, `.td-row-hit`,
 * `.td-need` — went out of the tree with `TodayPage` and its view components, and so did their
 * CSS. Those five tests are gone with the rules they measured: there is no under-sized control
 * left to protect, because there is no control left. What survives is the one `.td-*` tap
 * target still rendered — the daily-quest sheet/card action buttons — and that is what this
 * file now pins. The 44px rule itself is unchanged; only its remaining subject is.
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
  test('daily-quest smart actions and rerolls are 44px tap targets', () => {
    const body = ruleBody(rawCss, '.td-quest-actions button')
    expect(pxDeclaration(body, 'min-height')).toBeGreaterThanOrEqual(44)
  })

  test('sanity: the exact-selector matcher really can miss — a selector that no longer exists ' +
    'throws instead of silently returning an empty body', () => {
    expect(() => ruleBody(rawCss, '.td-tick')).toThrow(/No rule found/)
  })
})
