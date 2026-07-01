// ============================================================
// Mezo · SportScheduleSheet — weekly sport (volleyball) plan editor.
// One slot max per day (the weekly views render one row per day);
// Save emits the full slot list -> PUT /api/train/sport-schedule
// (full-replace). Real-mode-only affordance: mock mode keeps the
// Phase-1 static schedule (parity snapshot), so the editor entry
// points are hidden there.
// ============================================================
import { useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Icon } from '@/components/ui/Icon'
import { Display } from '@/components/ui/Display'
import { CtaPrimary, CtaGhost } from '@/components/ui/Cta'
import { DAY_ORDER } from '@/data/train'
import type { SportScheduleSlotInput } from '@/lib/trainApi'
import type { VolleyballSession } from '@/data/types'
import { NumberStep } from '@/features/train/components/SportLogSheet'

interface DayDraft {
  on: boolean
  time: string
  durationMin: number
  kind: 'training' | 'match'
  location: string
  intensityLabel: string
}

const emptyDraft = (): DayDraft =>
  ({ on: false, time: '18:00', durationMin: 90, kind: 'training', location: '', intensityLabel: '' })

// Round-trips the mapped schedule (role 'meccs*' <-> kind 'match') — exact for
// real-mode data, best-effort for the Phase-1 mock fixture.
function draftsFrom(sessions: VolleyballSession[]): DayDraft[] {
  return DAY_ORDER.map((d) => {
    const s = sessions.find((x) => x.day === d)
    return s
      ? {
          on: true, time: s.time, durationMin: s.duration,
          kind: s.role.startsWith('meccs') ? 'match' as const : 'training' as const,
          location: s.court, intensityLabel: s.intensity,
        }
      : emptyDraft()
  })
}

export function SportScheduleSheet({ initial, onSave, onClose }: {
  initial: VolleyballSession[]
  onSave?: (slots: SportScheduleSlotInput[]) => void
  onClose: () => void
}) {
  const [drafts, setDrafts] = useState<DayDraft[]>(() => draftsFrom(initial))
  const patch = (i: number, p: Partial<DayDraft>) =>
    setDrafts((ds) => ds.map((d, j) => (j === i ? { ...d, ...p } : d)))

  const save = () => {
    onSave?.(drafts.flatMap((d, i) => d.on
      ? [{
          dayOfWeek: i, time: d.time, durationMin: d.durationMin, kind: d.kind,
          ...(d.location.trim() ? { location: d.location.trim() } : {}),
          ...(d.intensityLabel.trim() ? { intensityLabel: d.intensityLabel.trim() } : {}),
        }]
      : []))
  }

  const inputStyle = {
    background: 'var(--surface-2)', border: '1px solid var(--border-subtle)',
    color: 'var(--text-primary)', fontFamily: 'var(--ff-mono)', fontSize: 12,
    padding: '8px 10px', width: '100%',
  } as const

  return (
    <Sheet onClose={onClose} labelledBy="sport-schedule-title">
      {(close) => (
        <>
          {/* Header */}
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div className="col">
              <span className="eyebrow" style={{ color: 'var(--cat-tendency)' }}>Sport · heti terv</span>
              <div style={{ marginTop: 4 }}>
                <Display size="md">
                  <span role="heading" aria-level={2} id="sport-schedule-title">Heti rend</span>
                </Display>
              </div>
            </div>
            <button className="chip notch-4" onClick={close} aria-label="Bezárás" style={{ padding: '6px 8px' }}>
              <Icon name="x" size={12} />
            </button>
          </div>

          {/* Day editors */}
          <div className="col gap-sm">
            {DAY_ORDER.map((day, i) => {
              const d = drafts[i]
              return (
                <div key={day} className="card notch-4" style={{ padding: 10 }}>
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <span
                      className="label-mono"
                      style={{ width: 36, color: d.on ? 'var(--cat-tendency)' : 'var(--text-tertiary)' }}
                    >
                      {day}
                    </span>
                    <button
                      type="button"
                      className="chip notch-4"
                      aria-pressed={d.on}
                      onClick={() => patch(i, { on: !d.on })}
                      style={{
                        padding: '6px 10px', fontSize: 9,
                        color: d.on ? 'var(--cat-tendency)' : 'var(--text-tertiary)',
                        borderColor: d.on
                          ? 'color-mix(in srgb, var(--cat-tendency) 40%, transparent)'
                          : 'var(--border-subtle)',
                      }}
                    >
                      {day} session
                    </button>
                  </div>
                  {d.on && (
                    <div className="col gap-sm mt-md">
                      <div className="row gap-sm">
                        <input
                          type="time"
                          aria-label={`${day} idő`}
                          value={d.time}
                          onChange={(e) => patch(i, { time: e.target.value })}
                          style={{ ...inputStyle, width: 110 }}
                        />
                        <button
                          type="button"
                          className="chip notch-4 flex-1"
                          aria-pressed={d.kind === 'training'}
                          onClick={() => patch(i, { kind: 'training' })}
                          style={{ fontSize: 9, color: d.kind === 'training' ? 'var(--cat-tendency)' : 'var(--text-tertiary)' }}
                        >
                          {day} edzés
                        </button>
                        <button
                          type="button"
                          className="chip notch-4 flex-1"
                          aria-pressed={d.kind === 'match'}
                          onClick={() => patch(i, { kind: 'match' })}
                          style={{ fontSize: 9, color: d.kind === 'match' ? 'var(--cat-tendency)' : 'var(--text-tertiary)' }}
                        >
                          {day} meccs
                        </button>
                      </div>
                      <NumberStep
                        label="Hossz · perc"
                        val={d.durationMin}
                        step={15}
                        min={15}
                        max={360}
                        onChange={(v) => patch(i, { durationMin: v })}
                      />
                      <input
                        aria-label={`${day} helyszín`}
                        placeholder="Helyszín"
                        value={d.location}
                        onChange={(e) => patch(i, { location: e.target.value })}
                        style={inputStyle}
                      />
                      <input
                        aria-label={`${day} intenzitás`}
                        placeholder="Intenzitás · pl. közepes"
                        value={d.intensityLabel}
                        onChange={(e) => patch(i, { intensityLabel: e.target.value })}
                        style={inputStyle}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div className="row gap-sm mt-lg">
            <CtaGhost className="notch-4 flex-1" onClick={close}>Mégse</CtaGhost>
            <CtaPrimary className="notch-4 flex-1" onClick={() => { save(); close() }}>
              <Icon name="check" size={14} /> Mentés
            </CtaPrimary>
          </div>
        </>
      )}
    </Sheet>
  )
}
