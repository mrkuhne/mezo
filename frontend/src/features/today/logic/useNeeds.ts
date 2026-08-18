// ============================================================
// Mezo · useNeeds — the six "Életjel-ringek" (needs rings), live (mezo-dhzk).
// Composes the app's existing data hooks (@/data/hooks — never a per-domain deep import, per
// the frontend conventions) into `RawNeedsData`, adapts it via `buildNeedsEvents`, and walks
// the pure decay/refill engine (`needsAt`) to `now`.
//
// `isPending` (fix-wave review finding, post-Task-9): a COMPOSITE of every consumed read that
// exposes its own isPending — sleepGoal alone used to gate it, so a real-mode cold load
// rendered all six rings straight off "no events yet" (every band reads `critical`) for the
// whole window the other ~13 reads were still in flight. Sources that don't expose isPending on
// their public return (`useFuelDay`, `useSleep`, `useCheckins`, `useHabitDay`) are left OUT of
// the gate and keep needsInputs.ts's existing "pending → empty events" degrade instead — adding
// isPending to those hooks' shape would ripple to every other consumer for a read this hook can
// already tolerate transiently missing (a same-mount useQuery, typically the first to resolve).
// Mock mode stays synchronous-green: every dual-mode hook resolves `isPending: false` immediately
// via `initialData`, and `useTrain`/`useRunning`'s own pending flags are explicitly `!mock && …`.
// Spec: .superpowers/sdd/2026-08-17-needs-rings/task-2-brief.md
// ============================================================
import { useMemo } from 'react'
import {
  useActivities, useCheckins, useFuelDay, useHabitDay, useIntentionDay,
  useRitualDay, useRunning, useSleep, useSleepGoal, useTrain,
} from '@/data/hooks'
import { addDays, localDateString } from '@/shared/lib/dates'
import { needsAt, type NeedState } from '@/features/today/logic/needs'
import { buildNeedsEvents, type RawNeedsData } from '@/features/today/logic/needsInputs'

export function useNeeds(now: Date): { states: NeedState[]; isPending: boolean } {
  const todayIso = localDateString(now)
  const yesterdayIso = addDays(todayIso, -1)

  const { goal, isPending: sleepGoalPending } = useSleepGoal()
  const { fuel: fuelToday } = useFuelDay(todayIso)
  const { fuel: fuelYesterday } = useFuelDay(yesterdayIso)
  const { sleepLog } = useSleep()
  const train = useTrain()
  const { runSessions, runningPending } = useRunning()
  const { data: activitiesToday, isPending: activitiesTodayPending } = useActivities(todayIso)
  const { data: activitiesYesterday, isPending: activitiesYesterdayPending } = useActivities(yesterdayIso)
  const { checkins: checkinsToday } = useCheckins()
  const { data: intentionToday, isPending: intentionTodayPending } = useIntentionDay(todayIso)
  const { data: intentionYesterday, isPending: intentionYesterdayPending } = useIntentionDay(yesterdayIso)
  const { data: ritualYesterday, isPending: ritualYesterdayPending } = useRitualDay(yesterdayIso)
  const { habits: habitsToday } = useHabitDay(todayIso)
  const { habits: habitsYesterday } = useHabitDay(yesterdayIso)

  const gymDoneDates = train.gymDoneDates
  const completedTodayWorkout = train.completedTodayWorkout
  const sportSessions = train.sport.sessions

  // `train.workoutPending` covers `gymDoneDates`/`completedTodayWorkout` (both derive from the
  // same `/today` read); `train.sportPending` covers `sportSessions`. `runningPending` tracks
  // the running-BLOCKS query (the only pending flag `useRunning` exposes) as a same-mount proxy
  // for the sibling `runSessions` query this hook actually reads — both fire from the same
  // mount, so in practice they resolve together.
  const isPending = sleepGoalPending || activitiesTodayPending || activitiesYesterdayPending
    || intentionTodayPending || intentionYesterdayPending || ritualYesterdayPending
    || train.workoutPending || train.sportPending || runningPending

  const states = useMemo(() => {
    const raw: RawNeedsData = {
      now, todayIso, yesterdayIso,
      wakeTime: goal.wakeTime, bedTime: goal.bedTime,
      fuelToday, fuelYesterday,
      sleepLog, goalMinutes: goal.targetMinutes,
      gymDoneDates,
      completedTodayWorkout: completedTodayWorkout ? { date: completedTodayWorkout.date } : null,
      sportSessions: sportSessions.map((s) => ({ isoDate: s.isoDate, time: s.time })),
      runSessions: runSessions.map((r) => ({ date: r.date })),
      activitiesToday, activitiesYesterday,
      checkinsToday,
      intentionToday, intentionYesterday,
      ritualYesterday,
      habitsToday, habitsYesterday,
    }
    return needsAt(now, { wakeTime: goal.wakeTime, bedTime: goal.bedTime, events: buildNeedsEvents(raw) })
  }, [
    now, todayIso, yesterdayIso, goal,
    fuelToday, fuelYesterday, sleepLog,
    gymDoneDates, completedTodayWorkout, sportSessions, runSessions,
    activitiesToday, activitiesYesterday, checkinsToday,
    intentionToday, intentionYesterday, ritualYesterday,
    habitsToday, habitsYesterday,
  ])

  return { states, isPending }
}
