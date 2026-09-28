// ============================================================
// Mezo · plannedSkips — the central "is this planned occurrence skipped?" read + the TS mirror of
// the backend's read-time counting rule (Kihagyás S1, mezo-q4xt2.1). One shared identity match so
// every date-specific FE read (fuel protocol, Today hero, day-orb fill, ritual recap, fuel week,
// the week agenda itself) matches a skip the same way the backend's own
// `WorkoutWindowQueryService`/`PlannedSkipPolicy` does, instead of each re-deriving it.
// ============================================================
import { addDays, localDateString } from '@/shared/lib/dates'

export type SkipKind = 'GYM' | 'SPORT' | 'RUN'
export type SkipReason = 'ILLNESS' | 'STOMACH' | 'INJURY' | 'TRAVEL' | 'TIRED' | 'NO_TIME' | 'NO_MOOD' | 'OTHER' | 'NONE'

/** The identity of one planned occurrence a skip can target — matched per `isSkipped` below.
 *  `dayOfWeek`/`time` only matter for SPORT, `sessionKey` only for RUN. */
export interface PlannedSkipKey {
  kind: SkipKind
  date: string
  dayOfWeek?: number | null
  time?: string | null
  sessionKey?: string | null
}

/** One planned skip as the FE reads it — the key it targets plus its read-time verdict. No
 *  `createdAt` in real mode (the server never sends it back); mock mode stamps it so `judge`
 *  can sort the free-pass race the same way the backend does. */
export interface PlannedSkip extends PlannedSkipKey {
  id: string
  reasonCategory: SkipReason
  reasonText?: string | null
  source: 'USER' | 'ADVICE'
  serious: boolean
  freePass: boolean
  excused: boolean
  createdAt?: string
}

/** Reasons that can never be excused via the weekly free pass — always excused on their own,
 *  mirroring `PlannedSkipPolicy.isSerious` (backend). */
export const SERIOUS: ReadonlySet<SkipReason> = new Set(['ILLNESS', 'STOMACH', 'INJURY', 'TRAVEL'])

/** Same identity match every skip-aware FE read shares with the backend's own
 *  `WorkoutWindowQueryService.windowsFor` (mezo-cq06, extended for GYM/RUN in S1): `kind` + `date`
 *  always; SPORT also `dayOfWeek` + the unnormalised `"HH:mm"` `time` string compared as-is; RUN
 *  also `sessionKey`. */
function matches(s: PlannedSkipKey, t: PlannedSkipKey): boolean {
  if (s.kind !== t.kind || s.date !== t.date) return false
  if (s.kind === 'SPORT') return s.dayOfWeek === t.dayOfWeek && s.time === t.time
  if (s.kind === 'RUN') return s.sessionKey === t.sessionKey
  return true
}

/** True when `skips` hides the planned occurrence `t` identifies. */
export function isSkipped(skips: readonly PlannedSkipKey[], t: PlannedSkipKey): boolean {
  return skips.some((s) => matches(s, t))
}

/** The skip row (with its full verdict, if `T` carries one) matching `t`, or `undefined`. */
export function findSkip<T extends PlannedSkipKey>(skips: readonly T[], t: PlannedSkipKey): T | undefined {
  return skips.find((s) => matches(s, t))
}

/** SPORT-only convenience the pre-S1 call sites keep using verbatim (fuel protocol, Today hero,
 *  day-orb fill, ritual recap, fuel week, the week agenda's own filter) — same params as before,
 *  now matching only `kind: 'SPORT'` rows out of the combined GYM/SPORT/RUN planned-skips list. */
export function isSportSlotSkipped(skips: readonly PlannedSkipKey[], dayOfWeek: number, time: string, date: string): boolean {
  return isSkipped(skips, { kind: 'SPORT', date, dayOfWeek, time })
}

/** ISO week key (weekBasedYear*100 + weekOfWeekBasedYear) for a `YYYY-MM-DD` date — the free-pass
 *  bucket, mirroring `PlannedSkipPolicy.isoWeekKey` (backend, `java.time.temporal.IsoFields`). */
function isoWeekKey(dateIso: string): number {
  const [y, m, d] = dateIso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const isoDow = (date.getUTCDay() + 6) % 7 // Mon=0..Sun=6
  date.setUTCDate(date.getUTCDate() - isoDow + 3) // Thursday of this ISO week decides the ISO year
  const isoYear = date.getUTCFullYear()
  const jan4 = new Date(Date.UTC(isoYear, 0, 4))
  const jan4Dow = (jan4.getUTCDay() + 6) % 7
  const week1Monday = new Date(jan4.getTime() - jan4Dow * 86_400_000)
  const weekNo = Math.round((date.getTime() - week1Monday.getTime()) / (7 * 86_400_000)) + 1
  return isoYear * 100 + weekNo
}

/**
 * TS mirror of `PlannedSkipPolicy.judge` (backend) — mock mode ONLY: real mode trusts the
 * server's own verdicts on every `PlannedSkipResponse`, never recomputes them client-side.
 * Rules: serious reasons are always excused but never take the free pass; one soft (non-serious)
 * USER row per ISO week (of the skip's OWN date), earliest by `createdAt` then `id`, gets the
 * pass; ADVICE rows are always excused but never consume a pass. Output order matches input order.
 */
export function judge(skips: PlannedSkip[]): PlannedSkip[] {
  const passByWeek = new Map<number, string>()
  const softUser = skips.filter((s) => s.source === 'USER' && !SERIOUS.has(s.reasonCategory))
  const sorted = [...softUser].sort((a, b) => {
    const ca = a.createdAt ?? ''
    const cb = b.createdAt ?? ''
    if (ca !== cb) return ca < cb ? -1 : 1
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
  for (const s of sorted) {
    const wk = isoWeekKey(s.date)
    if (!passByWeek.has(wk)) passByWeek.set(wk, s.id)
  }
  return skips.map((s) => {
    const serious = SERIOUS.has(s.reasonCategory)
    const freePass = s.source === 'USER' && !serious && passByWeek.get(isoWeekKey(s.date)) === s.id
    const excused = serious || freePass || s.source === 'ADVICE'
    return { ...s, serious, freePass, excused }
  })
}

/** The skip window every skip read/write is scoped to: `today − 7` .. the Sunday of `today`'s
 *  ISO/Mon–Sun week (local dates), mirroring the backend's `TRAIN_SKIP_DATE_OUT_OF_WINDOW` bound. */
export function skipWindow(today: Date = new Date()): { fromIso: string; toIso: string } {
  const todayIso = localDateString(today)
  const dow = (today.getDay() + 6) % 7 // Mon=0..Sun=6
  return { fromIso: addDays(todayIso, -7), toIso: addDays(todayIso, 6 - dow) }
}
