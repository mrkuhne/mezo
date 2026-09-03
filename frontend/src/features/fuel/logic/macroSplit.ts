// macroSplit — a single meal's OWN macro composition (mezo-tjua). The logged-meal surfaces used to
// frame a meal against the day's macro keret ("30% napi" on a window ring, "Kcal a napi 24.5%-a"
// under the score sheet's macro bar); a LOGGED meal now prints what it is MADE OF instead: the
// P/C/F share of its own energy. Pure: no React, no ambient time — the keretHero.ts/fuelSwimlane.ts
// pattern.

/** Atwater factors — the energy each macro gram carries. */
const KCAL_PER_G = { p: 4, c: 4, f: 9 } as const

export interface MacroSplit { p: number; c: number; f: number }

/**
 * P/C/F share of the meal's OWN macro energy, as whole percents summing to exactly 100
 * (largest-remainder, so a 33.3/33.3/33.3 meal reads 34/33/33 rather than 33/33/33).
 * A missing gram value counts as 0; a meal with no macro energy at all (all null/zero — the
 * wire hasn't filled the row yet) returns null, never a fabricated 0/0/0 or a NaN.
 */
export function macroSplit(macros: {
  p?: number | null
  c?: number | null
  f?: number | null
}): MacroSplit | null {
  const kcal = {
    p: (macros.p ?? 0) * KCAL_PER_G.p,
    c: (macros.c ?? 0) * KCAL_PER_G.c,
    f: (macros.f ?? 0) * KCAL_PER_G.f,
  }
  const total = kcal.p + kcal.c + kcal.f
  if (total <= 0) return null

  const exact = { p: (kcal.p / total) * 100, c: (kcal.c / total) * 100, f: (kcal.f / total) * 100 }
  const split: MacroSplit = { p: Math.floor(exact.p), c: Math.floor(exact.c), f: Math.floor(exact.f) }
  let remainder = 100 - (split.p + split.c + split.f)
  // Hand the leftover points to the largest fractional parts, P→C→F on a tie (stable order, so
  // the same meal never renders two different splits between surfaces).
  const order = (['p', 'c', 'f'] as const)
    .slice()
    .sort((a, z) => (exact[z] - Math.floor(exact[z])) - (exact[a] - Math.floor(exact[a])))
  for (const key of order) {
    if (remainder <= 0) break
    split[key] += 1
    remainder -= 1
  }
  return split
}
