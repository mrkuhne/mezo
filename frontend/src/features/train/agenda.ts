// ============================================================
// Mezo · agenda — pure time-ordering for a day's training sessions.
// Flattens a WeeklyAgendaDay's gym/volleyball/running into typed
// AgendaItems carrying a `timeOfDay`, sorted ascending; untimed
// (null/'') sort last, then stable by original modality order.
// Consumed by WeeklyDayRow (weekly rows) and TrainTodayView (heroes)
// so both surfaces order identically.
// ============================================================
import type { WeeklyAgendaDay } from '@/features/train/components/WeeklyDayRow'
import type { GymScheduleDay, VolleyballSession } from '@/data/types'
import type { RunPrescribedSession } from '@/data/train/runningApi'

export type AgendaItem =
  | { kind: 'gym'; timeOfDay: string | null; gym: GymScheduleDay }
  | { kind: 'volleyball'; timeOfDay: string | null; volleyball: VolleyballSession }
  | { kind: 'running'; timeOfDay: string | null; running: RunPrescribedSession }

/** A day's sessions, ordered by time-of-day; untimed (null/'') sort last, then by modality. */
export function daySessions(day: WeeklyAgendaDay): AgendaItem[] {
  const items: AgendaItem[] = []
  if (day.gym) items.push({ kind: 'gym', timeOfDay: day.gym.time ?? null, gym: day.gym })
  if (day.volleyball) items.push({ kind: 'volleyball', timeOfDay: day.volleyball.time ?? null, volleyball: day.volleyball })
  for (const r of day.running) items.push({ kind: 'running', timeOfDay: r.timeOfDay ?? null, running: r })
  const key = (t: string | null) => (t && t.length ? t : '99:99')
  return items.map((it, i) => ({ it, i }))
    .sort((a, b) => key(a.it.timeOfDay).localeCompare(key(b.it.timeOfDay)) || a.i - b.i)
    .map(({ it }) => it)
}
