// ============================================================
// Heti · nap-oldal léptető csempék (mezo-d20.6.10)
// Source: en-body.html `dayNav()` / `.daynav` + `.dnavt` ×1.18.
// Each tile carries the NEIGHBOUR's weekday and score, so the step is
// informed rather than blind; an unscored neighbour shows `—`, never 0,
// and a missing neighbour (week edge) is a disabled tile.
// ============================================================
import { huMonthDay } from '@/shared/lib/dates'
import { huDowShort } from '@/features/me/logic/weekDay'
import type { MeWeekDay } from '@/data/me/meWeek'

function label(day: MeWeekDay | null): string {
  return day ? `${huDowShort(day.date)} · ${day.score ?? '—'}` : '—'
}

export function DayNavTiles({ prev, next, onGo }: {
  prev: MeWeekDay | null
  next: MeWeekDay | null
  onGo: (dateIso: string) => void
}) {
  return (
    <div className="wkd-daynav rise" style={{ '--d': '180ms' } as React.CSSProperties}>
      <button
        type="button"
        className="wkd-navt"
        disabled={!prev}
        onClick={prev ? () => onGo(prev.date) : undefined}
        aria-label={prev ? `Előző nap: ${huMonthDay(prev.date)}` : 'Előző nap'}
      >
        <div className="k">‹ előző nap</div>
        <div className="v">{label(prev)}</div>
      </button>
      <button
        type="button"
        className="wkd-navt is-right"
        disabled={!next}
        onClick={next ? () => onGo(next.date) : undefined}
        aria-label={next ? `Következő nap: ${huMonthDay(next.date)}` : 'Következő nap'}
      >
        <div className="k">következő nap ›</div>
        <div className="v">{label(next)}</div>
      </button>
    </div>
  )
}
