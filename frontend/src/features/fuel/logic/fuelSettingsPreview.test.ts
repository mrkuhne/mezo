import { describe, expect, test } from 'vitest'
import { buildFuelSettingsMacroPreview } from '@/features/fuel/logic/fuelSettingsPreview'

describe('buildFuelSettingsMacroPreview', () => {
  test('builds the current target preview from macro energy', () => {
    expect(buildFuelSettingsMacroPreview({ kcal: 3100, p: 220, c: 380, f: 95 })).toEqual({
      kcal: 3100,
      protein: { grams: 220, pct: 27 },
      carbs: { grams: 380, pct: 47 },
      fat: { grams: 95, pct: 26 },
    })
  })

  test('uses deterministic largest-remainder rounding to total exactly 100 percent', () => {
    const preview = buildFuelSettingsMacroPreview({ kcal: 1000, p: 1, c: 1, f: 1 })

    expect(preview).not.toBeNull()
    expect(preview!.protein.pct + preview!.carbs.pct + preview!.fat.pct).toBe(100)
    expect(preview).toMatchObject({
      protein: { pct: 24 },
      carbs: { pct: 23 },
      fat: { pct: 53 },
    })
  })

  test('does not mutate the supplied targets', () => {
    const targets = Object.freeze({ kcal: 2400, p: 180, c: 260, f: 70 })

    buildFuelSettingsMacroPreview(targets)

    expect(targets).toEqual({ kcal: 2400, p: 180, c: 260, f: 70 })
  })

  test.each([
    { kcal: 0, p: 0, c: 0, f: 0 },
    { kcal: 2000, p: -1, c: 200, f: 70 },
    { kcal: Number.NaN, p: 150, c: 200, f: 70 },
  ])('returns null for an unusable target set: %o', (targets) => {
    expect(buildFuelSettingsMacroPreview(targets)).toBeNull()
  })
})
