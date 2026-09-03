// StackDayArc — the Stack v2 "day-arc" timeline (Fuel design-2.0 spec §Stack, mezo-d20.4.3).
// A pure horizontal read of today's zone slots between wake and lefekvés: a done-so-far fill, a
// live "MA" (now) marker, and one dot per zone placed by real time (not index) — done zones get a
// sage check, the single next (first not-fully-done) zone gets a pulsing gold ring, everything
// else is a hollow "todo" dot. Time labels stagger above/below the track (odd index) so adjacent
// zones scheduled close together never collide. Purely presentational — the page computes
// `nextIndex` and `now` (fake-timer-friendly: passed in, not read live in here).
import { toHHmm, toMin } from '@/data/fuel/fuelConfig'
import type { StackDaySlot } from '@/features/fuel/logic/projectStackDay'

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/** A slot is "done" once every entry in it is either taken or not applicable today (skipped). */
export function isSlotDone(slot: StackDaySlot): boolean {
  return slot.entries.every(e => e.taken || e.skippedToday)
}

export function StackDayArc({
  slots,
  wake,
  bed,
  nextIndex,
  now,
  note,
}: {
  slots: StackDaySlot[]
  wake: string
  bed: string
  nextIndex: number
  now: Date
  /** Right-aligned corner note in the card head — the prototype's `edzésnap 17:30`. */
  note?: string
}) {
  const startMin = toMin(wake)
  const span = Math.max(toMin(bed) - startMin, 1)
  const pct = (hhmm: string) => clamp(((toMin(hhmm) - startMin) / span) * 100, 0, 100)
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const nowPct = clamp(((nowMin - startMin) / span) * 100, 0, 100)

  return (
    <div className="card stk-arc">
      <div className="stk-arc-head">
        <span className="eyebrow">Nap-ív · {wake} → {bed}</span>
        {note && <span className="stk-arc-note">{note}</span>}
      </div>
      <div className="stk-arc-track">
        <div className="stk-arc-fill" style={{ width: `${nowPct}%` }} />
        <i className="stk-arc-now" style={{ left: `${nowPct}%` }} aria-hidden="true" />
        {slots.map((slot, i) => {
          const done = isSlotDone(slot)
          const state = done ? 'done' : i === nextIndex ? 'next' : 'todo'
          return (
            <span
              key={`dot-${slot.zone}-${slot.time}`}
              className={`stk-arc-dot ${state}`}
              style={{ left: `${pct(slot.time)}%` }}
              data-zone={slot.zone}
            >
              {done && <span aria-hidden="true">✓</span>}
            </span>
          )
        })}
        {slots.map((slot, i) => (
          <span
            key={`lbl-${slot.zone}-${slot.time}`}
            className={`stk-arc-lbl${i % 2 ? ' alt' : ''}`}
            style={{ left: `${pct(slot.time)}%` }}
          >
            {slot.time}
          </span>
        ))}
      </div>
      <div className="stk-arc-legend">
        <span className="stk-leg-done">● bevéve</span>
        <span className="stk-leg-next">◉ következő</span>
        <span className="stk-leg-todo">○ hátravan</span>
        <span className="stk-leg-ma">▏MA {toHHmm(nowMin)}</span>
      </div>
    </div>
  )
}
