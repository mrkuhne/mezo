// ============================================================
// Mezo · GymScheduleSheet — standalone weekly gym-time editor.
// One time max per weekday; Save emits the full slot list
// -> PUT /api/train/gym-schedule (full-replace). Gym slots persist
// across mesocycles — the editor only sets the WHEN; the WHAT comes
// from the active meso's gym days (deriveGymSchedule joins them).
// Mirrors SportScheduleSheet, minus the volleyball-only fields.
// Folyadék (mezo-n4wf5.3): the prototype has no route for this sheet (it opens only from
// Settings), so it is written in the shared sheet language — the calendar glyph head, one
// row per weekday (the day badge, the day's name, its time field), „Mentés" + „Mégse".
// ============================================================
import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { Box, FoSheetHead, Input, SheetActs } from '@/shared/ui/folyadek'
import { DayNum } from '@/features/train/components/folyadek'
import { DAY_LABELS, DAY_ORDER } from '@/data/train/train'
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
    <Sheet onClose={onClose} labelledBy="gym-schedule-title" className="fo-sheet es-sheet">
      {(close) => (
        <>
          <FoSheetHead titleId="gym-schedule-title" icon="t-calendar" eyebrow="Gym · heti idő" title="Heti gym-időpontok" onClose={close} />

          {/* Day editors — one time per weekday (a set day reads in ink, an unset one quiet) */}
          <div className="es-vl">
            {DAY_ORDER.map((day, i) => (
              <label key={day} className={times[i] ? 'fo-row es-gymday is-set' : 'fo-row es-gymday'}>
                <DayNum>{day}</DayNum>
                <span className="g"><strong>{DAY_LABELS[day]}</strong></span>
                <Input type="time" aria-label={`${day} időpont`} value={times[i]} onChange={(e) => patch(i, e.target.value)} />
              </label>
            ))}
          </div>

          {saveError && (
            <div role="alert"><Box icon="t-info" color="var(--fo-bad)" title="Nem sikerült menteni."><p>A módosításaid megmaradtak; próbáld újra.</p></Box></div>
          )}
          <SheetActs label={saving ? 'Mentés…' : 'Mentés'} disabled={saving} onSave={() => save(close)} onCancel={close} />
        </>
      )}
    </Sheet>
  )
}
