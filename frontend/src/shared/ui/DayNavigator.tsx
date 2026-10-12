import { DatePicker } from '@/shared/ui/DatePicker'
import { useM } from '@/shared/i18n'
import { addDays, localDateString } from '@/shared/lib/dates'
import { fmtDate } from '@/shared/lib/format'

export interface DayNavigatorProps {
  date: string // YYYY-MM-DD (selected day)
  onChange: (date: string) => void // fires with the new ISO date (arrow step or calendar pick)
  maxDate?: string // default localDateString(); `next` disabled at maxDate — no future
  minDate?: string // optional floor; `prev` disabled at minDate
  /** The two-line date row of the Fuel Mai (prototype `dayNav`): „Ma / Tegnap / N nappal ezelőtt" over the full date.
   *  Off by default: the one-line variant reads „Ma" on today and the short date otherwise. */
  eyebrow?: boolean
}

/** Whole days between `iso` and `maxDate` (0 = today). */
function daysBack(iso: string, maxDate: string): number {
  return Math.round((Date.parse(`${maxDate}T12:00:00Z`) - Date.parse(`${iso}T12:00:00Z`)) / 86_400_000)
}

/**
 * The day pager (Folyadék F5, mezo-n4wf5.5 — prototype vilagos/fuel.js `dayNav`, CSS `.fa-dn` in
 * folyadek-fuel-mai.css): previous / next day arrows around the tappable date, which opens the calendar
 * (`DatePicker`). `next` is disabled at `maxDate` (no future), `prev` at `minDate`. ISO `YYYY-MM-DD` strings
 * compare lexicographically == chronologically, so bounds are string compares. Only consumer: FuelMaiPage.
 * No `@/data/*` imports — this is a shared/ui primitive.
 */
export function DayNavigator({ date, onChange, maxDate = localDateString(), minDate, eyebrow = false }: DayNavigatorProps) {
  const M = useM()
  const N = M.fuelMai.dayNav
  const canPrev = !minDate || date > minDate
  const canNext = date < maxDate
  // the label is formatted at render (the DatePicker calls it), so it follows the language
  const label = (iso: string) => (eyebrow ? fmtDate(iso, 'frame') : iso === maxDate ? N.today : fmtDate(iso, 'monthDayWeekday'))
  const back = daysBack(date, maxDate)
  return (
    <div className="fa-dn">
      <button type="button" className="fa-dn-step" aria-label={N.prev} disabled={!canPrev} onClick={() => onChange(addDays(date, -1))}>
        <span aria-hidden="true">‹</span>
      </button>
      <span className="fa-dn-mid">
        {eyebrow && <small>{back <= 0 ? N.today : back === 1 ? N.yesterday : N.daysAgo(back)}</small>}
        <DatePicker value={date} onChange={onChange} maxDate={maxDate} minDate={minDate} formatLabel={label} />
      </span>
      <button type="button" className="fa-dn-step" aria-label={N.next} disabled={!canNext} onClick={() => onChange(addDays(date, 1))}>
        <span aria-hidden="true">›</span>
      </button>
    </div>
  )
}
