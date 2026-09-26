import { useEffect, useState } from 'react'
import { cn } from '@/shared/lib/cn'
import { huMonthDayDow, localDateString } from '@/shared/lib/dates'

export interface DatePickerProps {
  value: string // YYYY-MM-DD (selected day)
  onChange: (date: string) => void // fires with the picked ISO date, then closes
  maxDate?: string // default localDateString(); days after are disabled
  minDate?: string // optional floor
  formatLabel?: (iso: string) => string // trigger label; default huMonthDayDow
}

// Hungarian month labels for the calendar header. HU_MONTHS in dates.ts is module-private
// (its display strings feed the ISO->label formatters), so the header keeps its own copy.
const HU_MONTHS = ['Jan', 'Feb', 'Már', 'Ápr', 'Máj', 'Jún', 'Júl', 'Aug', 'Szep', 'Okt', 'Nov', 'Dec']
// Monday-first weekday column headers (Hétfő … Vasárnap).
const HU_DOW_SHORT = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V']

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
 * inline colours. Pages that re-dress the trigger (Rutin) keep their own scoped rules.
 */
export function DatePicker({ value, onChange, maxDate, minDate, formatLabel }: DatePickerProps) {
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
        aria-label="Dátum kiválasztása"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openPicker())}
        className="dp-trigger"
      >
        {(formatLabel ?? huMonthDayDow)(value)}
      </button>

      {open && (
        <>
          <button type="button" aria-label="Bezárás" onClick={() => setOpen(false)} className="dp-veil" />
          <div role="dialog" aria-label="Naptár" className="dp-cal glass is-still">
            <div className="dp-head">
              <button
                type="button"
                aria-label="Előző hónap"
                onClick={() => stepMonth(-1)}
                disabled={prevDisabled}
                className="dp-nav"
              >
                ‹
              </button>
              <strong>
                {HU_MONTHS[vm]} {vy}
              </strong>
              <button
                type="button"
                aria-label="Következő hónap"
                onClick={() => stepMonth(1)}
                disabled={nextDisabled}
                className="dp-nav"
              >
                ›
              </button>
            </div>

            <div className="dp-grid">
              {HU_DOW_SHORT.map((d) => (
                <div key={d} className="dp-dow">
                  {d}
                </div>
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
