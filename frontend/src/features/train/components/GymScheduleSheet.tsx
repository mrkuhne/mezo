// ============================================================
// Mezo · GymScheduleSheet — standalone weekly gym-time editor.
// One time max per weekday; Save emits the full slot list
// -> PUT /api/train/gym-schedule (full-replace). Gym slots persist
// across mesocycles — the editor only sets the WHEN; the WHAT comes
// from the active meso's gym days (deriveGymSchedule joins them).
// Mirrors SportScheduleSheet, minus the volleyball-only fields.
// ============================================================
import { useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Icon } from '@/components/ui/Icon'
import { Display } from '@/components/ui/Display'
import { CtaPrimary, CtaGhost } from '@/components/ui/Cta'
import { DAY_ORDER } from '@/data/train'
import type { GymScheduleSlotInput } from '@/lib/trainApi'
import type { GymScheduleSlot } from '@/data/types'

function timesFrom(slots: GymScheduleSlot[]): string[] {
  return DAY_ORDER.map((_, i) => slots.find((s) => s.dayOfWeek === i)?.time ?? '')
}

export function GymScheduleSheet({ slots, onSave, onClose }: {
  slots: GymScheduleSlot[]
  onSave: (slots: GymScheduleSlotInput[]) => void
  onClose: () => void
}) {
  const [times, setTimes] = useState<string[]>(() => timesFrom(slots))
  const patch = (i: number, time: string) =>
    setTimes((ts) => ts.map((t, j) => (j === i ? time : t)))

  const save = (close: () => void) => {
    onSave(times.flatMap((t, i) => (t ? [{ dayOfWeek: i, time: t }] : [])))
    close()
  }

  const inputStyle = {
    background: 'var(--surface-2)', border: '1px solid var(--border-subtle)',
    color: 'var(--text-primary)', fontFamily: 'var(--ff-mono)', fontSize: 16,
    padding: '8px 10px', width: 130,
  } as const

  return (
    <Sheet onClose={onClose} labelledBy="gym-schedule-title">
      {(close) => (
        <>
          {/* Header */}
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div className="col">
              <span className="eyebrow brand">Gym · heti idő</span>
              <div style={{ marginTop: 4 }}>
                <Display size="md">
                  <span role="heading" aria-level={2} id="gym-schedule-title">Heti gym-időpontok</span>
                </Display>
              </div>
            </div>
            <button className="chip notch-4" onClick={close} aria-label="Bezárás" style={{ padding: '6px 8px' }}>
              <Icon name="x" size={12} />
            </button>
          </div>

          {/* Day editors — one time per weekday */}
          <div className="col gap-sm">
            {DAY_ORDER.map((day, i) => (
              <div key={day} className="card notch-4" style={{ padding: 10 }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <span
                    className="label-mono"
                    style={{ width: 36, color: times[i] ? 'var(--brand-glow)' : 'var(--text-tertiary)' }}
                  >
                    {day}
                  </span>
                  <input
                    type="time"
                    aria-label={`${day} időpont`}
                    value={times[i]}
                    onChange={(e) => patch(i, e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="row gap-sm mt-lg">
            <CtaGhost className="notch-4 flex-1" onClick={close}>Mégse</CtaGhost>
            <CtaPrimary className="notch-4 flex-1" onClick={() => save(close)}>
              <Icon name="check" size={14} /> Mentés
            </CtaPrimary>
          </div>
        </>
      )}
    </Sheet>
  )
}
