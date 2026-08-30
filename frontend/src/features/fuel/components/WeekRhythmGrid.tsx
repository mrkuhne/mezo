// ============================================================
// Mezo · WeekRhythmGrid (Fuel · Terv) — Mozaik re-face (mezo-d20.4.7)
// Source of truth: docs/design_2.0/prototypes/src/fuel-body.html #page-terv
// "Heti ritmus" qcard (.rhyrow/.rhytrack/.blk/.mk/.rhyleg), ×1.18.
//
// Fix vs the Phase-1 version (audit gap #16): kitchen-close and caffeine-cutoff
// markers are no longer hardcoded ('21:00'/'21:30'/'14:00') — the CALLER derives
// them from useFuelSettings().caffeineCutoff and the sleep goal's bedTime (the
// same KITCHEN_CLOSE_OFFSET_MIN the real Mai plan already honors) and passes
// them in as plain HH:mm strings. This component stays presentational/pure.
// ============================================================
import type { GymScheduleDay, VolleyballSession } from '@/data/types'

const HOURS_START = 6
const TOTAL = 16 // 06 → 22

function pctFromTime(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number)
  return Math.max(0, Math.min(100, ((h + m / 60 - HOURS_START) / TOTAL) * 100))
}

function widthForMins(mins: number): number {
  return (mins / 60 / TOTAL) * 100
}

function WeekDayRow({
  gym,
  vb,
  kitchenPct,
  coffeePct,
}: {
  gym: GymScheduleDay
  vb: VolleyballSession | undefined
  kitchenPct: number
  coffeePct: number
}) {
  const isToday = gym.today === true
  const hasGym = gym.active && gym.time != null && gym.duration != null
  const gymStart = hasGym ? pctFromTime(gym.time as string) : null
  const gymWidth = hasGym ? widthForMins(gym.duration as number) : null
  const vbStart = vb ? pctFromTime(vb.time) : null
  const vbWidth = vb ? widthForMins(vb.duration) : null
  const isRest = !gym.active && !vb

  return (
    <div className="fpl-rhyrow">
      <span className="fpl-dl">
        {gym.day}
        {isToday && <span className="ma">MA</span>}
      </span>
      <div className="fpl-track">
        <span className="fpl-mk cf" style={{ left: coffeePct + '%' }} />
        <span className="fpl-mk kc" style={{ left: kitchenPct + '%' }} />
        {gymStart != null && gymWidth != null && (
          <span
            className="fpl-blk gym"
            style={{ left: gymStart + '%', width: Math.max(2, gymWidth) + '%' }}
            title={`${gym.type} · ${gym.time} · ${gym.duration}p`}
          />
        )}
        {vbStart != null && vbWidth != null && vb != null && (
          <span
            className="fpl-blk vb"
            style={{ left: vbStart + '%', width: Math.max(2, vbWidth) + '%' }}
            title={`Röpi · ${vb.time} · ${vb.duration}p`}
          />
        )}
        {isRest && <span className="fpl-rest">pihenő</span>}
      </div>
    </div>
  )
}

export function WeekRhythmGrid({
  gymSchedule,
  volleyball,
  caffeineCutoff,
  kitchenClose,
  title,
}: {
  gymSchedule: GymScheduleDay[]
  volleyball: VolleyballSession[]
  /** Settings-derived — HH:mm, e.g. FuelSettings.caffeineCutoff (audit gap #16). */
  caffeineCutoff: string
  /** Sleep-goal-derived — HH:mm, bedTime − KITCHEN_CLOSE_OFFSET_MIN (same as the real Mai plan). */
  kitchenClose: string
  /** The week label shown in the card's corner (prototype "Aug 24 – 30"). */
  title: string
}) {
  const kitchenPct = pctFromTime(kitchenClose)
  const coffeePct = pctFromTime(caffeineCutoff)

  return (
    <div className="mz-qcard">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <span className="mz-eyebrow">Heti ritmus · 06–22</span>
        <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--mz-ink-mut)' }}>{title}</span>
      </div>
      <div className="col" style={{ gap: 2 }}>
        {gymSchedule.map((gym) => {
          const vb = volleyball.find((v) => v.day === gym.day)
          return (
            <WeekDayRow key={gym.day} gym={gym} vb={vb} kitchenPct={kitchenPct} coffeePct={coffeePct} />
          )
        })}
      </div>
      <div className="fpl-leg">
        <span><i style={{ background: 'var(--mz-goalfill)' }} />gym</span>
        <span><i style={{ background: 'var(--cat-tendency)' }} />röpi</span>
        <span><i style={{ background: 'var(--mz-ink-mut)', width: 3 }} />konyhazárás {kitchenClose}</span>
        <span><i style={{ background: 'var(--warning)', width: 3 }} />koffein-cutoff {caffeineCutoff} — a beállításaidból</span>
      </div>
    </div>
  )
}
