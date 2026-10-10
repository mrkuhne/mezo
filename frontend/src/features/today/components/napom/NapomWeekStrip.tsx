// A napom · the week strip (Folyadék prototype `ndWeek`, vilagos/nap.js) — the seven days of the
// viewed day's week as seven small vessels, one tap each. A scored day fills to its score and
// shows it; today is „élő" and fills with the areas done so far; a thin day is a sliver with a
// dash; a future day is empty and not openable — there is nothing there yet. The viewed day
// wears the ink outline.
import type { CSSProperties } from 'react'
import { addDays, huMonthDay } from '@/shared/lib/dates'
import { cn } from '@/shared/lib/cn'
import { dayState, huDowFull, mondayOf } from '@/features/me/logic/weekDay'
import type { MeWeekDay } from '@/data/me/meWeek'

const LETTERS = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'] as const

type Mark = 'today' | 'fut' | 'sc' | 'th' | null

function markOf(iso: string, today: string, day: MeWeekDay | undefined): Mark {
  if (iso === today) return 'today'
  if (iso > today) return 'fut'
  if (!day) return null
  const st = dayState(day, today)
  return st === 'scored' ? 'sc' : st === 'thin' ? 'th' : null
}

export function NapomWeekStrip({ date, today, days, liveDone = null, onPick }: {
  /** The viewed day — the strip shows its week. */
  date: string
  today: string
  /** `useMeWeek(monday).days` — empty while the week is still loading. */
  days: readonly MeWeekDay[]
  /** Today's done areas (0–6) when today's open evaluation is the one on screen; `null` when the
   *  page is showing another day, so today's vessel claims no level. */
  liveDone?: number | null
  onPick: (iso: string) => void
}) {
  const monday = mondayOf(date)
  return (
    <div className="nn-week" role="group" aria-label="A hét napjai">
      {LETTERS.map((letter, i) => {
        const iso = addDays(monday, i)
        const day = days.find((d) => d.date === iso)
        const mark = markOf(iso, today, day)
        const score = mark === 'sc' ? (day?.score ?? null) : null
        const pct = score != null ? score : mark === 'today' ? ((liveDone ?? 0) / 6) * 100 : mark === 'th' ? 7 : 0
        const text = score != null ? score : mark === 'th' ? '–' : mark === 'today' ? 'élő' : ''
        return (
          <button
            key={iso}
            type="button"
            // `lo` = the liquid does not cover the caption, so it stands above the level, in ink.
            className={cn(mark, pct < 40 && 'lo', iso === date && 'on')}
            aria-label={`${huDowFull(iso)}, ${huMonthDay(iso)}`}
            aria-current={iso === date ? 'date' : undefined}
            disabled={mark === 'fut'}
            onClick={() => onPick(iso)}
          >
            <small>{letter}</small>
            <span className="t" aria-hidden="true" style={{ '--p': `${Math.max(0, Math.min(100, pct))}%` } as CSSProperties}>
              <i style={{ height: `${Math.max(0, Math.min(100, pct))}%` }} />
              <b>{text}</b>
            </span>
            <em>{Number(iso.slice(8))}</em>
          </button>
        )
      })}
    </div>
  )
}
