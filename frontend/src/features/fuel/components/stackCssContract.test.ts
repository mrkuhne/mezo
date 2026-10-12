// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

/**
 * The Kiegészítők CSS contract. Until Folyadék F5 (mezo-n4wf5.5) this pinned the „Fuel Stack 3.0" block of
 * prototype.css (`.stk-*`, mezo-ubxd); that block has no markup any more and was deleted with a zero-usage proof.
 * What it GUARANTEED is re-pointed at the area's Folyadék sheet (`.fk-`, styles/folyadek-fuel-kieg.css) and the kit:
 *
 *  · „defines .stk-hub-next / -progress / -timeline / -manage-row / -add-row / -item-sheet …" → the sheet dresses
 *    every surface the area renders: today's capsules, the protocol's list rows, the add wizard's step bar and
 *    fields, the item box, the medication's cycle and stop confirm;
 *  · „the feature section stays scoped to stk selectors" → every selector of the sheet carries `.fk-`; it never
 *    restyles a bare kit or house class;
 *  · „44px hit areas cover intake, management and add actions" → the intake tick is the kit's `.fo-tk` (drawn 30 px,
 *    its `::after` reaches 44 px), a managed line is a kit row (`button.fo-row::after`), the add row's button is a
 *    kit button (`min-height: 44px`) — the sheet must not shrink any of them;
 *  · „reduced motion neutralizes hero and progress animation" → the sheet has no motion at all outside the
 *    no-preference branch (the base rule is the final frame), and no endless loop.
 */
const read = (name: string) => readFileSync(new URL(`../../../styles/${name}`, import.meta.url), 'utf8')
const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '')
const sheet = strip(read('folyadek-fuel-kieg.css'))
const kit = strip(read('folyadek-kit.css'))
const house = strip(read('prototype.css'))

describe('Kiegészítők scoped CSS contract (Folyadék, was: Fuel Stack 3.0)', () => {
  test.each([
    '.fk-caps', '.fk-caps i.on', '.fk-caps i.nx', '.fk-list', '.fk-zv', '.fk-pb', '.fk-band', '.fk-two', '.fk-add',
    '.fk-unit', '.fk-sheet', '.fk-sc', '.fk-cyc', '.fk-stop',
  ])('defines %s', (selector) => {
    expect(sheet).toContain(selector)
  })

  test('the old block is gone and no rule of it is left', () => {
    expect(house).not.toContain('.stk-')
    expect(read('prototype.css')).not.toContain('Fuel Stack 3.0 (mezo-ubxd)')
  })

  test('the sheet stays scoped to fk selectors', () => {
    const flat = sheet.replace(/@media[^{]*\{/g, '')
    const selectors = [...flat.matchAll(/([^{}]+)\{[^{}]*\}/g)].flatMap((m) => m[1].split(/,(?![^(]*\))/).map((s) => s.trim()).filter(Boolean))
    expect(selectors.length).toBeGreaterThan(40)
    expect(selectors.filter((sel) => !sel.includes('.fk-'))).toEqual([])
    // and never a bare house / kit class at the start of a rule
    expect(sheet).not.toMatch(/(^|\n)\s*\.(?:card|row|mz-page|toast|fo-card|fo-row|fo-hero|fo-btn|fo-tk)(?:[\s,{]|$)/)
  })

  test('44px hit areas cover intake, management and add actions', () => {
    const hit = /([^{}]*\.fo-tk::after[^{}]*)\{([^}]*)\}/.exec(kit)
    expect(hit, 'the kit rule giving the tick its touch area is gone').not.toBeNull()
    expect(hit![2]).toMatch(/width:\s*max\(100%,\s*44px\)[^}]*height:\s*max\(100%,\s*44px\)/)
    expect(hit![1]).toContain('button.fo-row::after')
    expect(kit).toMatch(/\.fo-btn \{[^}]*min-height:\s*44px/)
    // the area sheet resizes none of them, and hides no touch area
    const touching = [...sheet.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => /\.fo-(tk|btn|row)\b/.test(m[1]))
    for (const m of touching) {
      expect(m[2], `${m[1].trim()} must not resize a kit control`).not.toMatch(/(?:^|[;\s])(?:min-|max-)?(?:height|width):/)
      expect(m[2]).not.toMatch(/pointer-events|::after/)
    }
    expect(sheet).not.toMatch(/\.fo-(tk|btn|row)[^{]*::after/)
  })

  test('no motion outside the no-preference branch, and no endless loop', () => {
    const still = sheet.replace(/@media\s*\(prefers-reduced-motion:\s*no-preference\)\s*\{(?:[^{}]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\})*[^{}]*\}/g, '')
    expect(still).not.toMatch(/animation\s*:\s*(?!none)[a-z]/)
    expect(still).not.toMatch(/transition\s*:\s*(?!none)[a-z]/)
    expect(sheet).not.toContain('infinite')
  })
})
