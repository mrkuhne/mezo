import { describe, expect, it } from 'vitest'
import rawCss from '@/styles/prototype.css?raw'

/**
 * „Mihez képest" tone guard (mezo-d20.8.2.1).
 *
 * The comparison cell is the one place in the app where a number is explicitly framed as
 * better-or-worse than a past self, so ADR 0010 bites hardest there: the value is signed and
 * honest, but the PALETTE only ever rewards. There is deliberately no `down` tone.
 *
 * The subject of the assertion is the forbidden VALUE, not the number of rules — the panel-rhythm
 * regression (mezo-d20.11.2) taught that counting usages passes for the wrong reason. What must
 * never happen is a punishing colour reaching this cell at all, whichever rule brings it.
 */

/** Selector → declaration body, comments stripped first so a `/* … *​/` block above a rule
 *  cannot be swallowed into the following selector capture. */
function rules(): Array<{ sel: string; body: string }> {
  const bare = rawCss.replace(/\/\*[\s\S]*?\*\//g, '')
  return [...bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim(), body: m[2] }))
}

/** Every token family that reads as "you did badly" — coral, terracotta, error, danger, red. */
const PUNISHING = /--(coral|terracotta|error|danger)-|\bred\b|#(c4634b|ff6b4a|a84a26)/i

describe('the comparison cell never punishes', () => {
  it('paints no coral, terracotta or error tone anywhere in the tile', () => {
    const offenders = rules()
      .filter((r) => r.sel.includes('.wr-cmp'))
      .filter((r) => PUNISHING.test(r.body))
      .map((r) => r.sel)
    expect(offenders).toEqual([])
  })

  it('offers exactly one toned state, and it is the rewarding one', () => {
    const toned = rules()
      .filter((r) => /\.wr-cmp-cell\s+\.v\./.test(r.sel))
      .map((r) => r.sel.trim())
    expect(toned).toEqual(['.wr-cmp-cell .v.up'])
  })

  it('gives the untoned value a real colour of its own, not an inherited accident', () => {
    const base = rules().find((r) => r.sel.trim() === '.wr-cmp-cell .v')
    expect(base, 'no .wr-cmp-cell .v rule at all').toBeDefined()
    expect(base!.body).toMatch(/color:\s*var\(--/)
  })
})

describe('the missed set stays a ghost', () => {
  it('renders dashed and dimmed, with no punishing tone', () => {
    const ghost = rules().filter((r) => r.sel.includes('.wr-set.ghost'))
    expect(ghost.length).toBeGreaterThan(0)
    expect(ghost.some((r) => r.body.includes('dashed'))).toBe(true)
    expect(ghost.filter((r) => PUNISHING.test(r.body))).toEqual([])
  })
})
