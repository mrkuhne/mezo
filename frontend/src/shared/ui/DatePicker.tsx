import { useEffect, useState } from 'react'
import { cn } from '@/shared/lib/cn'
import { addDays, huMonthDayDow, localDateString } from '@/shared/lib/dates'
import { fmtDate } from '@/shared/lib/format'
import { useM } from '@/shared/i18n'

export interface DatePickerProps {
  value: string // YYYY-MM-DD (selected day)
  onChange: (date: string) => void // fires with the picked ISO date, then closes
  maxDate?: string // default localDateString(); days after are disabled
  minDate?: string // optional floor
  formatLabel?: (iso: string) => string // trigger label; default huMonthDayDow
}

// The month header („2026. október" / "October 2026") and the Monday-first weekday column heads (H K Sze Cs P Szo V /
// Mon … Sun) come from `format.ts`, built at render: the calendar follows the app language (Folyadék F5).
const A_MONDAY = '2026-10-05'

// Monday-first ISO day cells for the visible month, with leading/trailing nulls to fill weeks.
function monthCells(year: number, month0: number): (string | null)[] {
  const first = new Date(year, month0, 1)
  const lead = (first.getDay() + 6) % 7 // Mon=0 … Sun=6
  const days = new Date(year, month0 + 1, 0).getDate()
  const cells: (string | null)[] = Array(lead).fill(null)
  for (let d = 1; d <= days; d++) cells.push(localDateString(new Date(year, month0, d)))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

/**
 * Themed, domain-free calendar popover for read-only date navigation. A pill trigger shows the
 * formatted selected day; clicking opens a Monday-first month grid. Picking a day fires `onChange`
 * and closes; days after `maxDate` (default today) — and before `minDate` — are disabled. Mirrors
 * the popover pattern of SubNavDropdown (open state, window Escape listener, backdrop close).
 * ISO `YYYY-MM-DD` strings compare lexicographically == chronologically, so bound checks are string
 * comparisons. No `@/data/*` imports — this is a shared/ui primitive.
 *
 * Skin (üveg U10, mezo-me75u.10): a lavender glass popover, sheen off (`.dp-cal.glass.is-still`),
 * flat round month arrows, the selected day a lit lavender fill with dark ink, today a hairline
 * ring, out-of-range days dimmed — all in the `uveg reteg ablak` block of prototype.css; no
 * inline colours. A page that re-dresses it keeps its own scoped rules: the Fuel Mai day pager (its only
 * consumer today) wears the domain's liquid on the selected day (`.fa-dn-mid .dp-*`, folyadek-fuel-mai.css).
 * Words: `frame.datePicker`; the month and the weekdays: `format.ts`.
 */
export function DatePicker({ value, onChange, maxDate, minDate, formatLabel }: DatePickerProps) {
  const D = useM().frame.datePicker
  const [open, setOpen] = useState(false)
  // Visible month, initialised from value's year/month; re-synced to value on each open.
  const [vy, setVy] = useState(() => Number(value.slice(0, 4)))
  const [vm, setVm] = useState(() => Number(value.slice(5, 7)) - 1) // month0

  const today = localDateString()
  const max = maxDate ?? today

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function openPicker() {
    setVy(Number(value.slice(0, 4)))
    setVm(Number(value.slice(5, 7)) - 1)
    setOpen(true)
  }

  function stepMonth(delta: number) {
    const d = new Date(vy, vm + delta, 1)
    setVy(d.getFullYear())
    setVm(d.getMonth())
  }

  const cells = monthCells(vy, vm)
  // Don't let the header navigate into a fully-out-of-range month (viewing tone: no future).
  const nextDisabled = localDateString(new Date(vy, vm + 1, 1)) > max
  const prevDisabled = minDate ? localDateString(new Date(vy, vm, 0)) < minDate : false

  return (
    <div className="dp-wrap">
      <button
        type="button"
        aria-label={D.pick}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openPicker())}
        className="dp-trigger"
      >
        {(formatLabel ?? huMonthDayDow)(value)}
      </button>

      {open && (
        <>
          <button type="button" aria-label={D.close} onClick={() => setOpen(false)} className="dp-veil" />
          <div role="dialog" aria-label={D.calendar} className="dp-cal glass is-still">
            <div className="dp-head">
              <button
                type="button"
                aria-label={D.prevMonth}
                onClick={() => stepMonth(-1)}
                disabled={prevDisabled}
                className="dp-nav"
              >
                ‹
              </button>
              <strong>{fmtDate(new Date(vy, vm, 1, 12), 'monthYear')}</strong>
              <button
                type="button"
                aria-label={D.nextMonth}
                onClick={() => stepMonth(1)}
                disabled={nextDisabled}
                className="dp-nav"
              >
                ›
              </button>
            </div>

            <div className="dp-grid">
              {Array.from({ length: 7 }, (_, i) => (
                <div key={i} className="dp-dow">{fmtDate(addDays(A_MONDAY, i), 'weekdayCompact')}</div>
              ))}
            </div>

            <div className="dp-grid">
              {cells.map((iso, i) =>
                iso === null ? (
                  <div key={`empty-${i}`} />
                ) : (
                  <button
                    key={iso}
                    type="button"
                    aria-label={iso}
                    aria-current={iso === today ? 'date' : undefined}
                    disabled={iso > max || (minDate ? iso < minDate : false)}
                    onClick={() => {
                      onChange(iso)
                      setOpen(false)
                    }}
                    className={cn('dp-day', iso === value && 'is-sel', iso === today && 'is-today')}
                  >
                    {Number(iso.slice(8, 10))}
                  </button>
                ),
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
