// ============================================================
// Mezo · weekAgenda — pure Mon–Sun agenda build shared by Mai and Heti
// (mezo-9bbc; lifted out of TrainTodayPage unchanged). Merges the gym
// schedule, the recurring sport slots, the prescribed runs and this
// week's completed custom instances into one WeeklyAgendaDay per weekday.
// ============================================================
import type { WeeklyAgendaDay } from '@/features/train/components/WeeklyDayRow'
import type { GymScheduleDay, VolleyballSession } from '@/data/types'
import type { RunningBlockResponse } from '@/data/train/runningApi'
import { DAY_ORDER } from '@/data/train/train'
import { runSessionsForDay, todayIdx } from '@/data/train/runningAgenda'
import { localDateString } from '@/shared/lib/dates'

/** ISO date of this week's weekday `index` (0 = Monday), relative to `today`. */
export function weekDateIso(index: number, today = new Date()): string {
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate() - todayIdx(today) + index)
  return localDateString(base)
}

/** One skipped dated occurrence of a recurring sport slot (proactive coaching S5, mezo-d58h.5) —
 *  the same identity key the backend's `sport_slot_skip` uses: weekday (0=Hét..6=Vas, matching
 *  `DAY_ORDER`'s own index) + clock time + the skipped date. */
export interface SportSlotSkip {
  dayOfWeek: number
  time: string
  date: string
}

/** True when `skips` hides the (weekday, time) occurrence pinned to `date` — the SAME identity
 *  match every skip-aware FE read shares with the backend's own `hasScheduledTrainingOn`
 *  (mezo-cq06): weekday index (0=Hét..6=Vas, matching `DAY_ORDER`) + the unnormalised `"HH:mm"`
 *  time string, compared as-is + the exact ISO date. Exported so the other date-specific FE
 *  reads (fuel protocol, Today hero, day-orb fill, ritual recap, fuel week) can match a skip the
 *  same way `buildWeekAgenda` below does, instead of each re-deriving the comparison. */
export function isSportSlotSkipped(skips: SportSlotSkip[], dayOfWeek: number, time: string, date: string): boolean {
  return skips.some((s) => s.dayOfWeek === dayOfWeek && s.time === time && s.date === date)
}

export function buildWeekAgenda({
  gymTimes,
  sportSlots,
  runningBlock,
  weekWorkouts,
  today = new Date(),
  skips = [],
}: {
  gymTimes: GymScheduleDay[]
  sportSlots: VolleyballSession[]
  runningBlock: RunningBlockResponse | null
  weekWorkouts: { id: string; date: string; origin: string; status: string; title: string }[]
  today?: Date
  skips?: SportSlotSkip[]
}): WeeklyAgendaDay[] {
  // Completed custom (saját) instances of this week, grouped by ISO date — extra
  // rows on the date they were actually trained (mezo-ws2x).
  const customByDate = new Map<string, { id: string; title: string }[]>()
  for (const w of weekWorkouts) {
    if (w.origin === 'custom' && w.status === 'completed') {
      const list = customByDate.get(w.date) ?? []
      list.push({ id: w.id, title: w.title })
      customByDate.set(w.date, list)
    }
  }

  return DAY_ORDER.map((d, i) => {
    const g = gymTimes.find((x) => x.day === d)
    const date = weekDateIso(i, today)
    // A dated one-off event (mezo-e1sp) pins to its exact ISO date — weekday-label matching
    // alone would repeat it on that weekday of every rendered week. Recurring slots carry no date.
    // A skip_sport_slot advice action (mezo-d58h.5) hides one dated occurrence of a recurring
    // slot — matched on the same identity the backend uses: weekday index + clock time + date.
    const v = sportSlots.filter(
      (x) =>
        x.day === d &&
        (!x.date || x.date === date) &&
        !isSportSlotSkipped(skips, i, x.time, date),
    )
    return {
      day: d,
      date,
      gym: g && g.active ? g : null,
      sport: v,
      running: runSessionsForDay(runningBlock, DAY_ORDER.indexOf(d)),
      isToday: Boolean(g?.today || v.some((x) => x.today)),
      custom: customByDate.get(date) ?? [],
    }
  })
}
