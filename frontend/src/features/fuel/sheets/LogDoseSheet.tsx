// ============================================================
// Mezo · LogDoseSheet (the dose-capture sheet — mezo-d94; Folyadék F5, mezo-n4wf5.5) — prototype sheet `dose`.
// „+ Beadás" on FuelMedicationPage opens this. You log only the ACTUAL dose; the cycle day + phase are DERIVED from the
// newest dose (a dose dated today re-anchors the cycle to day 1). Fields: Dátum (default today) · Időpont (optional —
// empty anchors the cycle on the date) · Dózis (prefilled from the last dose) · Jegyzet (optional, can be dictated) →
// builds a MedicationDoseInput, calls useMedicationActions().logDose, then closes.
// ============================================================
import { useId, useState } from 'react'
import { useMedication, useMedicationActions } from '@/data/hooks'
import { localDateString, offsetIso } from '@/shared/lib/dates'
import type { MedicationDoseInput } from '@/data/types'
import { useM } from '@/shared/i18n'
import { Sheet } from '@/shared/ui/Sheet'
import { FoSheetHead, Input, Lab, SheetActs } from '@/shared/ui/folyadek'
import { VoiceField } from '@/shared/ui/voice/VoiceField'
import { appendDictation } from '@/shared/lib/voice/useVoiceInput'

export function LogDoseSheet({ onClose }: { onClose: () => void }) {
  const M = useM().fuelKieg
  const id = useId()
  const { medication: med, doses } = useMedication()
  const { logDose } = useMedicationActions()

  // Prefill the dose from the last logged dose; fall back to the medication's
  // default dose so a first-ever dose still has a sensible value.
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
    <Sheet onClose={onClose} labelledBy="log-dose-title" className="fo-sheet fk-sheet">
      {(close) => (
        <>
          <FoSheetHead icon="t-syringe" title={M.doseSheet.title} titleId="log-dose-title"
            sub={M.doseSheet.sub(med.name || M.med.title)} />

          <div className="fk-two">
            <div>
              <Lab htmlFor={`${id}-date`}>{M.doseSheet.date}</Lab>
              <Input id={`${id}-date`} type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div>
              <Lab htmlFor={`${id}-time`}>{M.doseSheet.time}</Lab>
              <Input id={`${id}-time`} type="time" value={time} onChange={e => setTime(e.target.value)} />
            </div>
          </div>

          <Lab htmlFor={`${id}-dose`}>{M.doseSheet.dose}</Lab>
          <div className="fk-unit">
            <Input id={`${id}-dose`} inputMode="decimal" value={dose} onChange={e => setDose(e.target.value)}
              placeholder={String(med.defaultDose)} />
            <span>{med.doseUnit || 'mg'}</span>
          </div>

          <Lab htmlFor={`${id}-note`}>{M.doseSheet.note}</Lab>
          <VoiceField domain="fuel" size="sm" onTranscript={t => setNote(d => appendDictation(d, t))}>
            <Input id={`${id}-note`} value={note} onChange={e => setNote(e.target.value)} placeholder={M.doseSheet.notePlaceholder} />
          </VoiceField>

          <SheetActs label={M.doseSheet.save} onSave={() => submit(close)} onCancel={close} cancelLabel={M.common.cancel} disabled={!canSave} />
        </>
      )}
    </Sheet>
  )
}
