// ============================================================
// Mezo · MesoDayCard — ONE training day of the plan's week, in „A heted"
// (mezo-me75u.5; Folyadék F3 mezo-n4wf5.3, prototype vilagos/edzes.js `dayCard`).
// Shared by the Terv landing (MesoTervPage) and the plan's own page
// (MesocycleBuilderPage): the two surfaces show the same week, so they render the
// same piece rather than two drifting copies.
//
// OWNER DECISION 2026-10-10: only TODAY is a full card — the body filled with the
// day's muscles, three facts, the muscle chips with their set counts. Every other
// training day is ONE ROW: weekday, type, the facts as one line, the state stamp
// (Megvolt · Részben · Jön) and the chevron. Both open the day's own page.
//
// HONESTY. A done day reports what the instance itself carries (mesoWeekDone:
// logged sets, measured minutes, worked exercises) — never the plan's numbers
// under a „Megvolt" stamp, and never a record count, which lives only in the
// frozen report. An unmeasurable duration prints „–", not the estimate.
// Today is never drawn as done even when a session is already logged: the day is
// still open, and „Ma" is the list's loudest state.
// ============================================================
import type { MesoDay } from '@/data/types'
import type { BodyView } from '@/features/train/logic/bodyGeometry.gen'
import { shapesFor } from '@/features/train/logic/bodyMapShapes'
import { BodyLiq, Mchp } from '@/features/train/components/folyadek'
import { dayTileData } from '@/features/train/wizard/dayTiles'
import type { DayDone } from '@/features/train/logic/mesoWeekDone'
import { Chev, St } from '@/shared/ui/folyadek'
import { cx } from '@/shared/ui/folyadek/util'

/** The side of the body a set of muscles is best seen from: the back when more than half of
 *  them are drawn there first (prototype `dayView`). */
export function bodyViewOf(muscles: string[]): BodyView {
  const back = muscles.filter((m) => shapesFor(m)[0]?.[0] === 'back').length
  return back > muscles.length / 2 ? 'back' : 'front'
}

/** A muscle's level in the day's body: its sets against seven, the prototype's own scale. */
export const DAY_BODY_FULL = 7

export function MesoDayCard({ day, name, isToday, done, onOpen }: {
  day: MesoDay
  /** The weekday's display name ('Hétfő'), already resolved by the caller. */
  name: string
  isToday: boolean
  /** What this day actually held, or null when it is today / not trained yet. */
  done: DayDone | null
  /** Kept for the callers' signature (the entrance stagger is the kit's now). */
  delayMs?: number
  onOpen: () => void
}) {
  const tile = dayTileData(day)
  const partial = done !== null && done.sets < tile.sets

  const facts: [string, string][] = done
    ? [
        [partial ? `${done.sets}/${tile.sets}` : String(done.sets), 'szett'],
        [done.minutes == null ? '–' : String(done.minutes), 'perc'],
        [String(done.exercises), 'gyakorlat'],
      ]
    : [
        [String(tile.sets), 'szett'],
        [`${isToday ? '' : '~'}${tile.minutes}`, 'perc'],
        [String(day.exercises.length), 'gyakorlat'],
      ]

  const stamp = done
    ? <St tone={partial ? 'warn' : 'ok'}>{partial ? 'Részben' : 'Megvolt'}</St>
    : isToday ? <St tone="plan">Ma</St> : <St>Jön</St>
  const label = `${name} · ${day.type}${done ? (partial ? ' · részben megvolt' : ' · megvolt') : isToday ? ' · ma' : ''}`

  if (!isToday) {
    return (
      <button type="button" className={cx('ep-dc row', done ? 'done' : 'next')} aria-label={label} onClick={onOpen}>
        <span className="hd">
          <span className="g">
            <small>{name}</small>
            <strong>{day.type}</strong>
            <em>{facts.map(([v, l]) => `${v} ${l}`).join(' · ')}</em>
          </span>
          {stamp}
          <Chev />
        </span>
      </button>
    )
  }

  return (
    <button type="button" className="ep-dc now" aria-label={label} onClick={onOpen}>
      <span className="hd">
        <span className="g">
          <small>{name}</small>
          <strong>{day.type}</strong>
        </span>
        {stamp}
        <Chev />
      </span>
      <span className="ct">
        <BodyLiq view={bodyViewOf(tile.muscles.map((m) => m.token))}
          entries={tile.muscles.map((m) => ({ muscle: m.token, planned: m.sets / DAY_BODY_FULL }))}
          ariaLabel={`${day.type} nap — érintett izmok`} />
        <span className="cl">
          <span className="f3">
            {facts.map(([v, l]) => <i key={l}><b>{v}</b><small>{l}</small></i>)}
          </span>
          <span className="chs">
            {tile.muscles.map((m) => (
              <span key={m.label}><Mchp muscle={m.token} size={22} /><b>{m.sets}</b></span>
            ))}
          </span>
        </span>
      </span>
    </button>
  )
}
