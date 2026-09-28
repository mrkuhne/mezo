// Formatting helpers for the „Hogy tanultam?” explainer (mezo-y72o3).

const HU_MONTHS_SHORT = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.']

/** '2026-09-14' → 'szept. 14' (HU short month, no trailing dot after the day). */
export function huShortDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${HU_MONTHS_SHORT[m - 1]} ${d}`
}

/** Plain rounded kcal, no thousands grouping (matches the energy sheet). */
export const nf = (n: number) => String(Math.round(n))
/** Signed with a real minus sign. */
export const signed = (n: number) => (Math.round(n) < 0 ? `−${nf(Math.abs(n))}` : `+${nf(n)}`)
/** The uncertainty is not that precise — nearest 10 kcal. */
export const round10 = (n: number) => Math.round(n / 10) * 10
/** HU decimal comma, fixed fraction digits. */
export const dec = (n: number, digits: number) =>
  n.toLocaleString('hu-HU', { minimumFractionDigits: digits, maximumFractionDigits: digits })

/** Learned-base confidence words (mezo-zz91i), verbatim per the spec. */
export const CONFIDENCE_WORD = { low: 'Még tanulok', medium: 'Közepesen biztos', high: 'Biztos' } as const

/** A reviewed week, Monday–Sunday: 'szept. 21–27.' — the month repeats only when the week
 *  crosses one ('szept. 28–okt. 4.'). */
export function huWeekRange(startIso: string, endIso: string): string {
  const sameMonth = startIso.slice(0, 7) === endIso.slice(0, 7)
  return `${huShortDate(startIso)}–${sameMonth ? Number(endIso.slice(8, 10)) : huShortDate(endIso)}.`
}

// The prototype's short weekday set (elo/fuel.html `WDS`), Sunday first.
const HU_WD_SHORT = ['V', 'H', 'K', 'Sze', 'Cs', 'P', 'Szo']

/** '2026-09-23' → 'Sze, szept. 23.' — one day of a reviewed week. */
export function huWeekdayDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${HU_WD_SHORT[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}, ${huShortDate(iso)}.`
}
