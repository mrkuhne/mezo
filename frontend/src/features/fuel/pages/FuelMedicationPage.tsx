// ============================================================
// Mezo · FuelMedicationPage (Fuel — "Gyógyszer" tab)
// The owner's single active medication (Retatrutide), restyled to the agreed mockup
// (gyogyszer-a-szellos.html · "A modell — szellősebben"): a medication card
// (name · route · cadence · current dose) → the MedicationCycleBar (7-cell kinetic
// strip, current day outlined) → a phase note ("N. nap · {phase} fázis · utolsó
// beadás …") → the "Beadások" dose log (newest first) → a "＋ Beadás" button.
//
// You log only the actual injections; the cycle day + phase are DERIVED from the
// newest dose by the backend / the mock hook (useMedication, Task 11). Tapping
// "＋ Beadás" flips `logOpen` and opens the LogDoseSheet (Task 13), which captures a
// dose via useMedicationActions().logDose (a today-dated dose re-anchors retaDay to 1).
// ============================================================
import { useState } from 'react'
import { useMedication } from '@/data/hooks'
import { huMonthDayDow } from '@/shared/lib/dates'
import { Icon } from '@/shared/ui/Icon'
import { MedicationCycleBar } from '@/features/fuel/components/MedicationCycleBar'
import { LogDoseSheet } from '@/features/fuel/sheets/LogDoseSheet'

// route code → HU label (mockup: "subQ injekció"). Falls back to the raw code.
const ROUTE_LABEL: Record<string, string> = {
  subQ: 'subQ injekció',
  IM: 'IM injekció',
  oral: 'orális',
}
// cadence code → HU label (mockup: "heti · hétfő"). Falls back to the raw code.
const CADENCE_LABEL: Record<string, string> = {
  'weekly-monday': 'heti · hétfő',
  'weekly-tuesday': 'heti · kedd',
  'weekly-wednesday': 'heti · szerda',
  'weekly-thursday': 'heti · csütörtök',
  'weekly-friday': 'heti · péntek',
  'weekly-saturday': 'heti · szombat',
  'weekly-sunday': 'heti · vasárnap',
  daily: 'napi',
}

// "utolsó beadás N napja" — days between the last dose date and today (date part only).
function lastDoseAgo(lastDoseAt: string | null | undefined): string | null {
  if (!lastDoseAt) return null
  const d = (iso: string) => Date.UTC(...(iso.slice(0, 10).split('-').map(Number) as [number, number, number]))
  const today = new Date()
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  const days = Math.round((todayUtc - d(lastDoseAt)) / 86_400_000)
  if (days <= 0) return 'utolsó beadás ma'
  if (days === 1) return 'utolsó beadás tegnap'
  return `utolsó beadás ${days} napja`
}

export function FuelMedicationPage() {
  const { medication: med, cycle, doses } = useMedication()
  const [logOpen, setLogOpen] = useState(false)

  const routeLabel = ROUTE_LABEL[med.route] ?? med.route
  const cadenceLabel = CADENCE_LABEL[med.cadence] ?? med.cadence
  // the phase note's phase name is the leading word of the derived phaseLabel ("Stabil · plató" → "Stabil")
  const phaseName = cycle.phaseLabel.split('·')[0].trim()
  const ago = lastDoseAgo(cycle.lastDoseAt)

  return (
    <>
      <div className="pghead-np sage">
        <div>
          <div className="over">Fuel · Gyógyszer</div>
          <h1>Reta</h1>
        </div>
        <button
          type="button"
          onClick={() => setLogOpen(true)}
          className="pgact-np np-press"
          style={{ background: 'var(--wash-sage)', color: 'var(--sage-deep)' }}
        >
          <Icon name="plus" size={12} /> Beadás
        </button>
      </div>

      {/* Medication card — name · current dose, route · cadence, the cycle strip, the phase note. */}
      <div style={{ padding: '0 24px 8px' }}>
        <div
          className="card"
          style={{ padding: '18px 18px 16px', borderLeft: '2px solid var(--error)' }}
        >
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--ff-display)', fontSize: 19, fontWeight: 600, color: 'var(--text-primary)' }}>
              {med.name}
            </span>
            <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 19, fontWeight: 600, color: 'var(--error)' }}>
              {med.defaultDose} {med.doseUnit}
            </span>
          </div>
          <div className="text-secondary" style={{ fontSize: 11, marginTop: 7 }}>
            {routeLabel} · {cadenceLabel}
          </div>

          <MedicationCycleBar week={cycle.week} />

          <div
            data-testid="medication-phase-note"
            style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 12, textAlign: 'center' }}
          >
            {cycle.retaDay}. nap · <b style={{ color: 'var(--sage-deep)' }}>{phaseName} fázis</b>
            {ago && <> · {ago}</>}
          </div>
        </div>
      </div>

      {/* Beadások — the dose log, newest first (the hook already returns recentDoses newest-first). */}
      <div style={{ padding: '0 24px 32px' }}>
        <div className="row" style={{ alignItems: 'center', gap: 9, margin: '22px 2px 12px' }}>
          <span className="eyebrow">Beadások</span>
          <span style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, var(--border-subtle), transparent)' }} />
        </div>

        {doses.length === 0 ? (
          <div className="card" style={{ padding: 20, textAlign: 'center' }}>
            <span className="text-tertiary" style={{ fontSize: 12 }}>Még nincs rögzített beadás.</span>
          </div>
        ) : (
          <ul role="list" aria-label="Beadások" className="col gap-sm" style={{ padding: 0, listStyle: 'none' }}>
            {doses.map(dose => (
              <li
                key={dose.id}
                className="card row"
                style={{ padding: '14px 16px', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                  {huMonthDayDow(dose.administeredAt.slice(0, 10))}
                </span>
                <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 15, fontWeight: 600, color: 'var(--error)' }}>
                  {dose.dose} {med.doseUnit}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* LogDoseSheet — the dose-capture sheet (Task 13). "＋ Beadás" flips logOpen. */}
      {logOpen && <LogDoseSheet onClose={() => setLogOpen(false)} />}
    </>
  )
}
