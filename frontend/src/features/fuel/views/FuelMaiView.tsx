import { useState } from 'react'
import type { FuelMeal } from '@/data/types'
import { useFuelDay, useFuelTimeline, useProtocol, useTodayScenario, useToday } from '@/data/hooks'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { PageTitle } from '@/shared/ui/PageTitle'
import { Icon } from '@/shared/ui/Icon'
import { StatCell } from '@/shared/ui/StatCell'
import { RetaPhaseBar } from '@/shared/ui/RetaPhaseBar'
import { ProgressBar } from '@/shared/ui/ProgressBar'
import { MacroHero } from '@/features/fuel/components/MacroHero'
import { FuelTimeline } from '@/features/fuel/components/FuelTimeline'
import { PacingCard } from '@/features/fuel/components/PacingCard'
import { MealScoreSheet } from '@/features/fuel/MealScoreSheet'
import { ReplanSheet } from '@/features/fuel/ReplanSheet'
import { LogMealSheet } from '@/features/fuel/LogMealSheet'

export function FuelMaiView() {
  const { fuel } = useFuelDay()
  const { plan, getScoredMeal } = useFuelTimeline()
  const { protocol } = useProtocol()
  const { retaDay } = useTodayScenario()
  const { today } = useToday()

  const [scoreMeal, setScoreMeal] = useState<FuelMeal | null>(null)
  const [replanOpen, setReplanOpen] = useState(false)
  const [logOpen, setLogOpen] = useState(false)

  const doneCount = plan.slots.filter(s => s.state === 'done').length

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div className="col gap-xs">
          <Eyebrow brand>Fuel · Mai</Eyebrow>
          <PageTitle>Pacing</PageTitle>
        </div>
        <button
          type="button"
          onClick={() => setLogOpen(true)}
          className="chip brand"
          aria-label="Logolás"
          style={{ fontSize: 10, padding: '6px 10px' }}
        >
          <Icon name="plus" size={12} /> Log
        </button>
      </div>

      {/* Reta phase context */}
      <RetaPhaseBar day={retaDay} />
      <div className="row" style={{ padding: '4px 24px 12px', justifyContent: 'space-between' }}>
        <span className="eyebrow">Reta D{retaDay} · medication-aware</span>
        <span className="eyebrow text-tertiary">kcal floor 2500</span>
      </div>

      {/* Context strip (gym/vb/coffee/kitchen) */}
      <div style={{ padding: '0 24px 12px' }}>
        <div className="card notch-4" style={{ padding: 12, background: 'var(--surface-1)' }}>
          <div className="row gap-md" style={{ justifyContent: 'space-between' }}>
            <StatCell
              label={plan.workout.start === '—' ? 'Gym' : today.workoutType}
              val={plan.workout.start}
              sub={plan.workout.duration ? plan.workout.duration + 'p' : ''}
              color="var(--brand-glow)"
            />
            <StatCell
              label="Volleyball"
              val={plan.volleyball.noneToday ? 'off' : plan.volleyball.start}
              sub={plan.volleyball.noneToday ? 'Csü nincs' : '90p'}
              color={plan.volleyball.noneToday ? 'var(--text-tertiary)' : 'var(--cat-tendency)'}
            />
            <StatCell label="Coffee" val={plan.caffeineCutoff} sub="cutoff" color="var(--warning)" />
            <StatCell label="Kitchen" val={plan.kitchenClose} sub="close" color="var(--info)" />
          </div>
        </div>
      </div>

      {/* Macro hero */}
      <div style={{ padding: '0 24px 12px' }}>
        <MacroHero targets={fuel.targets} consumed={fuel.consumed} eyebrow={fuel.pacing.eyebrow} />
      </div>

      {/* Pacing insight */}
      <div style={{ padding: '8px 24px 8px' }}>
        <PacingCard pacing={fuel.pacing} />
      </div>

      {/* Timeline — meals + supplements + workout/sport blocks */}
      <div style={{ padding: '16px 24px 8px' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span className="eyebrow">Mai timeline · {plan.slots.length} slot</span>
          <span className="eyebrow brand">{doneCount}/{plan.slots.length}</span>
        </div>
        {/* Protocol meta row */}
        <div
          className="row gap-sm"
          style={{
            padding: '6px 10px',
            marginBottom: 12,
            background: 'var(--surface-1)',
            border: '1px solid var(--border-subtle)',
            alignItems: 'center',
          }}
        >
          <Icon name="sparkle" size={11} color="var(--brand-glow)" />
          <div className="col flex-1" style={{ minWidth: 0 }}>
            <span className="label-mono brand" style={{ fontSize: 9 }}>
              Stack · v{protocol.version} · {protocol.builtAt}
            </span>
            <span className="label-mono text-tertiary" style={{ fontSize: 8, marginTop: 1 }}>
              {protocol.lastReplanReason
                ? '↳ ' + protocol.lastReplanReason
                : protocol.itemCount + ' item · conf ' + (protocol.confidence * 100).toFixed(0) + '%'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setReplanOpen(true)}
            className="chip"
            style={{ fontSize: 9, padding: '4px 8px', color: 'var(--brand-glow)', borderColor: 'var(--border-brand)' }}
          >
            <Icon name="tool" size={10} /> Replan
          </button>
        </div>
        <FuelTimeline slots={plan.slots} getScoredMeal={getScoredMeal} onOpenScore={setScoreMeal} />
      </div>

      {/* Micronutrients */}
      <div style={{ padding: '16px 24px 24px' }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>Mikrotápanyagok · heti</div>
        <div className="card notch-4" style={{ padding: 14 }}>
          <div className="col gap-md">
            {fuel.micronutrients.map((n, i) => (
              <div key={i} className="row gap-md">
                <span
                  className="label-mono"
                  style={{ width: 36, color: n.pct < 70 ? 'var(--warning)' : 'var(--text-primary)' }}
                >
                  {n.name}
                </span>
                <ProgressBar className="flex-1" value={n.pct} tone={n.pct < 70 ? 'warning' : 'glow'} />
                <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 11, color: 'var(--text-tertiary)', width: 56, textAlign: 'right' }}>
                  {n.pct}% · {n.target}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {scoreMeal && <MealScoreSheet meal={scoreMeal} onClose={() => setScoreMeal(null)} />}
      {replanOpen && <ReplanSheet onClose={() => setReplanOpen(false)} />}
      {logOpen && <LogMealSheet onClose={() => setLogOpen(false)} />}
    </>
  )
}
