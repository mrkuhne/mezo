// ============================================================
// Mezo · FuelMedicationPage (Fuel — "Gyógyszer" tab) — Mozaik re-face (mezo-d20.4.7)
// Source of truth: docs/design_2.0/prototypes/src/fuel-body.html #page-gyogyszer (p-lav, ×1.18).
// Anatomy: MozaikPage(lav) → PageHead(‹ Fuel, + Beadás) → PageHero(i-injekcio, D{cycleDay},
// "Gyógyszer", no subtitle) → medcard (name · current dose, route · cadence, MedicationCycleBar,
// phase note) → "Beadások" dose log (newest first, now surfacing dose.note — audit gap #10) →
// LogDoseSheet. The honest empty state (no active medication, no add-path in the UI) keeps its
// own minimal scaffold — no hero, nothing to headline.
//
// Deliberate deviation from the raw hex `--error` red the Phase-1 card used: the whole card is
// now lavender (prototype's own medcard tint) and the cycle bar's peak rides `--mz-no-ink`
// (terracotta) via MedicationCycleBar — the "never red" guardrail (handoff §2).
//
// Behavior (useMedication, useMedicationActions, the `!med.id` honesty gate, LogDoseSheet) is
// the untouched data layer — only the chrome changed.
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMedication, useMedicationActions } from '@/data/hooks'
import { huMonthDayDow } from '@/shared/lib/dates'
import { Icon } from '@/shared/ui/Icon'
import { MozaikPage, PageHead, PageHero, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { MedicationCycleBar } from '@/features/fuel/components/MedicationCycleBar'
import { LogDoseSheet } from '@/features/fuel/sheets/LogDoseSheet'
import { MedicationFormSheet } from '@/features/fuel/sheets/MedicationFormSheet'

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
  const navigate = useNavigate()
  const { medication: med, cycle, doses } = useMedication()
  const { stopMedication } = useMedicationActions()
  const [logOpen, setLogOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [confirmStop, setConfirmStop] = useState(false)

  // Honest empty state (mezo-lwmq): there is no active medication and no way to add one from
  // the UI — the slice keeps its generic machinery, but the owner tracks no medication. No hero
  // here — there is no headline number to show for "nothing tracked".
  if (!med.id) {
    return (
      <MozaikPage tone="lav">
        <PageHead onBack={() => navigate(-1)} label="‹ Fuel" />
        <PageBody>
          {/* The empty branch is choreographed too — it was the ONLY branch the mock day ever
              reaches, which is why /fuel/gyogyszer measured as "no entrance choreography". */}
          <EntranceGroup>
          <div data-testid="medication-empty" className="mz-qcard rise" style={{ textAlign: 'center', padding: 24 }}>
            <span style={{ fontFamily: 'var(--ff-display)', fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}>
              Nincs követett gyógyszer
            </span>
            <span className="text-tertiary" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
              Ha szedsz valamit ciklusban — ide kerül a fázis-térkép és a beadás-napló.
            </span>
            <button
              type="button"
              className="cta-primary"
              onClick={() => setFormOpen(true)}
              style={{ marginTop: 14 }}
            >
              <Icon name="plus" size={12} /> Gyógyszer felvétele
            </button>
          </div>
          </EntranceGroup>
        </PageBody>
        {formOpen && <MedicationFormSheet onClose={() => setFormOpen(false)} />}
      </MozaikPage>
    )
  }

  const routeLabel = ROUTE_LABEL[med.route] ?? med.route
  const cadenceLabel = CADENCE_LABEL[med.cadence] ?? med.cadence
  // the phase note's phase name is the leading word of the derived phaseLabel ("Stabil · plató" → "Stabil")
  const phaseName = cycle.phaseLabel.split('·')[0].trim()
  const ago = lastDoseAgo(cycle.lastDoseAt)

  return (
    <MozaikPage tone="lav">
      <PageHead onBack={() => navigate(-1)} label="‹ Fuel">
        <button type="button" onClick={() => setLogOpen(true)} className="pgact" style={{ marginLeft: 'auto' }}>
          <Icon name="plus" size={12} /> Beadás
        </button>
      </PageHead>

      <EntranceGroup>
        {/* D{cycleDay} — distinct from the phase note's "{cycleDay}. nap" prose below (same
            fact, different register: D-prefixed vs ordinal-day sentence — the prototype's own
            hero/phase-note duality, not a literal repeated string). */}
        <PageHero icon="i-injekcio" big={`D${cycle.cycleDay}`} name="Gyógyszer" />

        <PageBody>
          <div className="fmd-medcard rise" style={{ '--d': '0ms' } as React.CSSProperties}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--ff-display)', fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
                {med.name}
              </span>
              <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 17, fontWeight: 700, color: 'var(--mz-cell-lav-ink)' }}>
                {med.defaultDose} {med.doseUnit}
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--mz-ink-soft)', marginTop: 6 }}>
              {routeLabel} · {cadenceLabel}
            </div>

            <MedicationCycleBar week={cycle.week} />

            <div
              data-testid="medication-phase-note"
              style={{ fontSize: 11, color: 'var(--mz-ink-soft)', marginTop: 12, textAlign: 'center' }}
            >
              {cycle.cycleDay}. nap · <b style={{ color: 'var(--mz-cell-lav-ink)' }}>{phaseName} fázis</b>
              {ago && <> · {ago}</>}
            </div>
          </div>

          {/* Beadások — the dose log, newest first (the hook already returns recentDoses newest-first),
              now surfacing dose.note (audit gap #10: captured by LogDoseSheet, never shown before). */}
          <div className="row rise" style={{ '--d': '70ms', alignItems: 'center', margin: '18px 2px 10px' } as React.CSSProperties}>
            <span className="mz-eyebrow">Beadások</span>
          </div>

          {doses.length === 0 ? (
            <div className="mz-qcard rise" style={{ '--d': '100ms', textAlign: 'center' } as React.CSSProperties}>
              <span className="text-tertiary" style={{ fontSize: 12 }}>Még nincs rögzített beadás.</span>
            </div>
          ) : (
            <ul role="list" aria-label="Beadások" className="mz-qcard rise" style={{ '--d': '100ms', padding: '4px 14px', listStyle: 'none', margin: 0 } as React.CSSProperties}>
              {doses.map((dose) => (
                <li key={dose.id} className="fmd-doserow">
                  <span style={{ color: 'var(--text-primary)' }}>
                    {huMonthDayDow(dose.administeredAt.slice(0, 10))}
                    {dose.note && <span className="nt"> „{dose.note}"</span>}
                  </span>
                  <span className="dd">
                    {dose.dose} {med.doseUnit}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/* Szerkesztés + kétlépcsős Leállítás (fuel-mely.html). The stop is NEVER error-toned —
              a decision, not a mistake: neutral ghosts, a dashed confirm card, and the lav CTA.
              Stopping soft-archives (PUT active:false); the dose history stays server-side. */}
          <div className="row gap-sm rise" style={{ '--d': '160ms', marginTop: 14 } as React.CSSProperties}>
            <button type="button" className="cta-ghost flex-1" onClick={() => setFormOpen(true)}>
              Szerkesztés
            </button>
            <button type="button" className="cta-ghost flex-1" onClick={() => setConfirmStop(true)}>
              Leállítás
            </button>
          </div>
          {confirmStop && (
            <div
              data-testid="medication-stop-confirm"
              style={{
                border: '1px dashed var(--border-strong)', borderRadius: 13,
                padding: '10px 12px', marginTop: 8, fontSize: 12, color: 'var(--mz-ink-soft)',
              }}
            >
              A {med.name} leáll — a beadás-történet megmarad, a Fuel-oldalak nem számolnak vele tovább.
              <div className="row gap-sm" style={{ marginTop: 10 }}>
                <button type="button" className="cta-ghost flex-1" onClick={() => setConfirmStop(false)}>
                  Mégse
                </button>
                <button
                  type="button"
                  className="cta-primary flex-1"
                  onClick={() => { stopMedication(med); setConfirmStop(false) }}
                >
                  Leállítom
                </button>
              </div>
            </div>
          )}
        </PageBody>
      </EntranceGroup>

      {/* LogDoseSheet — the dose-capture sheet (Task 13). "＋ Beadás" flips logOpen. */}
      {logOpen && <LogDoseSheet onClose={() => setLogOpen(false)} />}
      {formOpen && <MedicationFormSheet medication={med} onClose={() => setFormOpen(false)} />}
    </MozaikPage>
  )
}
