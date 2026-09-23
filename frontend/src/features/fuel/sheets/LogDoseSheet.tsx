// ============================================================
// Mezo · LogDoseSheet (the dose-capture sheet — mezo-d94)
// Tapping "＋ Beadás" in FuelMedicationPage opens this. You log only the ACTUAL
// injection; the cycle day + phase are DERIVED from the newest dose (the mock
// hook / backend recompute cycleDay = days-since-newest + 1, so a dose dated today
// re-anchors the cycle to day 1). Mirrors the AddPantryItemSheet shell (shared
// <Sheet> portal + chamfer Field cards). Fields: Dátum (default today) · Időpont
// (optional) · Dózis (prefilled from the last dose) · Jegyzet (optional) → on save
// builds a MedicationDoseInput and calls useMedicationActions().logDose, then closes.
//
// ÜVEG (mezo-me75u.2; prototypes/uveg-fuel-tobbi.html `SH.dose`): the sheet is ONE sky glass
// surface (`fsx-sheet`), the fields are eyebrow-labelled flat wells, Mégse is flat and the
// save a lit sky button (lit flat, never glass in glass). Behavior unchanged.
// ============================================================
import { useState } from 'react'
import { useMedication, useMedicationActions } from '@/data/hooks'
import { localDateString, offsetIso } from '@/shared/lib/dates'
import type { MedicationDoseInput } from '@/data/types'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { Icon3D } from '@/shared/ui/clay'

// A single form field: an eyebrow caption over a flat well. The <label> wraps the control so
// getByLabelText resolves it.
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="fsx-sh-field">
      <span className="uv-eyebrow">{label}</span>
      {children}
    </label>
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
    // administeredAt: an OFFSET-BEARING ISO-8601 datetime (Jackson's OffsetDateTime
    // deserializer rejects a zone-less string with a 400). We append the LOCAL UTC
    // offset rather than calling .toISOString() so the instant's .toLocalDate() (which
    // the backend uses as the day key, MedicationService.logDose) stays the CHOSEN date —
    // a naive new Date(`${date}T00:00`).toISOString() shifts local-midnight to UTC and can
    // roll the date back a day in a +offset timezone, corrupting the cycle's day math.
    const administeredAt = offsetIso(date, time || '00:00')
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
    <Sheet onClose={onClose} labelledBy="log-dose-title" className="glass is-still fsx-sheet is-sky">
      {(close) => (
        <>
          {/* Header */}
          <div className="fsx-shh">
            <span className="fsx-shh-art" aria-hidden="true"><Icon3D name="t-syringe" size={48} /></span>
            <div className="fsx-shh-copy">
              <span className="uv-eyebrow">Beadás · {med.name || 'Gyógyszer'}</span>
              <div id="log-dose-title" className="fsx-shh-title"><strong>Új beadás</strong></div>
            </div>
            <button type="button" className="fsx-shh-x" aria-label="Bezárás" onClick={close}>
              <Icon name="x" size={12} />
            </button>
          </div>

          {/* Mikor — date + optional time */}
          <div className="fsx-sh-two">
            <Field label="Dátum">
              <input className="fsx-sh-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
            </Field>
            <Field label="Időpont">
              <input className="fsx-sh-input" type="time" value={time} onChange={e => setTime(e.target.value)} />
            </Field>
          </div>

          {/* Dózis */}
          <Field label="Dózis">
            <span className="fsx-sh-unitrow">
              <input
                className="fsx-sh-input"
                inputMode="decimal"
                value={dose}
                onChange={e => setDose(e.target.value)}
                placeholder={String(med.defaultDose)}
              />
              <span className="fsx-sh-unit">{med.doseUnit || 'mg'}</span>
            </span>
          </Field>

          {/* Jegyzet */}
          <Field label="Jegyzet">
            <input className="fsx-sh-input" value={note} onChange={e => setNote(e.target.value)} placeholder="pl. hétfő reggel · subQ has" />
          </Field>

          {/* Actions */}
          <div className="fsx-sh-pair">
            <button type="button" className="fsx-sh-btn uv-flat" onClick={close}>
              Mégse
            </button>
            <button type="button" className="fsx-sh-btn is-lit" disabled={!canSave} onClick={() => submit(close)}>
              <Icon name="check" size={14} /> Beadás
            </button>
          </div>

          <div style={{ height: 24 }} />
        </>
      )}
    </Sheet>
  )
}
