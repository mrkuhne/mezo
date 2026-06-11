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
