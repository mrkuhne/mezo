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

export function buildWeekAgenda({
  gymTimes,
  sportSlots,
  runningBlock,
  weekWorkouts,
  today = new Date(),
}: {
  gymTimes: GymScheduleDay[]
  sportSlots: VolleyballSession[]
  runningBlock: RunningBlockResponse | null
  weekWorkouts: { id: string; date: string; origin: string; status: string; title: string }[]
  today?: Date
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
    const v = sportSlots.filter((x) => x.day === d && (!x.date || x.date === date))
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
