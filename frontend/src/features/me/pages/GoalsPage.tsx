import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { Display } from '@/shared/ui/Display'
import { GhostState } from '@/shared/ui/GhostState'
import { MozaikPage, PageHead, PageHero, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup, useCountUp } from '@/shared/ui/mozaik/motion'
import { useGoal, useGoalActions, useWeight, useBiometricProfile } from '@/data/hooks'
import { huMonthDay } from '@/shared/lib/dates'
import { hu1 } from '@/shared/lib/huNum'
import { GoalTimeline } from '@/features/me/components/GoalTimeline'
import { GoalRecept } from '@/features/me/components/GoalRecept'
import { GoalPlanSlots } from '@/features/me/components/GoalPlanSlots'
import { EditGoalSheet } from '@/features/me/sheets/EditGoalSheet'
import { GoalGate } from '@/features/me/components/GoalGate'
import GoalsSkeleton from '@/features/me/pages/GoalsSkeleton'
import { TRAJECTORY_LABEL, GUARD_LABEL } from '@/features/me/logic/goalLabels'

// The Cél subpage (mezo-d20.6.2, prototype en-body #page-cel ×1.18): a tile →
// own-page Mozaik scaffold (coral tone) with the guard-chip goal card up top,
// the engine's recept as amber/sage segment tiles, the gym/futás/röplabda
// timeline lanes and the dashed Mesociklus/Futóblokk plan slots below. Data
// hooks, mutations and behavioral contracts carry over from the pre-reface
// page verbatim — only the face changes.

export function GoalsPage() {
  const navigate = useNavigate()
  const { goal, goalResponse, timeline, goalId, pending } = useGoal()
  const { detachPlan, evaluate, evaluating } = useGoalActions()
  const { weightTrends } = useWeight()
  const { isComplete: biometricComplete } = useBiometricProfile()
  const [sheet, setSheet] = useState<'goal' | null>(null)
  const [gateOpen, setGateOpen] = useState(false)

  // Signed math so bulk still lands in 0..100; maintain (totalRange 0) hides the
  // track entirely — mirrors GoalMiniCard's exact contract (review fix, Task 5).
  // Computed with null-safe defaults so the hook below always runs (rules of
  // hooks) even while `goal` is not yet loaded (pending/empty-state branches).
  const totalRange = goal ? goal.startWeight - goal.targetWeight : 0
  const progressPct = goal && totalRange !== 0
    ? Math.min(100, Math.max(0, ((goal.startWeight - goal.currentWeight) / totalRange) * 100))
    : 0
  const progressCount = useCountUp(Math.round(progressPct))

  // "Új cél" hard gate (G6, mezo-06n — Task 7): goal creation requires a
  // complete biometric profile (the engine derives the calorie target from it).
  // Complete → straight to the wizard; incomplete → the gate interstitial that
  // sets up the profile first, then continues. Shared by both entry points (the
  // empty-state CTA + the header chip) so the rule lives in one place.
  const startNewGoal = () => {
    if (biometricComplete) navigate('/me/goals/new')
    else setGateOpen(true)
  }

  const NewGoalAction = (
    <button type="button" className="pgact" style={{ marginLeft: 'auto' }} onClick={startNewGoal}>
      ＋ Új cél
    </button>
  )

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
      <MozaikPage tone="coral">
        <PageHead onBack={() => navigate('/me')} label="‹ Én" />
        <PageHero name="Hosszú cél" />
        <PageBody>
          <GhostState
            lines={3}
            message="Még nincs aktív célod — hozz létre egyet, és a Mezo köré szervezi a terveket."
            ctaLabel="＋ Új cél"
            onCta={startNewGoal}
          />
        </PageBody>
        {gateOpen && (
          <GoalGate onClose={() => setGateOpen(false)} onComplete={() => navigate('/me/goals/new')} />
        )}
      </MozaikPage>
    )
  }

  const remaining = goal.currentWeight - goal.targetWeight

  // Hero reads the raw contract directly (Decision C): trajectory/guards/window.
  const guards = goalResponse.guards ?? []

  return (
    <MozaikPage tone="coral">
      <PageHead onBack={() => navigate('/me')} label="‹ Én">{NewGoalAction}</PageHead>
      <EntranceGroup>
        <PageHero
          icon="i-cel"
          big={totalRange !== 0 ? `${progressCount}%` : undefined}
          name="Hosszú cél"
        />
        <PageBody>
          {/* Guard-chip goal card (tap → EditGoalSheet) */}
          <button type="button" className="gc-card rise" style={{ '--d': '0ms' } as React.CSSProperties} onClick={() => setSheet('goal')}>
            <div className="gc-card-top">
              <span className="eyebrow" style={{ color: 'var(--primary-deep)' }}>
                {TRAJECTORY_LABEL[goalResponse.trajectory]} · aktív
              </span>
              {guards.length > 0 && (
                <div className="gc-guards">
                  {guards.map((g) => (
                    <span key={g} className="mzp-stch ok">{GUARD_LABEL[g] ?? g}</span>
                  ))}
                </div>
              )}
            </div>
            <Display size="lg" className="mt-sm">{goalResponse.title}</Display>
            <span className="text-secondary mt-sm" style={{ fontSize: 11, display: 'block' }}>
              {huMonthDay(goalResponse.startDate)} → {huMonthDay(goalResponse.targetDate)}
            </span>

            {/* Weight track — shared .track/.fill/.dot/.track-l vocabulary (Task 3),
                same idiom as the Profil GoalMiniCard's mini-track. */}
            {totalRange !== 0 && (
              <>
                <div className="track">
                  <div className="fill" style={{ width: `${progressPct}%` }} />
                  <div className="dot" style={{ left: `${progressPct}%` }} />
                </div>
                <div className="track-l">
                  <span>{hu1(goal.startWeight)}</span>
                  <span style={{ color: 'var(--sage-deep)' }}>{hu1(goal.currentWeight)} most</span>
                  <span>{hu1(goal.targetWeight)} cél</span>
                </div>
              </>
            )}

            {/* Stats — only backend-derived figures: remaining kg (weight-log
                derived) and the real EWMA 4-week rate. */}
            <div className="mz-mcells" style={{ marginTop: 9 }}>
              <span style={{ '--mw': 'var(--mz-cell-coral-bg)', '--md': 'var(--mz-cell-coral-ink)' } as React.CSSProperties}>
                <b>{hu1(remaining)} kg</b><small>hátra</small>
              </span>
              <span style={{ '--mw': 'var(--mz-cell-sage-bg)', '--md': 'var(--mz-cell-sage-ink)' } as React.CSSProperties}>
                <b>{weightTrends.last4w.weeklyRate}</b><small>kg / hét</small>
              </span>
            </div>

            {/* Identity */}
            <p className="gc-quote">"{goal.identityFrame}"</p>
          </button>

          {/* Recept — the G5 engine finale: the segmented prescription (kcal/
              protein/sleep/rest per block + projected rate + rationale), the
              feasibility verdict and the guard-status pills. Null prescription
              (real, not yet evaluated) → the "Értékeld a célt" CTA that runs the
              engine via useGoalActions().evaluate. (mezo-g1u) */}
          <div className="rise" style={{ '--d': '90ms' } as React.CSSProperties}>
            <GoalRecept
              prescription={goalResponse.prescription}
              onEvaluate={goalId ? () => evaluate(goalId) : undefined}
              evaluating={evaluating}
            />
          </div>

          {/* Timeline — the goal as a horizontal time axis: gym/run lanes + gap
              chips + the ambient volleyball band (G4b command-center finale). The
              lane component consumes the raw timeline; each plan bar's ✕
              detaches the link via useGoalActions().detachPlan. */}
          <div className="gc-lsec rise" style={{ '--d': '190ms' } as React.CSSProperties}>
            <Eyebrow>Cél alatt fut · idővonal</Eyebrow>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--mz-ink-mut)' }}>{timeline?.weeks ?? 0} hét</span>
          </div>
          <div className="rise" style={{ '--d': '220ms' } as React.CSSProperties}>
            {timeline ? (
              <GoalTimeline
                timeline={timeline}
                onDetach={goalId ? (linkId) => detachPlan(goalId, linkId) : undefined}
              />
            ) : (
              <GhostState lines={3} message="Még nincs terv a cél alá csatolva — tervezz egy mesót, és itt jelenik meg az idővonalon." />
            )}
          </div>

          {/* Plan slots — the hub-and-spoke assembly UX (G4b, goal-funnel.html
              Funnel B): Mesociklus + Futóblokk slots, each launching the existing
              planner (＋ Tervezd) or attaching an owned plan (＋ Csatolj
              meglévőt → AttachPlanSheet). Volleyball stays ambient/read-only in
              the timeline band — not a slot. */}
          {goalId && (
            <div className="rise" style={{ '--d': '260ms' } as React.CSSProperties}>
              <GoalPlanSlots goalId={goalId} />
            </div>
          )}
        </PageBody>
      </EntranceGroup>

      {sheet === 'goal' && goalId && (
        <EditGoalSheet onClose={() => setSheet(null)} goal={goal} goalResponse={goalResponse} goalId={goalId} />
      )}

      {gateOpen && (
        <GoalGate onClose={() => setGateOpen(false)} onComplete={() => navigate('/me/goals/new')} />
      )}
    </MozaikPage>
  )
}
