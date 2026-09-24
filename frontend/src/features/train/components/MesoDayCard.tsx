// ============================================================
// Mezo · MesoDayCard — ONE day of the running plan, as a card in „A heted"
// (mezo-me75u.5, U5). Shared by the Terv landing (MesoTervPage) and the run's
// own page (MesocycleBuilderPage): the two surfaces show the same week, so they
// render the same card rather than two drifting copies.
//
// ANATOMY (owner-approved 2026-09-24, prototypes/uveg-edzes2.html#terv). The
// owner rejected an earlier draft as „rendszer nélkül összevissza odavágott
// elemek"; what settled it was giving the card ONE structure, identical in every
// state — state changes colour and volume, never layout:
//
//   ┌ header band ────────────────────────────────┐
//   │ HÉTFŐ                    [Megvolt]       ›  │  eyebrow over title,
//   │ Push                                        │  stamp + chevron right
//   ├─ hairline ──────────────────────────────────┤
//   │ ┌────┐  [16 szett][68 perc][5 gyakorlat]    │  fixed 62px map column |
//   │ │map │  ◉4 ◉3 ◉3 ◉3 ◉3                      │  three EQUAL boxes in a
//   │ └────┘                                      │  grid + the muscle row on
//   └─────────────────────────────────────────────┘  the same left edge
//
// The one loud thing is WHAT you train — the body map and the title. The three
// numbers are deliberately equal and quiet; they support, never compete.
//
// HONESTY. A done day reports what the instance itself carries (mesoWeekDone:
// logged sets, measured minutes, worked exercises) — never the plan's numbers
// under a „Megvolt" stamp, and never a record count, which lives only in the
// frozen meso report. An unmeasurable duration prints „–", not the estimate.
// Today is never drawn as done even when a session is already logged: the day is
// still open, and „Ma" is the card's loudest state.
// ============================================================
import type { CSSProperties } from 'react'
import type { MesoDay } from '@/data/types'
import { cn } from '@/shared/lib/cn'
import { Icon3D } from '@/shared/ui/clay'
import { BodyMap, type BodyHeat } from '@/features/train/components/BodyMap'
import { MuscleChip } from '@/features/train/components/MuscleChip'
import { dayTileData } from '@/features/train/wizard/dayTiles'
import type { DayDone } from '@/features/train/logic/mesoWeekDone'

type Fact = { icon: 't-dumbbell' | 't-clock' | 't-protocol'; value: string; label: string }

export function MesoDayCard({ day, name, isToday, done, delayMs, onOpen }: {
  day: MesoDay
  /** The weekday's display name ('Hétfő'), already resolved by the caller. */
  name: string
  isToday: boolean
  /** What this day actually held, or null when it is today / not trained yet. */
  done: DayDone | null
  delayMs: number
  onOpen: () => void
}) {
  const tile = dayTileData(day)
  const partial = done !== null && done.sets < tile.sets
  const state = done ? (partial ? 'is-part' : 'is-done') : isToday ? 'is-now' : 'is-next'

  // The card's accent is the day's dominant muscle family, so Push / Legs / Pull read as three
  // different cards at a glance — the fix for „minden nap ugyanúgy néz ki".
  const accent = tile.muscles[0]?.color ?? 'var(--dv-coral)'
  const heat: BodyHeat[] = tile.muscles.map((m) => ({ token: m.token, level: 'in' }))

  const facts: Fact[] = done
    ? [
        { icon: 't-dumbbell', value: partial ? `${done.sets}/${tile.sets}` : String(done.sets), label: 'szett' },
        { icon: 't-clock', value: done.minutes == null ? '–' : String(done.minutes), label: 'perc' },
        { icon: 't-protocol', value: String(done.exercises), label: 'gyakorlat' },
      ]
    : [
        { icon: 't-dumbbell', value: String(tile.sets), label: 'szett' },
        { icon: 't-clock', value: `${isToday ? '' : '~'}${tile.minutes}`, label: 'perc' },
        { icon: 't-protocol', value: String(day.exercises.length), label: 'gyakorlat' },
      ]

  const stamp = done
    ? { className: partial ? 'is-part' : 'is-done', icon: 't-tick' as const, text: partial ? 'Részben' : 'Megvolt' }
    : isToday
      ? { className: 'is-today', icon: 't-play' as const, text: 'Ma' }
      : { className: 'is-next', icon: null, text: 'Jön' }

  return (
    <button
      type="button"
      className={cn('tv-day', state, 'rise')}
      style={{ '--d': `${delayMs}ms`, '--c': accent } as CSSProperties}
      aria-label={`${name} · ${day.type}${done ? (partial ? ' · részben megvolt' : ' · megvolt') : isToday ? ' · ma' : ''}`}
      onClick={onOpen}
    >
      <span className="tv-day-head">
        <span className="tv-day-id">
          <span className="tv-day-tag">{name}</span>
          <strong>{day.type}</strong>
        </span>
        <span className={cn('tv-day-stamp', stamp.className)}>
          {stamp.icon && <Icon3D name={stamp.icon} size={17} />}
          {stamp.text}
        </span>
        <b className="tv-day-chev" aria-hidden="true">›</b>
      </span>
      <span className="tv-day-body">
        {/* Not aria-hidden: the map carries the answer to „mit edzel ezen a napon". */}
        <span className="tv-day-map">
          <BodyMap heat={heat} views="auto" ariaLabel={`${day.type} nap — érintett izmok`} />
        </span>
        <span className="tv-day-col">
          <span className="tv-day-facts">
            {facts.map((f) => (
              <i key={f.label}>
                <Icon3D name={f.icon} size={17} />
                <b>{f.value}</b>
                <small>{f.label}</small>
              </i>
            ))}
          </span>
          <span className="tv-day-chips">
            {tile.muscles.map((m) => (
              // Publish the hue on the element that wears the well (U1 rule 4): the chip's
              // lit background reads `--mc` off THIS span, not off an inner child.
              <span className="tv-day-chip" key={m.label} style={{ '--mc': m.color } as CSSProperties}>
                <MuscleChip token={m.token} size={30} />
                <b>{m.sets}</b>
              </span>
            ))}
          </span>
        </span>
      </span>
    </button>
  )
}
