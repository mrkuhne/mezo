// ============================================================
// Mezo · HabitFormationHistory (mezo-08zl) — prototype `rutin-formalodas` history surface ×1.18.
//
// Replaces the 28-day PROPORTION strip with the actual lifetime: a week-per-column grid (the
// shape scales to any history length instead of truncating at 28), plus "melyik napokon megy" —
// the weekday breakdown, which is where the day-of-week regularity signal becomes visible.
//
// Three states must read as three (the 28-day strip's own review finding): a pipa is sage, a
// missed day is a visibly darker neutral, and a day with no row at all is the faintest — because
// rows are only materialized on days the app was opened, absence is NOT a miss and must not
// look like one.
// ============================================================
import type { HabitFormation, HabitFormationStatus } from '@/data/types'
import { weekdayBreakdown } from '@/features/me/logic/habitFormation'
import { cn } from '@/shared/lib/cn'

/** Monday-first column index for a plain `YYYY-MM-DD`, parsed as a LOCAL calendar day. */
function localDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

interface Cell {
  date: string
  status: HabitFormationStatus | null
}

/** Lifetime days laid out as weeks (columns) × weekdays (rows), Monday first. */
export function toWeeks(days: readonly { date: string; status: HabitFormationStatus }[]): Cell[][] {
  if (days.length === 0) {
    return []
  }
  const byDate = new Map(days.map((d) => [d.date, d.status]))
  const first = localDate(days[0].date)
  const last = localDate(days[days.length - 1].date)
  // Pad to whole weeks so every column has seven rows and the grid never jitters.
  const start = new Date(first)
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  const weeks: Cell[][] = []
  for (let cursor = start; cursor <= last; ) {
    const col: Cell[] = []
    for (let i = 0; i < 7; i++) {
      const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
      col.push({ date: iso, status: byDate.get(iso) ?? null })
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1)
    }
    weeks.push(col)
  }
  return weeks
}

export function HabitFormationHistory({ f }: { f: HabitFormation }) {
  const weeks = toWeeks(f.days)
  const cells = weekdayBreakdown(f.days)
  const best = cells.reduce<{ label: string; ratio: number } | null>((acc, c) => (
    c.ratio != null && (acc == null || c.ratio > acc.ratio) ? { label: c.label, ratio: c.ratio } : acc
  ), null)

  return (
    <div data-testid="formation-history">
      <div className="rt-cal" role="img"
        aria-label={`Teljes előzmény: ${f.reps} pipa, ${f.missed} kimaradt nap.`}>
        {weeks.map((col, i) => (
          <div className="rt-cal-col" key={i}>
            {col.map((c) => (
              <i key={c.date} className={cn(c.status === 'done' && 'is-done', c.status === 'missed' && 'is-miss')} />
            ))}
          </div>
        ))}
      </div>
      <div className="rt-cal-lg">
        <span><em className="is-done" />pipa</span>
        <span><em className="is-miss" />kimaradt</span>
        <span><em />nem volt sor</span>
      </div>

      <div className="rt-wdays" aria-hidden="true">
        {cells.map((c) => (
          <div className="rt-wday" key={c.label}>
            <div className="rt-wday-bar">
              <i style={{ height: `${Math.round((c.ratio ?? 0) * 100)}%` }} />
            </div>
            <span>{c.label}</span>
          </div>
        ))}
      </div>
      <p className="rt-hint">
        {best != null
          ? `A legerősebb napod: ${best.label} (${Math.round(best.ratio * 100)}%). `
            + 'A gyengébbeknél nem az akaraton múlik — ott érdemes a horgonyt igazítani.'
          : 'Még nincs lezárt nap, amiből heti mintázatot olvashatnánk.'}
      </p>
    </div>
  )
}
