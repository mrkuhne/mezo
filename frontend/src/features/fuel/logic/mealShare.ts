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
//
// --- mezo-l2gp0: a Mai kártya arány-gyűrűinek tiszta matekja ---------------------------
// P/Ch/Zs gyűrű: a makró részesedése az étkezés SAJÁT, grammokból számolt (Atwater 4/4/9)
// energiájából — a részletlap arány-gyűrűinek szemantikája, kártya-léptékben. A napi célhoz
// mért per-étkezés ív a gyakorlatban üresnek látszott (owner, v1 elvetve).
// Rost gyűrű: a NAPI rost-adagból fedezett rész — a rostnak nincs energia-aránya.
//
// Őszinte-null: ha bármely makró hiányzik, EGYIK arány sem számolható (csonka összetételre
// nem állítunk tényt); a csupa-0 összetétel 0/0 → null. A hívó a grammot ettől még mutatja.
//
// `mealMacroShare` (largest-remainder, mindig pontosan 100-ra jön ki) és `macroEnergyShares`
// (független kerekítés makrónként, ~100 körül, őszinte-null bármely hiányzó makróra)
// szándékosan élnek egymás mellett — más felület, más szemantika, más matek.
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

export interface MacroShares { p: number | null; c: number | null; f: number | null }

const NONE: MacroShares = { p: null, c: null, f: null }

/** Egész százalék (0–100) makrónként az étkezés makró-energiájából; null-hármas, ha nem számolható. */
export function macroEnergyShares(row: {
  proteinG: number | null; carbsG: number | null; fatG: number | null
}): MacroShares {
  const { proteinG, carbsG, fatG } = row
  if (proteinG == null || carbsG == null || fatG == null) return NONE
  const p = proteinG * 4
  const c = carbsG * 4
  const f = fatG * 9
  const total = p + c + f
  if (total <= 0) return NONE
  return {
    p: Math.round((p / total) * 100),
    c: Math.round((c / total) * 100),
    f: Math.round((f / total) * 100),
  }
}

/** A napi rost-adagból fedezett rész egész százalékban, 100-ra vágva; őszinte-null. */
export function fiberSharePct(fiberG: number | null, targetG: number): number | null {
  if (fiberG == null || targetG <= 0) return null
  return Math.min(100, Math.round((fiberG / targetG) * 100))
}
