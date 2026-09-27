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
