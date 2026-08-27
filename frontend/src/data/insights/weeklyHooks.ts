// Heti retired (mezo-p2tr) — the Insights Weekly review (useWeekly + its score-derivation
// helpers) moved to /me/week (WeekPage, backed by GET /api/me/week — the score is now
// backend-computed). Everything from this file's original D' cut (mezo-t16y.1) is gone except
// `isoWeekNumber`, still shared by memoirApi.ts's real-mode "Hét N" title.

/** ISO-8601 week number of the given date (used for the "Hét N" title). */
export function isoWeekNumber(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
}
