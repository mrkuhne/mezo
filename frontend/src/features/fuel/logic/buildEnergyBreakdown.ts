import { blockKcal, type PlannerBlock } from '@/features/fuel/logic/buildDayPlan'
import type { EnergyBreakdown } from '@/features/fuel/sheets/EnergyBreakdownSheet'

const KG_KCAL = 7700 // kcal per kg body fat — fallback rate ↔ daily-deficit relationship
const DEFAULT_RUN_MIN = 40
const DEFAULT_BLOCK_MIN = 60

/**
 * Fuel-side adapter: today's dynamic energy (`plan.energy`) + today's training blocks + the current
 * prescription segment → the {@link EnergyBreakdown} the shared sheet renders. Returns null on the
 * static path (no `tdeeBootstrap`) — there is nothing to explain then. The deficit section is present
 * only when the day carries a goal balance (`energy.balance !== 0`); `rateKgPerWk` is the absolute
 * weekly rate (from the segment, else derived via 7700÷7). Per-block kcal reuses the planner's `blockKcal`.
 */
export function buildEnergyBreakdown(input: {
  energy: { base: number; activity: number; balance: number; target: number }
  blocks: PlannerBlock[]
  weightKg: number
  tdeeBootstrap: { bmr: number; neat: number; formula: 'KATCH' | 'MSJ' } | null | undefined
  segment: { dailyEnergyBalanceKcal?: number; projectedRateKgPerWk?: number; label?: string; rationale?: string | null } | null
  activityLabel: string
  goalLabel: string
}): EnergyBreakdown | null {
  const { energy, blocks, weightKg, tdeeBootstrap: tb, segment, activityLabel, goalLabel } = input
  if (!tb) return null

  const deficit = energy.balance !== 0
    ? {
        kcal: energy.balance,
        rateKgPerWk: Math.abs(segment?.projectedRateKgPerWk ?? (energy.balance * 7) / KG_KCAL),
        goalLabel: segment?.label || goalLabel,
        rationale: segment?.rationale ?? undefined,
      }
    : undefined

  return {
    base: { kcal: energy.base, bmr: tb.bmr, neat: tb.neat, neatLabel: activityLabel, formula: tb.formula },
    movement: {
      kcal: energy.activity,
      isWeeklyAvg: false,
      blocks: blocks.map(b => ({
        label: b.label,
        kind: b.kind,
        min: b.durationMin ?? (b.kind === 'run' ? DEFAULT_RUN_MIN : DEFAULT_BLOCK_MIN),
        kcal: Math.round(blockKcal(b.kind, b.durationMin, weightKg)),
      })),
    },
    deficit,
    target: energy.target,
  }
}
