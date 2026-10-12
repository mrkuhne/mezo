// ============================================================
// Mezo · FuelMedicationPage (Kiegészítők → Gyógyszer) — Folyadék F5 (mezo-n4wf5.5).
// Prototype: docs/design_2.0/prototypes/vilagos/fuel.js `gyogyszer()` (states: gyogyszer · .aktiv · .ujonnan · .leallitas).
//
// No tracked medication: the empty cycle as the invitation + „Gyógyszer felvétele". With one: the hero (the dose, the
// route and how often, the cycle as capsules — the three heights are the three PHASES, not a measured level — a verdict
// on the phase and the last dose, „+ Beadás" on the liquid) → „Beadások": the dose log (newest first, the user's note
// as written), Szerkesztés and the two-step Leállítás.
// A medication without a dose yet says so („Még nincs beadás…") instead of a day number.
//
// Stopping is NEVER error-toned — a decision, not a mistake; it soft-archives (the dose history stays server-side).
// Behaviour (useMedication, useMedicationActions, the `!med.id` gate, the sheets) is the untouched data layer.
// ============================================================
import { useState } from 'react'
import { useMedication, useMedicationActions } from '@/data/hooks'
import { fmtDate, fmtNum } from '@/shared/lib/format'
import { useM } from '@/shared/i18n'
import { Acts, Btn, Card, Hero, Lk, Note, Row, Section, Txt } from '@/shared/ui/folyadek'
import { StackPageScaffold } from '@/features/fuel/components/StackPageScaffold'
import { MedicationCycleBar, cycleCells, usePhaseWord } from '@/features/fuel/components/MedicationCycleBar'
import { LogDoseSheet } from '@/features/fuel/sheets/LogDoseSheet'
import { DEFAULT_CYCLE, MedicationFormSheet } from '@/features/fuel/sheets/MedicationFormSheet'

/** Whole days between the last dose's date and today (date part only); null without a dose. */
function daysSince(lastDoseAt: string | null | undefined): number | null {
  if (!lastDoseAt) return null
  const d = (iso: string) => Date.UTC(...(iso.slice(0, 10).split('-').map(Number) as [number, number, number]))
  const today = new Date()
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((todayUtc - d(lastDoseAt)) / 86_400_000)
}

export function FuelMedicationPage() {
  const M = useM().fuelKieg
  const phaseWord = usePhaseWord()
  const { medication: med, cycle, doses } = useMedication()
  const { stopMedication } = useMedicationActions()
  const [logOpen, setLogOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [confirmStop, setConfirmStop] = useState(false)

  // Honest empty state (mezo-lwmq): no active medication — the empty cycle invites, nothing is headlined.
  if (!med.id) {
    return (
      <StackPageScaffold backTo="/fuel/stack" name={M.med.title} eyebrow={M.med.eyebrowEmpty}>
        <Hero className="fk-ghero" data-testid="medication-empty" label={M.med.emptyLabel} verdict={M.med.emptyVerdict}
          sub={M.med.emptySub}
          actions={<Btn onClick={() => setFormOpen(true)}>{M.med.add}</Btn>}>
          <div className="fk-g" aria-hidden="true"><MedicationCycleBar week={cycleCells(DEFAULT_CYCLE)} off dim /></div>
          <Note>{M.common.note}</Note>
        </Hero>
        {formOpen && <MedicationFormSheet onClose={() => setFormOpen(false)} />}
      </StackPageScaffold>
    )
  }

  const routes = M.med.route as Record<string, string>
  const cadences = M.med.cadence as Record<string, string>
  // No dose yet (the honest-zero cycle of a new medication): the cycle has not started.
  const fresh = cycle.cycleDay <= 0 || cycle.week.length === 0
  const phase = phaseWord(cycle.phaseKey, cycle.phaseLabel.split('·')[0].trim())
  const ago = daysSince(cycle.lastDoseAt)
  const verdict = fresh ? M.med.verdictFresh
    : ago == null ? M.med.verdictPhase(phase)
      : ago <= 0 ? M.med.verdictToday(phase)
        : ago === 1 ? M.med.verdictYesterday(phase) : M.med.verdictDays(phase, ago)
  const length = fresh ? med.cycle.cycleLengthDays : cycle.week.length
  const phaseDays = med.cycle.phases
    .map(p => M.med.phaseDays(p.toDay - p.fromDay + 1, phaseWord(p.key, p.label))).join(' · ')

  return (
    <StackPageScaffold backTo="/fuel/stack" name={med.name} eyebrow={M.med.eyebrow}>
      <Hero className="fk-ghero" label={fresh ? M.med.notStarted : M.med.cycleLabel(cycle.cycleDay, length)}
        verdict={<span data-testid="medication-phase-note">{verdict}</span>}
        sub={M.med.heroSub(phaseDays)}
        actions={<Btn onClick={() => setLogOpen(true)}>{M.med.addDose}</Btn>}>
        <div className="fk-g">
          <div className="fk-sc">
            <span className="fo-big">{fmtNum(med.defaultDose, 2)}<small>{med.doseUnit}</small></span>
            <span className="fk-rc">{routes[med.route] ?? med.route}<br />{cadences[med.cadence] ?? med.cadence}</span>
          </div>
          {fresh
            ? <MedicationCycleBar week={cycleCells(med.cycle)} off dim />
            : <MedicationCycleBar week={cycle.week} />}
        </div>
      </Hero>

      {/* Beadások — the dose log, newest first (the hook returns recentDoses newest-first), with the note as written. */}
      <Section n={1} title={doses.length > 0 ? M.med.dosesCount(doses.length) : M.med.doses} />
      <Card>
        {doses.length === 0 ? <Txt>{M.med.noDoses}</Txt> : (
          <div role="list" aria-label={M.med.doses} className="fk-list">
            {doses.map(dose => (
              <div role="listitem" key={dose.id}>
                <Row icon="t-syringe" title={fmtDate(dose.administeredAt.slice(0, 10), 'frame')}
                  sub={dose.note ? M.med.quote(dose.note) : undefined}
                  value={<>{fmtNum(dose.dose, 2)}<small>{med.doseUnit}</small></>} />
              </div>
            ))}
          </div>
        )}

        {/* Szerkesztés + the two-step Leállítás. Stopping soft-archives (PUT active:false). */}
        {confirmStop ? (
          <div data-testid="medication-stop-confirm" className="fk-stop" role="group" aria-label={M.med.stopAria}>
            <p>{M.med.stopText(med.name)}</p>
            <Acts>
              <Btn sm ghost onClick={() => { stopMedication(med); setConfirmStop(false) }}>{M.med.stopYes}</Btn>
              <Lk onClick={() => setConfirmStop(false)}>{M.common.cancel}</Lk>
            </Acts>
          </div>
        ) : (
          <Acts>
            <Btn sm ghost onClick={() => setFormOpen(true)}>{M.med.edit}</Btn>
            <Lk onClick={() => setConfirmStop(true)}>{M.med.stop}</Lk>
          </Acts>
        )}
        <Note>{M.common.note}</Note>
      </Card>

      {logOpen && <LogDoseSheet onClose={() => setLogOpen(false)} />}
      {formOpen && <MedicationFormSheet medication={med} onClose={() => setFormOpen(false)} />}
    </StackPageScaffold>
  )
}
