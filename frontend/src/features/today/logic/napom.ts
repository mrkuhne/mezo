// A napom (spec 2026-09-24 §2–§3, §6) — the day view's pure rules. Nothing here calls an LLM:
// the live day is read by these rules, the closed day by the overnight review.
import type { NormalizedDayEvaluation } from '@/data/me/dayEvaluation'
import type { MeWeekDay } from '@/data/me/meWeek'

/** The napzárás card's window: 20:00 until midnight, unless the ritual is closed. After midnight
 *  the calendar day has turned — a day nobody closed just loses the card (final review 2026-09-24). */
export const NAPZARAS_CARD_FROM_HOUR = 20

const dim = (ev: NormalizedDayEvaluation, id: string) => ev.dimensions.find((d) => d.id === id)
const trainingDone = (ev: NormalizedDayEvaluation) => dim(ev, 'training')?.status === 'DONE'
const proteinGap = (day: MeWeekDay | null) =>
  day?.proteinG != null && day.proteinTargetG != null ? Math.max(0, Math.round(day.proteinTargetG - day.proteinG)) : null
const anyLog = (day: MeWeekDay | null) =>
  !!day && (day.kcal != null || day.sleepMin != null || (day.checkinCount ?? 0) > 0 || (day.workoutCount ?? 0) > 0)

export function doneCount(ev: NormalizedDayEvaluation): number {
  return ev.dimensions.filter((d) => d.status === 'DONE').length
}

export function dayReading(ev: NormalizedDayEvaluation, day: MeWeekDay | null): string {
  if (!anyLog(day)) return 'Még üres a napod. Az első beírással elindul.'
  const gap = proteinGap(day)
  if (!trainingDone(ev) && gap != null && gap > 0) return `Fehérjéből már csak ${gap} g hiányzik, az edzés még hátravan.`
  if (!trainingDone(ev)) {
    // "The plate is fine" only when food was actually logged — otherwise a neutral line.
    return day?.kcal != null
      ? 'A tányér rendben van, már csak az edzés maradt a mai napból.'
      : 'Az edzés még hátravan a mai napból.'
  }
  if ((day?.checkinCount ?? 0) < 4) return 'Az edzés megvolt. Egy esti check-in, és kerek a nap.'
  return 'Minden a helyén. Ma este nyugodtan zárhatod a napot.'
}

export function isNapzarasCardWindow(now: Date, ritualClosed: boolean): boolean {
  if (ritualClosed) return false
  return now.getHours() >= NAPZARAS_CARD_FROM_HOUR
}

export type NextActionKind = 'workout' | 'checkin' | 'napzaras'
export interface NextAction { kind: NextActionKind; eyebrow: string; title: string; sub: string; cta: string; to: string }

/** The one next step for today. `ritualClosed` is today's napzárás state: once the day is
 *  closed the evening slot falls through to the other rules (or `null`). */
export function nextBestAction(
  ev: NormalizedDayEvaluation,
  day: MeWeekDay | null,
  now: Date,
  ritualClosed: boolean,
): NextAction | null {
  if (isNapzarasCardWindow(now, ritualClosed)) {
    return {
      kind: 'napzaras',
      eyebrow: 'MOST ÉRDEMES · ESTE',
      title: 'Tegyük le a napot',
      sub: 'A napzárás innen és az esti rutinból is indul. Hajnalban megírom, milyen napod volt.',
      cta: 'Napzárás',
      to: '/ritual',
    }
  }
  const t = dim(ev, 'training')
  if (t?.status !== 'DONE' && t?.status !== 'NO_DATA') {
    return {
      kind: 'workout',
      eyebrow: 'MOST ÉRDEMES · DÉLUTÁN',
      title: 'Még hátravan a mai edzés',
      sub: 'Utána egy fehérjés vacsora, és a tápanyag is kész.',
      cta: 'Edzés',
      to: '/train/mai',
    }
  }
  if ((day?.checkinCount ?? 0) < 4) {
    return {
      kind: 'checkin',
      eyebrow: 'MOST ÉRDEMES',
      title: 'Egy check-in hiányzik',
      sub: 'Fél perc. Utána teljes a napod képe.',
      cta: 'Check-in',
      to: '/nap/checkin',
    }
  }
  return null
}

export const seenKey = (dateIso: string) => `napom.seen.${dateIso}`

export function isMorningMode(
  y: NormalizedDayEvaluation | null,
  storage: Pick<Storage, 'getItem'> | null = safeStorage(),
): boolean {
  if (!y || y.state !== 'scored' || !y.reviewId) return false
  try {
    return storage?.getItem(seenKey(y.date)) == null
  } catch {
    return true
  }
}

/** Fired on `window` after `markSeen` writes — `useMorningMode` subscribes, so the A napom tab
 *  dot clears the moment yesterday's review is on screen, not on some later re-render. */
export const NAPOM_SEEN_EVENT = 'napom:seen'

export function markSeen(dateIso: string, storage: Pick<Storage, 'setItem'> | null = safeStorage()): void {
  try {
    storage?.setItem(seenKey(dateIso), '1')
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(NAPOM_SEEN_EVENT))
  } catch {
    /* private mode: morning mode simply repeats */
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}
