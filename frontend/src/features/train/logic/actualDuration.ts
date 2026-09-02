// ============================================================
// Mezo · actualDuration — the MEASURED counterpart of sessionLength's estimate
// (mezo-1jm8). Two clocks reach the client: the raw wall-clock pair and the
// derived active time. The headline "tény" number is the elapsed wall clock,
// because that is what the user actually spent; active time is the fallback for
// a session that was auto-closed (finishedAt absent) and for backfilled history.
// ============================================================

export interface SessionTiming {
  startedAt?: string | null
  finishedAt?: string | null
  activeSeconds?: number | null
}

/** Whole minutes actually spent, or null when nothing usable was measured. */
export function actualMinutes(t: SessionTiming): number | null {
  const seconds = elapsedSeconds(t) ?? t.activeSeconds ?? null
  if (seconds == null || seconds < 60) return null
  return Math.round(seconds / 60)
}

function elapsedSeconds(t: SessionTiming): number | null {
  if (!t.startedAt || !t.finishedAt) return null
  const ms = Date.parse(t.finishedAt) - Date.parse(t.startedAt)
  return Number.isFinite(ms) && ms > 0 ? Math.round(ms / 1000) : null
}
