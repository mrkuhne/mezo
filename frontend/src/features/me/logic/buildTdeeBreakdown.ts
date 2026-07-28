import type { BiometricProfileResponse } from '@/data/me/biometricProfileApi'
import { ACTIVITY_SHORT, type ActivityLevel } from '@/features/me/logic/biometricFields'
import type { EnergyBreakdown } from '@/features/fuel/sheets/EnergyBreakdownSheet'

/**
 * Profile-side adapter (mezo-hobb): the persisted TDEE bootstrap (weekly model) → an
 * {@link EnergyBreakdown} with NO deficit section — the Profile card is about maintenance, not the
 * day's goal. Movement is the weekly-averaged scheduled EAT (`weeklyEatKcalPerDay`), flagged
 * `isWeeklyAvg` so the sheet shows the "heti átlag" tile instead of today's per-activity pills.
 * Returns null before the engine has run (no `tdeeBootstrap`).
 */
export function buildTdeeBreakdown(profile: BiometricProfileResponse): EnergyBreakdown | null {
  const tb = profile.tdeeBootstrap
  if (!tb) return null
  const label = profile.activityLevel ? ACTIVITY_SHORT[profile.activityLevel as ActivityLevel] : ''
  return {
    base: { kcal: tb.neatBaselineKcal, bmr: tb.bmr, neat: tb.neat, neatLabel: label, formula: tb.formula },
    movement: { kcal: tb.weeklyEatKcalPerDay, isWeeklyAvg: true },
    target: tb.tdee,
  }
}
