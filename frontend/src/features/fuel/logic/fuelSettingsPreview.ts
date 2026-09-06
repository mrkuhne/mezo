import { DIET_SPLIT_PRESETS, PROTEIN_TIER_G_PER_KG_BW } from '@/data/fuel/fuelConfig'
import type { DietSettings } from '@/data/types'

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
 * Formats a target set for the settings preview donut: energy shares as whole percents that sum
 * to exactly 100 (largest-remainder), plus the grams as-is. The input is either the active
 * goal-engine target or a draft projection (`projectDraftTargets` / the server preview) — this
 * function only presents numbers, it never derives them.
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

/**
 * MOCK-MODE ONLY draft projection (mezo-u2pd). Real mode gets its numbers from
 * `POST /api/diet/settings/preview`, which runs the actual goal engine; mock mode has no engine,
 * so it re-derives the draft's macros from the currently served targets using the same SHAPE the
 * engine uses — fat = split share of kcal, protein = the tier's g/kg band endpoint (scaled off
 * the base, whose grams were produced under `savedTier`), carbs = the energy remainder:
 *
 * - kcal is carried over unchanged. The engine's `dayTypeShiftKcal` redistribution is NOT modelled
 *   here — mock mode has no prescription to re-segment, and the weekly frame is unchanged anyway.
 * - the ISSN fat floor (0.5 g/kg BW) is NOT applied: mock mode has no body weight. A very low
 *   kcal + low_fat draft can therefore show a slightly lower fat than the engine would prescribe.
 *
 * Both deviations are mock fictions by construction, matching the rest of the mock seed; the
 * constants it does use are drift-guarded against application.yml (dietSplitDriftGuard.test.ts).
 */
export function projectDraftTargets(
  base: FuelSettingsTargetInput,
  draft: Pick<DietSettings, 'splitPreset' | 'fatPctX10' | 'proteinTier'>,
  savedTier: DietSettings['proteinTier'],
): FuelSettingsTargetInput {
  // A custom split with no fat% yet falls back to balanced — the engine's `fatShareFor` default.
  const customShare = draft.fatPctX10 == null ? DIET_SPLIT_PRESETS.balanced : draft.fatPctX10 / 1000
  const share = draft.splitPreset === 'custom'
    ? customShare
    : DIET_SPLIT_PRESETS[draft.splitPreset]
  const proteinScale =
    PROTEIN_TIER_G_PER_KG_BW[draft.proteinTier] / PROTEIN_TIER_G_PER_KG_BW[savedTier]
  const p = Math.round(base.p * proteinScale)
  const f = Math.round(base.kcal * share / 9)
  return { kcal: base.kcal, p, f, c: Math.max(0, Math.round((base.kcal - 4 * p - 9 * f) / 4)) }
}
