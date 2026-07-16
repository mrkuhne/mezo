// ============================================================
// Mezo · GymScheduleSheet
// Weekly gym-time editor bottom sheet — per-day active toggle, type label
// and time-chip picker. The Mezo engine derives pre/post-workout meals,
// caffeine cutoff, supplement timing and sleep impact from these slots.
// Port: prototype/src/fuel-plan.jsx GymScheduleSheet + ScheduleRow (791–900).
//
// Adaptations vs prototype:
//  - No global mutation: the prototype's "Mentés" wrote
//    window.MezoData.gymSchedule.weeklyTimes. We instead lift the edited copy
//    via onSave(next) and dismiss with the sheet's animated close().
//  - The per-day on/off switch reuses the shared <Toggle> (44×24) instead of
//    the prototype's bespoke 36×20 inline button.
// ============================================================
import { useState } from 'react'
import type { GymScheduleDay } from '@/data/types'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { Display } from '@/shared/ui/Display'
import { Toggle } from '@/shared/ui/Toggle'

const TIMES = ['06:00', '07:00', '08:00', '16:00', '17:00', '18:00', '19:00']

export function GymScheduleSheet({
  schedule,
  onSave,
  onClose,
}: {
  schedule: GymScheduleDay[]
  onSave: (next: GymScheduleDay[]) => void
  onClose: () => void
}) {
  // Local working copy — edits never touch the source data or any global.
  const [localSchedule, setLocalSchedule] = useState<GymScheduleDay[]>(schedule)

  const updateDay = (i: number, patch: Partial<GymScheduleDay>) => {
    setLocalSchedule(prev => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  }

  return (
    <Sheet onClose={onClose} labelledBy="gym-schedule-title">
      {(close) => (
        <>
          {/* Header */}
          <div
            className="row"
            style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}
          >
            <div className="col">
              <Eyebrow brand>Heti gym idők</Eyebrow>
              <div id="gym-schedule-title" style={{ marginTop: 4 }}>
                <Display size="md">Mikor megyünk?</Display>
              </div>
            </div>
            <button className="chip" aria-label="Bezárás" onClick={close} style={{ padding: '6px 8px' }}>
              <Icon name="x" size={12} />
            </button>
          </div>

          <p className="text-secondary" style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 14 }}>
            A Mezo ezekből számolja a pre/post-workout étkezést, koffein-cutoff-ot, supplement
            timing-ot, alvás-impact-et.
          </p>

          <div className="col gap-sm">
            {localSchedule.map((slot, i) => (
              <ScheduleRow key={i} slot={slot} onChange={patch => updateDay(i, patch)} />
            ))}
          </div>

          {/* Actions */}
          <div className="row gap-sm mt-lg">
            <button className="cta-ghost flex-1" onClick={close}>
              Mégse
            </button>
            <button
              className="cta-primary flex-1"
              onClick={() => {
                onSave(localSchedule)
                close()
              }}
            >
              <Icon name="check" size={14} /> Mentés
            </button>
          </div>

          <div style={{ height: 24 }} />
        </>
      )}
    </Sheet>
  )
}

function ScheduleRow({
  slot,
  onChange,
}: {
  slot: GymScheduleDay
  onChange: (patch: Partial<GymScheduleDay>) => void
}) {
  return (
    <div
      className="card"
      style={{
        padding: '10px 12px',
        borderColor: slot.active ? 'var(--border-brand)' : 'var(--border-subtle)',
        background: slot.active
          ? 'color-mix(in srgb, var(--brand-glow) 3%, transparent)'
          : 'var(--surface-1)',
        opacity: slot.active ? 1 : 0.6,
      }}
    >
      <div className="row" style={{ alignItems: 'center', gap: 12 }}>
        <span
          className="label-mono"
          style={{
            width: 40,
            fontSize: 10,
            color: slot.active ? 'var(--brand-glow)' : 'var(--text-tertiary)',
          }}
        >
          {slot.day}
        </span>
        <div className="col flex-1" style={{ minWidth: 0 }}>
          {slot.active ? (
            <>
              <input
                value={slot.type ?? ''}
                onChange={e => onChange({ type: e.target.value })}
                placeholder="pl. Pull Day"
                style={{ fontSize: 13, color: 'var(--text-primary)', padding: '2px 0' }}
              />
              <div className="row gap-xs mt-xs flex-wrap">
                {TIMES.map(t => {
                  const selected = slot.time === t
                  return (
                    <button
                      key={t}
                      onClick={() => onChange({ time: t })}
                      className="chip"
                      style={{
                        fontSize: 9,
                        padding: '3px 6px',
                        color: selected ? 'var(--brand-glow)' : 'var(--text-tertiary)',
                        borderColor: selected ? 'var(--border-brand)' : 'var(--border-subtle)',
                        background: selected
                          ? 'color-mix(in srgb, var(--brand-glow) 8%, transparent)'
                          : 'transparent',
                      }}
                    >
                      {t}
                    </button>
                  )
                })}
              </div>
            </>
          ) : (
            <span className="text-tertiary" style={{ fontSize: 12, fontStyle: 'italic' }}>
              off
            </span>
          )}
        </div>
        <Toggle
          on={slot.active}
          onToggle={() => onChange({ active: !slot.active })}
          ariaLabel={`${slot.day} aktív`}
        />
      </div>
    </div>
  )
}
