import { toHHmm, toMin } from '@/data/fuel/fuelConfig'
import { runSessionsForDay, todayIdx } from '@/data/train/runningAgenda'
import { sportOf, SPORT_TITLES } from '@/features/train/logic/sportKinds'
import { isSportSlotSkipped, type SportSlotSkip } from '@/features/train/logic/weekAgenda'
import { localDateString } from '@/shared/lib/dates'
import type { PlannerBlock } from '@/features/fuel/logic/buildDayPlan'
import type { RunningBlockResponse } from '@/data/train/runningApi'
import type { GymSchedule, SportSchedule } from '@/data/types'

/** The user's real day anchors that drive slot times when provided. */
export interface ProtocolAnchors {
  wake: string
  preWorkout?: string
  bedtime: string
}

/** The pre-workout stack slot lands this many minutes before the day's first training block
 *  (spec §5) — the single canonical offset. `projectStackDay` (mezo-vx9v) is now the PRIMARY
 *  place it is applied (straight off `blocks`, for the live occurrence-based Stack timeline);
 *  `deriveProtocolAnchors` below still applies it too, for any caller that wants a
 *  `{wake, preWorkout, bedtime}` shape instead of the raw block list. Either way this one constant
 *  is the sole offset, so the Fuel/Stack page, the notification schedule writer, and the
 *  settings-screen preview can never quietly disagree on when that slot fires. */
export const PRE_WORKOUT_STACK_LEAD_MIN = 40

/** Today's real training blocks (gym / sport / run), in derivation order. Moved here (out of
 *  `data/fuel/timelineHooks.ts`, which re-exports it for backward compatibility) so it can be
 *  called from anywhere that needs "today's blocks" without pulling in the whole fuel-timeline
 *  hook composition — notably `deriveProtocolAnchors` below and the notification writer/preview,
 *  which only need the block TIMES, not the full day plan. */
export function deriveBlocks(
  gymSchedule: GymSchedule | null,
  sport: { schedule: SportSchedule | null },
  activeRunningBlock: RunningBlockResponse | null,
  // Skipped dated occurrences of a recurring sport slot (mezo-cq06) — a skip_sport_slot advice
  // action hides one dated occurrence; without this, the fuel protocol kept anchoring the
  // pre-workout meal / calorie budget on a sport block the backend already treats as absent.
  // Empty default keeps every caller that hasn't threaded skips through yet byte-identical.
  skips: SportSlotSkip[] = [],
): PlannerBlock[] {
  const blocks: PlannerBlock[] = []
  // Gym: the meso's today gym day joined with its standalone weekly slot (needs a time).
  const gym = gymSchedule?.weeklyTimes.find(d => d.today && d.active && d.time)
  if (gym?.time) blocks.push({ kind: 'gym', time: gym.time, durationMin: gym.duration ?? null, label: gym.type ?? 'Gym' })
  // Sport: EVERY today-session — recurring slots and dated one-off events alike (mezo-e1sp);
  // a single .find silently dropped the second block of a stacked day (e.g. a recurring
  // training + a one-off match) from the calorie budget and the meal windows. The label
  // carries the session's sport identity so cross/TRX don't render as 'Volleyball' (mezo-rhe5).
  // A skipped occurrence (mezo-cq06) is matched on today's weekday index + the slot's own
  // unnormalised time + today's ISO date — the same identity `buildWeekAgenda` uses.
  const todayIso = localDateString(new Date())
  for (const vb of sport.schedule?.volleyball.sessions.filter(
    s => s.today && s.time && !isSportSlotSkipped(skips, todayIdx(), s.time, todayIso),
  ) ?? []) {
    blocks.push({ kind: 'sport', time: vb.time, durationMin: vb.duration ?? null, label: SPORT_TITLES[sportOf(vb)] })
  }
  // Run: today's prescribed session in the active block's current week (needs a plan time).
  // Interval sessions have no single continuous duration → null (DEFAULT_BLOCK_MIN drives snapping).
  const run = runSessionsForDay(activeRunningBlock, todayIdx())[0]
  if (run?.timeOfDay) blocks.push({ kind: 'run', time: run.timeOfDay, durationMin: null, label: run.label })
  return blocks
}

/**
 * The CANONICAL `ProtocolAnchors` derivation — `wake`/`bedtime` straight through, `preWorkout`
 * anchored to the day's first training block minus `PRE_WORKOUT_STACK_LEAD_MIN`. `projectStackDay`
 * (mezo-vx9v) now derives the same pre-workout offset straight from `blocks` + this module's
 * `PRE_WORKOUT_STACK_LEAD_MIN` constant rather than through this function, so this is kept for any
 * caller that still needs a `{wake, preWorkout, bedtime}` shape rather than the raw block list —
 * a second derivation of the same minute is exactly the drift this design exists to avoid (the
 * backend has no fuel-slot times of its own precisely because the FE is the single source of
 * truth for them).
 */
export function deriveProtocolAnchors(
  gymSchedule: GymSchedule | null,
  sport: { schedule: SportSchedule | null },
  activeRunningBlock: RunningBlockResponse | null,
  wake: string,
  bedtime: string,
  skips: SportSlotSkip[] = [],
): ProtocolAnchors {
  const blocks = deriveBlocks(gymSchedule, sport, activeRunningBlock, skips)
  const firstBlock = blocks.length ? [...blocks].sort((a, b) => toMin(a.time) - toMin(b.time))[0] : null
  return {
    wake,
    preWorkout: firstBlock ? toHHmm(toMin(firstBlock.time) - PRE_WORKOUT_STACK_LEAD_MIN) : undefined,
    bedtime,
  }
}
