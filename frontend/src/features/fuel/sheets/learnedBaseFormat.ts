// Formatting helpers for the „Hogy tanultam?” explainer (mezo-y72o3).
// The words live in the catalog (`fuelLogika.learned`) and are read when CALLED / READ (the exported
// label maps are getter-backed), so every importer follows a language switch without an edit.
// Dates: English goes through `format.ts`; Hungarian keeps this sheet's own short forms („szept. 14",
// „Sze, szept. 23.") — `format.ts` has no dotted lower-case month / one-letter weekday style.
import type { ExpenditureHistory, IntakeDayMarkResult, IntakeDayStatus } from '@/data/fuel/expenditureApi'
import { fmtDate, locale } from '@/shared/lib/format'
import { getLang, m } from '@/shared/i18n'

const HU_MONTHS_SHORT = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.']

/** '2026-09-14' → 'szept. 14' (HU short month, no trailing dot after the day) · '14 Sep'. */
export function huShortDate(iso: string): string {
  if (getLang() !== 'hu') return fmtDate(iso.slice(0, 10), 'monthDay')
  const [, month, day] = iso.split('-').map(Number)
  return `${HU_MONTHS_SHORT[month - 1]} ${day}`
}

/** Plain rounded kcal, no thousands grouping (matches the energy sheet). */
export const nf = (n: number) => String(Math.round(n))
/** Signed with a real minus sign. */
export const signed = (n: number) => (Math.round(n) < 0 ? `−${nf(Math.abs(n))}` : `+${nf(n)}`)
/** The uncertainty is not that precise — nearest 10 kcal. */
export const round10 = (n: number) => Math.round(n / 10) * 10
/** Fixed fraction digits in the app language's format (HU decimal comma · EN point). `format.ts` has
 *  no fixed-digit style (`fmtNum` drops a zero fraction), so this stays a `toLocaleString` — but on
 *  `locale()`, never a hard-coded `hu-HU`. */
export const dec = (n: number, digits: number) =>
  n.toLocaleString(locale(), { minimumFractionDigits: digits, maximumFractionDigits: digits })

/** Learned-base confidence words (mezo-zz91i), verbatim per the spec. Getter-backed. */
export const CONFIDENCE_WORD: Record<'low' | 'medium' | 'high', string> = {
  get low() { return m().fuelLogika.learned.confidence.low },
  get medium() { return m().fuelLogika.learned.confidence.medium },
  get high() { return m().fuelLogika.learned.confidence.high },
}

/** A reviewed week, Monday–Sunday: 'szept. 21–27.' — the month repeats only when the week
 *  crosses one ('szept. 28–okt. 4.'). English: '21–27 Sep' · '28 Sep – 4 Oct'. */
export function huWeekRange(startIso: string, endIso: string): string {
  const sameMonth = startIso.slice(0, 7) === endIso.slice(0, 7)
  if (getLang() !== 'hu') {
    return sameMonth
      ? `${Number(startIso.slice(8, 10))}–${huShortDate(endIso)}`
      : `${huShortDate(startIso)} – ${huShortDate(endIso)}`
  }
  return `${huShortDate(startIso)}–${sameMonth ? Number(endIso.slice(8, 10)) : huShortDate(endIso)}.`
}

// The prototype's short weekday set (elo/fuel.html `WDS`), Sunday first.
const HU_WD_SHORT = ['V', 'H', 'K', 'Sze', 'Cs', 'P', 'Szo']

/** '2026-09-23' → 'Sze, szept. 23.' · 'Wed, 23 Sep' — one day of a reviewed week. */
export function huWeekdayDate(iso: string): string {
  if (getLang() !== 'hu') return `${fmtDate(iso.slice(0, 10), 'weekdayShort')}, ${huShortDate(iso)}`
  const [year, month, day] = iso.split('-').map(Number)
  return `${HU_WD_SHORT[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]}, ${huShortDate(iso)}.`
}

/** The line after a day mark re-chains the base (mezo-3n2so, elo/fuel.html `changeMsg`): how much
 *  the frame moved — shared by the „Heti tanulás” sheet and the „Hogy tanultam?” page's day list. */
export function markChangeLine(r: Pick<IntakeDayMarkResult, 'appliedBaseBeforeKcal' | 'appliedBaseAfterKcal'>): string {
  const before = r.appliedBaseBeforeKcal
  const after = r.appliedBaseAfterKcal
  const delta = before != null && after != null ? Math.round(after - before) : 0
  const words = m().fuelLogika.learned
  return delta ? words.changed(signed(delta)) : words.unchanged
}

/** Whether a day mark can move the served frame: `learning` (switch on, a learned week exists),
 *  `off` (the owner's switch is off — the formula serves), `empty` (no learned week yet). An
 *  unresolved history reads as `learning`, like the „Hogy tanultam?” page. */
export type LearningMode = 'learning' | 'off' | 'empty'
export function learningModeOf(history: ExpenditureHistory | null): LearningMode {
  if (history && history.weeks.length === 0) return 'empty'
  return history?.learningEnabled === false ? 'off' : 'learning'
}

/** When the frame cannot move, the mark is only saved — never claim a kcal change (mezo-3n2so). Getter-backed. */
export const SAVED_ONLY: Record<Exclude<LearningMode, 'learning'>, string> = {
  get off() { return m().fuelLogika.learned.savedOnly.off },
  get empty() { return m().fuelLogika.learned.savedOnly.empty },
}

/** The toast after a day mark, honest per mode — shared by the day log and the day list. */
export function markToastLine(mode: LearningMode, r: Pick<IntakeDayMarkResult, 'appliedBaseBeforeKcal' | 'appliedBaseAfterKcal'>): string {
  return mode === 'learning' ? markChangeLine(r) : SAVED_ONLY[mode]
}

/** A day's status chip: copy + tone (elo/fuel.html `STATUS`; tones map to `.fwl-st.st-*`). Getter-backed:
 *  `DAY_STATUS[status]` builds the pair when it is READ, with the word of the current language. */
export const DAY_STATUS: Record<IntakeDayStatus['status'], [string, string]> = {
  get usable(): [string, string] { return [m().fuelLogika.learned.dayStatus.usable, 'ok'] },
  get suspicious(): [string, string] { return [m().fuelLogika.learned.dayStatus.suspicious, 'sus'] },
  get confirmed_complete(): [string, string] { return [m().fuelLogika.learned.dayStatus.confirmed_complete, 'mc'] },
  get marked_incomplete(): [string, string] { return [m().fuelLogika.learned.dayStatus.marked_incomplete, 'mi'] },
  get unlogged(): [string, string] { return [m().fuelLogika.learned.dayStatus.unlogged, 'none'] },
}

/** Does the day count in the learning? (elo/fuel.html `isOn`) */
export const dayCounts = (s: IntakeDayStatus['status']) => s === 'usable' || s === 'confirmed_complete'
