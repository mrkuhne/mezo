// ============================================================
// Mezo · recovery — kímélő mód (Kihagyás S2, mezo-q4xt2.2) FE logic: the protected dates as
// virtual whole-day skip rows, and the copy of the estimate chips, the period title and the
// „Üdv újra!" return lines. Strings are verbatim from the approved living prototypes
// (`docs/design_2.0/prototypes/elo/edzes.html` KDUR/KEST/KWHO/UDVX, `nap.html` kmWelcome).
// ============================================================
import type { RecoveryReturn, RecoveryState } from '@/data/train/recoveryApi'
import type { PlannedSkip, SkipReason } from '@/features/train/logic/plannedSkips'

export type RecoveryEstimate = 'TODAY' | 'FEW_DAYS' | 'WEEK' | 'UNKNOWN'

/** The „Meddig tarthat?" chips, in prototype order. */
export const ESTIMATE_CHIPS: readonly { value: RecoveryEstimate; label: string }[] = [
  { value: 'TODAY', label: 'Csak ma' },
  { value: 'FEW_DAYS', label: '2–3 nap' },
  { value: 'WEEK', label: 'Kb. egy hét' },
  { value: 'UNKNOWN', label: 'Nem tudom' },
]

/**
 * One virtual `DAY` row per protected date — hides every planned occurrence on that date
 * (`plannedSkips.ts`'s `matches`). Always excused + serious, never the free pass, mirroring the
 * backend's virtual RECOVERY verdict. The category is the shown period's; a protected date of an
 * older, no-longer-shown period (the server only sends the open or today-ended one) carries
 * `NONE` rather than a guessed category.
 */
export function protectedDayRows(state: RecoveryState | null | undefined): PlannedSkip[] {
  if (!state) return []
  const category: SkipReason = state.period?.category ?? 'NONE'
  return state.protectedDates.map((date) => ({
    id: `recovery:${date}`,
    kind: 'DAY',
    date,
    reasonCategory: category,
    source: 'RECOVERY',
    excused: true,
    serious: true,
    freePass: false,
  }))
}

const CATEGORY: Partial<Record<SkipReason, string>> = {
  ILLNESS: 'Beteg vagy',
  STOMACH: 'Gyomorrontás',
  INJURY: 'Sérülés / fájdalom',
  TRAVEL: 'Úton vagy',
}

/** The period's „who" label (prototype KWHO) — only the four serious categories open a period. */
export function categoryCopy(cat: SkipReason): string | null {
  return CATEGORY[cat] ?? null
}

const ESTIMATE: Record<RecoveryEstimate, string | null> = {
  TODAY: 'csak ma',
  FEW_DAYS: '2–3 nap',
  WEEK: 'kb. egy hét',
  UNKNOWN: null,
}

/** The estimate half of the period title (prototype `kmTitle`): „becslés: 2–3 nap" (+ „ volt"
 *  once it has passed), or „még nem tudod, meddig tart" for UNKNOWN. */
export function estimateCopy(e: RecoveryEstimate, expired = false): string {
  const v = ESTIMATE[e]
  return v ? `becslés: ${v}${expired ? ' volt' : ''}` : 'még nem tudod, meddig tart'
}

const HU_MONTHS_SHORT = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.']

/** '2026-10-18' → 'okt. 18.' (the prototype's date form in the return line). */
function shortDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${HU_MONTHS_SHORT[m - 1]} ${d}.`
}

/** `iso` moved by `n` days (UTC arithmetic — a pure calendar shift, DST-free). */
function shiftIso(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return t.toISOString().slice(0, 10)
}

export interface ReturnCopy {
  /** „3 nap kiesés" — bold in the prototype. */
  headline: string
  /** What happens to the programme. */
  program: string
  /** `${headline} · ${program}` — the whole calendar line. */
  line: string
  /** How the first session(s) are lightened. */
  ramp: string
}

/**
 * The „Üdv újra!" lines for a return (prototype UDVX / kmWelcome), from the server's own
 * `RecoveryReturn`. The meso's previous end is `newEndDate − shiftDays` (the shift moved it by
 * exactly that); without `newEndDate` the „(A → B)" part is left out. `week` is the meso week the
 * user continues with (the active meso's current week after the shift) — optional, since the
 * return itself does not carry it; without it the week clause is left out rather than guessed.
 * A zero shift (no active meso, or no week boundary crossed) means the programme did not move.
 */
export function returnCopy(ret: RecoveryReturn, opts: { week?: number | null } = {}): ReturnCopy {
  const headline = `${ret.daysOut} nap kiesés`
  const shiftWeeks = Math.round(ret.shiftDays / 7)
  const later = shiftWeeks === 1 ? 'egy héttel' : `${shiftWeeks} héttel`
  const dates = ret.newEndDate
    ? ` (${shortDate(shiftIso(ret.newEndDate, -ret.shiftDays))} → ${shortDate(ret.newEndDate)})`
    : ''
  const week = opts.week ?? null
  let program: string
  if (ret.rule === 'CONTINUE') {
    program = 'a program megy tovább a naptár szerint.'
  } else if (shiftWeeks <= 0) {
    // No shift: RESUME simply continues; a STEP_BACK that did not move the calendar only says so.
    program = ret.rule === 'RESUME'
      ? 'a programod nem csúszik, onnan folytatod, ahol abbahagytad.'
      : 'a programod nem csúszik.'
  } else if (ret.rule === 'RESUME') {
    program = week
      ? `onnan folytatod, ahol abbahagytad: a ${week}. hét ismétlődik, a program vége ${later} később lesz${dates}.`
      : `onnan folytatod, ahol abbahagytad, a program vége ${later} később lesz${dates}.`
  } else {
    program = week
      ? `egy hetet visszalépünk: a ${week}. héttel folytatod, a program vége ${later} később lesz${dates}.`
      : `egy hetet visszalépünk, a program vége ${later} később lesz${dates}.`
  }
  const ramp = ret.rampSessions >= 2
    ? 'Az első 2 edzés könnyített: harmadával kevesebb sorozat; az elsőn kb. 10%-kal kisebb súly, a másodikon a régi.'
    : 'Az első edzés könnyített: harmadával kevesebb sorozat, kb. 10%-kal kisebb súly.'
  return { headline, program, line: `${headline} · ${program}`, ramp }
}
