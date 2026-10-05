// ============================================================
// Mezo · dayStripItems — pre-derives the DayStrip's chips from the week
// agenda (mezo-9bbc). Keeps DayStrip presentational: it receives dots and
// counts, never predicates or domain types.
// ============================================================
import { daySessions, type AgendaItem, type WeeklyAgendaDay } from '@/features/train/logic/agenda'
import { SPORT_TONE, sportOf, type SessionTone } from '@/features/train/logic/sportKinds'

export interface DayStripItem {
  /** Day key from DAY_ORDER (`Hét`…`Vas`). */
  day: string
  /** Day-of-month of this weekday in the current week. */
  dayNumber: number
  isToday: boolean
  /** One tone per session, in time order — rendered as coloured dots. */
  dots: SessionTone[]
  doneCount: number
  /** Not-done sessions the user skipped (Kihagyás S1, mezo-q4xt2.1) — each carries a t-skip mark. */
  skipCount?: number
  /** Kímélő mód S2 (mezo-q4xt2.2): a protected day with a not-done session — one t-kimelo mark
   *  instead of the skip marks (prototype `dstrip()` `km`). */
  protectedDay?: boolean
  sessionCount: number
}

// A completed saját (custom) workout is gym load, so it wears the gym tone —
// same as the card Mai renders for it (mezo-9bbc).
const toneOf = (item: AgendaItem): SessionTone =>
  item.kind === 'gym' || item.kind === 'custom'
    ? 'gym'
    : item.kind === 'running'
      ? 'run'
      : SPORT_TONE[sportOf(item.sport)]

export function dayStripItems(
  agenda: WeeklyAgendaDay[],
  isDone: (day: WeeklyAgendaDay, item: AgendaItem) => boolean,
  // Kihagyás S1 (mezo-q4xt2.1): which sessions are skipped. A done session never counts as
  // skipped — a trained day wins over a skip, as everywhere else.
  isSkipped: (day: WeeklyAgendaDay, item: AgendaItem) => boolean = () => false,
): DayStripItem[] {
  return agenda.map((d) => {
    const sessions = daySessions(d)
    const open = sessions.filter((s) => !isDone(d, s))
    const protectedDay = Boolean(d.protected) && open.length > 0
    return {
      day: d.day,
      dayNumber: d.date ? Number(d.date.slice(8, 10)) : 0,
      isToday: d.isToday,
      dots: sessions.map(toneOf),
      doneCount: sessions.filter((s) => isDone(d, s)).length,
      skipCount: protectedDay ? 0 : open.filter((s) => isSkipped(d, s)).length,
      ...(protectedDay ? { protectedDay: true } : {}),
      sessionCount: sessions.length,
    }
  })
}
