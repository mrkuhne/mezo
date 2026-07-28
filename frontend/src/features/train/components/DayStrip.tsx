// ============================================================
// Mezo · DayStrip — Mai's horizontal week navigator (mezo-9bbc).
// One `.daychip` per weekday: label (MA on today) + day number, a dot per
// scheduled session coloured by modality, and a done marker line. Purely
// presentational — it receives pre-derived DayStripItems (dayStripItems.ts).
// ============================================================
import { cn } from '@/shared/lib/cn'
import { DAY_LABELS } from '@/data/train/train'
import type { DayStripItem } from '@/features/train/logic/dayStripItems'

export function DayStrip({
  items,
  selected,
  onSelect,
}: {
  items: DayStripItem[]
  /** Day key of the currently shown day. */
  selected: string
  onSelect: (day: string) => void
}) {
  return (
    <div className="daystrip" role="tablist" aria-label="Hét napjai">
      {items.map((it) => {
        const empty = it.sessionCount === 0
        return (
          <button
            key={it.day}
            type="button"
            role="tab"
            aria-selected={it.day === selected}
            className={cn('daychip', it.isToday && 'today', it.day === selected && 'sel', empty && 'rest')}
            onClick={() => onSelect(it.day)}
            aria-label={`${DAY_LABELS[it.day] ?? it.day}${it.isToday ? ' · ma' : ''}`}
          >
            <span className="dl">{it.isToday ? 'MA' : it.day}</span>
            <span className="dn">{it.dayNumber}</span>
            <span className="dots" aria-hidden="true">
              {it.dots.map((tone, i) => (
                <span key={`${tone}-${i}`} className={cn('dot', `dot-${tone}`)} />
              ))}
            </span>
            <span className="ck">
              {empty ? 'pihenő' : it.doneCount > 0 ? '✓'.repeat(it.doneCount) : '—'}
            </span>
          </button>
        )
      })}
    </div>
  )
}
