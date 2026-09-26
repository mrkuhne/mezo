// ============================================================
// Mezo · GymScheduleSheet — standalone weekly gym-time editor.
// One time max per weekday; Save emits the full slot list
// -> PUT /api/train/gym-schedule (full-replace). Gym slots persist
// across mesocycles — the editor only sets the WHEN; the WHAT comes
// from the active meso's gym days (deriveGymSchedule joins them).
// Mirrors SportScheduleSheet, minus the volleyball-only fields.
// Üveg (U10, mezo-me75u.10, `uveg-reteg` `SH.gym`): a coral glass sheet, the calendar 3D head,
// seven flat day cells with flat time fields, Mégse flat ghost + the lit coral „Mentés" pill.
// ============================================================
import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { SheetError, SheetHead } from '@/shared/ui/SheetHead'
import { Icon3D } from '@/shared/ui/clay'
import { cn } from '@/shared/lib/cn'
import { DAY_ORDER } from '@/data/train/train'
import type { GymScheduleSlotInput } from '@/data/train/trainApi'
import type { GymScheduleSlot } from '@/data/types'

function timesFrom(slots: GymScheduleSlot[]): string[] {
  return DAY_ORDER.map((_, i) => slots.find((s) => s.dayOfWeek === i)?.time ?? '')
}

export function GymScheduleSheet({ slots, onSave, onClose }: {
  slots: GymScheduleSlot[]
  onSave: (slots: GymScheduleSlotInput[]) => void | Promise<unknown>
  onClose: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [times, setTimes] = useState<string[]>(() => timesFrom(slots))
  const patch = (i: number, time: string) =>
    setTimes((ts) => ts.map((t, j) => (j === i ? time : t)))

  const save = async (close: () => void) => {
    setSaving(true)
    setSaveError(false)
    try {
    await onSave(times.flatMap((t, i) => (t ? [{ dayOfWeek: i, time: t }] : [])))
    close()
    } catch { setSaveError(true) } finally { setSaving(false) }
  }

  return (
    <Sheet glass onClose={onClose} labelledBy="gym-schedule-title" className="uvl-edzes">
      {(close) => (
        <div className="uvl-body">
          <SheetHead icon="t-calendar" eyebrow="Gym · heti idő" title="Heti gym-időpontok" titleId="gym-schedule-title" onClose={close} />

          {/* Day editors — one time per weekday, each a flat cell (a set day lit coral) */}
          <div className="uvl-rows">
            {DAY_ORDER.map((day, i) => (
              <label key={day} className={cn('uvl-cell', times[i] && 'is-set')}>
                <span className="uvl-cell-day">{day}</span>
                <input
                  type="time"
                  aria-label={`${day} időpont`}
                  value={times[i]}
                  onChange={(e) => patch(i, e.target.value)}
                />
              </label>
            ))}
          </div>

          {saveError && <SheetError>Nem sikerült menteni. A módosításaid megmaradtak; próbáld újra.</SheetError>}
          <div className="uvl-foot">
            <button type="button" className="uvl-ghost" onClick={close}>Mégse</button>
            <button type="button" className="uvl-cta" disabled={saving} onClick={() => save(close)}>
              <Icon3D name="t-tick" size={20} />{saving ? 'Mentés…' : 'Mentés'}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
