// ============================================================
// Heti · Napi pontszám oszlopok (mezo-d20.6.10)
// Source: en-body.html `dayCols()` + `.dcols`, ×1.18 (330 → 390px frame).
// Rework of the retired `components/WeekScoreBars.tsx`, which was an
// `aria-hidden` SVG with a HARDCODED `['H','K','Sz','Cs','P','Sz','V']` axis —
// where Szerda and Szombat both read „Sz". The axis is now derived from each
// day's REAL date, every column is a real button that opens that day, and the
// chart has accessible names instead of being hidden from assistive tech.
// ============================================================
import type { CSSProperties } from 'react'
import { cn } from '@/shared/lib/cn'
import { huDow, huMonthDay, huWeekdayFullIso } from '@/shared/lib/dates'
import { scoreBandClass } from '@/features/me/logic/scoreBand'
import { DAY_STATE_LABEL, dayScoreState } from '@/features/me/logic/dayScoreState'
import type { MeWeekDay } from '@/data/me/meWeek'

/** Prototype: `Math.max(5, round(sc / 100 * 58))` over a 78px well, null ⇒ 4. ×1.18. */
const MAX_BAR_PX = 68
const MIN_BAR_PX = 6
const NULL_BAR_PX = 5

export interface WeekScoreBarsProps {
  days: MeWeekDay[]
  /** The viewer's LOCAL today — decides future days and the MA marking. */
  todayIso: string
  /** MA is only marked while the browsed week is the running one (prototype: `d.dt === today && w.cur`). */
  currentWeek: boolean
  onSelect?: (dateIso: string) => void
}

export function WeekScoreBars({ days, todayIso, currentWeek, onSelect }: WeekScoreBarsProps) {
  return (
    <div className="wka-dcols">
      {days.map((day, i) => {
        const state = dayScoreState(day, todayIso)
        const isToday = currentWeek && day.date === todayIso
        const height = day.score == null
          ? NULL_BAR_PX
          : Math.max(MIN_BAR_PX, Math.round((Math.max(0, Math.min(100, day.score)) / 100) * MAX_BAR_PX))
        // The accessible name is where the tanulom / nincs adat / még előtted split becomes
        // audible — the column itself can only show `—` for all three.
        const value = day.score != null ? `${day.score} pont` : DAY_STATE_LABEL[state]
        const name = `${huWeekdayFullIso(day.date)}, ${huMonthDay(day.date)} — ${value}${isToday ? ' · ma' : ''}`
        return (
          <button
            key={day.date}
            type="button"
            className={cn('wka-col', isToday && 'is-today', state === 'future' && 'is-future')}
            onClick={() => onSelect?.(day.date)}
            aria-label={name}
          >
            <span className="vl">{day.score ?? '—'}</span>
            <i
              className={cn('bar', scoreBandClass(day.score))}
              style={{ height, '--d': `${200 + i * 60}ms` } as CSSProperties}
              aria-hidden="true"
            />
            <span className="dw" aria-hidden="true">{huDow(day.date).slice(0, 3)}</span>
          </button>
        )
      })}
    </div>
  )
}
