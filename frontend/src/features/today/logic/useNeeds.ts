// ============================================================
// Mezo · useNeeds — the six "Életjel-ringek" (needs rings), live (mezo-dhzk).
// Composes the app's existing data hooks (@/data/hooks — never a per-domain deep import, per
// the frontend conventions) into `RawNeedsData`, adapts it via `buildNeedsEvents`, and walks
// the pure decay/refill engine (`needsAt`) to `now`. Every source but `useSleepGoal` degrades
// to "no events" while pending (needsInputs.ts's adapter rules already tolerate empty/missing
// data), so `isPending` reflects only the sleep-goal read — the one value the sim can't run
// without (wake/bed anchor the whole simulation window).
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

  const { goal, isPending } = useSleepGoal()
  const { fuel: fuelToday } = useFuelDay(todayIso)
  const { fuel: fuelYesterday } = useFuelDay(yesterdayIso)
  const { sleepLog } = useSleep()
  const train = useTrain()
  const { runSessions } = useRunning()
  const { data: activitiesToday } = useActivities(todayIso)
  const { data: activitiesYesterday } = useActivities(yesterdayIso)
  const { checkins: checkinsToday } = useCheckins()
  const { data: intentionToday } = useIntentionDay(todayIso)
  const { data: intentionYesterday } = useIntentionDay(yesterdayIso)
  const { data: ritualYesterday } = useRitualDay(yesterdayIso)
  const { habits: habitsToday } = useHabitDay(todayIso)
  const { habits: habitsYesterday } = useHabitDay(yesterdayIso)

  const gymDoneDates = train.gymDoneDates
  const completedTodayWorkout = train.completedTodayWorkout
  const sportSessions = train.sport.sessions

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
