// Fuel P5 — unified day-planner timeline hook (mezo-53su).
//
// Both modes compose the day's LIVE sources into a `FuelPlanToday` via the pure `buildDayPlan`:
//   the sleep-goal wake/bed anchor + fuel-settings cadence & caffeine cutoff, the current-week
//   prescription budget, the day's logged meals + the recipe catalog, the supplement protocol
//   (anchor-aware) + intakes, and today's gym/sport/run blocks. In MOCK mode every source hook
//   serves its seed, so the same composition yields a deterministic demo plan (fixed now 13:30);
//   the static hand-authored plan seed is retired (mezo-53su). Design:
//   docs/superpowers/specs/2026-07-02-fuel-p5-merged-timeline-design.md.
//
// React rules of hooks: EVERY hook below is called UNCONDITIONALLY in both modes. The only
// mode branch is the injected `nowHHmm` (fixed in mock for determinism). The composition is
// pure (module functions + buildDayPlan), never hooks.

import { isMockMode } from '@/data/_client/mode'
import { localDateString, currentWeekOf } from '@/shared/lib/dates'
import { getScoredMeal } from '@/data/fuel/fuel'
import { useFuelDay } from '@/data/fuel/fuelHooks'
import { useRecipes } from '@/data/fuel/recipeHooks'
import { useProtocol, useStack, useIntakes } from '@/data/fuel/stackHooks'
import { useFuelSettings } from '@/data/fuel/fuelSettingsHooks'
import { useGoal } from '@/data/me/goalHooks'
import { useBiometricProfile } from '@/data/me/biometricHooks'
import { useSleepGoal } from '@/data/me/sleepHooks'
import { useTrain } from '@/data/train/trainHooks'
import { useRunning } from '@/data/train/runningHooks'
import { buildDayPlan, deriveDailyBudget } from '@/features/fuel/logic/buildDayPlan'
import { buildEnergyBreakdown } from '@/features/fuel/logic/buildEnergyBreakdown'
import { buildProtocol, deriveBlocks, deriveProtocolAnchors } from '@/features/fuel/logic/buildProtocol'
import { ACTIVITY_SHORT, type ActivityLevel } from '@/features/me/logic/biometricFields'
import type { GoalResponse } from '@/data/me/goalApi'
import type { GoalTimelineResponse } from '@/data/me/goalLinkApi'
import type { FuelSlot } from '@/data/types'

// Fixed mock "now" (spec D6) — deterministic demo + tests.
export const MOCK_NOW_HHMM = '13:30'

// `deriveBlocks` now lives in `features/fuel/logic/buildProtocol.ts` (moved so the notification
// schedule writer + settings preview can reuse it, and so `deriveProtocolAnchors` there is the
// ONE place `PRE_WORKOUT_STACK_LEAD_MIN` is applied) — re-exported here so existing imports
// from this module (`data/fuel/timelineHooks`) keep working unchanged.
export { deriveBlocks }

/** The ACTIVE goal's prescription segment for the CURRENT goal-week — the day's budget source.
 *  Current week uses the same day-span math the running/meso blocks use (`currentWeekOf`) over the
 *  goal window (`startDate` + the timeline's total weeks; when the timeline hasn't resolved yet,
 *  the last segment's `toWeek` bounds it). The segment whose `[fromWeek..toWeek]` covers that week
 *  wins; a week outside every segment falls back to the FIRST segment (pinned by test). Returns
 *  null when there is no prescription → `deriveDailyBudget` then passes the day-targets fallback. */
function currentSegment(
  goalResponse: GoalResponse | null,
  timeline: GoalTimelineResponse | null,
): { kcal: number; proteinG: number; dailyEnergyBalanceKcal: number } | null {
  const segments = goalResponse?.prescription?.segments
  if (!segments?.length) return null
  const totalWeeks = timeline?.weeks ?? segments[segments.length - 1].toWeek
  const week = goalResponse?.startDate ? currentWeekOf(goalResponse.startDate, totalWeeks) : 1
  return segments.find(s => week >= s.fromWeek && week <= s.toWeek) ?? segments[0]
}

/**
 * The Fuel "Mai" timeline — one composition in both modes (mezo-53su). Mock sources serve their
 * seeds, so the same `buildDayPlan` yields a deterministic demo plan; real composes the live day.
 */
export function useFuelTimeline(date: string = localDateString()) {
  const { fuel } = useFuelDay(date)
  const { recipes } = useRecipes()
  const { goal, goalResponse, timeline } = useGoal()
  const { goal: sleepGoal } = useSleepGoal()
  const { selectedIds } = useProtocol()
  const { stash } = useStack()
  const intakes = useIntakes(date)
  const { gymSchedule, sport } = useTrain()
  const { activeRunningBlock } = useRunning()
  const { settings } = useFuelSettings() // Fuel-owned meal cadence + caffeine cutoff (mezo-53su)
  const { profile } = useBiometricProfile() // NEAT band label for the energy-breakdown sheet (mezo-hobb)

  // ── Composition (both modes) ─────────────────────────────────────────────────
  // The wake/bed day-anchor is owned by the sleep goal (mezo-dbsr, spec D3) — always set
  // (mock seed / real ghost). Meal cadence + caffeine cutoff are Fuel-owned settings.
  const wake = sleepGoal.wakeTime
  const bed = sleepGoal.bedTime
  const mealsPerDay = settings.mealsPerDay

  const blocks = deriveBlocks(gymSchedule, sport, activeRunningBlock)

  // Dynamic energy inputs (mezo-1oy5 / mezo-eujg): current weigh-in drives the MET activity burn +
  // the BMR floor; BMR×neat is the lifestyle maintenance and the segment's explicit
  // dailyEnergyBalanceKcal is the goal deficit/surplus — both straight from the wire. When the
  // biometric profile hasn't resolved (no BMR/neat), deriveDailyBudget falls back to the static path.
  const weightKg = goal?.currentWeight ?? goalResponse?.startWeightKg ?? 0
  const segment = currentSegment(goalResponse, timeline)
  const budget = deriveDailyBudget(segment, fuel.targets, {
    bmr: goalResponse?.tdeeBootstrap?.bmr ?? null,
    neat: goalResponse?.tdeeBootstrap?.neat ?? null,
    weightKg,
    blocks,
  })

  // Protocol slots (P2 selection-only): the goal's selection, else all non-medication stash items;
  // anchor the slot times to the real day via the CANONICAL deriveProtocolAnchors (wake,
  // first-block − 40min, bedtime) — never re-derived inline here.
  const selection = selectedIds ?? stash.filter(s => s.type !== 'medication').map(s => s.id)
  const anchors = deriveProtocolAnchors(gymSchedule, sport, activeRunningBlock, wake, bed)
  const protocolSlots = buildProtocol(selection, stash, anchors).slots

  // `nowHHmm` is injected (buildDayPlan stays clock-free/deterministic). Mock pins a fixed now
  // (spec D6) for a deterministic demo + tests; real reads the wall clock.
  const now = new Date()
  const nowHHmm = isMockMode()
    ? MOCK_NOW_HHMM
    : `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  const plan = buildDayPlan({
    wake, bed, mealsPerDay, blocks, budget, weightKg,
    meals: fuel.meals, recipes, protocolSlots, intakes,
    caffeineCutoff: settings.caffeineCutoff, nowHHmm,
  })

  // Dynamic-energy explanation (mezo-hobb): the shared EnergyBreakdownSheet's prop, built from the
  // day's plan.energy + today's blocks + the current segment + the NEAT band. Null on the static path.
  const tb = goalResponse?.tdeeBootstrap
  const energyBreakdown = buildEnergyBreakdown({
    energy: plan.energy,
    blocks,
    weightKg,
    tdeeBootstrap: tb ? { bmr: tb.bmr, neat: tb.neat, formula: tb.formula } : null,
    segment,
    activityLabel: profile?.activityLevel ? ACTIVITY_SHORT[profile.activityLevel as ActivityLevel] : '',
    goalLabel: goal?.title ?? 'Cél',
  })

  // wake/bed/nowHHmm are returned so view-side zone math never re-derives the day anchor and never
  // reads the wall clock itself (mock mode must stay deterministic — MOCK_NOW_HHMM). Additive.
  return { plan, budget, blocks, weightKg, energyBreakdown, wake, bed, nowHHmm, getScoredMeal: (s: FuelSlot) => getScoredMeal(s, fuel.meals) }
}
