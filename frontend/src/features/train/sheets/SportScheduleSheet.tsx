// ============================================================
// Mezo · SportScheduleSheet — weekly sport plan editor.
// Per-day slot lists (a day holds 0..n slots, each with a sport discriminator);
// non-volleyball slots always save kind 'training'.
// Save emits the full slot list -> PUT /api/train/sport-schedule
// (full-replace). Real-mode-only affordance: mock mode keeps the
// static Phase-1 schedule (a read-only seed, no write path), so the
// editor entry points are hidden there.
// Üveg re-dress (mezo-me75u.4): the shared floating capture sheet (one rose glass
// surface, bible U2 rule 15) with the capture header; the day editors and slots are
// flat cells, the chips flat with the chosen one solid rose, fields flat, Mégse flat
// and Mentés the one lit primary.
// ============================================================
import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon3D } from '@/shared/ui/clay'
import { CaptureHeader } from '@/shared/ui/CaptureHeader'
import { CtaPrimary, CtaGhost } from '@/shared/ui/Cta'
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
    <Sheet onClose={onClose} labelledBy="sport-schedule-title" className="capture-sheet capture-tone-sport glass uvs-sheet">
      {(close) => (
        <>
          <CaptureHeader id="sport-schedule-title" title="Heti rend" eyebrow="Sport · heti terv" kind="sport" onClose={close} />

          {/* Day editors */}
          <div className="col gap-sm">
            {DAY_ORDER.map((day, di) => (
              <div key={day} className={days[di].length ? 'uvs-day card has' : 'uvs-day card'}>
                <span className="uvs-day-lbl">{day}</span>
                <div className="col gap-sm mt-sm">
                  {days[di].map((d, si) => {
                    const slotName = `${DAY_LABELS[day]} ${si + 1}.`
                    return (
                      <div key={si} className="uvs-slot">
                        <div className="row gap-xs" role="group" aria-label={`${slotName} sport`}>
                          {SCHEDULE_SPORT_KINDS.map((k) => (
                            <button
                              key={k}
                              type="button"
                              className="chip flex-1"
                              aria-pressed={d.sport === k}
                              aria-label={`${slotName} ${SPORT_LABELS[k]}`}
                              onClick={() => patch(di, si, { sport: k, ...(k !== 'volleyball' ? { kind: 'training' as const } : {}) })}
                            >
                              {SPORT_LABELS[k]}
                            </button>
                          ))}
                          <button
                            type="button"
                            className="chip"
                            aria-label={`${slotName} slot törlése`}
                            onClick={() => removeSlot(di, si)}
                          >
                            törlés
                          </button>
                        </div>
                        <div className="col gap-sm mt-md">
                          <div className="row gap-sm">
                            <input
                              type="time"
                              aria-label={`${slotName} idő`}
                              value={d.time}
                              onChange={(e) => patch(di, si, { time: e.target.value })}
                              className="uvs-inp is-time"
                            />
                            {d.sport === 'volleyball' && (
                              <>
                                <button
                                  type="button"
                                  className="chip flex-1"
                                  aria-pressed={d.kind === 'training'}
                                  aria-label={`${slotName} edzés`}
                                  onClick={() => patch(di, si, { kind: 'training' })}
                                >
                                  edzés
                                </button>
                                <button
                                  type="button"
                                  className="chip flex-1"
                                  aria-pressed={d.kind === 'match'}
                                  aria-label={`${slotName} meccs`}
                                  onClick={() => patch(di, si, { kind: 'match' })}
                                >
                                  meccs
                                </button>
                              </>
                            )}
                          </div>
                          <NumberStep
                            label="Hossz · perc"
                            val={d.durationMin}
                            step={15}
                            min={15}
                            max={360}
                            onChange={(v) => patch(di, si, { durationMin: v })}
                          />
                          <input
                            aria-label={`${slotName} helyszín`}
                            placeholder="Helyszín"
                            value={d.location}
                            onChange={(e) => patch(di, si, { location: e.target.value })}
                            className="uvs-inp"
                          />
                          <input
                            aria-label={`${slotName} intenzitás`}
                            placeholder="Intenzitás · pl. közepes"
                            value={d.intensityLabel}
                            onChange={(e) => patch(di, si, { intensityLabel: e.target.value })}
                            className="uvs-inp"
                          />
                        </div>
                      </div>
                    )
                  })}
                  <button
                    type="button"
                    className="uvs-addslot uv-empty"
                    aria-label={`${DAY_LABELS[day]} sport hozzáadása`}
                    onClick={() => addSlot(di)}
                  >
                    + Sport hozzáadása
                  </button>
                </div>
              </div>
            ))}
          </div>

          {saveError && <p className="capture-warn capture-section" role="alert">Nem sikerült menteni. A módosításaid megmaradtak; próbáld újra.</p>}
          {/* Footer */}
          <div className="capture-actions">
            <CtaGhost className="flex-1" onClick={close}>Mégse</CtaGhost>
            <CtaPrimary className="capture-save flex-1" disabled={saving} onClick={() => save(close)}>
              <Icon3D name="t-tick" size={22} /> {saving ? 'Mentés…' : 'Mentés'}
            </CtaPrimary>
          </div>
        </>
      )}
    </Sheet>
  )
}
