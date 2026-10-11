import { describe, expect, it } from 'vitest'
import kitCss from '@/styles/folyadek-kit.css?raw'
import rawCss from '@/styles/folyadek-edzes-osszegzes.css?raw'

/**
 * The comparison's tone guard (mezo-d20.8.2.1; re-pointed at the Folyadék rules in mezo-n4wf5.4:
 * the rows are `.eo-cmp`, and the tone is the liquid `--eo-liq` their level is poured in).
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
const PUNISHING = /--(coral|terracotta|error|danger)-|--fo-bad\b|\bred\b|#(c4634b|ff6b4a|a84a26|d4483b)/i

describe('the comparison never punishes', () => {
  it('paints no coral, terracotta, error or „bad" tone anywhere in the comparison rows', () => {
    const cmp = rules().filter((r) => r.sel.includes('.eo-cmp'))
    expect(cmp.length).toBeGreaterThan(0)
    expect(cmp.filter((r) => PUNISHING.test(r.body)).map((r) => r.sel)).toEqual([])
  })

  it('offers exactly one toned state, and it is the rewarding one', () => {
    const toned = rules()
      .filter((r) => /\.eo-cmp[.[]/.test(r.sel))
      .map((r) => r.sel.trim())
    expect(toned).toEqual(['.eo-cmp.up'])
    expect(rules().find((r) => r.sel.trim() === '.eo-cmp.up')!.body).toMatch(/--eo-liq:\s*var\(--dom\)/)
  })

  it('gives the untoned level a real, neutral colour of its own, not an inherited accident', () => {
    const base = rules().find((r) => r.sel.trim() === '.eo-cmp')
    expect(base, 'no .eo-cmp rule at all').toBeDefined()
    expect(base!.body).toMatch(/--eo-liq:\s*var\(--fo-faint\)/)
  })

  it('has no punishing tone anywhere in the review\'s own stylesheet', () => {
    expect(rules().filter((r) => PUNISHING.test(r.body)).map((r) => r.sel)).toEqual([])
  })
})

describe('the missed set stays a ghost', () => {
  it('is a quiet row — dimmed by the kit, with no punishing tone of its own', () => {
    const ghost = rules().filter((r) => r.sel.includes('.eo-ghost'))
    expect(ghost.length).toBeGreaterThan(0)
    expect(ghost.some((r) => /color:\s*var\(--fo-sub\)/.test(r.body))).toBe(true)
    expect(ghost.filter((r) => PUNISHING.test(r.body))).toEqual([])
    // The dimming itself is the kit's `Row state="dim"` (asserted on the rendered row in
    // WorkoutReviewPage.test.tsx); the kit's rule must not carry a punishing tone either.
    const dim = kitCss.replace(/\/\*[\s\S]*?\*\//g, '').match(/\.fo-row\.dim\s*\{([^}]*)\}/)
    expect(dim, 'no .fo-row.dim rule in the kit').not.toBeNull()
    expect(dim![1]).toMatch(/opacity/)
    expect(PUNISHING.test(dim![1])).toBe(false)
  })
})
