// ============================================================
// Mezo · WeekdayGrid — single-select 7-day picker (Hét..Vas). value/onChange
// is a dayOfWeek index (0=Hét..6=Vas, = DAY_ORDER index).
// Folyadék (mezo-n4wf5.3, prototype vilagos/edzes.js `futasterv()` `chips(DSH, …)`): the kit's
// pills with the one-letter weekday on them; the accessible name stays the DAY_ORDER word.
// ============================================================
import { DAY_ORDER } from '@/data/train/train'
import { Pill, Pills } from '@/shared/ui/folyadek'

/** The short weekday shown on a pill / a day badge (prototype `DSH`), by dayOfWeek index. */
export const DAY_SHORT = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'] as const

export function WeekdayGrid({ value, onChange }: { value: number; onChange: (dayOfWeek: number) => void }) {
  return (
    <Pills role="group" aria-label="Nap">
      {DAY_ORDER.map((d, i) => (
        <Pill key={d} on={i === value} aria-label={d} onClick={() => onChange(i)}>{DAY_SHORT[i]}</Pill>
      ))}
    </Pills>
  )
}
