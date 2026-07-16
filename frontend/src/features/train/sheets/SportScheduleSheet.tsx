// ============================================================
// Mezo · SportScheduleSheet — weekly sport plan editor.
// Per-day slot lists (a day holds 0..n slots, each with a sport discriminator);
// non-volleyball slots always save kind 'training'.
// Save emits the full slot list -> PUT /api/train/sport-schedule
// (full-replace). Real-mode-only affordance: mock mode keeps the
// static Phase-1 schedule (a read-only seed, no write path), so the
// editor entry points are hidden there.
// ============================================================
import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { Display } from '@/shared/ui/Display'
import { CtaPrimary, CtaGhost } from '@/shared/ui/Cta'
import { DAY_LABELS, DAY_ORDER } from '@/data/train/train'
import type { SportScheduleSlotInput } from '@/data/train/trainApi'
import type { VolleyballSession } from '@/data/types'
import { NumberStep } from '@/features/train/sheets/SportLogSheet'
import { SPORT_KINDS, SPORT_LABELS, sportOf, type SportKind } from '@/features/train/logic/sportKinds'

interface SlotDraft {
  sport: SportKind
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
  onSave?: (slots: SportScheduleSlotInput[]) => void
  onClose: () => void
}) {
  const [days, setDays] = useState<SlotDraft[][]>(() => draftsFrom(initial))
  const patch = (di: number, si: number, p: Partial<SlotDraft>) =>
    setDays((ds) => ds.map((slots, j) => (j === di ? slots.map((s, k) => (k === si ? { ...s, ...p } : s)) : slots)))
  const addSlot = (di: number) => setDays((ds) => ds.map((slots, j) => (j === di ? [...slots, newSlot()] : slots)))
  const removeSlot = (di: number, si: number) =>
    setDays((ds) => ds.map((slots, j) => (j === di ? slots.filter((_, k) => k !== si) : slots)))

  const save = () => {
    onSave?.(days.flatMap((slots, i) => slots.map((d) => ({
      dayOfWeek: i, time: d.time, durationMin: d.durationMin,
      sport: d.sport, kind: d.sport === 'volleyball' ? d.kind : 'training',
      ...(d.location.trim() ? { location: d.location.trim() } : {}),
      ...(d.intensityLabel.trim() ? { intensityLabel: d.intensityLabel.trim() } : {}),
    }))))
  }

  const inputStyle = {
    background: 'var(--surface-2)', border: '1px solid var(--border-subtle)',
    color: 'var(--text-primary)', fontSize: 12,
    padding: '8px 10px', width: '100%',
  } as const

  return (
    <Sheet onClose={onClose} labelledBy="sport-schedule-title">
      {(close) => (
        <>
          {/* Header */}
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div className="col">
              <span className="eyebrow" style={{ color: 'var(--rose)' }}>Sport · heti terv</span>
              <div style={{ marginTop: 4 }}>
                <Display size="md">
                  <span role="heading" aria-level={2} id="sport-schedule-title">Heti rend</span>
                </Display>
              </div>
            </div>
            <button className="chip" onClick={close} aria-label="Bezárás" style={{ padding: '6px 8px' }}>
              <Icon name="x" size={12} />
            </button>
          </div>

          {/* Day editors */}
          <div className="col gap-sm">
            {DAY_ORDER.map((day, di) => (
              <div key={day} className="card" style={{ padding: 10 }}>
                <span
                  className="label-mono"
                  style={{ color: days[di].length ? 'var(--rose)' : 'var(--text-tertiary)' }}
                >
                  {day}
                </span>
                <div className="col gap-sm mt-sm">
                  {days[di].map((d, si) => {
                    const slotName = `${DAY_LABELS[day]} ${si + 1}.`
                    return (
                      <div key={si} className="card" style={{ padding: 10, background: 'var(--surface-2)' }}>
                        <div className="row gap-xs" role="group" aria-label={`${slotName} sport`}>
                          {SPORT_KINDS.map((k) => (
                            <button
                              key={k}
                              type="button"
                              className="chip flex-1"
                              aria-pressed={d.sport === k}
                              aria-label={`${slotName} ${SPORT_LABELS[k]}`}
                              onClick={() => patch(di, si, { sport: k, ...(k !== 'volleyball' ? { kind: 'training' as const } : {}) })}
                              style={{
                                padding: '6px 8px', fontSize: 9,
                                color: d.sport === k ? 'var(--rose)' : 'var(--text-tertiary)',
                                borderColor: d.sport === k
                                  ? 'color-mix(in srgb, var(--rose) 40%, transparent)'
                                  : 'var(--border-subtle)',
                              }}
                            >
                              {SPORT_LABELS[k]}
                            </button>
                          ))}
                          <button
                            type="button"
                            className="chip"
                            aria-label={`${slotName} slot törlése`}
                            onClick={() => removeSlot(di, si)}
                            style={{ padding: '6px 8px' }}
                          >
                            <Icon name="x" size={10} />
                          </button>
                        </div>
                        <div className="col gap-sm mt-md">
                          <div className="row gap-sm">
                            <input
                              type="time"
                              aria-label={`${slotName} idő`}
                              value={d.time}
                              onChange={(e) => patch(di, si, { time: e.target.value })}
                              style={{ ...inputStyle, width: 110 }}
                            />
                            {d.sport === 'volleyball' && (
                              <>
                                <button
                                  type="button"
                                  className="chip flex-1"
                                  aria-pressed={d.kind === 'training'}
                                  aria-label={`${slotName} edzés`}
                                  onClick={() => patch(di, si, { kind: 'training' })}
                                  style={{ fontSize: 9, color: d.kind === 'training' ? 'var(--rose)' : 'var(--text-tertiary)' }}
                                >
                                  edzés
                                </button>
                                <button
                                  type="button"
                                  className="chip flex-1"
                                  aria-pressed={d.kind === 'match'}
                                  aria-label={`${slotName} meccs`}
                                  onClick={() => patch(di, si, { kind: 'match' })}
                                  style={{ fontSize: 9, color: d.kind === 'match' ? 'var(--rose)' : 'var(--text-tertiary)' }}
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
                            style={inputStyle}
                          />
                          <input
                            aria-label={`${slotName} intenzitás`}
                            placeholder="Intenzitás · pl. közepes"
                            value={d.intensityLabel}
                            onChange={(e) => patch(di, si, { intensityLabel: e.target.value })}
                            style={inputStyle}
                          />
                        </div>
                      </div>
                    )
                  })}
                  <button
                    type="button"
                    className="chip"
                    aria-label={`${DAY_LABELS[day]} sport hozzáadása`}
                    onClick={() => addSlot(di)}
                    style={{ padding: '8px 10px', fontSize: 9, color: 'var(--text-secondary)' }}
                  >
                    + Sport hozzáadása
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="row gap-sm mt-lg">
            <CtaGhost className="flex-1" onClick={close}>Mégse</CtaGhost>
            <CtaPrimary className="flex-1" onClick={() => { save(); close() }}>
              <Icon name="check" size={14} /> Mentés
            </CtaPrimary>
          </div>
        </>
      )}
    </Sheet>
  )
}
