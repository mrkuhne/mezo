// ============================================================
// Mezo · Fuel · Plan view (Terv) — WEEKLY rhythm: meals, supplements, training stack
// Port: prototype/src/fuel-plan.jsx FuelPlanPage (49–216); real-mode wiring Fuel P4 (mezo-kpo).
//
// Adaptations vs prototype:
//  - GymScheduleSheet saves go through useFuelWeekActions().saveGymSchedule (write-through to
//    Train's PUT /api/train/gym-schedule per ADR P0a); the local gymOverride keeps the edit
//    visible optimistically (and IS the demo persistence in mock mode, where the save no-ops).
//  - WeekRhythmGrid owns its own section header ("Heti ritmus · 24h tengelyen")
//    and legend, so they are not duplicated here.
//  - Weekly stats/title/note come from the dual-mode useFuelWeek(); sections with no real
//    source render honest-empty in real mode (hidden when [], `—` when null).
// ============================================================
import { useState } from 'react'
import type { GymScheduleDay } from '@/data/types'
import { useFuelWeek, useFuelWeekActions, useTodayScenario } from '@/data/hooks'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { Icon } from '@/shared/ui/Icon'
import { StatCell } from '@/shared/ui/StatCell'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import { RetaWeekStrip } from '@/features/fuel/components/RetaWeekStrip'
import { WeekRhythmGrid } from '@/features/fuel/components/WeekRhythmGrid'
import { PatternRow } from '@/features/fuel/components/PatternRow'
import { WeeklySupplementGrid } from '@/features/fuel/components/WeeklySupplementGrid'
import { GymScheduleSheet } from '@/features/fuel/sheets/GymScheduleSheet'

export function FuelPlanPage() {
  const { title, retaWeek, gymSchedule, weeklySupplements, patterns, weeklyStats, volleyball, weeklyNote } = useFuelWeek()
  const { saveGymSchedule } = useFuelWeekActions()
  const { retaDay } = useTodayScenario()
  // Optimistic local copy of a sheet save; null = render the hook's (query-backed) schedule.
  const [gymOverride, setGymOverride] = useState<GymScheduleDay[] | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const schedule = gymOverride ?? gymSchedule

  // Weekly aggregates
  const activeGymDays = schedule.filter(d => d.active).length
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
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="pgact-np np-press"
          style={{ background: 'var(--wash-sage)', color: 'var(--sage-deep)' }}
        >
          <Icon name="settings" size={12} /> Idők
        </button>
      </div>

      {/* Weekly stats card */}
      <div style={{ padding: '0 24px 12px' }}>
        <div className="card notch-12" style={{ padding: 16 }}>
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

      {/* Reta week strip — hidden until a medication cycle exists (real-mode honest ghost) */}
      {retaWeek.length > 0 && (
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
      )}

      {/* 7-day rhythm grid (includes its own header + legend) */}
      <WeekRhythmGrid gymSchedule={schedule} volleyball={volleyball} />

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

      {editOpen && (
        <GymScheduleSheet
          schedule={schedule}
          onSave={(next) => {
            setGymOverride(next)
            saveGymSchedule(next)
          }}
          onClose={() => setEditOpen(false)}
        />
      )}
    </>
  )
}
