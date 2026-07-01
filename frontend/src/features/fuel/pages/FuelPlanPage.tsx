// ============================================================
// Mezo · Fuel · Plan view (Terv) — WEEKLY rhythm: meals, supplements, training stack
// Port: prototype/src/fuel-plan.jsx FuelPlanPage (49–216).
//
// Adaptations vs prototype:
//  - State lives in this component (gymScheduleState + editOpen) and is lifted
//    into GymScheduleSheet via onSave instead of the prototype's global mutation.
//  - WeekRhythmGrid owns its own section header ("Heti ritmus · 24h tengelyen")
//    and legend, so they are not duplicated here.
//  - The weekly-stat magic numbers come from useFuelWeek().weeklyStats.
// ============================================================
import { useState } from 'react'
import type { GymScheduleDay } from '@/data/types'
import { useFuelWeek, useTodayScenario } from '@/data/hooks'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { PageTitle } from '@/shared/ui/PageTitle'
import { Icon } from '@/shared/ui/Icon'
import { StatCell } from '@/shared/ui/StatCell'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import { RetaWeekStrip } from '@/features/fuel/components/RetaWeekStrip'
import { WeekRhythmGrid } from '@/features/fuel/components/WeekRhythmGrid'
import { PatternRow } from '@/features/fuel/components/PatternRow'
import { WeeklySupplementGrid } from '@/features/fuel/components/WeeklySupplementGrid'
import { GymScheduleSheet } from '@/features/fuel/sheets/GymScheduleSheet'

export function FuelPlanPage() {
  const { gymSchedule, weeklySupplements, patterns, weeklyStats, volleyball } = useFuelWeek()
  const { retaDay } = useTodayScenario()
  const [gymScheduleState, setGymScheduleState] = useState<GymScheduleDay[]>(gymSchedule)
  const [editOpen, setEditOpen] = useState(false)

  // Weekly aggregates
  const activeGymDays = gymScheduleState.filter(d => d.active).length
  const vbCount = volleyball.length
  const weeklyKcalAvg = Math.round(weeklyStats.kcalTarget * weeklyStats.kcalAvgFactor)

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div className="col gap-xs">
          <Eyebrow brand>Fuel · Heti terv</Eyebrow>
          <PageTitle>Máj 18 – 24</PageTitle>
        </div>
        <button onClick={() => setEditOpen(true)} className="chip" style={{ padding: '8px 10px' }}>
          <Icon name="settings" size={12} /> Idők
        </button>
      </div>

      {/* Weekly stats card */}
      <div style={{ padding: '0 24px 12px' }}>
        <div className="card notch-12" style={{ padding: 16 }}>
          <div className="row gap-md" style={{ justifyContent: 'space-between' }}>
            <StatCell
              label="Kcal avg"
              val={weeklyKcalAvg.toLocaleString()}
              sub={'/ ' + weeklyStats.kcalTarget}
              color="var(--brand-glow)"
            />
            <StatCell
              label="Protein hit"
              val={weeklyStats.proteinHitDays + '/7'}
              sub="napon"
              color="var(--cat-physiology)"
            />
            <StatCell
              label="Stack"
              val={weeklyStats.supplementsAdherence + '%'}
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

          <div
            className="row gap-md mt-md"
            style={{
              paddingTop: 12,
              borderTop: '1px solid var(--border-subtle)',
              alignItems: 'center',
            }}
          >
            <Icon name="sparkle" size={12} color="var(--brand-glow)" />
            <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.5, flex: 1 }}>
              <SafeMarkdown text="Most kell egy **középmagas-protein héttel** menni — Reta D3-D5 a peak étvágy-süllyedés." />
            </span>
          </div>
        </div>
      </div>

      {/* Reta week strip */}
      <div style={{ padding: '0 24px 12px' }}>
        <div className="card notch-4" style={{ padding: 14 }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
            <Eyebrow>Reta cycle · 7 nap</Eyebrow>
            <span className="label-mono brand" style={{ fontSize: 9 }}>
              D{retaDay} · ma
            </span>
          </div>
          <RetaWeekStrip currentDay={retaDay} />
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

      {/* 7-day rhythm grid (includes its own header + legend) */}
      <WeekRhythmGrid gymSchedule={gymScheduleState} volleyball={volleyball} />

      {/* Recurring patterns */}
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

      {/* Weekly supplement plan */}
      <div style={{ padding: '16px 24px 24px' }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <Eyebrow>Heti supplement-térkép</Eyebrow>
          <span className="label-mono text-tertiary" style={{ fontSize: 9 }}>
            {weeklySupplements.length} item
          </span>
        </div>
        <WeeklySupplementGrid rows={weeklySupplements} />
      </div>

      {editOpen && (
        <GymScheduleSheet
          schedule={gymScheduleState}
          onSave={setGymScheduleState}
          onClose={() => setEditOpen(false)}
        />
      )}
    </>
  )
}
