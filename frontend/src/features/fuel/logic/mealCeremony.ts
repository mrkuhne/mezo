// ============================================================
// Mezo · A kaja-ünneplés pontszám-matekja — tiszta, React-mentes (mezo-bqwyo).
//
// A prototípus `food.js` `mealStars`/`VERDICTS` sora portolva (docs/design_2.0/prototypes/
// companion-titanium/food.js:55-57), a ceremónia-minta §„Star mapping (meal)" szerint.
//
// EGY eltérés a prototípustól, és az adat miatt: a ház étkezés-pontszáma 0..1 a dróton
// (`MealResponse.score.value`, a Fuel felületek `score * 100`-at mutatnak), a prototípus
// viszont 0..10-es skálán gondolkodik. A váltás ITT történik, egy helyen.
// ============================================================
import { m } from '@/shared/i18n'

/** A dróton érkező 0..1 pontszám a minta 0..10-es skáláján. */
export function scoreOutOfTen(score01: number): number {
  return Math.round(score01 * 100) / 10
}

/**
 * Egész csillagok 1..5, FELFELÉ kerekítve (minta §Star mapping): 8,3 → 5 · 7,4 → 4 · 5,2 → 3.
 * Pontszám nélkül nincs csillag — a hívó ilyenkor ceremóniát sem nyit (őszinte-null).
 */
export function mealStars(scoreOutOf10: number): number {
  return Math.max(1, Math.min(5, Math.ceil(scoreOutOf10 / 2)))
}

/** A verdikt-létra a prototípusból (fuel.js `mealVerdict`); a szöveg HÍVÁSKOR olvasódik a katalógusból (`fuelLog.cer.verdict`),
 *  így a nyelvváltást követi. Csillag és ítélet EGY függvény-párból jön (`mealStars` → `mealVerdict`). */
export function mealVerdict(stars: number): string {
  const V = m().fuelLog.cer.verdict
  return stars >= 5 ? V.s5 : stars >= 4 ? V.s4 : stars >= 3 ? V.s3 : stars >= 2 ? V.s2 : V.s1
}
