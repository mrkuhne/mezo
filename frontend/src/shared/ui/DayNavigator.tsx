import type { CSSProperties } from 'react'
import { DatePicker } from '@/shared/ui/DatePicker'
import { addDays, localDateString, huMonthDayDow } from '@/shared/lib/dates'

export interface DayNavigatorProps {
  date: string // YYYY-MM-DD (selected day)
  onChange: (date: string) => void // fires with the new ISO date (arrow step or calendar pick)
  maxDate?: string // default localDateString(); `next` disabled at maxDate — no future
  minDate?: string // optional floor; `prev` disabled at minDate
}

/**
 * Prev/next day arrows flanking a tappable calendar date label — date navigation for the Rutin
 * tab, fronting either a read-only history view or an interactive logging surface (the
 * yesterday-backfill checkboxes, mezo-x9c2) depending on the page that mounts it. Wraps the
 * domain-free `DatePicker` primitive: arrows step ±1 day via `addDays`,
 * the centre label opens the calendar popover. `next` is disabled at `maxDate` (no future) and the
 * label reads "Ma" when the day is today (== maxDate); `prev` is disabled at `minDate`. ISO
 * `YYYY-MM-DD` strings compare lexicographically == chronologically, so bounds are string compares.
 * No `@/data/*` imports — this is a shared/ui primitive.
 */
export function DayNavigator({ date, onChange, maxDate = localDateString(), minDate }: DayNavigatorProps) {
  const canPrev = !minDate || date > minDate
  const canNext = date < maxDate
  const label = (iso: string) => (iso === maxDate ? 'Ma' : huMonthDayDow(iso))
  return (
    <div className="row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <button
        type="button"
        aria-label="Előző nap"
        disabled={!canPrev}
        onClick={() => onChange(addDays(date, -1))}
        style={chipStyle(!canPrev)}
      >
        ‹
      </button>
      <DatePicker value={date} onChange={onChange} maxDate={maxDate} minDate={minDate} formatLabel={label} />
      <button
        type="button"
        aria-label="Következő nap"
        disabled={!canNext}
        onClick={() => onChange(addDays(date, 1))}
        style={chipStyle(!canNext)}
      >
        ›
      </button>
    </div>
  )
}

// Bordered square arrow chip; dimmed + non-interactive when disabled (matches the mockup).
function chipStyle(disabled: boolean): CSSProperties {
  return {
    font: 'inherit',
    fontSize: 18,
    lineHeight: 1,
    width: 32,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--r-md)',
    border: '1px solid var(--line)',
    background: 'var(--surface-1)',
    color: disabled ? 'var(--text-quaternary)' : 'var(--lav-deep)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  }
}
