import { addDays, localDateString, mondayOf } from '@/shared/lib/dates'
import type {
  RecoveryCheckInAnswer,
  RecoveryPeriod,
  RecoveryReturnRule,
  RecoveryState,
  RecoveryUpsertRequest,
  TodayComeback,
} from '@/data/train/recoveryApi'
import type { WorkoutPlan } from '@/data/types'

// ============================================================
// Mezo · kímélő mód mock server (Kihagyás S2, mezo-q4xt2.2) — pure `RecoveryState → RecoveryState`
// transitions mirroring `RecoveryReturnService`/`RecoveryReturnPolicy` (backend), so mock mode is
// fully usable: open → protected days, BETTER → the return rule, undo, discard, release, waive.
// Self-contained: the programme shift is computed against a fixed mock meso (below) instead of
// the Train mock's own meso, which this never edits.
// ============================================================

/** Mock seed and real-mode placeholder alike: no period, nothing protected. */
export const recoveryEmpty: RecoveryState = { period: null, protectedDates: [], comeback: null }

const SERIOUS = new Set(['ILLNESS', 'STOMACH', 'INJURY', 'TRAVEL'])

const OFFSET: Record<RecoveryUpsertRequest['estimate'], number | null> = {
  TODAY: 0,
  FEW_DAYS: 2,
  WEEK: 6,
  UNKNOWN: null,
}

/** Whole days from `a` to `b` (calendar dates, DST-free). */
function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000)
}

/** The mock's active meso: 5 weeks, started two Mondays before this week's — today is in week 3. */
function mockMeso(today: string): { start: string; end: string; weeks: number } {
  const start = addDays(mondayOf(today), -14)
  return { start, end: addDays(start, 5 * 7 - 1), weeks: 5 }
}

/** `MesoWeeks.weekOf` — 1-based week of `date`, clamped to [1, weeks]. */
function weekOf(start: string, date: string, weeks: number): number {
  const w = Math.trunc(daysBetween(start, date) / 7) + 1
  return Math.max(1, Math.min(weeks, w))
}

/** `RecoveryReturnPolicy.decide`. */
export function decideReturn(start: string, endedOn: string): { rule: RecoveryReturnRule; daysOut: number; rampSessions: number } {
  const daysOut = Math.max(1, daysBetween(start, endedOn))
  if (daysOut <= 2) return { rule: 'CONTINUE', daysOut, rampSessions: 1 }
  if (daysOut <= 9) return { rule: 'RESUME', daysOut, rampSessions: 2 }
  return { rule: 'STEP_BACK', daysOut, rampSessions: 2 }
}

/** Protected dates in [today−7, today+13]: start … endedOn−1 (open-ended → the window's end), minus releases. */
function protectedDates(p: RecoveryPeriod | null | undefined, today: string): string[] {
  if (!p) return []
  const from = addDays(today, -7)
  const to = addDays(today, 13)
  const first = p.startDate > from ? p.startDate : from
  const last = p.endedOn && addDays(p.endedOn, -1) < to ? addDays(p.endedOn, -1) : to
  const out: string[] = []
  for (let d = first; d <= last; d = addDays(d, 1)) {
    if (!p.releasedDates.includes(d)) out.push(d)
  }
  return out
}

/** The period's read-time fields recomputed for `today`, then the whole state rebuilt around it. */
function build(p: RecoveryPeriod | null, today: string, comeback: RecoveryState['comeback'] = null): RecoveryState {
  if (!p) return { period: null, protectedDates: [], comeback }
  const period: RecoveryPeriod = {
    ...p,
    dayIndex: daysBetween(p.startDate, today) + 1,
    estimateExpired: !!p.expectedEnd && p.expectedEnd < today,
  }
  return { period, protectedDates: protectedDates(period, today), comeback: period.endedOn ? comeback : null }
}

function openPeriod(prev: RecoveryState): RecoveryPeriod {
  const p = prev.period
  if (!p || p.endedOn) throw new Error('TRAIN_RECOVERY_NOT_FOUND')
  return p
}

let mockIdCounter = 0
function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  mockIdCounter += 1
  return `mock-recovery-${mockIdCounter}`
}

/** PUT — open a period, or change the open one's category/estimate (its start is kept). */
export function mockOpen(prev: RecoveryState, req: RecoveryUpsertRequest, today = localDateString()): RecoveryState {
  if (!SERIOUS.has(req.category)) throw new Error('TRAIN_RECOVERY_CATEGORY_INVALID')
  const start = req.startDate ?? today
  if (start < addDays(today, -7) || start > today) throw new Error('TRAIN_RECOVERY_START_OUT_OF_WINDOW')
  const open = prev.period && !prev.period.endedOn ? prev.period : null
  const startDate = open?.startDate ?? start
  const off = OFFSET[req.estimate]
  const period: RecoveryPeriod = {
    id: open?.id ?? newId(),
    category: req.category,
    estimate: req.estimate,
    startDate,
    expectedEnd: off === null ? null : addDays(startDate, off),
    endedOn: null,
    dayIndex: 1,
    estimateExpired: false,
    checkedInToday: open?.checkedInToday ?? false,
    releasedDates: open?.releasedDates ?? [],
    releasedUnlightened: open?.releasedUnlightened ?? [],
    return: null,
  }
  return build(period, today)
}

/** POST check-in — NOT_YET keeps it open; BETTER ends it today and applies the return rule. */
export function mockCheckIn(prev: RecoveryState, answer: RecoveryCheckInAnswer, today = localDateString()): RecoveryState {
  const p = openPeriod(prev)
  if (answer === 'NOT_YET') return build({ ...p, checkedInToday: true }, today)
  if (today <= p.startDate) throw new Error('TRAIN_RECOVERY_TOO_EARLY')
  const d = decideReturn(p.startDate, today)
  let shiftDays = 0
  let newEndDate: string | null = null
  if (d.rule !== 'CONTINUE') {
    const meso = mockMeso(today)
    const weekAtStart = weekOf(meso.start, p.startDate, meso.weeks)
    const target = d.rule === 'RESUME' ? weekAtStart : Math.max(1, weekAtStart - 1)
    const current = Math.trunc(daysBetween(meso.start, today) / 7) + 1
    shiftDays = Math.max(0, current - target) * 7
    newEndDate = addDays(meso.end, shiftDays)
  }
  const ended: RecoveryPeriod = {
    ...p,
    endedOn: today,
    checkedInToday: true,
    return: { ...d, shiftDays, newEndDate },
  }
  return build(ended, today, { total: d.rampSessions, done: 0, waived: false })
}

/** POST undo-better — reopen the period ended today, reverting the shift. */
export function mockUndoBetter(prev: RecoveryState, today = localDateString()): RecoveryState {
  const p = prev.period
  if (!p || p.endedOn !== today) throw new Error('TRAIN_RECOVERY_UNDO_EXPIRED')
  return build({ ...p, endedOn: null, return: null }, today)
}

/** DELETE — „Tévedés volt": the open (or today-ended) period is gone. */
export function mockDiscard(prev: RecoveryState, today = localDateString()): RecoveryState {
  const p = prev.period
  if (!p || (p.endedOn && p.endedOn !== today)) throw new Error('TRAIN_RECOVERY_NOT_FOUND')
  return recoveryEmpty
}

function protectable(p: RecoveryPeriod, date: string, today: string): void {
  if (date < p.startDate || date > addDays(today, 13)) throw new Error('TRAIN_RECOVERY_DATE_NOT_PROTECTED')
}

/** PUT release — „Ma mégis edzek" on a protected date (lighter by default). */
export function mockRelease(prev: RecoveryState, date: string, lighten: boolean, today = localDateString()): RecoveryState {
  const p = openPeriod(prev)
  protectable(p, date, today)
  const releasedDates = [...new Set([...p.releasedDates, date])].sort()
  const unl = p.releasedUnlightened.filter((d) => d !== date)
  const releasedUnlightened = (lighten ? unl : [...unl, date]).sort()
  return build({ ...p, releasedDates, releasedUnlightened }, today)
}

/** DELETE release — the date is protected again. */
export function mockUnrelease(prev: RecoveryState, date: string, today = localDateString()): RecoveryState {
  const p = openPeriod(prev)
  protectable(p, date, today)
  return build({
    ...p,
    releasedDates: p.releasedDates.filter((d) => d !== date),
    releasedUnlightened: p.releasedUnlightened.filter((d) => d !== date),
  }, today)
}

/** POST waive-comeback — the ramp of the latest ended period is switched off (`total` 0). */
export function mockWaiveComeback(prev: RecoveryState, today = localDateString()): RecoveryState {
  if (!prev.period?.endedOn || !prev.comeback) throw new Error('TRAIN_RECOVERY_NOT_FOUND')
  return build(prev.period, today, { ...prev.comeback, total: 0, waived: true })
}

/** „Harmadával kevesebb sorozat" — the prototype's `cbSets` (4→3, 3→2, never below 1). */
export const rampSets = (n: number): number => Math.max(1, n - Math.round(n / 3))

/** The comeback ramp as `/today` would serve it: the next lightened session while the ramp of
 *  the latest ended period is neither waived nor used up. */
export function mockTodayComeback(state: RecoveryState | null | undefined): TodayComeback | null {
  const cb = state?.comeback
  if (!state?.period?.endedOn || !cb || cb.waived || cb.done >= cb.total) return null
  return { index: cb.done + 1, total: cb.total, mode: 'RAMP' }
}

/** Mock parity for `/today`'s comeback: the plan gets `comeback` and its working sets reduced by
 *  a third, exactly what the backend serves (weights are left alone — the mock has no engine). */
export function withMockComeback(plan: WorkoutPlan, state: RecoveryState | null | undefined): WorkoutPlan {
  const comeback = mockTodayComeback(state)
  if (!comeback) return plan
  return {
    ...plan,
    comeback,
    exercises: plan.exercises.map((e) => {
      const workingSets = rampSets(e.workingSets)
      return { ...e, workingSets, sets: e.warmupSets + workingSets }
    }),
  }
}
