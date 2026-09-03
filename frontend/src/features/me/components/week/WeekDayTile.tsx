// ============================================================
// Heti · nap-mozaik csempe (mezo-d20.6.10)
// Source: en-body.html `dayCard()` / `.dcard` ×1.18.
//
// The tile does NOT expand in place — that was the 4th design round's
// lesson (a right-column tile growing full-width punches a hole in the
// 2-column grid). Tapping navigates to `/me/week/napok/:date`, which is
// also what makes a single day deep-linkable (audit gap §8.3/6).
//
// Its four honest states come from `weekDay.ts`, not from ad-hoc null
// checks: a `tanulom` day and a `nincs adat` day say different things.
// ============================================================
import type { CSSProperties } from 'react'
import { ClayIcon, ClaySpot } from '@/shared/ui/clay'
import { cn } from '@/shared/lib/cn'
import { huMonthDay } from '@/shared/lib/dates'
import { scoreBand, scoreBandInk } from '@/features/me/logic/scoreBand'
import {
  DAY_COPY, SUBSCORES, dayState, fmtSleep, huDowShort, huInt, tileScoreLabel,
} from '@/features/me/logic/weekDay'
import type { MeWeekDay } from '@/data/me/meWeek'

/** `Máj 20` → `máj 20` — the tile's date micro-label is lowercase in the prototype. */
function tileDate(dateIso: string): string {
  return huMonthDay(dateIso).toLowerCase()
}

export interface WeekDayTileProps {
  day: MeWeekDay
  /** the device's local today — drives both the MA flag and the future state */
  todayIso: string
  /** the weekly analysis wrote about this day → the lavender `jegyzet` chip */
  hasNote: boolean
  /** entrance stagger (the tile carries `.rise`; EntranceGroup arms the play class) */
  delayMs: number
  onOpen: () => void
}

export function WeekDayTile({ day, todayIso, hasNote, delayMs, onOpen }: WeekDayTileProps) {
  const state = dayState(day, todayIso)
  const style = { '--d': `${delayMs}ms` } as CSSProperties
  const dow = huDowShort(day.date)

  if (state === 'future') {
    return (
      <div className="wkd-tile is-future rise" style={style} data-testid="week-day-tile" data-date={day.date}>
        <div className="wkd-trow">
          <span className="wkd-dow is-mut">{dow}</span>
          <span className="wkd-dte">{tileDate(day.date)}</span>
        </div>
        <div className="wkd-scnum is-dash">·</div>
        <div className="wkd-note">{DAY_COPY.futureTile}</div>
      </div>
    )
  }

  const scoreWord = tileScoreLabel(state)
  return (
    <button
      type="button"
      className={cn('wkd-tile rise', `is-${scoreBand(day.score)}`, state !== 'scored' && 'is-thin')}
      style={style}
      onClick={onOpen}
      data-testid="week-day-tile"
      data-date={day.date}
      aria-label={`${dow} ${tileDate(day.date)} — ${scoreWord ?? `${day.score} / 100`}`}
    >
      <div className="wkd-trow">
        <span className="wkd-dow">{dow}</span>
        {day.date === todayIso && <span className="wkd-ma">MA</span>}
        <span className="wkd-dte">{tileDate(day.date)}</span>
        <span className="wkd-chv" aria-hidden="true">⌄</span>
      </div>

      <div className="wkd-trow">
        {scoreWord != null ? (
          <span className="wkd-scnum is-dash">{scoreWord}</span>
        ) : (
          <span className="wkd-scnum" style={{ color: scoreBandInk(day.score) }}>
            {day.score}<small> / 100</small>
          </span>
        )}
        <div className="wkd-sparks" aria-hidden="true">
          {SUBSCORES.map((s, k) => {
            const v = day.subscores[s.key]
            return (
              <i
                key={s.key}
                className={v == null ? 'is-none' : s.barClass}
                style={{
                  height: v == null ? 4 : Math.max(5, Math.round((v / 100) * 26)),
                  '--d': `${300 + delayMs + k * 53}ms`,
                } as CSSProperties}
              />
            )
          })}
        </div>
      </div>

      <div className="wkd-chips">
        {day.kcal != null && (
          <span className="wkd-chip"><ClayIcon name="i-fuel" size={12} />{huInt(day.kcal)}</span>
        )}
        {day.sleepMin != null && (
          <span className="wkd-chip"><ClayIcon name="i-alvas" size={12} />{fmtSleep(day.sleepMin)}</span>
        )}
        {day.workoutCount > 0 && (
          <span className="wkd-chip"><ClayIcon name="i-edzes" size={12} />{day.workoutCount}×</span>
        )}
        <span className={cn('wkd-chip', !day.checkinCount && 'is-mut')}>
          <ClayIcon name="i-checkin" size={12} />{day.checkinCount}/4
        </span>
        {hasNote && (
          <span className="wkd-chip is-note"><ClaySpot name="s-orb" size={12} />jegyzet</span>
        )}
      </div>

      {scoreWord != null && (
        <div className="wkd-note">{state === 'empty' ? DAY_COPY.emptyTile : DAY_COPY.thinTile}</div>
      )}
    </button>
  )
}
