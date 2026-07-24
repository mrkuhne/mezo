import type { MesoDay } from '@/data/types'
import type { WorkoutSummaryResponse } from '@/data/train/trainApi'

/** Where a gym day tap goes: review when completed this week (by template id), else the session (D6). */
export function gymDayTarget(day: MesoDay, weekWorkouts: WorkoutSummaryResponse[]): string | null {
  if (day.exerciseCount === 0) return null
  const done = weekWorkouts.find((w) => w.templateSessionId && w.templateSessionId === day.id)
  if (done) return `/train/review/${done.id}`
  return day.current || !day.id ? '/train/session' : `/train/session?day=${day.id}`
}
