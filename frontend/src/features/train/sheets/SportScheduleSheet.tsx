// ============================================================
// Mezo · SportScheduleSheet — weekly sport plan editor.
// Per-day slot lists (a day holds 0..n slots, each with a sport discriminator);
// non-volleyball slots always save kind 'training'.
// Save emits the full slot list -> PUT /api/train/sport-schedule
// (full-replace). Real-mode-only affordance: mock mode keeps the
// static Phase-1 schedule (a read-only seed, no write path), so the
// editor entry points are hidden there.
// Folyadék (mezo-n4wf5.3): the prototype has no route for this sheet (it opens only from
// Settings), so it is written in the same sheet language as `SHEETS.sportev` — the calendar
// glyph head, one block per weekday (the day badge + its slots), each slot: sport pills +
// „törlés", time + kind pills, the length stepper, place and intensity fields; a text link
// adds a slot; „Mentés" + „Mégse". Every field and its accessible name is unchanged.
// ============================================================
import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { Box, FoSheetHead, Input, Lk, Pill, Pills, SheetActs } from '@/shared/ui/folyadek'
import { DayNum } from '@/features/train/components/folyadek'
import { DAY_LABELS, DAY_ORDER } from '@/data/train/train'
import type { SportScheduleSlotInput } from '@/data/train/trainApi'
import type { VolleyballSession } from '@/data/types'
import { NumberStep } from '@/features/train/sheets/SportLogSheet'
import { SPORT_LABELS, sportOf } from '@/features/train/logic/sportKinds'

// The schedule slot's OWN 3-id vocabulary — `ck_sport_schedule_slot_sport` stayed
// unchanged when the sport-session wire widened to ten ids (mezo-88iwa.9), so this
// sheet keeps offering only what the schedule's own CHECK still accepts.
const SCHEDULE_SPORT_KINDS = ['volleyball', 'cross', 'trx'] as const
type ScheduleSportKind = (typeof SCHEDULE_SPORT_KINDS)[number]

interface SlotDraft {
  sport: ScheduleSportKind
  time: string
  durationMin: number
  kind: 'training' | 'match'
  location: string
  intensityLabel: string
}

const newSlot = (): SlotDraft =>
  ({ sport: 'volleyball', time: '18:00', durationMin: 90, kind: 'training', location: '', intensityLabel: '' })

// Groups the mapped schedule per weekday (role 'meccs*' <-> kind 'match') — exact for
// real-mode data, best-effort for the Phase-1 mock fixture. A day holds 0..n slots.
function draftsFrom(sessions: VolleyballSession[]): SlotDraft[][] {
  return DAY_ORDER.map((d) =>
    sessions.filter((x) => x.day === d).map((s) => ({
      sport: sportOf(s), time: s.time, durationMin: s.duration,
      kind: s.role.startsWith('meccs') ? 'match' as const : 'training' as const,
      location: s.court, intensityLabel: s.intensity,
    })))
}

export function SportScheduleSheet({ initial, onSave, onClose }: {
  initial: VolleyballSession[]
  onSave?: (slots: SportScheduleSlotInput[]) => void | Promise<unknown>
  onClose: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [days, setDays] = useState<SlotDraft[][]>(() => draftsFrom(initial))
  const patch = (di: number, si: number, p: Partial<SlotDraft>) =>
    setDays((ds) => ds.map((slots, j) => (j === di ? slots.map((s, k) => (k === si ? { ...s, ...p } : s)) : slots)))
  const addSlot = (di: number) => setDays((ds) => ds.map((slots, j) => (j === di ? [...slots, newSlot()] : slots)))
  const removeSlot = (di: number, si: number) =>
    setDays((ds) => ds.map((slots, j) => (j === di ? slots.filter((_, k) => k !== si) : slots)))

  const save = async (close: () => void) => {
    setSaving(true)
    setSaveError(false)
    try {
    await onSave?.(days.flatMap((slots, i) => slots.map((d) => ({
      dayOfWeek: i, time: d.time, durationMin: d.durationMin,
      sport: d.sport, kind: d.sport === 'volleyball' ? d.kind : 'training',
      ...(d.location.trim() ? { location: d.location.trim() } : {}),
      ...(d.intensityLabel.trim() ? { intensityLabel: d.intensityLabel.trim() } : {}),
    }))))
    close()
    } catch { setSaveError(true) } finally { setSaving(false) }
  }

  return (
    <Sheet onClose={onClose} labelledBy="sport-schedule-title" className="fo-sheet es-sheet">
      {(close) => (
        <>
          <FoSheetHead titleId="sport-schedule-title" icon="t-calendar" eyebrow="Sport · heti terv" title="Heti rend" onClose={close} />

          {/* Day editors */}
          <div className="es-days">
            {DAY_ORDER.map((day, di) => (
              <div key={day} className={days[di].length ? 'es-dayed has' : 'es-dayed'}>
                <div className="es-dayed-h">
                  <DayNum>{day}</DayNum>
                  <strong>{DAY_LABELS[day]}</strong>
                  <Lk aria-label={`${DAY_LABELS[day]} sport hozzáadása`} onClick={() => addSlot(di)}>+ Sport hozzáadása</Lk>
                </div>
                {days[di].map((d, si) => {
                  const slotName = `${DAY_LABELS[day]} ${si + 1}.`
                  return (
                    <div key={si} className="es-slot">
                      <div className="es-slot-top">
                        <Pills role="group" aria-label={`${slotName} sport`}>
                          {SCHEDULE_SPORT_KINDS.map((k) => (
                            <Pill
                              key={k}
                              on={d.sport === k}
                              aria-label={`${slotName} ${SPORT_LABELS[k]}`}
                              onClick={() => patch(di, si, { sport: k, ...(k !== 'volleyball' ? { kind: 'training' as const } : {}) })}
                            >
                              {SPORT_LABELS[k]}
                            </Pill>
                          ))}
                        </Pills>
                        <Lk aria-label={`${slotName} slot törlése`} onClick={() => removeSlot(di, si)}>törlés</Lk>
                      </div>
                      <div className="es-slot-when">
                        <Input type="time" aria-label={`${slotName} idő`} value={d.time} onChange={(e) => patch(di, si, { time: e.target.value })} />
                        {d.sport === 'volleyball' && (
                          <Pills>
                            <Pill on={d.kind === 'training'} aria-label={`${slotName} edzés`} onClick={() => patch(di, si, { kind: 'training' })}>edzés</Pill>
                            <Pill on={d.kind === 'match'} aria-label={`${slotName} meccs`} onClick={() => patch(di, si, { kind: 'match' })}>meccs</Pill>
                          </Pills>
                        )}
                      </div>
                      <NumberStep label="Hossz · perc" val={d.durationMin} step={15} min={15} max={360} onChange={(v) => patch(di, si, { durationMin: v })} />
                      <Input aria-label={`${slotName} helyszín`} placeholder="Helyszín" value={d.location} onChange={(e) => patch(di, si, { location: e.target.value })} />
                      <Input aria-label={`${slotName} intenzitás`} placeholder="Intenzitás · pl. közepes" value={d.intensityLabel} onChange={(e) => patch(di, si, { intensityLabel: e.target.value })} />
                    </div>
                  )
                })}
              </div>
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
