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
//
// ÜVEG (mezo-me75u.2; prototypes/uveg-fuel-tobbi.html `gyogyszer()`): sky accent. The empty
// state is a dashed free space (bible §3 rank 4) with the big 3D syringe and a sky glass CTA; the
// filled page has a frameless sky/lavender halo hero (big 3D syringe, D{cycleDay} numeral), the
// medication as ONE sky glass card (the cycle strip inside it is flat cells, the current day lit),
// the dose log as flat rows, Szerkesztés flat and Leállítás warm-tinted. Behavior unchanged.
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMedication, useMedicationActions } from '@/data/hooks'
import { huMonthDayDow } from '@/shared/lib/dates'
import { Icon } from '@/shared/ui/Icon'
import { MozaikPage, PageHead, PageBody } from '@/shared/ui/mozaik'
import { Icon3D } from '@/shared/ui/clay'
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
      <MozaikPage tone="lav" className="fmd-page">
        <PageHead onBack={() => navigate(-1)} label="‹ Fuel" />
        <PageBody>
          {/* The empty branch is choreographed too — it was the ONLY branch the mock day ever
              reaches, which is why /fuel/gyogyszer measured as "no entrance choreography". */}
          <EntranceGroup>
          <div data-testid="medication-empty" className="fmd-empty uv-empty rise">
            <span className="fmd-empty-art" aria-hidden="true"><Icon3D name="t-syringe" size={70} /></span>
            <strong>Nincs követett gyógyszer</strong>
            <span className="fmd-empty-lead">
              Ha szedsz valamit ciklusban — ide kerül a fázis-térkép és a beadás-napló.
            </span>
            <button
              type="button"
              className="fmd-btn glass is-primary"
              onClick={() => setFormOpen(true)}
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
    <MozaikPage tone="lav" className="fmd-page">
      <PageHead onBack={() => navigate(-1)} label="‹ Fuel">
        <button type="button" onClick={() => setLogOpen(true)} className="pgact fmd-act">
          <Icon name="plus" size={12} /> Beadás
        </button>
      </PageHead>

      <EntranceGroup>
        {/* D{cycleDay} — distinct from the phase note's "{cycleDay}. nap" prose below (same
            fact, different register: D-prefixed vs ordinal-day sentence — the prototype's own
            hero/phase-note duality, not a literal repeated string). */}
        <div className="fmd-hero uv-halo">
          <span className="fmd-hero-art" aria-hidden="true"><Icon3D name="t-syringe" size={84} /></span>
          <strong className="fmd-hero-num">{`D${cycle.cycleDay}`}</strong>
          <span className="fmd-hero-eb">Gyógyszer</span>
        </div>

        <PageBody>
          <div className="fmd-medcard glass rise" style={{ '--d': '0ms', '--i': 1 } as React.CSSProperties}>
            <div className="fmd-medcard-head">
              <strong>{med.name}</strong>
              <b>{med.defaultDose} {med.doseUnit}</b>
            </div>
            <div className="fmd-medcard-sub">
              {routeLabel} · {cadenceLabel}
            </div>

            <span className="fmd-eyebrow">Kinetikus ciklus</span>
            <MedicationCycleBar week={cycle.week} />

            <div data-testid="medication-phase-note" className="fmd-phase">
              {cycle.cycleDay}. nap · <b>{phaseName} fázis</b>
              {ago && <> · {ago}</>}
            </div>
          </div>

          {/* Beadások — the dose log, newest first (the hook already returns recentDoses newest-first),
              now surfacing dose.note (audit gap #10: captured by LogDoseSheet, never shown before). */}
          <div className="fmd-sec rise" style={{ '--d': '70ms' } as React.CSSProperties}>
            <span className="fmd-eyebrow">Beadások</span>
            {doses.length > 0 && <b>{doses.length}</b>}
          </div>

          {doses.length === 0 ? (
            <div className="fmd-nodose uv-empty rise" style={{ '--d': '100ms' } as React.CSSProperties}>
              Még nincs rögzített beadás.
            </div>
          ) : (
            <ul role="list" aria-label="Beadások" className="fmd-doselist rise" style={{ '--d': '100ms' } as React.CSSProperties}>
              {doses.map((dose) => (
                <li key={dose.id} className="fmd-doserow uv-flat">
                  <span className="fmd-dose-art" aria-hidden="true"><Icon3D name="t-syringe" size={28} /></span>
                  <span className="fmd-dose-copy">
                    <strong>{huMonthDayDow(dose.administeredAt.slice(0, 10))}</strong>
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
          <div className="fmd-pair rise" style={{ '--d': '160ms' } as React.CSSProperties}>
            <button type="button" className="fmd-btn uv-flat" onClick={() => setFormOpen(true)}>
              Szerkesztés
            </button>
            <button type="button" className="fmd-btn is-warn" onClick={() => setConfirmStop(true)}>
              Leállítás
            </button>
          </div>
          {confirmStop && (
            <div data-testid="medication-stop-confirm" className="fmd-stop uv-empty">
              A {med.name} leáll — a beadás-történet megmarad, a Fuel-oldalak nem számolnak vele tovább.
              <div className="fmd-pair">
                <button type="button" className="fmd-btn uv-flat" onClick={() => setConfirmStop(false)}>
                  Mégse
                </button>
                <button
                  type="button"
                  className="fmd-btn is-warn"
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
