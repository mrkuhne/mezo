// ============================================================
// Mezo · mealShare tests (Fuel Titanium S1b, mezo-33k6) — az étkezés SAJÁT összetétele.
// Owner-döntés: a részletező oldal gyűrűi nem a napi célhoz mérnek, hanem azt mondják el,
// miből áll a tányér. Ezért a három szám 100%-ra jön ki — és ha bármelyik makró ismeretlen,
// EGYIK sem kap százalékot (egy ismeretlen egészből nem lehet részt számolni).
// ============================================================
import { expect, test } from 'vitest'
import { mealMacroShare } from '@/features/fuel/logic/mealShare'

test('a három makró energiából számolt aránya pontosan 100%', () => {
  const rows = mealMacroShare({ p: 30, c: 40, f: 12 })
  expect(rows.map(r => r.key)).toEqual(['p', 'c', 'f'])
  expect(rows.map(r => r.label)).toEqual(['Fehérje', 'Szénhidrát', 'Zsír'])
  expect(rows.reduce((s, r) => s + (r.pct ?? 0), 0)).toBe(100)
  // 120 / 160 / 108 kcal (4·4·9) → 31 / 41 / 28
  expect(rows.map(r => r.pct)).toEqual([31, 41, 28])
  expect(rows.map(r => r.grams)).toEqual([30, 40, 12])
})

test('ismeretlen makró esetén egyetlen százalék sem születik, a grammok maradnak', () => {
  const rows = mealMacroShare({ p: 30, c: 40, f: null })
  expect(rows.map(r => r.pct)).toEqual([null, null, null])
  expect(rows.map(r => r.grams)).toEqual([30, 40, null])
})

test('makró-energia nélküli étkezés nem hazudik 0/0/0-t', () => {
  const rows = mealMacroShare({ p: 0, c: 0, f: 0 })
  expect(rows.map(r => r.pct)).toEqual([null, null, null])
  expect(rows.map(r => r.grams)).toEqual([0, 0, 0])
})
