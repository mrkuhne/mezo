import type { PlannerBlock } from '@/features/fuel/logic/buildDayPlan'
import { blockEnergyKind, DEFAULT_GYM_MIN, DEFAULT_RUN_MIN, netKcal, restKcalPerHour } from '@/data/train/activityEnergy'
import type { EnergyBlock, EnergyBreakdown } from '@/features/fuel/sheets/EnergyBreakdownSheet'

const KG_KCAL = 7700 // kcal per kg body fat — fallback rate ↔ daily-deficit relationship

/**
 * Fuel-side adapter: the day's SERVED energy (`budget.energy`, mezo-32m82) + today's planned training
 * blocks + the current prescription segment → the {@link EnergyBreakdown} the shared sheet renders.
 * Returns null on the static path (no `tdeeBootstrap`) — there is nothing to explain then. Movement is
 * the served planned share + the unplanned credit; the planned share is the weekly plan's part of the
 * day, so the sheet reads it as the weekly schedule, and a non-zero credit gets its own
 * „Terven kívüli mozgás" line. The deficit section is present only when the day carries a goal
 * balance (`energy.balance !== 0`); `rateKgPerWk` is the absolute weekly rate (from the segment, else
 * derived via 7700÷7). Per-block kcal are previews from the net activity-energy mirror
 * (`activityEnergy.netKcal`) at rest BMR/24.
 */
export function buildEnergyBreakdown(input: {
  energy: { base: number; planned: number; extra: number; balance: number; target: number }
  blocks: PlannerBlock[]
  weightKg: number
  tdeeBootstrap: { bmr: number; neat: number; formula: 'KATCH' | 'MSJ' } | null | undefined
  segment: { dailyEnergyBalanceKcal?: number; projectedRateKgPerWk?: number; label?: string; rationale?: string | null } | null
  activityLabel: string
  goalLabel: string
}): EnergyBreakdown | null {
  const { energy, blocks, weightKg, tdeeBootstrap: tb, segment, activityLabel, goalLabel } = input
  if (!tb) return null
  const restPerHour = restKcalPerHour(tb.bmr, weightKg)

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
      kcal: energy.planned + energy.extra,
      isWeeklyAvg: true,
      blocks: [
        ...blocks.map((b): EnergyBlock => {
          const min = b.durationMin ?? (b.kind === 'run' ? DEFAULT_RUN_MIN : DEFAULT_GYM_MIN)
          return { label: b.label, kind: b.kind, min, kcal: netKcal(blockEnergyKind(b), null, min, restPerHour) ?? 0 }
        }),
        ...(energy.extra > 0 ? [{ label: 'Terven kívüli mozgás', kind: 'extra' as const, min: null, kcal: energy.extra }] : []),
      ],
    },
    deficit,
    target: energy.target,
  }
}
