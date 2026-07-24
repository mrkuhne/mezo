import type { SleepEntry } from '@/data/types'
import { localDateString } from '@/shared/lib/dates'

/** Escalation trigger (slice C3, spec D4): trailing-14-day averages over the sleep log,
 *  never under 5 samples. 'short' (avg duration < 6.0h) outranks 'quality' (avg <= 4/10).
 *  The snooze is a localStorage ISO date (muted until, exclusive) — the nightTrace idiom. */

export const ESCALATION_WINDOW_DAYS = 14
export const MIN_SAMPLES = 5
export const SHORT_AVG_H = 6.0
export const POOR_AVG_QUALITY = 4
export const SNOOZE_DAYS = 14
export const SNOOZE_KEY = 'mezo-sleep-escal-snooze'

export type EscalationReason = 'short' | 'quality'
export interface EscalationResult { triggered: boolean; reason: EscalationReason | null }

const addDaysIso = (iso: string, delta: number): string => {
  const d = new Date(`${iso}T12:00:00`) // noon avoids DST edge shifting the date
  d.setDate(d.getDate() + delta)
  return localDateString(d)
}

export function evaluateEscalation(log: SleepEntry[], todayIso: string): EscalationResult {
  const windowStart = addDaysIso(todayIso, -ESCALATION_WINDOW_DAYS)
  const inWindow = log.filter((e) => e.date > windowStart && e.date <= todayIso)
  if (inWindow.length < MIN_SAMPLES) return { triggered: false, reason: null }
  const avg = (f: (e: SleepEntry) => number) =>
    inWindow.reduce((s, e) => s + f(e), 0) / inWindow.length
  if (avg((e) => e.duration) < SHORT_AVG_H) return { triggered: true, reason: 'short' }
  if (avg((e) => e.quality) <= POOR_AVG_QUALITY) return { triggered: true, reason: 'quality' }
  return { triggered: false, reason: null }
}

export function isSnoozed(todayIso: string): boolean {
  try {
    const until = localStorage.getItem(SNOOZE_KEY)
    if (!until || !/^\d{4}-\d{2}-\d{2}$/.test(until)) return false
    return todayIso < until
  } catch {
    return false
  }
}

export function snooze(todayIso: string): void {
  try {
    localStorage.setItem(SNOOZE_KEY, addDaysIso(todayIso, SNOOZE_DAYS))
  } catch { /* storage unavailable — best effort */ }
}
