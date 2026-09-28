import type {
  ExpenditureExcludedDay, ExpenditureHistory, ExpenditureWeek, ExpenditureWeeklyCard,
  IntakeDayMarkResult, IntakeDayStatus,
} from '@/data/fuel/expenditureApi'
import { addDays, localDateString, mondayOf } from '@/shared/lib/dates'

// Learned-expenditure part 2 (mezo-3n2so) mock seed — mirrors the owner-approved prototype's
// state (docs/design_2.0/prototypes/elo/fuel.html §"2. RÉSZ"): 12 weeks with one gap (the
// formula holds near 2400 kcal, the learned base converges 2400 → 2480 kcal, σ shrinks 320 → 150
// kcal, two holding weeks), the last 14 days carrying every status, and a weekly-summary card
// for the most recently reviewed week with two suspicious excluded days (Sze 1180, V 1020 kcal)
// and a +60 kcal step. All dates are anchored to TODAY so the mock stays valid on any day.

export const todayIso = (): string => localDateString()

/** This week's Monday — the currently-learning week, never itself reviewed yet. */
const thisMonday = (): string => mondayOf(todayIso())

/** The most recently REVIEWED week's Monday — one week before the current one. */
const lastReviewedMonday = (): string => addDays(thisMonday(), -7)

// ── 6.3 Hétről hétre — 12 calendar weeks, 11 reviewed rows, one gap (mezo-3n2so §6.3) ──
// [weeksBack from the last reviewed week, formula, posterior, sd, applied, step, usable, weighIn,
//  confidence, status] — weeksBack 8 is the gap (no row).
const WEEK_ROWS: Array<{
  weeksBack: number
  formulaBaseKcal: number
  posteriorBaseKcal: number
  posteriorSdKcal: number
  appliedBaseKcal: number
  stepKcal: number
  usableDays: number
  weighInDays: number
  confidence: ExpenditureWeek['confidence']
  status: ExpenditureWeek['status']
}> = [
  { weeksBack: 10, formulaBaseKcal: 2400, posteriorBaseKcal: 2400, posteriorSdKcal: 320, appliedBaseKcal: 2400, stepKcal: 0, usableDays: 3, weighInDays: 1, confidence: 'low', status: 'learning' },
  { weeksBack: 9, formulaBaseKcal: 2396, posteriorBaseKcal: 2440, posteriorSdKcal: 300, appliedBaseKcal: 2400, stepKcal: 0, usableDays: 4, weighInDays: 1, confidence: 'low', status: 'holding' },
  { weeksBack: 8, formulaBaseKcal: 2402, posteriorBaseKcal: 2465, posteriorSdKcal: 280, appliedBaseKcal: 2430, stepKcal: 30, usableDays: 6, weighInDays: 3, confidence: 'low', status: 'updated' },
  // weeksBack 7 — the gap week: too little data, no row at all.
  { weeksBack: 6, formulaBaseKcal: 2405, posteriorBaseKcal: 2470, posteriorSdKcal: 260, appliedBaseKcal: 2455, stepKcal: 25, usableDays: 5, weighInDays: 2, confidence: 'low', status: 'updated' },
  { weeksBack: 5, formulaBaseKcal: 2398, posteriorBaseKcal: 2462, posteriorSdKcal: 240, appliedBaseKcal: 2455, stepKcal: 0, usableDays: 3, weighInDays: 2, confidence: 'medium', status: 'holding' },
  { weeksBack: 4, formulaBaseKcal: 2400, posteriorBaseKcal: 2485, posteriorSdKcal: 220, appliedBaseKcal: 2475, stepKcal: 20, usableDays: 6, weighInDays: 4, confidence: 'medium', status: 'updated' },
  { weeksBack: 3, formulaBaseKcal: 2403, posteriorBaseKcal: 2460, posteriorSdKcal: 205, appliedBaseKcal: 2455, stepKcal: -20, usableDays: 6, weighInDays: 3, confidence: 'medium', status: 'updated' },
  { weeksBack: 2, formulaBaseKcal: 2401, posteriorBaseKcal: 2452, posteriorSdKcal: 190, appliedBaseKcal: 2455, stepKcal: 0, usableDays: 2, weighInDays: 1, confidence: 'medium', status: 'holding' },
  { weeksBack: 1, formulaBaseKcal: 2399, posteriorBaseKcal: 2445, posteriorSdKcal: 178, appliedBaseKcal: 2440, stepKcal: -15, usableDays: 5, weighInDays: 3, confidence: 'medium', status: 'updated' },
  { weeksBack: 0, formulaBaseKcal: 2400, posteriorBaseKcal: 2450, posteriorSdKcal: 165, appliedBaseKcal: 2420, stepKcal: -20, usableDays: 6, weighInDays: 4, confidence: 'medium', status: 'updated' },
]

/** The last reviewed week — the row the weekly-summary card also describes. */
const LAST_WEEK = {
  formulaBaseKcal: 2400,
  posteriorBaseKcal: 2470,
  posteriorSdKcal: 150,
  appliedBaseKcal: 2480,
  stepKcal: 60,
  usableDays: 4,
  weighInDays: 4,
  confidence: 'high' as ExpenditureWeek['confidence'],
  status: 'updated' as ExpenditureWeek['status'],
}

export function expenditureHistorySeed(): ExpenditureHistory {
  const anchor = lastReviewedMonday()
  const weeks: ExpenditureWeek[] = WEEK_ROWS.map((row) => ({
    weekStart: addDays(anchor, -7 * row.weeksBack),
    status: row.status,
    confidence: row.confidence,
    formulaBaseKcal: row.formulaBaseKcal,
    posteriorBaseKcal: row.posteriorBaseKcal,
    posteriorSdKcal: row.posteriorSdKcal,
    appliedBaseKcal: row.appliedBaseKcal,
    stepKcal: row.stepKcal,
    usableDays: row.usableDays,
    weighInDays: row.weighInDays,
  }))
  weeks.push({
    weekStart: anchor,
    status: LAST_WEEK.status,
    confidence: LAST_WEEK.confidence,
    formulaBaseKcal: LAST_WEEK.formulaBaseKcal,
    posteriorBaseKcal: LAST_WEEK.posteriorBaseKcal,
    posteriorSdKcal: LAST_WEEK.posteriorSdKcal,
    appliedBaseKcal: LAST_WEEK.appliedBaseKcal,
    stepKcal: LAST_WEEK.stepKcal,
    usableDays: LAST_WEEK.usableDays,
    weighInDays: LAST_WEEK.weighInDays,
  })
  return { learningEnabled: true, weeks }
}

// ── 5.4 Az utolsó 14 nap — every status represented, anchored to TODAY ──
const LAST_14_DAYS: Array<{
  daysAgo: number
  kcal: number | null
  rule: 'usable' | 'suspicious' | 'unlogged'
  mark: 'complete' | 'incomplete' | null
}> = [
  { daysAgo: 13, kcal: 2710, rule: 'usable', mark: null },
  { daysAgo: 12, kcal: 2890, rule: 'usable', mark: null },
  { daysAgo: 11, kcal: 1340, rule: 'suspicious', mark: null },
  { daysAgo: 10, kcal: null, rule: 'unlogged', mark: null },
  { daysAgo: 9, kcal: 3050, rule: 'usable', mark: null },
  { daysAgo: 8, kcal: 2150, rule: 'usable', mark: 'incomplete' },
  { daysAgo: 7, kcal: 2980, rule: 'usable', mark: null },
  { daysAgo: 6, kcal: 2820, rule: 'usable', mark: null },
  { daysAgo: 5, kcal: 1610, rule: 'suspicious', mark: 'complete' },
  { daysAgo: 4, kcal: 1180, rule: 'suspicious', mark: null },
  { daysAgo: 3, kcal: 2760, rule: 'usable', mark: null },
  { daysAgo: 2, kcal: null, rule: 'unlogged', mark: null },
  { daysAgo: 1, kcal: 3120, rule: 'usable', mark: null },
  { daysAgo: 0, kcal: 2200, rule: 'usable', mark: null },
]

/** The status a day would show, given its unmarked rule and the owner's mark (if any). */
function deriveStatus(
  rule: 'usable' | 'suspicious' | 'unlogged',
  mark: 'complete' | 'incomplete' | null,
): IntakeDayStatus['status'] {
  if (rule === 'unlogged') return 'unlogged'
  if (mark === 'complete') return 'confirmed_complete'
  if (mark === 'incomplete') return 'marked_incomplete'
  return rule
}

// ── Canonical mock learning state (mezo-3n2so, fix round 1) ──────────────────────────────────
// A single module-level store, NOT the QueryClient cache — the day-log (Task 11) reads a single
// day (`useIntakeDays(date, date)`) and the learning page (Task 10) reads the last 14
// (`useIntakeDays(from, to)`); each mounts its OWN `['intakeDays', from, to]` cache entry, so a
// mark made through one range must be visible to a freshly-mounted query on another range, and a
// dismissed card must stay dismissed across a remount. Storing the marks/applied-base/dismissed
// flag here (read by every `intakeDaysSeed`/`expenditureWeeklyCardSeed` call, mutated only by
// `applyMockDayMark`/`dismissMockWeeklyCard`) makes every mount agree, independent of which
// QueryClient or which range happens to already be cached.
//
// Module-level state outlives a single test, so any test that mutates it MUST reset it —
// `resetMockLearningState()` is meant for an `afterEach`.
interface MockLearningState {
  /** Explicit overrides of a day's mark, keyed by ISO date — absent means "use the seed's
   *  initial mark below". */
  markOverrides: Map<string, 'complete' | 'incomplete' | null>
  appliedBaseKcal: number
  weeklyCardDismissed: boolean
}

function initialMockLearningState(): MockLearningState {
  return { markOverrides: new Map(), appliedBaseKcal: LAST_WEEK.appliedBaseKcal, weeklyCardDismissed: false }
}

let mockState: MockLearningState = initialMockLearningState()

/** Test-only: resets the module-level mock learning state (marks, applied base, the dismissed
 *  weekly card) back to the seed's initial values. Call from an `afterEach`. */
export function resetMockLearningState(): void {
  mockState = initialMockLearningState()
}

function liveMarkFor(date: string, seedMark: 'complete' | 'incomplete' | null): 'complete' | 'incomplete' | null {
  return mockState.markOverrides.has(date) ? (mockState.markOverrides.get(date) ?? null) : seedMark
}

/**
 * Live per-day statuses, canonical across every mounted range — always reads the current
 * `mockState`, never a snapshot. `from`/`to` filter the fixed 14-day window; omit either to get
 * the whole window (used internally to look a day up regardless of what range a caller asked for).
 */
export function intakeDaysSeed(from?: string, to?: string): IntakeDayStatus[] {
  const today = todayIso()
  return LAST_14_DAYS
    .map(({ daysAgo, kcal, rule, mark }) => {
      const date = addDays(today, -daysAgo)
      const liveMark = liveMarkFor(date, mark)
      return { date, kcal, status: deriveStatus(rule, liveMark), mark: liveMark }
    })
    .filter((d) => (from == null || d.date >= from) && (to == null || d.date <= to))
}

// ── 5.1 A heti kártya — the last reviewed week, two suspicious excluded days, +60 kcal step ──
/** `null` once `dismissMockWeeklyCard()` has run — mirrors the 204 "already dismissed" case. */
export function expenditureWeeklyCardSeed(): ExpenditureWeeklyCard | null {
  if (mockState.weeklyCardDismissed) return null
  const weekStart = lastReviewedMonday()
  const excludedDays: ExpenditureExcludedDay[] = [
    { date: addDays(weekStart, 2), kcal: 1180, reason: 'suspicious' }, // Sze
    { date: addDays(weekStart, 6), kcal: 1020, reason: 'suspicious' }, // V
  ]
  return {
    weekStart,
    weekEnd: addDays(weekStart, 6),
    status: LAST_WEEK.status,
    confidence: LAST_WEEK.confidence,
    appliedBaseKcal: LAST_WEEK.appliedBaseKcal,
    posteriorSdKcal: LAST_WEEK.posteriorSdKcal,
    stepKcal: LAST_WEEK.stepKcal,
    usableDays: LAST_WEEK.usableDays,
    weighInDays: LAST_WEEK.weighInDays,
    minUsableDays: 4,
    minWeighInDays: 2,
    excludedDays,
  }
}

export function dismissMockWeeklyCard(): void {
  mockState.weeklyCardDismissed = true
}

export type MockIntakeDayMarkAction =
  | { kind: 'set'; status: 'complete' | 'incomplete' }
  | { kind: 'clear' }

/**
 * Mock mark/clear (mezo-3n2so): a deterministic stand-in for the real re-chain, applied against
 * the canonical `mockState` (so every mounted `useIntakeDays` range picks it up, not just the
 * one the caller happened to mark through). COMPLETE on a suspicious day pulls the applied base
 * down 40 kcal (a previously-excluded low day now counts); INCOMPLETE on a usable day pushes it
 * up 40 kcal (a previously-counted day is dropped); CLEAR reverses whichever of those the day
 * currently carries. TODAY never recomputes — the mark is saved, but the base only moves at next
 * Monday's run (`recomputed: false`, before === after).
 */
export function applyMockDayMark(date: string, action: MockIntakeDayMarkAction): IntakeDayMarkResult {
  const current = intakeDaysSeed().find((d) => d.date === date)
  if (!current || current.status === 'unlogged') {
    throw new Error(`No logged intake on ${date}`)
  }
  const before = mockState.appliedBaseKcal
  const isToday = date === todayIso()

  let nextStatus: IntakeDayStatus['status'] = current.status
  let nextMark: IntakeDayStatus['mark'] = current.mark ?? null
  let delta = 0

  if (action.kind === 'set' && action.status === 'complete') {
    delta = current.status === 'suspicious' ? -40 : 0
    nextStatus = 'confirmed_complete'
    nextMark = 'complete'
  } else if (action.kind === 'set') {
    delta = current.status === 'usable' ? 40 : 0
    nextStatus = 'marked_incomplete'
    nextMark = 'incomplete'
  } else if (current.status === 'confirmed_complete') {
    delta = 40
    nextStatus = 'suspicious'
    nextMark = null
  } else if (current.status === 'marked_incomplete') {
    delta = -40
    nextStatus = 'usable'
    nextMark = null
  }

  const after = isToday ? before : before + delta
  mockState.markOverrides.set(date, nextMark)
  mockState.appliedBaseKcal = after
  const day: IntakeDayStatus = { ...current, status: nextStatus, mark: nextMark }
  return { day, appliedBaseBeforeKcal: before, appliedBaseAfterKcal: after, recomputed: !isToday }
}
