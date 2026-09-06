import { describe, expect, test } from 'vitest'
import { DIET_SPLIT_PRESETS, PROTEIN_TIER_G_PER_KG_BW } from '@/data/fuel/fuelConfig'
import { DIET_SETTINGS_GHOST } from '@/data/fuel/dietSettingsHooks'

// DRIFT-GUARD (Diet Plan slice 1): these MUST match backend `mezo.goal.diet` + `mezo.diet-settings`
// in application.yml. If you change one side, change the other — this test is the tripwire.
const BACKEND_FAT_SHARES = { balanced: 0.275, low_fat: 0.2, low_carb: 0.4, high_carb: 0.22 }
const BACKEND_PROTEIN_TIERS = { moderate: 2.0, high: 2.2 }
const BACKEND_GHOST = {
  splitPreset: 'balanced', proteinPctX10: null, carbsPctX10: null, fatPctX10: null,
  proteinTier: 'moderate', waterMl: 4000, fiberG: 30, dayTypeShiftKcal: 0,
}

describe('diet split FE↔backend drift-guard', () => {
  test('fuelConfig.DIET_SPLIT_PRESETS mirrors mezo.goal.diet fat shares', () => {
    expect(DIET_SPLIT_PRESETS).toEqual(BACKEND_FAT_SHARES)
  })
  test('PROTEIN_TIER_G_PER_KG_BW mirrors mezo.goal.protein g/kg BW band endpoints', () => {
    expect(PROTEIN_TIER_G_PER_KG_BW).toEqual(BACKEND_PROTEIN_TIERS)
  })
  test('DIET_SETTINGS_GHOST mirrors the mezo.diet-settings config ghost', () => {
    expect(DIET_SETTINGS_GHOST).toEqual(BACKEND_GHOST)
  })
})
