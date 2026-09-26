import { toHHmm, toMin } from '@/data/fuel/fuelConfig'
import { runSessionsForDay, todayIdx } from '@/data/train/runningAgenda'
import { sportOf, SPORT_TITLES, type SportKind } from '@/features/train/logic/sportKinds'
import { isSportSlotSkipped, type SportSlotSkip } from '@/features/train/logic/weekAgenda'
import { localDateString } from '@/shared/lib/dates'
import type { PlannerBlock } from '@/features/fuel/logic/buildDayPlan'
import type { RunningBlockResponse } from '@/data/train/runningApi'
import type { GymSchedule, SportSchedule, SportSession } from '@/data/types'

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
  // The day's LOGGED sport sessions (mezo-rilew). A session the user played but never planned
  // produced no block at all, so its burnt energy never reached the day's `eat` term and the Fuel
  // calorie target stayed put — the owner-visible bug. Sessions are matched against the planned
  // occurrences first (the backend's `addSportWindowsForDay` rule), so a planned session that was
  // then logged still yields exactly ONE block; only the leftovers are added. Empty default keeps
  // the forward-looking callers (the notification schedule writer / its preview) schedule-only.
  sessions: SportSession[] = [],
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
  const plannedSport: PlannerBlock[] = (sport.schedule?.volleyball.sessions.filter(
    s => s.today && s.time && !isSportSlotSkipped(skips, todayIdx(), s.time, todayIso),
  ) ?? []).map(vb => (
    { kind: 'sport', sport: sportOf(vb), time: vb.time, durationMin: vb.duration ?? null, label: SPORT_TITLES[sportOf(vb)] }
  ))
  blocks.push(...resolveSportBlocks(plannedSport, sessions, todayIso))
  // Run: today's prescribed session in the active block's current week (needs a plan time).
  // Interval sessions have no single continuous duration → null (DEFAULT_BLOCK_MIN drives snapping,
  // DEFAULT_RUN_MIN the net burn estimate).
  const run = runSessionsForDay(activeRunningBlock, todayIdx())[0]
  if (run?.timeOfDay) blocks.push({ kind: 'run', time: run.timeOfDay, durationMin: null, label: run.label })
  return blocks
}

/**
 * Today's sport blocks: the planned occurrences RECONCILED with what was actually logged
 * (mezo-rilew) — the frontend twin of the backend's `WorkoutWindowQueryService
 * .addSportWindowsForDay`, so the two sides read one day the same way.
 *
 * A logged session is the primary source: it carries the clock time the sport was really played
 * and its real duration. Each session, earliest first, consumes the planned occurrence nearest to
 * it in time; the planned ones left over still yield their own blocks (a session yet to be played
 * is still fuel the day has to carry). That matching is the whole point of the reconciliation:
 * without it a planned session that was then logged would be counted TWICE in the day's activity
 * energy — and without the sessions at all (the state this fixes) a session played outside the
 * plan was counted ZERO times, so the Fuel calorie target never moved for it.
 *
 * A session with no clock time cannot be placed and is dropped rather than invented, exactly as on
 * the backend.
 */
function resolveSportBlocks(planned: PlannerBlock[], sessions: SportSession[], todayIso: string): PlannerBlock[] {
  const unmatched = [...planned]
  const blocks: PlannerBlock[] = []
  const todaysSessions = [...sessions]
    .filter(s => s.isoDate === todayIso && s.time)
    .sort((a, b) => toMin(a.time) - toMin(b.time))
  for (const s of todaysSessions) {
    const plan = nearestPlannedSport(unmatched, s.time)
    if (plan) unmatched.splice(unmatched.indexOf(plan), 1)
    blocks.push({
      kind: 'sport',
      sport: sportOf({ sport: s.sport as SportKind }),
      time: s.time,
      durationMin: s.duration ?? plan?.durationMin ?? null,
      label: SPORT_TITLES[sportOf({ sport: s.sport as SportKind })],
    })
  }
  return [...blocks, ...unmatched]
}

/** The planned sport block closest in time to a logged session — the backend's `nearestPlan`. */
function nearestPlannedSport(planned: PlannerBlock[], time: string): PlannerBlock | null {
  if (!planned.length) return null
  const at = toMin(time)
  return [...planned].sort((a, b) => Math.abs(toMin(a.time) - at) - Math.abs(toMin(b.time) - at))[0]
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
