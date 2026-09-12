// ============================================================
// Mezo · mealShare (Fuel Titanium S1b, mezo-33k6) — EGY étkezés saját makró-összetétele,
// a részletező oldal gyűrűihez. Owner-döntés: a meal-oldalon a gyűrűk nem a napi célhoz
// mérnek („a nap céljához mérve" feliratot is elhagyjuk), hanem azt mondják el, MIBŐL áll
// a tányér — ezért a három szám 100%-ra jön ki.
//
// A százalékot a már létező `macroSplit` adja (mezo-tjua), ugyanaz a largest-remainder
// szabály, amit a logolt ablak-gyűrűk használnak — két felület, egy aritmetika.
//
// Őszinte-null: ha BÁRMELYIK makró ismeretlen, egyetlen százalék sem születik. Egy
// ismeretlen egészből nem lehet részt számolni, és a többit felnagyítani épp a hiányt
// rejtené el. A grammok ilyenkor is látszanak, a hiányzó „—".
// Pure: nincs React, nincs ambient idő (a logic/ réteg szabálya).
// ============================================================
import { macroSplit } from '@/features/fuel/logic/macroSplit'

export interface MealShareRow {
  key: 'p' | 'c' | 'f'
  label: string
  grams: number | null
  /** A makró részesedése az étkezés SAJÁT energiájából; null = nem számolható (honest-null). */
  pct: number | null
}

const LABEL: Record<MealShareRow['key'], string> = {
  p: 'Fehérje',
  c: 'Szénhidrát',
  f: 'Zsír',
}

export function mealMacroShare(meal: {
  p?: number | null
  c?: number | null
  f?: number | null
}): MealShareRow[] {
  const grams = { p: meal.p ?? null, c: meal.c ?? null, f: meal.f ?? null }
  const complete = grams.p != null && grams.c != null && grams.f != null
  const split = complete ? macroSplit(grams) : null
  return (['p', 'c', 'f'] as const).map(key => ({
    key,
    label: LABEL[key],
    grams: grams[key],
    pct: split ? split[key] : null,
  }))
}
