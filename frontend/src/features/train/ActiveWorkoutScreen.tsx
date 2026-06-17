// ============================================================
// Mezo · ActiveWorkoutScreen — full-screen active-workout mode
// (sibling route /train/session, NO sub-nav). Three-phase state machine:
//   prep    → niggle pre-flag · challenges · warmup · exercise list · CTA
//   active  → per-set logging (weight/reps/RIR), Múlt hét comparison,
//             set dots, today's set history, PR toast + feedback debrief
//   complete→ WorkoutComplete celebration / recap
// Every exit (Bezárás / back / Mentés) navigates back to /train.
// Ported from prototype train.jsx (the active-workout TrainScreen).
// ============================================================
import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useTrain } from '@/data/hooks'
import type { LastWeekSet, LoggedWorkoutExercise, Mesocycle, WorkoutPlan } from '@/data/types'
import type { SetLogRequest, WorkoutFeedbackInput, WorkoutInstanceResponse } from '@/lib/trainApi'
import { PageTitle } from '@/components/ui/PageTitle'
import { Chip } from '@/components/ui/Chip'
import { Display } from '@/components/ui/Display'
import { Icon } from '@/components/ui/Icon'
import { CtaPrimary } from '@/components/ui/Cta'
import { SafeMarkdown } from '@/lib/safeMarkdown'
import { CompactStepper } from './components/CompactStepper'
import { LastWeekStat } from './components/LastWeekStat'
import { PRToast, type PRState } from './components/PRToast'
import { FeedbackModal, type ExerciseFeedbackValues } from './components/FeedbackModal'
import { WorkoutComplete } from './components/WorkoutComplete'
import { ChallengesCarousel } from './components/ChallengesCarousel'

type Phase = 'prep' | 'active' | 'complete'
type CompletedSets = Record<string, LastWeekSet[]>
type Side = 'L' | 'B' | 'R'

const WARMUP_ROWS = [
  { label: 'Dinamikus stretching', time: '3 perc' },
  { label: 'Cardio-lite · evezőpad', time: '3 perc' },
  { label: 'Aktiváció · band pull-apart × 20', time: '2 perc' },
] as const

const AMBER_TINT_6 = 'color-mix(in srgb, var(--warning) 6%, transparent)'
const AMBER_TINT_8 = 'color-mix(in srgb, var(--warning) 8%, transparent)'
const AMBER_BORDER = 'color-mix(in srgb, var(--warning) 30%, transparent)'
const BRAND_TINT_4 = 'color-mix(in srgb, var(--brand-glow) 4%, transparent)'
const BRAND_TINT_6 = 'color-mix(in srgb, var(--brand-glow) 6%, transparent)'
const BRAND_TINT_8 = 'color-mix(in srgb, var(--brand-glow) 8%, transparent)'
const BRAND_TINT_12 = 'color-mix(in srgb, var(--brand-glow) 12%, transparent)'

// PR demo (prototype-scripted moment): the 3rd set of exercise 0 at/above this
// weight triggers the Personal Record toast, which auto-hides after PR_TOAST_MS.
const PR_DEMO_THRESHOLD_KG = 105
const PR_TOAST_MS = 4500

// Guard wrapper: the session screen's hooks (useState×N) are initialized from
// workout data, so the null case must redirect BEFORE the inner component mounts
// — a conditional early return between hook calls would break the hook order
// now that `workout` is query-driven (T2).
export function ActiveWorkoutScreen() {
  const { workout, activeMeso, todaySession, workoutPending, startWorkout, logSet, saveWorkoutFeedback, finishWorkout } = useTrain()
  // A hard reload lands here with the queries still loading — redirecting now
  // would kill the resume flow (live-smoke catch). Hold rendering until loaded.
  if (workoutPending) return null
  // T0 clean slate: never render the session without a workout (and at least one exercise).
  if (!workout || workout.exercises.length === 0 || !activeMeso) return <Navigate to="/train" replace />
  return (
    <ActiveWorkoutSession
      workout={workout}
      activeMeso={activeMeso}
      todaySession={todaySession}
      startWorkout={startWorkout}
      logSet={logSet}
      saveWorkoutFeedback={saveWorkoutFeedback}
      finishWorkout={finishWorkout}
    />
  )
}

interface SessionProps {
  workout: WorkoutPlan
  activeMeso: Mesocycle
  todaySession: { templateSessionId: string; openWorkout: WorkoutInstanceResponse | null } | null
  startWorkout: (templateSessionId: string, opts?: { onSuccess?: (w: WorkoutInstanceResponse) => void }) => void
  logSet: (workoutId: string, set: SetLogRequest) => void
  saveWorkoutFeedback: (workoutId: string, items: WorkoutFeedbackInput[]) => void
  finishWorkout: (workoutId: string) => void
}

// First-ever workout has no last week: prefill from the exercise targets instead.
function prefill(e: LoggedWorkoutExercise): LastWeekSet {
  return e.lastWeek ?? { weight: 0, reps: parseInt(e.targetReps, 10) || 10, rir: e.targetRIR }
}

// Resume: rebuild the local completed-set map (+cursor) from the open instance's logged sets.
function seedFromOpen(open: WorkoutInstanceResponse | null, exercises: LoggedWorkoutExercise[]) {
  if (!open) return { completed: {} as CompletedSets, exerciseIdx: 0, setIdx: 0, phase: 'prep' as Phase }
  const completed: CompletedSets = {}
  for (const s of open.sets) {
    const i = exercises.findIndex((e) => e.id === s.exerciseId)
    if (i < 0) continue
    const k = 'ex' + i
    completed[k] = [...(completed[k] ?? []), { weight: Number(s.weightKg ?? 0), reps: s.reps ?? 0, rir: s.rir ?? 0 }]
  }
  let exerciseIdx = exercises.findIndex((e, i) => (completed['ex' + i]?.length ?? 0) < e.sets)
  if (exerciseIdx < 0) exerciseIdx = exercises.length - 1
  const setIdx = Math.min(completed['ex' + exerciseIdx]?.length ?? 0, exercises[exerciseIdx].sets - 1)
  return { completed, exerciseIdx, setIdx, phase: 'active' as Phase }
}

function ActiveWorkoutSession({
  workout, activeMeso, todaySession, startWorkout, logSet, saveWorkoutFeedback, finishWorkout,
}: SessionProps) {
  const W = workout
  const navigate = useNavigate()
  const onExit = () => navigate('/train')

  const weekLabel = `Week ${activeMeso.currentWeek} · ${activeMeso.phaseCurve[activeMeso.currentWeek - 1]}`
  const niggleActive = !!W.niggleWarning

  const open = todaySession?.openWorkout ?? null
  // Seed once on mount — a mid-workout reload resumes straight into 'active'.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const seeded = useMemo(() => seedFromOpen(open, W.exercises), [])
  // The logging panel opens pre-filled with the current exercise's last-week
  // numbers (same source used to prefill exercises 1..N after each debrief).
  const startPrefill = prefill(W.exercises[seeded.exerciseIdx])

  const [phase, setPhase] = useState<Phase>(seeded.phase)
  const [exerciseIdx, setExerciseIdx] = useState(seeded.exerciseIdx)
  const [setIdx, setSetIdx] = useState(seeded.setIdx)
  const [weight, setWeight] = useState(startPrefill.weight)
  const [reps, setReps] = useState(startPrefill.reps)
  const [rir, setRir] = useState(startPrefill.rir)
  const [completedSets, setCompletedSets] = useState<CompletedSets>(seeded.completed)
  const [workoutId, setWorkoutId] = useState<string | null>(open?.id ?? null)
  const [side, setSide] = useState<Side | null>(null)
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState('')
  const [showPR, setShowPR] = useState<PRState | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [niggleConfirmed, setNiggleConfirmed] = useState(false)
  const [acceptedChallenges, setAcceptedChallenges] = useState<string[]>([])

  // Auto-hide the PR toast (leak-safe: cleared on unmount / re-trigger).
  useEffect(() => {
    if (!showPR) return
    const t = setTimeout(() => setShowPR(null), PR_TOAST_MS)
    return () => clearTimeout(t)
  }, [showPR])

  const ex = W.exercises[exerciseIdx]
  const acceptedMap: Record<string, boolean> = Object.fromEntries(
    acceptedChallenges.map((id) => [id, true]),
  )
  const toggleChallenge = (id: string) =>
    setAcceptedChallenges((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )

  // Mock mode has no todaySession — "Kezdjük el" keeps the Phase-1 local behavior.
  const beginWorkout = () => {
    if (!todaySession) {
      setPhase('active')
      return
    }
    startWorkout(todaySession.templateSessionId, {
      onSuccess: (w) => {
        setWorkoutId(w.id)
        setPhase('active')
      },
    })
  }

  const completeSet = () => {
    const k = 'ex' + exerciseIdx
    setCompletedSets((prev) => ({
      ...prev,
      [k]: [...(prev[k] ?? []), { weight, reps, rir }],
    }))
    if (workoutId) {
      logSet(workoutId, {
        exerciseId: ex.id, setIndex: setIdx, weightKg: weight, reps, rir,
        ...(side ? { side } : {}), ...(note.trim() ? { note: note.trim() } : {}),
      })
    }
    setNote('')

    // PR demo: only set 3 of the first exercise at/above the threshold counts,
    // and only when a last-week reference exists to compare against.
    const firstLastWeek = W.exercises[0].lastWeek
    if (exerciseIdx === 0 && setIdx === 2 && firstLastWeek && weight >= PR_DEMO_THRESHOLD_KG) {
      setShowPR({
        delta: (weight - firstLastWeek.weight).toFixed(1),
        prev: firstLastWeek.weight,
        prevReps: firstLastWeek.reps,
      })
    }

    if (setIdx + 1 >= ex.sets) {
      // Last set of the exercise → debrief feedback sheet.
      setShowFeedback(true)
    } else {
      setSetIdx(setIdx + 1)
    }
  }

  // The save button of the debrief persists the RP values for the just-finished exercise.
  const saveFeedback = (vals: ExerciseFeedbackValues) => {
    if (workoutId) saveWorkoutFeedback(workoutId, [{ exerciseId: ex.id, ...vals }])
  }

  // Feedback resolution (skip or save both advance). Prefill the next
  // exercise's logging panel from its last-week numbers, or finish.
  const advanceAfterFeedback = () => {
    setShowFeedback(false)
    setSide(null)
    if (exerciseIdx + 1 < W.exercises.length) {
      const next = prefill(W.exercises[exerciseIdx + 1])
      setExerciseIdx(exerciseIdx + 1)
      setSetIdx(0)
      setWeight(next.weight)
      setReps(next.reps)
      setRir(next.rir)
    } else {
      if (workoutId) finishWorkout(workoutId)
      setPhase('complete')
    }
  }

  // ---------- PREP ----------
  if (phase === 'prep') {
    return (
      <div>
        {/* Breadcrumb — pinned below the status bar like native nav chrome (mezo-wdk) */}
        <div className="sticky-top" style={{ padding: '8px 24px' }}>
          <button className="row gap-sm" onClick={onExit}>
            <span style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--ff-mono)', fontSize: 14 }}>←</span>
            <span className="eyebrow">Vissza</span>
          </button>
        </div>
        <div style={{ padding: '6px 24px' }}>
          <div className="mt-sm">
            <PageTitle>{W.title}</PageTitle>
          </div>
          <div className="row gap-sm mt-sm flex-wrap">
            <Chip variant="brand">{weekLabel}</Chip>
            <Chip>{W.exercises.length} gyakorlat</Chip>
          </div>
        </div>

        {/* Niggle pre-flag — dismissed once acknowledged ("Értem · jó így") */}
        {niggleActive && W.niggleWarning && !niggleConfirmed && (
          <div style={{ padding: '16px 24px' }}>
            <div
              className="card notch-12"
              style={{
                padding: 16,
                background: AMBER_TINT_6,
                borderColor: AMBER_BORDER,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: 'var(--warning)' }} />
              <div className="row gap-sm" style={{ alignItems: 'center' }}>
                <Icon name="warning" size={16} color="var(--warning)" />
                <span className="eyebrow" style={{ color: 'var(--warning)' }}>
                  {W.niggleWarning.muscleLabel} · aktív niggle
                </span>
              </div>
              <p style={{ fontSize: 13, marginTop: 10, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                {W.niggleWarning.detail}
              </p>
              <div className="row gap-sm mt-md">
                <button
                  type="button"
                  className="cta-ghost notch-4"
                  style={{ fontSize: 10 }}
                  onClick={() => setNiggleConfirmed(true)}
                >
                  Értem · jó így
                </button>
                <button type="button" className="chip" style={{ fontSize: 9 }}>
                  Tudatosítsuk később
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mai kihívások — companion proposes, user approves */}
        <ChallengesCarousel
          challenges={W.challenges}
          accepted={acceptedMap}
          onToggle={toggleChallenge}
        />

        {/* Warmup block */}
        <div style={{ padding: '8px 24px' }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            Bemelegítés · 8 perc
          </div>
          <div className="col gap-sm">
            {WARMUP_ROWS.map((w, i) => (
              <div key={i} className="card notch-4 row" style={{ padding: '10px 14px', alignItems: 'center' }}>
                <span
                  className="label-mono"
                  style={{ fontSize: 9, color: 'var(--brand-glow)', marginRight: 12 }}
                >
                  0{i + 1}
                </span>
                <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1 }}>{w.label}</span>
                <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>
                  {w.time}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Exercise list */}
        <div style={{ padding: '16px 24px' }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            Gyakorlatsor
          </div>
          <div className="col gap-sm">
            {W.exercises.map((e, i) => {
              const exChallenge = W.challenges.find(
                (c) => c.exerciseId === e.id && acceptedMap[c.id],
              )
              return (
                <div
                  key={i}
                  className="card notch-4"
                  style={{
                    padding: 12,
                    borderColor: exChallenge ? 'var(--border-brand)' : 'var(--border-subtle)',
                    background: exChallenge ? BRAND_TINT_4 : 'var(--surface-1)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {exChallenge && (
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: 'var(--brand-glow)' }} />
                  )}
                  <div
                    className="row"
                    style={{ justifyContent: 'space-between', alignItems: 'flex-start', paddingLeft: exChallenge ? 6 : 0 }}
                  >
                    <div className="col flex-1">
                      <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{e.name}</span>
                      {exChallenge && (
                        <div className="row gap-sm mt-xs" style={{ alignItems: 'center' }}>
                          <Icon name="sparkle" size={10} color="var(--brand-glow)" />
                          <span className="label-mono" style={{ fontSize: 9, color: 'var(--brand-glow)' }}>
                            {exChallenge.typeLabel} · {exChallenge.target}
                          </span>
                        </div>
                      )}
                    </div>
                    <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>
                      {e.sets} × {e.targetReps}
                    </span>
                  </div>
                  <div className="row mt-sm gap-sm" style={{ paddingLeft: exChallenge ? 6 : 0 }}>
                    <span className="chip" style={{ fontSize: 9, padding: '2px 6px' }}>RIR {e.targetRIR}</span>
                    <span className="chip" style={{ fontSize: 9, padding: '2px 6px' }}>{e.muscle}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ padding: '24px' }}>
          <CtaPrimary onClick={beginWorkout}>
            <span>Kezdjük el</span>
            <span style={{ opacity: 0.5, fontWeight: 400 }}>·</span>
            <span>{W.title}</span>
          </CtaPrimary>
        </div>
      </div>
    )
  }

  // ---------- COMPLETE ----------
  if (phase === 'complete') {
    const hadPR = !!showPR || (completedSets['ex0'] ?? []).some((s) => s.weight >= PR_DEMO_THRESHOLD_KG)
    return (
      <WorkoutComplete workout={W} completedSets={completedSets} hadPR={hadPR} onExit={onExit} />
    )
  }

  // ---------- ACTIVE ----------
  const totalSets = W.exercises.reduce((a, e) => a + e.sets, 0)
  const doneSets = Object.values(completedSets).reduce((a, arr) => a + arr.length, 0)
  const activeChallenge = W.challenges.find((c) => c.exerciseId === ex.id && acceptedMap[c.id])
  const exHistory = completedSets['ex' + exerciseIdx] ?? []

  return (
    <>
      {showPR && <PRToast pr={showPR} />}
      {showFeedback && (
        <FeedbackModal
          ex={ex}
          isLastExercise={exerciseIdx + 1 >= W.exercises.length}
          onResolve={advanceAfterFeedback}
          onSave={saveFeedback}
        />
      )}

      <div>
        {/* Header — pinned below the status bar so progress stays visible (mezo-wdk) */}
        <div className="sticky-top" style={{ padding: '8px 24px 10px' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <button onClick={onExit} className="row gap-sm">
              <Icon name="x" size={16} color="var(--text-secondary)" />
              <span className="eyebrow">Bezárás</span>
            </button>
            <span className="label-mono">
              {exerciseIdx + 1}/{W.exercises.length} · {doneSets}/{totalSets} szet
            </span>
          </div>
          <div className="bar mt-sm">
            <div className="bar-fill glow" style={{ width: (doneSets / totalSets) * 100 + '%' }} />
          </div>
        </div>

        {/* Niggle banner if active */}
        {niggleActive && exerciseIdx <= 1 && (
          <div style={{ padding: '8px 24px' }}>
            <div
              style={{
                padding: '8px 12px',
                background: AMBER_TINT_8,
                borderLeft: '2px solid var(--warning)',
                fontSize: 11,
                color: 'var(--warning)',
                fontFamily: 'var(--ff-mono)',
                letterSpacing: '0.08em',
              }}
            >
              ⚠ Jobb váll aktív · {exerciseIdx === 1 ? 'pronated grif' : 'óvatos, először warm-up'}
            </div>
          </div>
        )}

        {/* Active exercise card */}
        <div style={{ padding: '16px 24px' }}>
          <div className="card notch-12" style={{ padding: 18 }}>
            {activeChallenge && (
              <div
                style={{
                  margin: '-18px -18px 14px',
                  padding: '10px 16px',
                  background: BRAND_TINT_8,
                  borderBottom: '1px solid var(--border-brand)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <Icon name="sparkle" size={14} color="var(--brand-glow)" />
                <div className="col flex-1">
                  <span className="label-mono" style={{ fontSize: 9, color: 'var(--brand-glow)' }}>
                    Aktív kihívás · {activeChallenge.typeLabel}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-primary)', marginTop: 2 }}>
                    Cél: <strong style={{ color: 'var(--brand-glow)', fontWeight: 500 }}>{activeChallenge.target}</strong>
                  </span>
                </div>
              </div>
            )}
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="eyebrow brand">
                {ex.type === 'compound' ? 'Compound' : 'Isolation'} · Set {setIdx + 1}/{ex.sets}
              </span>
              <span className="chip brand" style={{ fontSize: 9, padding: '3px 8px' }}>
                Cél · {ex.targetReps} @ RIR {ex.targetRIR}
              </span>
            </div>
            <div style={{ marginTop: 10 }}>
              <Display size="lg">{ex.name}</Display>
            </div>

            {/* Múlt hét — hero comparison block (only with a previous completed instance) */}
            {ex.lastWeek && (
              <div
                className="mt-lg"
                style={{
                  padding: '14px 16px',
                  background: 'var(--surface-2)',
                  borderLeft: '2px solid var(--brand-glow)',
                  position: 'relative',
                }}
              >
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                  <span className="label-mono" style={{ fontSize: 9, color: 'var(--brand-glow)' }}>Múlt hét · Kedd</span>
                  <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>7 napja</span>
                </div>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', gap: 8 }}>
                  <LastWeekStat label="Súly" val={ex.lastWeek.weight} unit="kg" />
                  <div style={{ width: 1, height: 32, background: 'var(--border-subtle)' }} />
                  <LastWeekStat label="Reps" val={'× ' + ex.lastWeek.reps} />
                  <div style={{ width: 1, height: 32, background: 'var(--border-subtle)' }} />
                  <LastWeekStat label="RIR" val={ex.lastWeek.rir} />
                </div>
                <div
                  className="row mt-md gap-sm"
                  style={{ alignItems: 'center', paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}
                >
                  <Icon name="sparkle" size={11} color="var(--brand-glow)" />
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {ex.lastWeek.rir >= 2 ? (
                      <SafeMarkdown text={`RIR ${ex.lastWeek.rir} maradt — **+2.5–5 kg** ma logikus`} />
                    ) : (
                      `RIR ${ex.lastWeek.rir} — közel a limithez, súly tartás vagy +1 rep`
                    )}
                  </span>
                </div>
              </div>
            )}

            {/* Set dots */}
            <div className="row mt-lg" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="set-dots">
                {Array.from({ length: ex.sets }, (_, i) => (
                  <div
                    key={i}
                    className={'set-dot' + (i < setIdx ? ' done' : i === setIdx ? ' active' : '')}
                  />
                ))}
              </div>
              <span className="label-mono" style={{ fontSize: 10 }}>
                {setIdx}/{ex.sets} done
              </span>
            </div>

            {/* Completed sets history */}
            {exHistory.length > 0 && (
              <div className="col gap-xs mt-md" style={{ paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
                <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)', marginBottom: 4 }}>
                  Mai szetek
                </span>
                {exHistory.map((s, i) => {
                  const delta = ex.lastWeek ? s.weight - ex.lastWeek.weight : 0
                  const isPR = exerciseIdx === 0 && s.weight >= PR_DEMO_THRESHOLD_KG
                  return (
                    <div
                      key={i}
                      className="row"
                      style={{
                        padding: '8px 10px',
                        background: isPR ? BRAND_TINT_6 : 'var(--surface-2)',
                        borderLeft: '2px solid ' + (isPR ? 'var(--brand-glow)' : 'var(--border-strong)'),
                        alignItems: 'center',
                      }}
                    >
                      <span
                        className="label-mono"
                        style={{ fontSize: 9, color: isPR ? 'var(--brand-glow)' : 'var(--text-tertiary)', width: 38 }}
                      >
                        {isPR && '★ '}#{i + 1}
                      </span>
                      <span
                        style={{
                          fontFamily: 'var(--ff-display)',
                          fontSize: 15,
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {s.weight}
                        <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 2 }}>
                          kg
                        </span>
                      </span>
                      <span
                        style={{ fontFamily: 'var(--ff-display)', fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: '0 10px' }}
                      >
                        ×
                      </span>
                      <span style={{ fontFamily: 'var(--ff-display)', fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {s.reps}
                      </span>
                      <span style={{ flex: 1 }} />
                      <span className="chip" style={{ fontSize: 9, padding: '2px 6px' }}>RIR {s.rir}</span>
                      {delta !== 0 && (
                        <span
                          className="label-mono"
                          style={{ fontSize: 9, color: delta > 0 ? 'var(--brand-glow)' : 'var(--text-tertiary)', marginLeft: 8 }}
                        >
                          {delta > 0 ? '+' : ''}
                          {delta}kg
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Compact logging panel */}
        <div style={{ padding: '12px 24px 0' }}>
          <div className="card notch-8" style={{ padding: 10 }}>
            <div className="row gap-sm">
              <CompactStepper label="kg" value={weight} step={2.5} onChange={setWeight} primary min={0} max={999} />
              <CompactStepper label="reps" value={reps} step={1} onChange={setReps} integer min={1} max={100} />
            </div>

            {/* RIR + Side row */}
            <div className="row gap-sm" style={{ marginTop: 8, alignItems: 'stretch' }}>
              <div className="flex-1" style={{ background: 'var(--surface-2)', padding: '5px 8px' }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span className="label-mono" style={{ fontSize: 8 }}>RIR</span>
                  <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 9, color: 'var(--text-tertiary)' }}>
                    reps in reserve
                  </span>
                </div>
                <div className="row gap-xs">
                  {[0, 1, 2, 3].map((n) => (
                    <button
                      key={n}
                      type="button"
                      aria-pressed={rir === n}
                      aria-label={`RIR ${n}`}
                      onClick={() => setRir(n)}
                      style={{
                        flex: 1,
                        padding: '6px 0',
                        background: rir === n ? BRAND_TINT_12 : 'var(--surface-1)',
                        border: '1px solid ' + (rir === n ? 'var(--brand-glow)' : 'var(--border-subtle)'),
                        color: rir === n ? 'var(--brand-glow)' : 'var(--text-secondary)',
                        fontFamily: 'var(--ff-display)',
                        fontSize: 14,
                        fontWeight: 600,
                        clipPath: 'polygon(2px 0, 100% 0, 100% calc(100% - 2px), calc(100% - 2px) 100%, 0 100%, 0 2px)',
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              {ex.type === 'isolation' && (
                <div style={{ background: 'var(--surface-2)', padding: '5px 8px', flexShrink: 0 }}>
                  <div className="label-mono" style={{ fontSize: 8, marginBottom: 4 }}>Side</div>
                  <div className="row gap-xs">
                    {(['L', 'B', 'R'] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        aria-pressed={side === s}
                        className={'chip' + (side === s ? ' brand' : '')}
                        style={{ fontSize: 9, padding: '5px 8px' }}
                        onClick={() => setSide(side === s ? null : s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tool row — Note is live (T2); 90s timer + Voice stay inert (Phase 3) */}
        <div style={{ padding: '8px 24px 0' }}>
          <div className="row gap-xs">
            <button type="button" className="chip flex-1" style={{ justifyContent: 'center', padding: '8px', fontSize: 9 }}>
              <Icon name="today" size={11} /> 90s
            </button>
            <button
              type="button"
              className={'chip flex-1' + (noteOpen ? ' brand' : '')}
              style={{ justifyContent: 'center', padding: '8px', fontSize: 9 }}
              onClick={() => setNoteOpen(!noteOpen)}
            >
              <Icon name="tool" size={11} /> Note
            </button>
            <button type="button" className="chip flex-1" style={{ justifyContent: 'center', padding: '8px', fontSize: 9 }}>
              <Icon name="mic" size={11} /> Voice
            </button>
          </div>
        </div>

        {/* Set note — sent with the next "Set kész", then cleared */}
        {noteOpen && (
          <div style={{ padding: '8px 24px 0' }}>
            <input
              aria-label="Szet megjegyzés"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Megjegyzés a következő szethez"
              style={{ width: '100%', fontSize: 13, padding: '10px 12px', background: 'var(--surface-2)' }}
            />
          </div>
        )}

        {/* CTA */}
        <div style={{ padding: '12px 24px 20px' }}>
          <button className="cta-primary notch-8" onClick={completeSet} style={{ padding: '14px 20px', fontSize: 15 }}>
            <Icon name="check" size={16} /> Set kész
          </button>
        </div>
      </div>
    </>
  )
}
