import type { PlannerBlock } from '@/features/fuel/logic/buildDayPlan'
import { blockEnergyKind, DEFAULT_GYM_MIN, DEFAULT_RUN_MIN, netKcal, restKcalPerHour } from '@/data/train/activityEnergy'
import type { EnergyBlock, EnergyBreakdown } from '@/features/fuel/sheets/EnergyBreakdownSheet'

const KG_KCAL = 7700 // kcal per kg body fat — fallback rate ↔ daily-deficit relationship

/**
 * Fuel-side adapter: the day's SERVED energy (`budget.energy`, mezo-32m82) + today's training blocks
 * (reconciled with what was actually logged, mezo-tb3s2) + the current prescription segment → the
 * {@link EnergyBreakdown} the shared sheet renders. Returns null on the static path (no
 * `tdeeBootstrap`) — there is nothing to explain then. Movement is the served LOGGED planned share +
 * the unplanned logged credit (`isWeeklyAvg: false` — this is never a weekly average, only the Én
 * hub's own `buildTdeeBreakdown` still produces that shape); the sheet's summands are exactly the
 * served parts („Tervezett edzés · logolva" + a non-zero „Terven kívüli mozgás"), so its row closes.
 * Today's blocks ride along as informational previews, never as summands — each carries `done`
 * (mezo-tb3s2): true for a block that was actually logged, false for a still-scheduled one that has
 * not been logged yet, so the sheet can preview it separately as "még jön". `pending` mirrors the
 * served day's `energy.pending` (today's not-yet-logged planned sessions' estimated kcal, display
 * only — never a summand of `kcal`). The deficit section is present only when the day carries a goal
 * balance (`energy.balance !== 0`); `rateKgPerWk` is the absolute weekly rate (from the segment, else
 * derived via 7700÷7). Per-block kcal are previews from the net activity-energy mirror
 * (`activityEnergy.netKcal`) at rest BMR/24.
 */
export function buildEnergyBreakdown(input: {
  energy: {
    base: number; planned: number; extra: number; balance: number; target: number
    /** Today's not-yet-logged planned sessions' estimated kcal (mezo-tb3s2) — display only. */
    pending?: number
    /** Learned-base provenance (mezo-zz91i) — the served day's own `FuelDayEnergy.baseSource` et al. */
    source?: 'formula' | 'learned'
    formulaBase?: number | null
    sd?: number | null
    confidence?: 'low' | 'medium' | 'high' | null
  }
  blocks: (PlannerBlock & { done?: boolean })[]
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
    base: {
      kcal: energy.base, bmr: tb.bmr, neat: tb.neat, neatLabel: activityLabel, formula: tb.formula,
      // Undefined (older/static-shaped input) reads as the formula path — the sheet's default.
      source: energy.source ?? 'formula',
      formulaKcal: energy.formulaBase ?? undefined,
      sdKcal: energy.sd,
      confidence: energy.confidence,
    },
    movement: {
      kcal: energy.planned + energy.extra,
      isWeeklyAvg: false,
      pending: energy.pending ?? 0,
      // The summands ARE the served parts, so the sheet's `+ … =` row closes on the total.
      parts: [
        { key: 'planned', label: 'Tervezett edzés · logolva', kcal: energy.planned },
        ...(energy.extra > 0 ? [{ key: 'extra' as const, label: 'Terven kívüli mozgás', kcal: energy.extra }] : []),
      ],
      // Per-session previews — informational, not summands. `done` (mezo-tb3s2) marks a block that
      // was actually logged vs. still-scheduled and not yet logged, so the sheet can preview the
      // latter separately ("még jön, ha megcsinálod").
      blocks: blocks.map((b): EnergyBlock => {
        const min = b.durationMin ?? (b.kind === 'run' ? DEFAULT_RUN_MIN : DEFAULT_GYM_MIN)
        return { label: b.label, kind: b.kind, min, kcal: netKcal(blockEnergyKind(b), null, min, restPerHour) ?? 0, done: Boolean(b.done) }
      }),
    },
    deficit,
    target: energy.target,
  }
}
