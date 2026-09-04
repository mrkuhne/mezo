export interface FuelSettingsTargetInput {
  kcal: number
  p: number
  c: number
  f: number
}

export interface FuelSettingsMacroPreview {
  kcal: number
  protein: { grams: number; pct: number }
  carbs: { grams: number; pct: number }
  fat: { grams: number; pct: number }
}

interface WeightedMacro {
  grams: number
  energy: number
  order: number
  pct: number
  remainder: number
}

/**
 * Formats the already active goal-engine target for the settings preview. It deliberately does
 * not project a diet draft: new gram targets only become truthful after the server saves and
 * recomputes them.
 */
export function buildFuelSettingsMacroPreview(
  targets: FuelSettingsTargetInput,
): FuelSettingsMacroPreview | null {
  const values = [targets.kcal, targets.p, targets.c, targets.f]
  if (values.some((value) => !Number.isFinite(value) || value < 0)) return null

  const macros: WeightedMacro[] = [
    { grams: targets.p, energy: targets.p * 4, order: 0, pct: 0, remainder: 0 },
    { grams: targets.c, energy: targets.c * 4, order: 1, pct: 0, remainder: 0 },
    { grams: targets.f, energy: targets.f * 9, order: 2, pct: 0, remainder: 0 },
  ]
  const totalEnergy = macros.reduce((sum, macro) => sum + macro.energy, 0)
  if (totalEnergy <= 0) return null

  for (const macro of macros) {
    const exact = macro.energy / totalEnergy * 100
    macro.pct = Math.floor(exact)
    macro.remainder = exact - macro.pct
  }

  let pointsLeft = 100 - macros.reduce((sum, macro) => sum + macro.pct, 0)
  const byRemainder = [...macros].sort((a, b) =>
    b.remainder - a.remainder || a.order - b.order)
  for (let index = 0; index < pointsLeft; index += 1) {
    byRemainder[index].pct += 1
  }

  return {
    kcal: targets.kcal,
    protein: { grams: targets.p, pct: macros[0].pct },
    carbs: { grams: targets.c, pct: macros[1].pct },
    fat: { grams: targets.f, pct: macros[2].pct },
  }
}
