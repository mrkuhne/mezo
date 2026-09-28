// Formatting helpers for the „Hogy tanultam?” explainer (mezo-y72o3).
import type { ExpenditureHistory, IntakeDayMarkResult, IntakeDayStatus } from '@/data/fuel/expenditureApi'

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

/** The line after a day mark re-chains the base (mezo-3n2so, elo/fuel.html `changeMsg`): how much
 *  the frame moved — shared by the „Heti tanulás” sheet and the „Hogy tanultam?” page's day list. */
export function markChangeLine(r: Pick<IntakeDayMarkResult, 'appliedBaseBeforeKcal' | 'appliedBaseAfterKcal'>): string {
  const before = r.appliedBaseBeforeKcal
  const after = r.appliedBaseAfterKcal
  const delta = before != null && after != null ? Math.round(after - before) : 0
  return delta ? `A keret ${signed(delta)} kcal-lal változott` : 'A keret nem változott'
}

/** Whether a day mark can move the served frame: `learning` (switch on, a learned week exists),
 *  `off` (the owner's switch is off — the formula serves), `empty` (no learned week yet). An
 *  unresolved history reads as `learning`, like the „Hogy tanultam?” page. */
export type LearningMode = 'learning' | 'off' | 'empty'
export function learningModeOf(history: ExpenditureHistory | null): LearningMode {
  if (history && history.weeks.length === 0) return 'empty'
  return history?.learningEnabled === false ? 'off' : 'learning'
}

/** When the frame cannot move, the mark is only saved — never claim a kcal change (mezo-3n2so). */
export const SAVED_ONLY: Record<Exclude<LearningMode, 'learning'>, string> = {
  off: 'Elmentettem — a tanult érték frissült, a keretet most a képlet adja.',
  empty: 'Elmentettem — amint elég adatom lesz, beleszámolom.',
}

/** The toast after a day mark, honest per mode — shared by the day log and the day list. */
export function markToastLine(mode: LearningMode, r: Pick<IntakeDayMarkResult, 'appliedBaseBeforeKcal' | 'appliedBaseAfterKcal'>): string {
  return mode === 'learning' ? markChangeLine(r) : SAVED_ONLY[mode]
}

/** A day's status chip: copy + tone (elo/fuel.html `STATUS`; tones map to `.fwl-st.st-*`). */
export const DAY_STATUS: Record<IntakeDayStatus['status'], [string, string]> = {
  usable: ['számít', 'ok'],
  suspicious: ['hiányosnak tűnt', 'sus'],
  confirmed_complete: ['te jelölted teljesnek', 'mc'],
  marked_incomplete: ['te jelölted hiányosnak', 'mi'],
  unlogged: ['nincs felírva', 'none'],
}

/** Does the day count in the learning? (elo/fuel.html `isOn`) */
export const dayCounts = (s: IntakeDayStatus['status']) => s === 'usable' || s === 'confirmed_complete'
