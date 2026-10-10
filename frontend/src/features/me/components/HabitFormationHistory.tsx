// ============================================================
// Mezo · HabitFormationHistory (mezo-08zl; Folyadék F2 mezo-n4wf5.2) — the lifetime as a quiet
// grid of small day vessels (prototype vilagos/nap.js `szokas` → `.np-g28`), plus „a hét napjai
// szerint" — the weekday breakdown, which is where the day-of-week regularity becomes visible.
//
// Three states must read as three: a pipa is a full vessel, a missed day an outlined empty one,
// and a day with no row at all the faintest — because rows are only materialized on days the app
// was opened, absence is NOT a miss and must not look like one (ADR 0010).
// ============================================================
import type { HabitFormation, HabitFormationStatus } from '@/data/types'
import { weekdayBreakdown } from '@/features/me/logic/habitFormation'
import { cn } from '@/shared/lib/cn'
import { Lab, Mini, Note } from '@/shared/ui/folyadek'

/** Monday-first column index for a plain `YYYY-MM-DD`, parsed as a LOCAL calendar day. */
function localDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

interface Cell {
  date: string
  status: HabitFormationStatus | null
}

/** Lifetime days laid out as weeks × weekdays, Monday first. */
export function toWeeks(days: readonly { date: string; status: HabitFormationStatus }[]): Cell[][] {
  if (days.length === 0) {
    return []
  }
  const byDate = new Map(days.map((d) => [d.date, d.status]))
  const first = localDate(days[0].date)
  const last = localDate(days[days.length - 1].date)
  // Pad to whole weeks so every week has seven days and the grid never jitters.
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

/** Past this many weeks the day vessels get shorter, so a long lifetime stays one glance. */
const LONG_WEEKS = 12

export function HabitFormationHistory({ f }: { f: HabitFormation }) {
  const weeks = toWeeks(f.days)
  const cells = weekdayBreakdown(f.days)
  const best = cells.reduce<{ label: string; ratio: number } | null>((acc, c) => (
    c.ratio != null && (acc == null || c.ratio > acc.ratio) ? { label: c.label, ratio: c.ratio } : acc
  ), null)

  return (
    <div data-testid="formation-history">
      {/* Two weeks per line, in calendar order: each half-line is Monday → Sunday. */}
      <div className={cn('rb-g28', weeks.length > LONG_WEEKS && 'long')} role="img"
        aria-label={`Teljes előzmény: ${f.reps} pipa, ${f.missed} kimaradt nap.`}>
        {weeks.flat().map((c) => (
          <i key={c.date} className={c.status === 'done' ? 'p' : c.status === 'missed' ? 'm' : 's'} />
        ))}
      </div>
      <div className="rb-leg">
        <span><i className="p" />pipa <b>{f.reps}</b></span>
        <span><i className="m" />kimaradt <b>{f.missed}</b></span>
        <span><i className="s" />nem volt sor</span>
      </div>
      <Note>Egy kémcső egy nap. Csendes rács, nem sorozat.</Note>

      <Lab>A hét napjai szerint</Lab>
      <div className="rb-wd">
        {cells.map((c) => {
          const pct = c.ratio != null ? Math.round(c.ratio * 100) : null
          return <Mini key={c.label} pct={pct ?? 0} value={pct != null ? `${pct}%` : '—'} label={c.label} />
        })}
      </div>
      <Note>
        {best != null
          ? `A legerősebb napod: ${best.label} (${Math.round(best.ratio * 100)}%). `
            + 'A gyengébbeknél nem az akaraton múlik — ott érdemes a horgonyt igazítani.'
          : 'Még nincs lezárt nap, amiből heti mintázatot olvashatnánk.'}
      </Note>
    </div>
  )
}
