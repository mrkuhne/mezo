// ============================================================
// Mezo · agenda — pure time-ordering for a day's training sessions.
// Flattens a WeeklyAgendaDay's gym/sport/running/custom into typed
// AgendaItems carrying a `timeOfDay`, sorted ascending; untimed
// (null/'') sort last, then stable by original modality order.
// Consumed by TrainTodayPage (Mai's DayStrip + heroes), and the
// WeeklyAgendaDay type below by weeklyLoad/weekAgenda/dayStripItems
// (the week-summary logic; the old WeeklyDayRow strip that used to sit
// here retired with TrainWeekPage's Titanium face, mezo-88iwa.13 T12 —
// this module kept the type since it was always the real logic home).
// ============================================================
import type { GymScheduleDay, VolleyballSession } from '@/data/types'
import type { RunPrescribedSession } from '@/data/train/runningApi'

export interface WeeklyAgendaDay {
  day: string
  /** ISO date of this row's day in the current week — used by the parent to derive done-state. */
  date?: string
  gym: GymScheduleDay | null
  /** This day's recurring sport slots (volleyball/cross/trx) — a day can hold several. */
  sport: VolleyballSession[]
  running: RunPrescribedSession[]
  isToday: boolean
  /** Completed custom (saját) workout instances on this date — extra done rows (mezo-ws2x). */
  custom?: { id: string; title: string }[]
}

export type AgendaItem =
  | { kind: 'gym'; timeOfDay: string | null; gym: GymScheduleDay }
  | { kind: 'sport'; timeOfDay: string | null; sport: VolleyballSession }
  | { kind: 'running'; timeOfDay: string | null; running: RunPrescribedSession }
  /** A COMPLETED saját (custom) instance trained on this day — untimed, so it sorts last. */
  | { kind: 'custom'; timeOfDay: null; custom: { id: string; title: string } }

/** A day's sessions, ordered by time-of-day; untimed (null/'') sort last, then by modality. */
export function daySessions(day: WeeklyAgendaDay): AgendaItem[] {
  const items: AgendaItem[] = []
  if (day.gym) items.push({ kind: 'gym', timeOfDay: day.gym.time ?? null, gym: day.gym })
  for (const s of day.sport) items.push({ kind: 'sport', timeOfDay: s.time ?? null, sport: s })
  for (const r of day.running) items.push({ kind: 'running', timeOfDay: r.timeOfDay ?? null, running: r })
  // Custom instances carry no schedule time — pushed last so the stable sort keeps
  // them after any other untimed session of the same day.
  for (const c of day.custom ?? []) items.push({ kind: 'custom', timeOfDay: null, custom: c })
  const key = (t: string | null) => (t && t.length ? t : '99:99')
  return items.map((it, i) => ({ it, i }))
    .sort((a, b) => key(a.it.timeOfDay).localeCompare(key(b.it.timeOfDay)) || a.i - b.i)
    .map(({ it }) => it)
}
