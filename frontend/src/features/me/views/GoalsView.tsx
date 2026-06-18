import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { PageTitle } from '@/components/ui/PageTitle'
import { Display } from '@/components/ui/Display'
import { Icon } from '@/components/ui/Icon'
import { GhostState } from '@/components/ui/GhostState'
import { ToolChipRow } from '@/components/ui/ToolChipRow'
import type { Tool } from '@/components/ui/ToolChip'
import { useGoal, useWeight } from '@/data/hooks'
import type { GoalKind } from '@/data/types'
import { FactorCard } from '../components/FactorCard'
import { InsightCard } from '../components/InsightCard'
import { GoalStat } from '../components/GoalStat'
import { LinkedMesoCard } from '../components/LinkedMesoCard'
import { EditGoalSheet } from '../EditGoalSheet'

const KIND_LABEL: Record<GoalKind, string> = {
  cut: 'Fogyás',
  bulk: 'Hízás',
  maintenance: 'Maintenance',
}

const FACTOR_TOOLS: Tool[] = [
  { type: 'read', name: 'get_weight_log', args: '30d' },
  { type: 'read', name: 'get_meal_history', args: '7d' },
  { type: 'read', name: 'get_sport_load' },
  { type: 'compute', name: 'computeWeightFactors' },
]

export function GoalsView() {
  const navigate = useNavigate()
  const { goal, linkedMesocycles } = useGoal()
  const { weightTrends } = useWeight()
  const [sheet, setSheet] = useState<'goal' | null>(null)

  // Real mode with no active goal: empty "set up a goal" state (mezo-72d). Must
  // come BEFORE any goal.X read below, and stays null-safe for the whole render.
  if (!goal) {
    return (
      <>
        <div className="page-header">
          <div>
            <Eyebrow brand>Me · Cél</Eyebrow>
            <PageTitle className="mt-sm">Hosszú cél</PageTitle>
          </div>
        </div>
        <div style={{ padding: '8px 24px 16px' }}>
          <GhostState
            lines={3}
            message="Még nincs aktív célod — hozz létre egyet, és a Mezo köré szervezi a terveket."
            ctaLabel="＋ Új cél"
            onCta={() => navigate('/me/goals/new')}
          />
        </div>
      </>
    )
  }

  const progressed = goal.startWeight - goal.currentWeight
  const remaining = goal.currentWeight - goal.targetWeight
  const totalRange = goal.startWeight - goal.targetWeight
  const progressPct = Math.min(100, (progressed / totalRange) * 100)

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <Eyebrow brand>Me · Goals</Eyebrow>
          <PageTitle className="mt-sm">Hosszú cél</PageTitle>
        </div>
        <button type="button" className="chip" onClick={() => navigate('/me/goals/new')}>
          <Icon name="plus" size={12} /> Új cél
        </button>
      </div>

      {/* Goal hero (tap to open EditGoalSheet) */}
      <div style={{ padding: '0 24px 16px' }}>
        <div
          className="card notch-12"
          onClick={() => setSheet('goal')}
          style={{
            padding: 20,
            width: '100%',
            textAlign: 'left',
            cursor: 'pointer',
            background: 'linear-gradient(180deg, rgba(94, 234, 212, 0.06) 0%, var(--surface-1) 100%)',
            borderColor: 'var(--border-brand)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'var(--brand-glow)' }} />
          <div
            style={{
              position: 'absolute',
              right: -50,
              top: -50,
              width: 180,
              height: 180,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(94, 234, 212, 0.12), transparent 70%)',
            }}
          />
          <div style={{ position: 'relative' }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="col">
                <Eyebrow brand>{KIND_LABEL[goal.kind]} · aktív</Eyebrow>
                <Display size="lg" className="mt-sm">{goal.title}</Display>
                <span className="text-secondary mt-sm" style={{ fontSize: 12, fontFamily: 'var(--ff-mono)' }}>
                  {goal.startDate} → {goal.targetDate}
                </span>
              </div>
              <Icon name="settings" size={16} color="var(--text-tertiary)" />
            </div>

            {/* Weight track */}
            <div className="mt-lg">
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8, alignItems: 'baseline' }}>
                <div className="col">
                  <span className="label-mono" style={{ fontSize: 8 }}>Most</span>
                  <span
                    style={{
                      fontFamily: 'var(--ff-display)',
                      fontSize: 32,
                      fontWeight: 600,
                      color: 'var(--brand-glow)',
                      lineHeight: 1,
                      marginTop: 2,
                      textShadow: '0 0 16px rgba(94, 234, 212, 0.4)',
                    }}
                  >
                    {goal.currentWeight}
                    <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 3 }}>
                      {goal.unit}
                    </span>
                  </span>
                </div>
                <div className="col" style={{ alignItems: 'flex-end' }}>
                  <span className="label-mono" style={{ fontSize: 8 }}>Cél</span>
                  <span
                    style={{
                      fontFamily: 'var(--ff-display)',
                      fontSize: 20,
                      color: 'var(--text-secondary)',
                      lineHeight: 1,
                      marginTop: 2,
                    }}
                  >
                    {goal.targetWeight}
                    <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 9, color: 'var(--text-tertiary)', marginLeft: 3 }}>
                      {goal.unit}
                    </span>
                  </span>
                </div>
              </div>
              <div style={{ position: 'relative', height: 6, background: 'var(--surface-2)' }}>
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: progressPct + '%',
                    background: 'linear-gradient(90deg, var(--brand-core), var(--brand-glow))',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: `calc(${progressPct}% - 1px)`,
                    top: -3,
                    bottom: -3,
                    width: 2,
                    background: 'var(--brand-glow)',
                    boxShadow: '0 0 8px var(--brand-glow)',
                  }}
                />
              </div>
              <div className="row mt-sm" style={{ justifyContent: 'space-between' }}>
                <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
                  {goal.startWeight} kg · start
                </span>
                <span className="label-mono" style={{ fontSize: 9, color: 'var(--brand-glow)' }}>
                  −{progressed.toFixed(1)} kg · {progressPct.toFixed(0)}%
                </span>
              </div>
            </div>

            {/* Stats */}
            <div className="row gap-md mt-lg" style={{ paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
              <GoalStat label="Hátra" val={remaining.toFixed(1)} unit="kg" />
              <GoalStat label="Tempó" val={String(weightTrends.last4w.weeklyRate)} unit="kg/hét" highlight />
              <GoalStat
                label="Vége"
                val={weightTrends.sinceStart.projectedEndDate}
                sub={weightTrends.sinceStart.projectedRateGap > 0 ? `${weightTrends.sinceStart.projectedRateGap}n előtt` : ''}
              />
            </div>

            {/* Identity */}
            <p
              className="text-secondary mt-md"
              style={{ fontSize: 12, fontStyle: 'italic', lineHeight: 1.5, paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}
            >
              "{goal.identityFrame}"
            </p>
          </div>
        </div>
      </div>

      {/* Mezo insights */}
      <div style={{ padding: '0 24px 16px' }}>
        <div style={{ marginBottom: 12 }}>
          <Eyebrow>Mezo · mit látunk</Eyebrow>
        </div>
        <div className="col gap-sm">
          {weightTrends.insights.map((ins, i) => (
            <InsightCard key={i} insight={ins} />
          ))}
        </div>
      </div>

      {/* Factors */}
      <div style={{ padding: '0 24px 16px' }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <Eyebrow>Hatások · ami most mozgatja</Eyebrow>
          <Eyebrow brand>{weightTrends.factors.length}</Eyebrow>
        </div>
        <div className="col gap-sm">
          {weightTrends.factors.map((f, i) => (
            <FactorCard key={i} factor={f} />
          ))}
        </div>
        <div className="mt-md">
          <ToolChipRow tools={FACTOR_TOOLS} />
        </div>
      </div>

      {/* Linked mesocycles */}
      <div style={{ padding: '0 24px 24px' }}>
        <div style={{ marginBottom: 12 }}>
          <Eyebrow>Cél alatt fut · {goal.mesocycles.length} meso</Eyebrow>
        </div>
        <div className="col gap-sm">
          {goal.mesocycles.map(mid => {
            const m = linkedMesocycles[mid]
            if (!m) return null
            return <LinkedMesoCard key={mid} meso={m} />
          })}
        </div>
      </div>

      {sheet === 'goal' && <EditGoalSheet onClose={() => setSheet(null)} goal={goal} />}
    </>
  )
}
