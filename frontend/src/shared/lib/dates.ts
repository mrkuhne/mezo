/** YYYY-MM-DD in the user's local timezone (UTC slicing shifts evening entries to the wrong day). */
export const localDateString = (d: Date = new Date()) =>
  new Intl.DateTimeFormat('en-CA').format(d)

// Hungarian month abbreviations + day-of-week labels, matching the Phase-1
// mock display strings. Used to format backend ISO dates (`2026-05-01`) into
// the HU display labels the UI expects (`Máj 1`, `Máj 20 · Sze`).
const HU_MONTHS = ['Jan', 'Feb', 'Már', 'Ápr', 'Máj', 'Jún', 'Júl', 'Aug', 'Szep', 'Okt', 'Nov', 'Dec']
const HU_DOW = ['Vas', 'Hét', 'Kedd', 'Sze', 'Csü', 'Pén', 'Szo']

/** '2026-05-01' -> 'Máj 1' (Hungarian month abbrev, no leading zero). */
export function huMonthDay(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${HU_MONTHS[m - 1]} ${d}`
}

/** '2026-05-20' -> 'Máj 20 · Sze' (TRUE day-of-week — mock fixtures are not authoritative here). */
export function huMonthDayDow(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${huMonthDay(iso)} · ${HU_DOW[new Date(y, m - 1, d).getDay()]}`
}

/**
 * The 1-based week (containing today) of a dated block, clamped to [1, weeks] — week 1 before the
 * start date. Mirrors the backend's `RunningService.clampWeek`/`TrainService.clampWeek` so mock mode
 * derives `currentWeek` identically. `Math.trunc` matches Java's truncate-toward-zero integer
 * division for future start dates (negative day spans).
 */
export function currentWeekOf(startIso: string, weeks: number): number {
  const [sy, sm, sd] = startIso.split('-').map(Number)
  const start = new Date(sy, sm - 1, sd)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const days = Math.round((today.getTime() - start.getTime()) / 86_400_000) // DST-safe day span
  const week = Math.trunc(days / 7) + 1
  return Math.max(1, Math.min(weeks, week))
}
