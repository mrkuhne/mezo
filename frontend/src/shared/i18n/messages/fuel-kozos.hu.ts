// Fuel · shared words (Folyadék F5, mezo-n4wf5.5): what the Fuel-shared pieces (`features/fuel/components/folyadek`) print and the
// labels several Fuel areas read. Owned by the foundation — an area builder ADDS keys only to its own `fuel-<area>` file and reports
// a word it misses here. Wording = the approved prototype's `L(hu, en)` pairs (docs/design_2.0/prototypes/vilagos/fuel.js).
export const fuelKozosHu = {
  macro: { protein: 'Fehérje', carbs: 'Szénhidrát', fat: 'Zsír', fiber: 'Rost', water: 'Víz' },
  macroLower: { protein: 'fehérje', carbs: 'szénhidrát', fat: 'zsír', fiber: 'rost' },
  macroShort: { protein: 'feh.', carbs: 'szénh.', fat: 'zsír', fiber: 'rost' },
  // the four stored facts of a line / a meal (`nutri`)
  facts: { fiber: 'rost', sugar: 'cukor', salt: 'só', satFat: 'tel. zsír' },
  factsLong: { fiber: 'Rost', sugar: 'Cukor', salt: 'Só', satFat: 'Telített zsír' },
  unit: { serving: 'adag', item: 'tétel' },
  noData: 'nincs adat',
  budget: 'keret',
  // the day's bowl (`bowlHero` / `dayBowl`)
  bowl: {
    eaten: 'kcal-t ettél',
    budgetLine: (kcal: string) => `keret ${kcal} kcal`,
    empty: 'Üres tál',
    aria: (eaten: string, target: string) => `${eaten} / ${target} kcal`,
    ariaSkipped: (eaten: string, target: string, skipped: string) => `${eaten} / ${target} kcal, ebből ${skipped} kcal kihagyva`,
  },
  // a window's small cup (`slotCup`)
  cup: {
    logged: (kcal: string, budget: string) => `Logolva: ${kcal} / ${budget} kcal`,
    loggedPct: (kcal: string, budget: string, pct: number) => `Logolva: ${kcal} / ${budget} kcal (${pct}%)`,
    budget: (budget: string) => `Keret: ${budget} kcal`,
  },
  // the three macro vials (`macroVials`)
  vials: {
    share: (pct: number) => `${pct}% energia`,
    aria: (name: string, grams: string, pct: number) => `${name}: ${grams} g · az energia ${pct}%-a`,
  },
  // a meal's four small capsules (`mealCells`)
  cells: {
    aria: (p: string, ps: number, c: string, cs: number, f: string, fs: number, fiber: string) =>
      `fehérje ${p} g, az étkezés energiájának ${ps}%-a; szénhidrát ${c} g, ${cs}%; zsír ${f} g, ${fs}%; rost ${fiber}`,
    fiber: (grams: string, pct: number) => `${grams} g, a napi adag ${pct}%-a`,
    // a meal with a missing macro gram: each capsule names what it knows
    known: (name: string, grams: string) => `${name} ${grams} g`,
    none: (name: string) => `${name} nincs adat`,
  },
  score: {
    pending: 'folyamatban',
    aria: (score: string) => `Mezo értékelése: ${score}`,
  },
  // the blood sugar response: three bands, never a number
  gly: {
    level: { low: 'alacsony', mid: 'közepes', high: 'magas' },
    levelCap: { low: 'Alacsony', mid: 'Közepes', high: 'Magas' },
    chipAria: (word: string) => `Vércukor-válasz: ${word}`,
    bandAria: (word: string) => `Vércukor-válasz sávja: ${word}`,
  },
  // where a line of a meal comes from (`TAGL`) and the marks beside it
  source: { pantry: 'kamra', recipe: 'recept', estimate: 'becslés', ai: 'AI', review: 'nézd át' },
  // NOVA short names (`NOVA`), keyed by the group number
  nova: { n1: 'Alapanyag', n2: 'Konyhai összetevő', n3: 'Feldolgozott', n4: 'Ultra-feldolgozott' },
  // an editable line (`lineCard` / `cLine`)
  line: {
    remove: (name: string) => `${name} eltávolítása`,
    amount: (name: string) => `${name} mennyisége`,
  },
  gentle: 'Kímélő mód',
}
