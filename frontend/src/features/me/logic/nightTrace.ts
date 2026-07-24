import { localDateString } from '@/shared/lib/dates'

/** Soft night-wake trace (spec D7): localStorage only, keyed by the MORNING the wake
 *  belongs to (an evening wake >= 18:00 belongs to tomorrow's log). SleepLogSheet
 *  prefills awakenings from it and clears it on a successful save. */
export interface NightTrace { count: number; lastAt: string }

const PREFIX = 'mezo-night-wake:'
const KEEP_DAYS = 3

export function traceDateFor(now: Date): string {
  if (now.getHours() >= 18) {
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    return localDateString(tomorrow)
  }
  return localDateString(now)
}

export function readNightWake(date: string): NightTrace | null {
  try {
    const raw = localStorage.getItem(PREFIX + date)
    if (!raw) return null
    const parsed = JSON.parse(raw) as NightTrace
    return typeof parsed?.count === 'number' ? parsed : null
  } catch {
    return null
  }
}

export function recordNightWake(now: Date = new Date()): void {
  try {
    const date = traceDateFor(now)
    const prev = readNightWake(date)
    const next: NightTrace = { count: (prev?.count ?? 0) + 1, lastAt: now.toISOString() }
    localStorage.setItem(PREFIX + date, JSON.stringify(next))
    prune(now)
  } catch { /* storage unavailable — the trace is best-effort */ }
}

export function clearNightWake(date: string): void {
  try { localStorage.removeItem(PREFIX + date) } catch { /* ignore */ }
}

function prune(now: Date): void {
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() - KEEP_DAYS)
  const cutoffIso = localDateString(cutoff)
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i)
    if (k?.startsWith(PREFIX) && k.slice(PREFIX.length) < cutoffIso) localStorage.removeItem(k)
  }
}
