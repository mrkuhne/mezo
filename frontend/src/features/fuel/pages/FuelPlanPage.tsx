// ============================================================
// Mezo · Fuel · Plan view (Terv) — WEEKLY rhythm: meals, supplements, training stack
// Port: prototype/src/fuel-plan.jsx FuelPlanPage (49–216); real-mode wiring Fuel P4 (mezo-kpo).
//
// Adaptations vs prototype:
//  - Gym times are READ-ONLY here (mezo-4t43): the schedule is set in the mesocycle planner
//    (Step 2) and the Gym-page "Időpontok" chip — Fuel only renders Train's derived week and
//    feeds the Mai timeline. The old in-page GymScheduleSheet editor + write-through are gone.
//  - WeekRhythmGrid owns its own section header ("Heti ritmus · 24h tengelyen")
//    and legend, so they are not duplicated here.
//  - Weekly stats/title/note come from the dual-mode useFuelWeek(); sections with no real
//    source render honest-empty in real mode (hidden when [], `—` when null).
// ============================================================
import { useFuelWeek, useTodayScenario } from '@/data/hooks'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { Icon } from '@/shared/ui/Icon'
import { StatCell } from '@/shared/ui/StatCell'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import { MedicationWeekStrip } from '@/features/fuel/components/MedicationWeekStrip'
import { WeekRhythmGrid } from '@/features/fuel/components/WeekRhythmGrid'
import { PatternRow } from '@/features/fuel/components/PatternRow'
import { WeeklySupplementGrid } from '@/features/fuel/components/WeeklySupplementGrid'

export function FuelPlanPage() {
  const { title, medCycleWeek, gymSchedule, weeklySupplements, patterns, weeklyStats, volleyball, weeklyNote } = useFuelWeek()
  const { medCycleDay } = useTodayScenario()

  // Weekly aggregates
  const activeGymDays = gymSchedule.filter(d => d.active).length
  const vbCount = volleyball.length
  const weeklyKcalAvg = Math.round(weeklyStats.kcalTarget * weeklyStats.kcalAvgFactor)

  return (
    <>
      {/* Header */}
      <div className="pghead-np sage">
        <div>
          <div className="over">Fuel · Heti terv</div>
          <h1>{title}</h1>
        </div>
      </div>

      {/* Weekly stats card */}
      <div style={{ padding: '0 24px 12px' }}>
        <div className="card" style={{ padding: 16 }}>
          <div className="row gap-md" style={{ justifyContent: 'space-between' }}>
            <StatCell
              label="Kcal avg"
              val={weeklyKcalAvg > 0 ? weeklyKcalAvg.toLocaleString() : '—'}
              sub={'/ ' + weeklyStats.kcalTarget}
              color="var(--sage)"
            />
            <StatCell
              label="Protein hit"
              val={weeklyStats.proteinHitDays + '/7'}
              sub="napon"
              color="var(--cat-physiology)"
            />
            <StatCell
              label="Stack"
              val={weeklyStats.supplementsAdherence == null ? '—' : weeklyStats.supplementsAdherence + '%'}
              sub="adherence"
              color="var(--cat-tendency)"
            />
            <StatCell
              label="Gym + Sport"
              val={activeGymDays + ' + ' + vbCount}
              sub="alkalom"
              color="var(--cat-preference)"
            />
          </div>

          {weeklyNote && (
            <div
              className="row gap-md mt-md"
              style={{
                paddingTop: 12,
                borderTop: '1px solid var(--border-subtle)',
                alignItems: 'center',
              }}
            >
              <Icon name="sparkle" size={12} color="var(--sage-deep)" />
              <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.5, flex: 1 }}>
                <SafeMarkdown text={weeklyNote} />
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Medication cycle strip — hidden until a medication cycle exists (real-mode honest ghost) */}
      {medCycleWeek.length > 0 && (
        <div style={{ padding: '0 24px 12px' }}>
          <div className="card" style={{ padding: 14 }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
              <Eyebrow>Gyógyszer-ciklus · 7 nap</Eyebrow>
              <span className="label-mono" style={{ fontSize: 9 }}>
                D{medCycleDay} · ma
              </span>
            </div>
            <MedicationWeekStrip currentDay={medCycleDay} />
            <p
              className="text-secondary mt-md"
              style={{
                fontSize: 11,
                lineHeight: 1.5,
                paddingTop: 10,
                borderTop: '1px solid var(--border-subtle)',
              }}
            >
              D1-D2 peak (étvágy-szuppresszió erős, kcal floor 2500), D3-D5 stabil ablak (PR-day
              candidate), D6-D7 trough (mikrobiom + folyadék reset).
            </p>
          </div>
        </div>
      )}

      {/* 7-day rhythm grid (includes its own header + legend) */}
      <WeekRhythmGrid gymSchedule={gymSchedule} volleyball={volleyball} />

      {/* Recurring patterns — pattern-engine output is P8; hidden while empty (real mode) */}
      {patterns.length > 0 && (
        <div style={{ padding: '16px 24px 12px' }}>
          <span className="eyebrow" style={{ marginBottom: 10, display: 'block' }}>
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
        <div style={{ padding: '16px 24px 24px' }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
            <Eyebrow>Heti supplement-térkép</Eyebrow>
            <span className="label-mono text-tertiary" style={{ fontSize: 9 }}>
              {weeklySupplements.length} item
            </span>
          </div>
          <WeeklySupplementGrid rows={weeklySupplements} />
        </div>
      )}
    </>
  )
}
