import type {
  ExpenditureExcludedDay, ExpenditureHistory, ExpenditureWeek, ExpenditureWeeklyCard,
  IntakeDayStatus,
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

// ── 5.1 A heti kártya — the last reviewed week, two suspicious excluded days, +60 kcal step ──
export function expenditureWeeklyCardSeed(): ExpenditureWeeklyCard {
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

export function intakeDaysSeed(): IntakeDayStatus[] {
  const today = todayIso()
  return LAST_14_DAYS.map(({ daysAgo, kcal, rule, mark }) => ({
    date: addDays(today, -daysAgo),
    kcal,
    status: deriveStatus(rule, mark),
    mark,
  }))
}

/** The mock's default applied base (matches the last reviewed week's card) — the mark
 *  mutations' "before" starting point until a mark has moved it. */
export const DEFAULT_APPLIED_BASE_KCAL = LAST_WEEK.appliedBaseKcal
