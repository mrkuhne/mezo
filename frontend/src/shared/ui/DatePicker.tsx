import { useEffect, useState, type CSSProperties } from 'react'
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
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        aria-label="Dátum kiválasztása"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openPicker())}
        style={triggerStyle}
      >
        {(formatLabel ?? huMonthDayDow)(value)}
      </button>

      {open && (
        <>
          <button type="button" aria-label="Bezárás" onClick={() => setOpen(false)} style={backdropStyle} />
          <div role="dialog" aria-label="Naptár" style={dialogStyle}>
            <div style={headerStyle}>
              <button
                type="button"
                aria-label="Előző hónap"
                onClick={() => stepMonth(-1)}
                disabled={prevDisabled}
                style={navBtnStyle(prevDisabled)}
              >
                ‹
              </button>
              <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--text-primary)' }}>
                {HU_MONTHS[vm]} {vy}
              </span>
              <button
                type="button"
                aria-label="Következő hónap"
                onClick={() => stepMonth(1)}
                disabled={nextDisabled}
                style={navBtnStyle(nextDisabled)}
              >
                ›
              </button>
            </div>

            <div style={gridStyle}>
              {HU_DOW_SHORT.map((d) => (
                <div key={d} style={dowHeadStyle}>
                  {d}
                </div>
              ))}
            </div>

            <div style={gridStyle}>
              {cells.map((iso, i) =>
                iso === null ? (
                  <div key={`empty-${i}`} />
                ) : (
                  <button
                    key={iso}
                    type="button"
                    aria-label={iso}
                    disabled={iso > max || (minDate ? iso < minDate : false)}
                    onClick={() => {
                      onChange(iso)
                      setOpen(false)
                    }}
                    style={dayStyle(iso === value, iso === today, iso > max || (minDate ? iso < minDate : false))}
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

const triggerStyle: CSSProperties = {
  font: 'inherit',
  fontSize: 13,
  fontWeight: 800,
  color: 'var(--lav-deep)',
  background: 'none',
  border: 0,
  padding: '2px 4px',
  cursor: 'pointer',
}

const backdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 40,
  background: 'transparent',
  border: 0,
  padding: 0,
  cursor: 'default',
}

const dialogStyle: CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 6px)',
  left: 0,
  zIndex: 50,
  width: 260,
  padding: 12,
  background: 'var(--surface-1)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--r-lg)',
  boxShadow: '0 12px 32px rgba(43, 33, 24, 0.18)',
}

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 8,
}

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, 1fr)',
  gap: 2,
}

const dowHeadStyle: CSSProperties = {
  textAlign: 'center',
  fontSize: 10,
  fontWeight: 700,
  color: 'var(--text-quaternary)',
  paddingBottom: 4,
}

function navBtnStyle(disabled: boolean): CSSProperties {
  return {
    font: 'inherit',
    fontSize: 18,
    lineHeight: 1,
    width: 28,
    height: 28,
    borderRadius: 'var(--r-full)',
    border: 0,
    background: 'none',
    color: disabled ? 'var(--text-quaternary)' : 'var(--lav-deep)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  }
}

function dayStyle(selected: boolean, isToday: boolean, disabled: boolean): CSSProperties {
  return {
    aspectRatio: '1 / 1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    font: 'inherit',
    fontSize: 12,
    fontWeight: selected ? 800 : 600,
    borderRadius: 'var(--r-full)',
    border: isToday && !selected ? '1.5px solid var(--sage-deep)' : '1.5px solid transparent',
    background: selected ? 'var(--lav)' : 'transparent',
    color: disabled ? 'var(--text-quaternary)' : selected ? 'var(--text-inverse)' : 'var(--text-primary)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
  }
}
