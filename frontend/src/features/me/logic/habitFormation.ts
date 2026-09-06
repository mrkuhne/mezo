// ============================================================
// Mezo · habit formation copy + geometry (mezo-08zl)
// Spec: docs/superpowers/specs/2026-09-06-habit-formation-design.md
//
// The backend returns NUMBERS only; every word the user reads is decided here, and every
// function in this file is pure so the wording and the curve can be tested without a DOM.
//
// Two rules run through all of it:
//   1. No confident zero. A null estimate stays null — we never phrase a guess as a fact.
//   2. A miss slows, never resets (design-iterations §3, ADR 0010): nothing here counts
//      streaks or breaks, and no branch produces failure language.
// ============================================================
import type { HabitFormationDay } from '@/data/types'

export interface FormationStage {
  /** Upper bound (exclusive) of this stage on the automaticity curve, in percent. */
  maxPct: number
  label: string
}

/** The four stages the user actually reads. The percentage is secondary to the words. */
export const FORMATION_STAGES: readonly FormationStage[] = [
  { maxPct: 25, label: 'még tudatos' },
  { maxPct: 60, label: 'épül' },
  { maxPct: 85, label: 'kezd magától menni' },
  { maxPct: 101, label: 'magától megy' },
]

export function stageIndexOf(automaticityPct: number): number {
  const i = FORMATION_STAGES.findIndex((s) => automaticityPct < s.maxPct)
  return i === -1 ? FORMATION_STAGES.length - 1 : i
}

export interface EtaPhrase {
  /** The range itself, e.g. "3–6 hét". */
  big: string
  /** What the range is about, e.g. "van hátra ebben a tempóban". */
  sub: string
}

const WEEKS_PER_MONTH = 4.345

/**
 * A RANGE, never a point estimate: the literature's individual spread is 4–335 days
 * (Singh 2024), so a single number would be false precision. The unit widens as the range
 * does — weeks while it is legible, then months, then an honest "fél éven túl" rather than
 * a 40-week figure nobody can act on.
 */
export function etaPhrase(weeksLo: number | null, weeksHi: number | null): EtaPhrase | null {
  if (weeksLo == null || weeksHi == null) {
    return null
  }
  const lo = Math.max(1, Math.round(weeksLo))
  const hi = Math.max(lo, Math.round(weeksHi))
  if (hi <= 12) {
    return { big: lo === hi ? `${hi} hét` : `${lo}–${hi} hét`, sub: 'ebben a tempóban' }
  }
  if (lo <= 26) {
    const mLo = Math.max(1, Math.round(lo / WEEKS_PER_MONTH))
    const mHi = Math.max(mLo, Math.round(hi / WEEKS_PER_MONTH))
    return {
      big: mLo === mHi ? `${mHi} hónap` : `${mLo}–${mHi} hónap`,
      sub: 'ebben a tempóban',
    }
  }
  return { big: 'fél éven túl', sub: 'ebben a tempóban — sűrűbb ismétlés közelebb hozza' }
}

/** Hétfő-first weekday buckets, so "melyik napokon megy" reads like a Hungarian week. */
export const WEEKDAY_LABELS = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'] as const

export interface WeekdayCell {
  label: string
  done: number
  missed: number
  /** done / (done + missed), or null when the day was never closed — no confident zero. */
  ratio: number | null
}

export function weekdayBreakdown(days: readonly HabitFormationDay[]): WeekdayCell[] {
  const cells: WeekdayCell[] = WEEKDAY_LABELS.map((label) => ({ label, done: 0, missed: 0, ratio: null }))
  for (const d of days) {
    // Parse as a plain calendar date — `new Date('2026-09-06')` is UTC midnight, which shifts
    // the weekday for anyone west of Greenwich.
    const [y, m, day] = d.date.split('-').map(Number)
    if (!y || !m || !day) {
      continue
    }
    const jsDay = new Date(y, m - 1, day).getDay() // 0 = vasárnap
    const cell = cells[(jsDay + 6) % 7]
    if (d.status === 'done') {
      cell.done += 1
    } else if (d.status === 'missed') {
      cell.missed += 1
    }
  }
  for (const c of cells) {
    const closed = c.done + c.missed
    c.ratio = closed > 0 ? c.done / closed : null
  }
  return cells
}

/**
 * The saturating curve itself, sampled for drawing: `automaticity(n) = 1 - e^(-k*n)`.
 * `n` is REPETITIONS, not calendar days — that is the whole point of the model, and the
 * axis label in the UI says so.
 */
export function curveY(k: number, reps: number): number {
  return 1 - Math.exp(-k * reps)
}

/** Repetitions at which the curve reaches `thresholdPct` — where the dashed line is drawn. */
export function repsAtThreshold(k: number, thresholdPct: number): number {
  return Math.log(1 / (1 - thresholdPct / 100)) / k
}
