// ============================================================
// Mezo · actualDuration — the MEASURED counterpart of sessionLength's estimate
// (mezo-1jm8). Two clocks reach the client: the raw wall-clock pair and the
// derived active time. The headline "tény" number is the elapsed wall clock,
// because that is what the user actually spent; active time is the fallback for
// a session that was auto-closed (finishedAt absent), for backfilled history,
// and — per the cap rule below — for a same-day late finish.
// ============================================================

export interface SessionTiming {
  startedAt?: string | null
  finishedAt?: string | null
  activeSeconds?: number | null
}

// Auto-close only settles a stale instance the NEXT day (WorkoutAutoCloseService), so a
// same-day "log until 09:00, tap finish at 20:00" session never gets auto-closed and its raw
// elapsed wall clock (finishedAt - startedAt) can read as many hours of idle time, not effort.
// activeSeconds (the clipped, derived measure every other surface in this feature already
// prefers) is always the sane number in that case. The rule: trust the raw elapsed clock only
// while it stays within a generous budget of activeSeconds — enough slack to absorb a real
// pause (a phone call, a meal break) without masking it, but not hours of an untouched app.
// Beyond that budget, elapsed is almost certainly clock drift from a late tap, not real duration,
// so fall back to activeSeconds.
const ELAPSED_OVER_ACTIVE_BUDGET_SECONDS = 30 * 60 // 30 minutes

/** Whole minutes actually spent, or null when nothing usable was measured. */
export function actualMinutes(t: SessionTiming): number | null {
  const seconds = preferredSeconds(t)
  if (seconds == null || seconds < 60) return null
  return Math.round(seconds / 60)
}

function preferredSeconds(t: SessionTiming): number | null {
  const elapsed = elapsedSeconds(t)
  const active = t.activeSeconds ?? null
  if (elapsed == null) return active
  if (active == null) return elapsed
  return elapsed - active > ELAPSED_OVER_ACTIVE_BUDGET_SECONDS ? active : elapsed
}

function elapsedSeconds(t: SessionTiming): number | null {
  if (!t.startedAt || !t.finishedAt) return null
  const ms = Date.parse(t.finishedAt) - Date.parse(t.startedAt)
  return Number.isFinite(ms) && ms > 0 ? Math.round(ms / 1000) : null
}
