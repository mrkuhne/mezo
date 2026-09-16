// ============================================================
// Mezo · mealShare tests (mezo-l2gp0) — a Mai kártya arány-gyűrűinek tiszta matekja.
// P/Ch/Zs: az étkezés SAJÁT (Atwater 4/4/9) energiájának részesedése; rost: napi adag része.
// ============================================================
import { expect, test } from 'vitest'
import { macroEnergyShares, fiberSharePct } from '@/features/fuel/logic/mealShare'

test('a makró-arányok az étkezés energiájából számolódnak (4/4/9)', () => {
  // 36 g P (144 kcal) + 48 g C (192) + 9 g F (81) = 417 kcal
  expect(macroEnergyShares({ proteinG: 36, carbsG: 48, fatG: 9 })).toEqual({ p: 35, c: 46, f: 19 })
})

test('a 0 g valódi nulla: 0%-os arány, nem null', () => {
  // banán: 1 g P (4) + 23 g C (92) + 0 g F (0) = 96 kcal
  expect(macroEnergyShares({ proteinG: 1, carbsG: 23, fatG: 0 })).toEqual({ p: 4, c: 96, f: 0 })
})

test('hiányzó makró mellett NINCS arány — csonka összetételre nem számolunk', () => {
  expect(macroEnergyShares({ proteinG: 36, carbsG: null, fatG: 9 })).toEqual({ p: null, c: null, f: null })
})

test('csupa nulla grammból nincs arány (0/0)', () => {
  expect(macroEnergyShares({ proteinG: 0, carbsG: 0, fatG: 0 })).toEqual({ p: null, c: null, f: null })
})

test('a rost a napi adag része, 100-ra vágva', () => {
  expect(fiberSharePct(8, 30)).toBe(27)
  expect(fiberSharePct(45, 30)).toBe(100)
  expect(fiberSharePct(0, 30)).toBe(0)
})

test('rost őszinte-null: hiányzó gramm vagy értelmetlen cél → null', () => {
  expect(fiberSharePct(null, 30)).toBeNull()
  expect(fiberSharePct(8, 0)).toBeNull()
})
