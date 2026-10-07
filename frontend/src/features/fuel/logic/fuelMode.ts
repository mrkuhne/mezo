// ============================================================
// Mezo · fuelMode — how Fuel behaves during a kímélő-mód period (Kihagyás S3, mezo-q4xt2.3).
// Mock mode derives the served `fuelMode` / `skippedKcal` from these (real mode reads the server's).
// ============================================================
import type { SkipReason, PlannedSkip } from '@/features/train/logic/plannedSkips'
import type { RecoveryState } from '@/data/train/recoveryApi'

export type FuelMode = 'GUIDANCE' | 'MAINTENANCE' | 'ESTIMATE'

export const fuelModeOf = (category: SkipReason): FuelMode | null => {
  switch (category) {
    case 'ILLNESS':
    case 'STOMACH': return 'GUIDANCE'
    case 'INJURY': return 'MAINTENANCE'
    case 'TRAVEL': return 'ESTIMATE'
    default: return null
  }
}

/** The recovery period covering `date` — start … endedOn−1, open-ended while open; per-day
 *  releases are ignored (a released training day is still a recovery day for Fuel). */
export function recoveryPeriodOn(state: RecoveryState | null | undefined, date: string) {
  const p = state?.period
  if (!p || date < p.startDate) return null
  if (p.endedOn && date >= p.endedOn) return null
  return p
}

/** Mock derivation of the day's served recovery fields. */
export function recoveryFuelFields(state: RecoveryState | null | undefined, date: string): {
  fuelMode: FuelMode | null; recoveryCategory: SkipReason | null; recoveryDay: number | null
} {
  const p = recoveryPeriodOn(state, date)
  if (!p) return { fuelMode: null, recoveryCategory: null, recoveryDay: null }
  const [sy, sm, sd] = p.startDate.split('-').map(Number)
  const [y, m, d] = date.split('-').map(Number)
  const day = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(sy, sm - 1, sd)) / 86_400_000) + 1
  return { fuelMode: fuelModeOf(p.category), recoveryCategory: p.category, recoveryDay: day }
}

/** Mock derivation of `skippedKcal`: Σ planned kcal of the date's MEAL skips, clamped to the
 *  target; 0 in GUIDANCE (the day is not budgeted there). */
export function skippedKcalOn(skips: readonly PlannedSkip[], date: string, mode: FuelMode | null, targetKcal: number): number {
  if (mode === 'GUIDANCE') return 0
  const sum = skips
    .filter((s) => s.kind === 'MEAL' && s.date === date)
    .reduce((a, s) => a + (s.plannedKcal ?? 0), 0)
  return Math.max(0, Math.min(sum, targetKcal))
}
