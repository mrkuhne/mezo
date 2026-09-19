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

/** A verdikt-létra szó szerint a prototípusból; az első sor, aminek a küszöbét elérjük. */
const VERDICTS: Array<[number, string]> = [
  [5, 'Hibátlan választás.'],
  [4, 'Erős tányér.'],
  [3, 'Rendben van.'],
  [2, 'Ez is számít.'],
  [0, 'Rögzítve — minden adat segít.'],
]

export function mealVerdict(stars: number): string {
  return (VERDICTS.find(([min]) => stars >= min) ?? VERDICTS[VERDICTS.length - 1])[1]
}
