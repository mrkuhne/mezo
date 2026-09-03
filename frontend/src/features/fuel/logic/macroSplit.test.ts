import { macroSplit } from '@/features/fuel/logic/macroSplit'

describe('macroSplit', () => {
  it('shares the meal energy by the Atwater factors, not by grams', () => {
    // 30 g P (120 kcal) · 30 g C (120 kcal) · 20 g F (180 kcal) = 420 kcal
    expect(macroSplit({ p: 30, c: 30, f: 20 })).toEqual({ p: 29, c: 28, f: 43 })
  })

  it('always sums to exactly 100', () => {
    for (const m of [
      { p: 33, c: 33, f: 14.67 },
      { p: 32, c: 50, f: 10 },
      { p: 1, c: 1, f: 1 },
      { p: 7, c: 13, f: 3 },
    ]) {
      const split = macroSplit(m)!
      expect(split.p + split.c + split.f).toBe(100)
    }
  })

  it('treats a missing macro as zero', () => {
    expect(macroSplit({ p: 25, c: null, f: undefined })).toEqual({ p: 100, c: 0, f: 0 })
  })

  it('returns null when the meal carries no macro energy at all', () => {
    expect(macroSplit({ p: 0, c: 0, f: 0 })).toBeNull()
    expect(macroSplit({})).toBeNull()
  })
})
