// ============================================================
// Mezo · LogDoseSheet (the dose-capture sheet — mezo-d94)
// Tapping "＋ Beadás" in FuelMedicationView opens this. You log only the ACTUAL
// injection; the cycle day + phase are DERIVED from the newest dose (the mock
// hook / backend recompute retaDay = days-since-newest + 1, so a dose dated today
// re-anchors the cycle to day 1). Mirrors the AddPantryItemSheet shell (shared
// <Sheet> portal + chamfer Field cards). Fields: Dátum (default today) · Időpont
// (optional) · Dózis (prefilled from the last dose) · Jegyzet (optional) → on save
// builds a MedicationDoseInput and calls useMedicationActions().logDose, then closes.
// ============================================================
import { useState } from 'react'
import { useMedication, useMedicationActions } from '@/data/hooks'
import { localDateString } from '@/lib/dates'
import type { MedicationDoseInput } from '@/data/types'
import { Sheet } from '@/components/ui/Sheet'
import { Icon } from '@/components/ui/Icon'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Display } from '@/components/ui/Display'

const fieldLabelStyle = { fontSize: 8, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-tertiary)' } as const
const fieldInputStyle = { fontSize: 14, color: 'var(--text-primary)', marginTop: 3, width: '100%' } as const
const grid2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 } as const

// A single chamfered form field card (label on top, control below) — the
// AddPantryItemSheet idiom. The <label> wraps the control so getByLabelText resolves it.
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="card notch-4" style={{ padding: '8px 10px' }}>
      <label className="label-mono col" style={{ ...fieldLabelStyle, gap: 0 }}>
        {label}
        {children}
      </label>
    </div>
  )
}

function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <div className="row" style={{ alignItems: 'center', gap: 8, margin: '14px 2px 8px' }}>
      <span className="label-mono" style={{ fontSize: 9, letterSpacing: '0.14em', color: 'var(--text-tertiary)' }}>{children}</span>
      <span style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
    </div>
  )
}

export function LogDoseSheet({ onClose }: { onClose: () => void }) {
  const { medication: med, doses } = useMedication()
  const { logDose } = useMedicationActions()

  // Prefill the dose from the last logged dose; fall back to the medication's
  // default dose so a first-ever injection still has a sensible value.
  const lastDose = doses[0]?.dose ?? med.defaultDose
  const [date, setDate] = useState(() => localDateString())
  const [time, setTime] = useState('') // optional — empty => date-only (cycle anchored on the date part)
  const [dose, setDose] = useState(String(lastDose))
  const [note, setNote] = useState('')

  const doseNum = Number(dose)
  const canSave = dose.trim() !== '' && Number.isFinite(doseNum) && doseNum > 0

  function submit(close: () => void) {
    if (!canSave) return
    // administeredAt: ISO datetime when a time is given, else the date at midnight.
    // The cycle derives retaDay from the date part only, so a today-dated dose → day 1.
    const administeredAt = time ? `${date}T${time}:00` : `${date}T00:00:00`
    const input: MedicationDoseInput = {
      administeredAt,
      dose: doseNum,
      note: note.trim() || null,
    }
    logDose(input)
    close()
    onClose()
  }

  return (
    <Sheet onClose={onClose} labelledBy="log-dose-title">
      {(close) => (
        <>
          {/* Header */}
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div className="col">
              <Eyebrow brand>Beadás · {med.name || 'Gyógyszer'}</Eyebrow>
              <div id="log-dose-title" style={{ marginTop: 4 }}>
                <Display size="md">Új beadás</Display>
              </div>
            </div>
            <button className="chip notch-8" aria-label="Bezárás" onClick={close} style={{ padding: '6px 8px' }}>
              <Icon name="x" size={12} />
            </button>
          </div>

          {/* Mikor — date + optional time */}
          <SectionHead>Mikor</SectionHead>
          <div style={grid2}>
            <Field label="Dátum">
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={fieldInputStyle} />
            </Field>
            <Field label="Időpont">
              <input type="time" value={time} onChange={e => setTime(e.target.value)} style={fieldInputStyle} />
            </Field>
          </div>

          {/* Dózis */}
          <SectionHead>Dózis</SectionHead>
          <div style={{ marginBottom: 8 }}>
            <Field label="Dózis">
              <div className="row gap-xs" style={{ marginTop: 3, alignItems: 'center' }}>
                <input
                  inputMode="decimal"
                  value={dose}
                  onChange={e => setDose(e.target.value)}
                  placeholder={String(med.defaultDose)}
                  style={{ fontSize: 14, color: 'var(--text-primary)', width: '60%' }}
                />
                <span className="label-mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{med.doseUnit || 'mg'}</span>
              </div>
            </Field>
          </div>

          {/* Jegyzet */}
          <SectionHead>Jegyzet</SectionHead>
          <div style={{ marginBottom: 8 }}>
            <Field label="Jegyzet">
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="pl. hétfő reggel · subQ has" style={fieldInputStyle} />
            </Field>
          </div>

          {/* Actions */}
          <div className="row gap-sm" style={{ marginTop: 14 }}>
            <button className="cta-ghost notch-4 flex-1" onClick={close}>
              Mégse
            </button>
            <button className="cta-primary notch-4 flex-1" disabled={!canSave} onClick={() => submit(close)}>
              <Icon name="check" size={14} /> Beadás
            </button>
          </div>

          <div style={{ height: 24 }} />
        </>
      )}
    </Sheet>
  )
}
