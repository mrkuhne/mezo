import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { PageTitle } from '@/components/ui/PageTitle'
import { Display } from '@/components/ui/Display'
import { Icon } from '@/components/ui/Icon'
import { GhostState } from '@/components/ui/GhostState'
import { useGoal, useGoalActions, useWeight, useBiometricProfile } from '@/data/hooks'
import type { GoalResponse } from '@/lib/goalApi'
import { huMonthDay } from '@/lib/dates'
import { GoalStat } from '@/features/me/components/GoalStat'
import { GoalTimeline } from '@/features/me/components/GoalTimeline'
import { GoalRecept } from '@/features/me/components/GoalRecept'
import { GoalPlanSlots } from '@/features/me/components/GoalPlanSlots'
import { EditGoalSheet } from '@/features/me/EditGoalSheet'
import { GoalGate } from '@/features/me/GoalGate'
import GoalsSkeleton from '@/features/me/views/GoalsSkeleton'
// LinkedMesoCard was the per-row card the GoalTimeline lane view replaced in G4b.

// Contract-native trajectory + guard labels — the hero reads these straight off
// the raw GoalResponse (G4b Decision C: window/trajectory/guards/weights no longer
// pass through the toGoal back-compat mapper).
const TRAJECTORY_LABEL: Record<GoalResponse['trajectory'], string> = {
  cut: 'Fogyás',
  bulk: 'Hízás',
  maintain: 'Maintenance',
}
const GUARD_LABEL: Record<string, string> = {
  strength: 'Erő-gard',
  muscle: 'Izom-gard',
}

export function GoalsView() {
  const navigate = useNavigate()
  const { goal, goalResponse, timeline, goalId, pending } = useGoal()
  const { detachPlan, evaluate, evaluating } = useGoalActions()
  const { weightTrends } = useWeight()
  const { isComplete: biometricComplete } = useBiometricProfile()
  const [sheet, setSheet] = useState<'goal' | null>(null)
  const [gateOpen, setGateOpen] = useState(false)

  // "Új cél" hard gate (G6, mezo-06n — Task 7): goal creation requires a
  // complete biometric profile (the engine derives the calorie target from it).
  // Complete → straight to the wizard; incomplete → the gate interstitial that
  // sets up the profile first, then continues. Shared by both entry points (the
  // empty-state CTA + the header chip) so the rule lives in one place.
  const startNewGoal = () => {
    if (biometricComplete) navigate('/me/goals/new')
    else setGateOpen(true)
  }

  // Loading skeleton (real mode): while the active-goal query is unresolved
  // (useGoal pending), show the layout-aware GoalsSkeleton so the swap to real
  // content does not flash the empty-state CTA. Must come BEFORE the no-goal guard
  // (pending and "no active goal" both look like a null goal). Mock mode never sets
  // pending (synchronous seed) → no skeleton (mezo-f2z). After all hooks.
  if (pending) return <GoalsSkeleton />

  // Real mode with no active goal: empty "set up a goal" state (mezo-72d). Must
  // come BEFORE any goal.X / goalResponse.X read below, and stays null-safe for
  // the whole render. `goal` and `goalResponse` go null together (both derive from
  // the same active GoalResponse), so this one guard narrows both.
  if (!goal || !goalResponse) {
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
            onCta={startNewGoal}
          />
        </div>
        {gateOpen && (
          <GoalGate onClose={() => setGateOpen(false)} onComplete={() => navigate('/me/goals/new')} />
        )}
      </>
    )
  }

  const progressed = goal.startWeight - goal.currentWeight
  const remaining = goal.currentWeight - goal.targetWeight
  const totalRange = goal.startWeight - goal.targetWeight
  const progressPct = Math.min(100, (progressed / totalRange) * 100)

  // Hero reads the raw contract directly (Decision C): trajectory/guards/window.
  const targetWeightKg = goalResponse.targetWeightKg ?? goalResponse.startWeightKg
  const guards = goalResponse.guards ?? []

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <Eyebrow brand>Me · Goals</Eyebrow>
          <PageTitle className="mt-sm">Hosszú cél</PageTitle>
        </div>
        <button type="button" className="chip" onClick={startNewGoal}>
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
                <Eyebrow brand>{TRAJECTORY_LABEL[goalResponse.trajectory]} · aktív</Eyebrow>
                <Display size="lg" className="mt-sm">{goalResponse.title}</Display>
                <span className="text-secondary mt-sm" style={{ fontSize: 12, fontFamily: 'var(--ff-mono)' }}>
                  {huMonthDay(goalResponse.startDate)} → {huMonthDay(goalResponse.targetDate)}
                </span>
                {guards.length > 0 && (
                  <div className="row gap-sm mt-sm" style={{ flexWrap: 'wrap' }}>
                    {guards.map((g) => (
                      <span
                        key={g}
                        className="chip"
                        style={{ fontSize: 9, padding: '2px 7px', color: 'var(--brand-glow)', borderColor: 'var(--border-brand)' }}
                      >
                        {GUARD_LABEL[g] ?? g}
                      </span>
                    ))}
                  </div>
                )}
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
                      kg
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
                    {targetWeightKg}
                    <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 9, color: 'var(--text-tertiary)', marginLeft: 3 }}>
                      kg
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
                  {goalResponse.startWeightKg} kg · start
                </span>
                <span className="label-mono" style={{ fontSize: 9, color: 'var(--brand-glow)' }}>
                  −{progressed.toFixed(1)} kg · {progressPct.toFixed(0)}%
                </span>
              </div>
            </div>

            {/* Stats — only backend-derived figures: remaining kg (weight-log derived)
                and the real EWMA 4-week rate. */}
            <div className="row gap-md mt-lg" style={{ paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
              <GoalStat label="Hátra" val={remaining.toFixed(1)} unit="kg" />
              <GoalStat label="Tempó" val={String(weightTrends.last4w.weeklyRate)} unit="kg/hét" highlight />
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

      {/* Timeline — the goal as a horizontal time axis: gym/run lanes + gap chips +
          the ambient volleyball band (G4b command-center finale, replaces the old
          "Cél alatt fut" cards). The lane component consumes the raw timeline; each
          plan bar's ✕ detaches the link via useGoalActions().detachPlan. */}
      <div style={{ padding: '0 24px 16px' }}>
        <div style={{ marginBottom: 12 }}>
          <Eyebrow>Cél alatt fut · idővonal</Eyebrow>
        </div>
        {timeline ? (
          <GoalTimeline
            timeline={timeline}
            onDetach={goalId ? (linkId) => detachPlan(goalId, linkId) : undefined}
          />
        ) : (
          <GhostState lines={3} message="Még nincs terv a cél alá csatolva — tervezz egy mesót, és itt jelenik meg az idővonalon." />
        )}
      </div>

      {/* Recept — the G5 engine finale: the segmented prescription (kcal/protein/
          sleep/rest per block + projected rate + rationale), the feasibility verdict
          and the guard-status pills. Replaces G4b's "G5 · hamarosan" placeholder.
          Null prescription (real, not yet evaluated) → the "Értékeld a célt" CTA that
          runs the engine via useGoalActions().evaluate. (mezo-g1u) */}
      <div style={{ padding: '0 24px 16px' }}>
        <GoalRecept
          prescription={goalResponse.prescription}
          onEvaluate={goalId ? () => evaluate(goalId) : undefined}
          evaluating={evaluating}
        />
      </div>

      {/* Plan slots — the hub-and-spoke assembly UX (G4b, goal-funnel.html Funnel B):
          Mesociklus + Futóblokk slots, each launching the existing planner
          (＋ Tervezd) or attaching an owned plan (＋ Csatolj meglévőt → AttachPlanSheet).
          Volleyball stays ambient/read-only in the timeline band — not a slot. */}
      {goalId && (
        <div style={{ padding: '0 24px 24px' }}>
          <div style={{ marginBottom: 12 }}>
            <Eyebrow>Építsd fel a tervet alá</Eyebrow>
          </div>
          <GoalPlanSlots goalId={goalId} />
        </div>
      )}

      {sheet === 'goal' && goalId && (
        <EditGoalSheet onClose={() => setSheet(null)} goal={goal} goalId={goalId} />
      )}

      {gateOpen && (
        <GoalGate onClose={() => setGateOpen(false)} onComplete={() => navigate('/me/goals/new')} />
      )}
    </>
  )
}
