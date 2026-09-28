import { DRAWER_PREVIEW_ROWS, MAX_RISE_DELAY_MS, drawerRows, hasRareTraces, patternBreakdown, riseDelay } from './discoveryDrawers'

const p = (event: string, i = 0) => ({ pairKey: `k${event}${i}`, title: `T${i}`, event })

describe('discoveryDrawers (mezo-p87ok)', () => {
  test('patternBreakdown reads biggest news first and skips absent kinds', () => {
    expect(patternBreakdown([p('confirmed'), p('promoted'), p('promoted', 1), p('confirmed', 1)]))
      .toBe('2 előléptetve · 2 megerősítve')
    expect(patternBreakdown([p('reinforced')])).toBe('1 erősödött')
    expect(patternBreakdown([p('mystery')])).toBe('')
  })

  test('drawerRows previews the head and opens to everything', () => {
    const items = Array.from({ length: 23 }, (_, i) => i)
    expect(drawerRows(items, false)).toEqual([0, 1, 2])
    expect(drawerRows(items, false)).toHaveLength(DRAWER_PREVIEW_ROWS)
    expect(drawerRows(items, true)).toHaveLength(23)
  })

  test('riseDelay staggers but never past the cap', () => {
    expect(riseDelay(0)).toBe(40)
    expect(riseDelay(1)).toBe(70)
    expect(riseDelay(71)).toBe(MAX_RISE_DELAY_MS)
  })

  test('hasRareTraces', () => {
    const empty = { patterns: [], newFacts: [], lifeEvents: [], memoir: false, predictions: [] }
    expect(hasRareTraces(empty)).toBe(false)
    expect(hasRareTraces({ ...empty, memoir: true })).toBe(true)
  })
})
