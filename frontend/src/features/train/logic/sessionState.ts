// ============================================================
// Mezo · sessionState — which state chip a session card wears (mezo-9bbc).
// Exactly four values; a logged session shows none (its eyebrow reads MEGVAN).
// `now` is injectable so tests stay deterministic.
// ============================================================
export type SessionState = 'now' | 'today' | 'missed' | 'planned'

export const SESSION_STATE_LABEL: Record<SessionState, string> = {
  now: 'MOST',
  today: 'MA',
  missed: 'ELMARADT',
  planned: 'TERVEZETT',
}

/** Minutes-since-midnight of a `HH:MM` string; null for missing/malformed/out-of-range input. */
const minutes = (t?: string | null): number | null => {
  if (!t) return null
  const m = /^(\d{2}):(\d{2})$/.exec(t)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h < 0 || h > 23 || min < 0 || min > 59) return null
  return h * 60 + min
}

export function sessionState({
  dayIso,
  todayIso,
  timeOfDay,
  now = new Date(),
}: {
  /** ISO date of the day the card belongs to. */
  dayIso: string
  /** ISO date of today (from `localDateString()`). */
  todayIso: string
  timeOfDay?: string | null
  now?: Date
}): SessionState {
  if (dayIso < todayIso) return 'missed'
  if (dayIso > todayIso) return 'planned'
  const start = minutes(timeOfDay)
  if (start === null) return 'today'
  const nowMin = now.getHours() * 60 + now.getMinutes()
  return Math.abs(start - nowMin) <= 60 ? 'now' : 'today'
}
