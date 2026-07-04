/** YYYY-MM-DD in the user's local timezone (UTC slicing shifts evening entries to the wrong day). */
export const localDateString = (d: Date = new Date()) =>
  new Intl.DateTimeFormat('en-CA').format(d)

/**
 * Offset-bearing ISO-8601 datetime (`YYYY-MM-DDThh:mm:ss±hh:mm`) for a chosen local `date` + `time`.
 * The offset is THIS browser's local UTC offset for that wall-clock moment, so the value's
 * server-side `.toLocalDate()` equals `date`. Jackson's OffsetDateTime deserializer rejects a
 * zone-less string, and a naive `new Date(...).toISOString()` shifts local time to UTC — rolling the
 * day back in a +offset zone and corrupting the server's day key. Used by supplement-intake +
 * medication-dose logging (see `nowOffsetIso`, `fuelApi.logIntake`, `LogDoseSheet`'s dose capture).
 */
export function offsetIso(date: string, time: string): string {
  const local = new Date(`${date}T${time}:00`)
  const offMin = -local.getTimezoneOffset() // e.g. +120 for UTC+02:00
  const sign = offMin >= 0 ? '+' : '-'
  const abs = Math.abs(offMin)
  const oh = String(Math.floor(abs / 60)).padStart(2, '0')
  const om = String(abs % 60).padStart(2, '0')
  return `${date}T${time}:00${sign}${oh}:${om}`
}

/** Offset-bearing ISO-8601 datetime for browser-local NOW (to the minute) — the "log it now" timestamp. */
export function nowOffsetIso(d: Date = new Date()): string {
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return offsetIso(localDateString(d), time)
}

// Hungarian month abbreviations + day-of-week labels, matching the Phase-1
// mock display strings. Used to format backend ISO dates (`2026-05-01`) into
// the HU display labels the UI expects (`Máj 1`, `Máj 20 · Sze`).
const HU_MONTHS = ['Jan', 'Feb', 'Már', 'Ápr', 'Máj', 'Jún', 'Júl', 'Aug', 'Szep', 'Okt', 'Nov', 'Dec']
const HU_DOW = ['Vas', 'Hét', 'Kedd', 'Sze', 'Csü', 'Pén', 'Szo']
const HU_DOW_FULL = ['Vasárnap', 'Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat']

/** Full Hungarian weekday name for a Date — the Today header's real-mode dayLabel. */
export const huWeekdayFull = (d: Date = new Date()) => HU_DOW_FULL[d.getDay()]

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
