// A napom · the week strip (prototype uveg-napod-body.html `week()`, owner OK 2026-09-24) — the
// seven days of the viewed day's week, one tap each. Replaces the old "‹ Napok" list. The 4px
// mark under each number is the day's state: scored (gradient), thin (dashed), today (coral),
// future (dimmed, and not openable — there is nothing there yet).
import type { CSSProperties } from 'react'
import { addDays, huMonthDay } from '@/shared/lib/dates'
import { cn } from '@/shared/lib/cn'
import { dayState, huDowFull, mondayOf } from '@/features/me/logic/weekDay'
import type { MeWeekDay } from '@/data/me/meWeek'

const LETTERS = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'] as const

function markClass(iso: string, today: string, day: MeWeekDay | undefined): string | null {
  if (iso === today) return 'is-today'
  if (iso > today) return 'is-fut'
  if (!day) return null
  const st = dayState(day, today)
  return st === 'scored' ? 'is-sc' : st === 'thin' ? 'is-th' : null
}

export function NapomWeekStrip({ date, today, days, onPick }: {
  /** The viewed day — the strip shows its week. */
  date: string
  today: string
  /** `useMeWeek(monday).days` — empty while the week is still loading. */
  days: readonly MeWeekDay[]
  onPick: (iso: string) => void
}) {
  const monday = mondayOf(date)
  return (
    <div className="napom-week rise" role="group" aria-label="A hét napjai" style={{ '--i': 1 } as CSSProperties}>
      {LETTERS.map((letter, i) => {
        const iso = addDays(monday, i)
        const fut = iso > today
        return (
          <button
            key={iso}
            type="button"
            className={cn('napom-wd', markClass(iso, today, days.find((d) => d.date === iso)), iso === date && 'is-on')}
            aria-label={`${huDowFull(iso)}, ${huMonthDay(iso)}`}
            aria-current={iso === date ? 'date' : undefined}
            disabled={fut}
            onClick={() => onPick(iso)}
          >
            {letter}
            <b>{Number(iso.slice(8))}</b>
            <i aria-hidden="true" />
          </button>
        )
      })}
    </div>
  )
}
