// Fuel P5 — dual-mode day-planner timeline hook.
//
// MOCK: byte-parity with the Phase-1 seed (`fuelPlan.today` + id-based `getScoredMeal` over
//   `fuelDay.meals`) — identical to the retired `fuelReadHooks.useFuelTimeline`.
// REAL: composes the day's LIVE sources into a `FuelPlanToday` via the pure `buildDayPlan`:
//   goal day-planner settings + the current-week prescription budget, the day's logged meals +
//   the recipe catalog, the supplement protocol (anchor-aware) + intakes, and today's gym/sport/
//   run blocks. Design: docs/superpowers/specs/2026-07-02-fuel-p5-merged-timeline-design.md.
//
// React rules of hooks: EVERY hook below is called UNCONDITIONALLY in both modes; only the
// RETURNED value branches on `isMockMode()`. The real composition under the guard is pure
// (module functions + buildDayPlan), never hooks.

import { isMockMode } from '@/data/_client/mode'
import { localDateString, currentWeekOf } from '@/shared/lib/dates'
import { PLANNER_DEFAULTS, toHHmm, toMin } from '@/data/fuel/fuelConfig'
import { fuelDay, fuelPlan, getScoredMeal } from '@/data/fuel/fuel'
import { useFuelDay } from '@/data/fuel/fuelHooks'
import { useRecipes } from '@/data/fuel/recipeHooks'
import { useProtocol, useStack, useIntakes } from '@/data/fuel/stackHooks'
import { useFuelSettings } from '@/data/fuel/fuelSettingsHooks'
import { useGoal } from '@/data/me/goalHooks'
import { useSleepGoal } from '@/data/me/sleepHooks'
import { useTrain } from '@/data/train/trainHooks'
import { useRunning } from '@/data/train/runningHooks'
import { runSessionsForDay, todayIdx } from '@/data/train/runningAgenda'
import { buildDayPlan, deriveDailyBudget, type PlannerBlock } from '@/features/fuel/logic/buildDayPlan'
import { buildProtocol, type ProtocolAnchors } from '@/features/fuel/logic/buildProtocol'
import type { GoalResponse } from '@/data/me/goalApi'
import type { GoalTimelineResponse } from '@/data/me/goalLinkApi'
import type { RunningBlockResponse } from '@/data/train/runningApi'
import type { FuelSlot, GymSchedule, SportSchedule } from '@/data/types'

// The pre-workout supplement stack lands T-40min before the first training block (spec §5).
const PRE_WORKOUT_STACK_LEAD_MIN = 40

/** Today's real training blocks (gym / sport / run), in derivation order. Each surface reuses the
 *  same today-derivation the Train views use so the planner and Train agree on "what's today". */
function deriveBlocks(
  gymSchedule: GymSchedule | null,
  sport: { schedule: SportSchedule | null },
  activeRunningBlock: RunningBlockResponse | null,
): PlannerBlock[] {
  const blocks: PlannerBlock[] = []
  // Gym: the meso's today gym day joined with its standalone weekly slot (needs a time).
  const gym = gymSchedule?.weeklyTimes.find(d => d.today && d.active && d.time)
  if (gym?.time) blocks.push({ kind: 'gym', time: gym.time, durationMin: gym.duration ?? null, label: gym.type ?? 'Gym' })
  // Sport: today's volleyball session from the recurring weekly schedule.
  const vb = sport.schedule?.volleyball.sessions.find(s => s.today && s.time)
  if (vb?.time) blocks.push({ kind: 'sport', time: vb.time, durationMin: vb.duration ?? null, label: 'Volleyball' })
  // Run: today's prescribed session in the active block's current week (needs a plan time).
  // Interval sessions have no single continuous duration → null (DEFAULT_BLOCK_MIN drives snapping).
  const run = runSessionsForDay(activeRunningBlock, todayIdx())[0]
  if (run?.timeOfDay) blocks.push({ kind: 'run', time: run.timeOfDay, durationMin: null, label: run.label })
  return blocks
}

/** The ACTIVE goal's prescription segment for the CURRENT goal-week — the day's budget source.
 *  Current week uses the same day-span math the running/meso blocks use (`currentWeekOf`) over the
 *  goal window (`startDate` + the timeline's total weeks; when the timeline hasn't resolved yet,
 *  the last segment's `toWeek` bounds it). The segment whose `[fromWeek..toWeek]` covers that week
 *  wins; a week outside every segment falls back to the FIRST segment (pinned by test). Returns
 *  null when there is no prescription → `deriveDailyBudget` then passes the day-targets fallback. */
function currentSegment(
  goalResponse: GoalResponse | null,
  timeline: GoalTimelineResponse | null,
): { kcal: number; proteinG: number } | null {
  const segments = goalResponse?.prescription?.segments
  if (!segments?.length) return null
  const totalWeeks = timeline?.weeks ?? segments[segments.length - 1].toWeek
  const week = goalResponse?.startDate ? currentWeekOf(goalResponse.startDate, totalWeeks) : 1
  return segments.find(s => week >= s.fromWeek && week <= s.toWeek) ?? segments[0]
}

/**
 * The Fuel "Mai" timeline. Mock serves the hand-authored Phase-1 plan; real composes the live day.
 */
export function useFuelTimeline(date: string = localDateString()) {
  // All reads are unconditional (rules of hooks) — the mode branch is only on the return value.
  const { fuel } = useFuelDay(date)
  const { recipes } = useRecipes()
  const { goal, goalResponse, timeline } = useGoal()
  const { goal: sleepGoal } = useSleepGoal()
  const { selectedIds } = useProtocol()
  const { stash } = useStack()
  const intakes = useIntakes(date)
  const { gymSchedule, sport } = useTrain()
  const { activeRunningBlock } = useRunning()
  const { settings } = useFuelSettings() // Fuel-owned caffeine cutoff (mezo-53su)

  if (isMockMode()) {
    return { plan: fuelPlan.today, getScoredMeal: (s: FuelSlot) => getScoredMeal(s, fuelDay.meals) }
  }

  // ── Real composition ───────────────────────────────────────────────────────
  // The wake/bed day-anchor is now owned by the sleep goal (mezo-dbsr, spec D3) —
  // always set (mock seed / real ghost), so no PLANNER_DEFAULTS fallback is needed.
  const wake = sleepGoal.wakeTime
  const bed = sleepGoal.bedTime
  const mealsPerDay = goal?.mealsPerDay ?? PLANNER_DEFAULTS.mealsPerDay // eating cadence stays on the weight goal

  const blocks = deriveBlocks(gymSchedule, sport, activeRunningBlock)
  const firstBlock = blocks.length ? [...blocks].sort((a, b) => toMin(a.time) - toMin(b.time))[0] : null

  const budget = deriveDailyBudget(currentSegment(goalResponse, timeline), fuel.targets)

  // Protocol slots (P2 selection-only): the goal's selection, else all non-medication stash items;
  // anchor the slot times to the real day (wake, first-block − 40min, bedtime).
  const selection = selectedIds ?? stash.filter(s => s.type !== 'medication').map(s => s.id)
  const anchors: ProtocolAnchors = {
    wake,
    preWorkout: firstBlock ? toHHmm(toMin(firstBlock.time) - PRE_WORKOUT_STACK_LEAD_MIN) : undefined,
    bedtime: bed,
  }
  const protocolSlots = buildProtocol(selection, stash, anchors).slots

  // `nowHHmm` from the wall clock here (buildDayPlan stays clock-free/deterministic).
  const now = new Date()
  const nowHHmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  const plan = buildDayPlan({
    wake, bed, mealsPerDay, blocks, budget,
    meals: fuel.meals, recipes, protocolSlots, intakes,
    caffeineCutoff: settings.caffeineCutoff, nowHHmm,
  })
  return { plan, getScoredMeal: (s: FuelSlot) => getScoredMeal(s, fuel.meals) }
}
