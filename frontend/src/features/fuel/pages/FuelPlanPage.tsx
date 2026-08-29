// ============================================================
// Mezo · Fuel · Plan view (Terv) — Mozaik re-face (mezo-d20.4.7)
// Source of truth: docs/design_2.0/prototypes/src/fuel-body.html #page-terv (p-sage, ×1.18).
// Anatomy: MozaikPage(sage) → PageHead(‹ Fuel) → PageHero(i-rend, "Terv", no bignum — every
// number here already lives in the stat strip below; a hero echo would repeat a shown fact,
// handoff §3) → weekly stat strip (kcal-átlag/protein-nap/stack/gym+sport) → weeklyNote card →
// WeekRhythmGrid (its own "Heti ritmus" qcard incl. the week-label corner) → medication-cycle
// qcard (hidden while empty) → Visszatérő minták / Heti supplement-térkép (hidden while empty,
// real mode always []).
//
// Fix vs the Phase-1 version (audit gap #16): WeekRhythmGrid's kitchen-close + caffeine-cutoff
// markers used to be hardcoded ('21:00'/'21:30'/'14:00'). They are now derived here from
// useFuelSettings().caffeineCutoff and the sleep goal's bedTime (bedTime − KITCHEN_CLOSE_
// OFFSET_MIN, the same constant the real Mai plan already applies) — any user with a
// non-default cutoff or bedtime now sees a correct Terv page.
//
// Other adaptations vs the prototype/Phase-1:
//  - Gym times are READ-ONLY here (mezo-4t43): the schedule is set in the mesocycle planner
//    (Step 2) and the Gym-page "Időpontok" chip — Fuel only renders Train's derived week and
//    feeds the Mai timeline. There is no in-page gym-time editor.
//  - The medication-cycle card's phase paragraph is the prototype's own generic copy line — the
//    Phase-1 hardcoded literal (a specific "kcal floor 2500" claim, audit gap #17) is dropped as
//    an unrelated fabrication, not a behavioral contract.
//  - Weekly stats/title/note come from the dual-mode useFuelWeek(); sections with no real
//    source render honest-empty in real mode (hidden when [], `—` when null).
// ============================================================
import { useNavigate } from 'react-router-dom'
import { useFuelWeek, useTodayScenario, useFuelSettings, useSleepGoal } from '@/data/hooks'
import { toHHmm, toMin, KITCHEN_CLOSE_OFFSET_MIN } from '@/data/fuel/fuelConfig'
import { Icon } from '@/shared/ui/Icon'
import { MozaikPage, PageHead, PageHero, PageBody, StatStrip, StatCell } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import { MedicationWeekStrip } from '@/features/fuel/components/MedicationWeekStrip'
import { WeekRhythmGrid } from '@/features/fuel/components/WeekRhythmGrid'
import { PatternRow } from '@/features/fuel/components/PatternRow'
import { WeeklySupplementGrid } from '@/features/fuel/components/WeeklySupplementGrid'

export function FuelPlanPage() {
  const navigate = useNavigate()
  const { title, medCycleWeek, gymSchedule, weeklySupplements, patterns, weeklyStats, volleyball, weeklyNote } = useFuelWeek()
  const { medCycleDay } = useTodayScenario()
  const { settings } = useFuelSettings()
  const { goal } = useSleepGoal()

  // Weekly aggregates
  const activeGymDays = gymSchedule.filter((d) => d.active).length
  const vbCount = volleyball.length
  const weeklyKcalAvg = Math.round(weeklyStats.kcalTarget * weeklyStats.kcalAvgFactor)
  // Settings-derived rhythm markers (audit gap #16 fix) — same offset the real Mai plan applies.
  const kitchenClose = toHHmm(toMin(goal.bedTime) - KITCHEN_CLOSE_OFFSET_MIN)

  return (
    <MozaikPage tone="sage">
      <PageHead onBack={() => navigate(-1)} label="‹ Fuel" />

      <EntranceGroup>
        <PageHero icon="i-rend" name="Terv" />

        <PageBody>
          {/* Weekly stat strip — every number the page shows lives here exactly once.
              It rises with the prototype's own 30 ms lead-in (fidelity audit, mezo-d20.11:
              the strip was the one block on this page with no entrance). */}
          <StatStrip className="rise">
            <StatCell
              value={weeklyKcalAvg > 0 ? weeklyKcalAvg.toLocaleString() : '—'}
              label={`kcal-átlag / ${weeklyStats.kcalTarget}`}
            />
            <StatCell value={`${weeklyStats.proteinHitDays}/7`} label="protein-nap" />
            <StatCell
              value={weeklyStats.supplementsAdherence == null ? '—' : `${weeklyStats.supplementsAdherence}%`}
              label="stack"
            />
            <StatCell value={`${activeGymDays}+${vbCount}`} label="gym + sport" />
          </StatStrip>

          {weeklyNote && (
            <div className="mz-qcard rise" style={{ '--d': '40ms', marginTop: 12 } as React.CSSProperties}>
              <div className="row gap-md" style={{ alignItems: 'flex-start' }}>
                <Icon name="sparkle" size={12} color="var(--mz-cell-sage-ink)" />
                <span style={{ fontSize: 11.5, color: 'var(--mz-ink-soft)', lineHeight: 1.5, flex: 1 }}>
                  <SafeMarkdown text={weeklyNote} />
                </span>
              </div>
            </div>
          )}

          {/* 7-day rhythm grid (includes its own header + week-label corner + legend) */}
          <div className="rise" style={{ '--d': '80ms', marginTop: 12 } as React.CSSProperties}>
            <WeekRhythmGrid
              gymSchedule={gymSchedule}
              volleyball={volleyball}
              caffeineCutoff={settings.caffeineCutoff}
              kitchenClose={kitchenClose}
              title={title}
            />
          </div>

          {/* Medication cycle strip — hidden until a medication cycle exists (real-mode honest ghost) */}
          {medCycleWeek.length > 0 && (
            <div className="mz-qcard rise" style={{ '--d': '120ms' } as React.CSSProperties}>
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
                <span className="mz-eyebrow">Gyógyszer-ciklus · 7 nap</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--mz-ink-mut)' }}>D{medCycleDay} · ma</span>
              </div>
              <MedicationWeekStrip currentDay={medCycleDay} />
              <p style={{ fontSize: 11, color: 'var(--mz-ink-soft)', lineHeight: 1.5, marginTop: 10, paddingTop: 10, borderTop: '0.5px solid rgba(43, 33, 24, 0.08)' }}>
                Csúcs → stabil → leszálló — a fázis a Mai ablak-étvágyat is jelzi.
              </p>
            </div>
          )}

          {/* Recurring patterns — pattern-engine output is P8; hidden while empty (real mode) */}
          {patterns.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <span className="mz-eyebrow" style={{ marginBottom: 10, display: 'block' }}>
                Visszatérő minták · Mezo
              </span>
              <div className="col gap-sm">
                {patterns.map((p, i) => (
                  <PatternRow key={i} {...p} />
                ))}
              </div>
            </div>
          )}

          {/* Weekly supplement plan — protocol-derived map is deferred; hidden while empty (real mode) */}
          {weeklySupplements.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
                <span className="mz-eyebrow">Heti supplement-térkép</span>
                <span style={{ fontSize: 9, color: 'var(--mz-ink-mut)' }}>{weeklySupplements.length} item</span>
              </div>
              <WeeklySupplementGrid rows={weeklySupplements} />
            </div>
          )}

          <p className="mz-principle">
            A Visszatérő minták és a Heti supplement-térkép szekció csak akkor jelenik meg, ha van
            adat — üresen nem foglal helyet.
          </p>
        </PageBody>
      </EntranceGroup>
    </MozaikPage>
  )
}
