import { DAY_ORDER } from '@/data/train/train'
import type { GymScheduleSlot } from '@/data/types'

/** Gentle anchor-consumer nudge (mezo-67rb): offer moving late gym slots into the
 *  wake-derived morning window. Presentational — the page owns data + snooze. */
export function MorningTrainingCard({
  offending,
  windowStart,
  windowEnd,
  onApply,
  onSnooze,
}: {
  offending: GymScheduleSlot[]
  windowStart: string
  windowEnd: string
  onApply: () => void
  onSnooze: () => void
}) {
  return (
    <section className="mtr" aria-label="Reggeli edzés-ablak">
      <span className="mtr-eye">Reggeli edzés</span>
      <p className="mtr-lead">
        A reggeli mozgás előrébb tolja a belső órát — este könnyebben alszol el. A horgonyod
        szerint az ablakod {windowStart}–{windowEnd}.
      </p>
      <p className="mtr-body">
        {offending.map((s) => `${DAY_ORDER[s.dayOfWeek]} ${s.time}`).join(' · ')} → {windowStart}
      </p>
      <div className="mtr-actions">
        <button className="mtr-cta" onClick={onApply}>Áthelyezés a reggeli ablakba</button>
        <button className="mtr-quiet" onClick={onSnooze}>Maradjon így</button>
      </div>
    </section>
  )
}
