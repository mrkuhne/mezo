// ============================================================
// Mezo · ActiveWorkoutPage — full-screen active-workout mode
// (sibling route /train/session, NO sub-nav). Three-phase state machine:
//   prep    → niggle pre-flag · challenges · warmup · exercise list · CTA
//   active  → per-set logging (weight/reps/RIR), Múlt hét comparison,
//             set dots, today's set history, PR toast + feedback debrief
//   complete→ WorkoutComplete celebration / recap
// Every exit (Bezárás / back / Mentés) navigates back to /train.
// Ported from prototype train.jsx (the active-workout TrainSection).
// ============================================================
import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useTrain } from '@/data/hooks'
import { useLevelUp } from '@/features/progression/LevelUpProvider'
import type { LastWeekSet, LoggedWorkoutExercise, Mesocycle, WorkoutPlan } from '@/data/types'
import type { GymExerciseInput, SetLogRequest, WorkoutFeedbackInput, WorkoutInstanceResponse } from '@/data/train/trainApi'
import {
  type Session,
  addExtraSet,
  advance,
  completeSet as completeSetModel,
  currentExerciseId,
  effectiveSetCount,
  makeSession,
  prescribedAt,
  seedFromOpen,
  skipExercise as skipExerciseModel,
} from '@/features/train/logic/workoutState'
import { PageTitle } from '@/shared/ui/PageTitle'
import { ScreenSkeleton } from '@/shared/ui/ScreenSkeleton'
import { Chip } from '@/shared/ui/Chip'
import { Display } from '@/shared/ui/Display'
import { Icon } from '@/shared/ui/Icon'
import { CtaPrimary } from '@/shared/ui/Cta'
import { Sheet } from '@/shared/ui/Sheet'
import { CompactStepper } from '@/features/train/components/CompactStepper'
import { LastWeekStat } from '@/features/train/components/LastWeekStat'
import { PRToast, type PRState } from '@/features/train/components/PRToast'
import { FeedbackModal, type ExerciseFeedbackValues } from '@/features/train/sheets/FeedbackModal'
import { WorkoutComplete } from '@/features/train/components/WorkoutComplete'
import { ChallengesCarousel } from '@/features/train/components/ChallengesCarousel'
import { ExerciseActionSheet } from '@/features/train/sheets/ExerciseActionSheet'

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
export function ActiveWorkoutPage() {
  const { workout, activeMeso, todaySession, workoutPending, startWorkout, logSet, skipExercise, saveExerciseNote, saveWorkoutFeedback, finishWorkout, saveDayExercises } = useTrain()
  // A hard reload lands here with the queries still loading — redirecting now
  // would kill the resume flow (live-smoke catch). Show the generic skeleton
  // until loaded (was `return null` — mezo-f2z). `workoutPending` is already
  // `!mock`-gated (false in mock, synchronous seed), so no skeleton flashes in
  // mock mode (Playwright parity).
  if (workoutPending) return <ScreenSkeleton />
  // T0 clean slate: never render the session without a workout (and at least one exercise).
  if (!workout || workout.exercises.length === 0 || !activeMeso) return <Navigate to="/train" replace />
  return (
    <ActiveWorkoutSession
      workout={workout}
      activeMeso={activeMeso}
      todaySession={todaySession}
      startWorkout={startWorkout}
      logSet={logSet}
      skipExercise={skipExercise}
      saveExerciseNote={saveExerciseNote}
      saveWorkoutFeedback={saveWorkoutFeedback}
      finishWorkout={finishWorkout}
      saveDayExercises={saveDayExercises}
    />
  )
}

interface SessionProps {
  workout: WorkoutPlan
  activeMeso: Mesocycle
  todaySession: { templateSessionId: string; openWorkout: WorkoutInstanceResponse | null } | null
  startWorkout: (templateSessionId: string, opts?: { onSuccess?: (w: WorkoutInstanceResponse) => void }) => void
  logSet: (workoutId: string, set: SetLogRequest) => void
  skipExercise: (workoutId: string, exerciseId: string) => void
  saveExerciseNote: (exerciseId: string, note: string) => void
  saveWorkoutFeedback: (workoutId: string, items: WorkoutFeedbackInput[]) => void
  finishWorkout: (workoutId: string, opts?: { onSuccess?: (r?: WorkoutInstanceResponse) => void }) => void
  saveDayExercises: (mesoId: string, dayId: string, exercises: GymExerciseInput[]) => void
}

// First-ever workout has no last week (and no engine prescription): prefill from
// the exercise's rep target (bottom of the range) instead.
function prefill(e: LoggedWorkoutExercise): LastWeekSet {
  return e.lastWeek ?? { weight: 0, reps: e.repMin || 10, rir: e.targetRIR }
}

function ActiveWorkoutSession({
  workout, activeMeso, todaySession, startWorkout, logSet, skipExercise, saveExerciseNote, saveWorkoutFeedback, finishWorkout, saveDayExercises,
}: SessionProps) {
  const W = workout
  const navigate = useNavigate()
  const onExit = () => navigate('/train')

  const weekLabel = `Week ${activeMeso.currentWeek} · ${activeMeso.phaseCurve[activeMeso.currentWeek - 1]}`
  const niggleActive = !!W.niggleWarning

  const open = todaySession?.openWorkout ?? null
  // Seed once on mount — a mid-workout reload resumes straight into 'active'.
  // The exerciseId-keyed pure model owns the per-set bookkeeping (workoutState.ts).
  const [initialSession] = useState<Session>(() =>
    open ? seedFromOpen(W.exercises, { sets: open.sets }) : makeSession(W.exercises),
  )
  const initialPhase: Phase = open ? 'active' : 'prep'
  // The logging panel opens pre-filled with the current exercise's last-week
  // numbers (same source used to prefill exercises 1..N after each debrief).
  const resumeExercise = W.exercises.find((e) => e.id === currentExerciseId(initialSession)) ?? W.exercises[0]
  const startPrefill = prefill(resumeExercise)

  const [phase, setPhase] = useState<Phase>(initialPhase)
  const [session, setSession] = useState<Session>(initialSession)
  const [weight, setWeight] = useState(startPrefill.weight)
  const [reps, setReps] = useState(startPrefill.reps)
  const [rir, setRir] = useState(startPrefill.rir)
  const [workoutId, setWorkoutId] = useState<string | null>(open?.id ?? null)
  const [side, setSide] = useState<Side | null>(null)
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState('')
  const [showPR, setShowPR] = useState<PRState | null>(null)
  // Progression: a real max_strength level-up from the finish signal drives the
  // recap's "PR" framing (replaces the old 105 kg demo scan). Captured here so it
  // survives after the level-up overlay (showLevelUp's host) is dismissed.
  const [hadPrFromSignal, setHadPrFromSignal] = useState(false)
  const { showLevelUp } = useLevelUp()
  // The just-finished exercise pinned for the debrief modal (and the active card
  // it overlays): `currentExerciseId` jumps to the NEXT exercise the moment the
  // last set is logged, so we keep an explicit feedback target until it resolves.
  const [feedbackEx, setFeedbackEx] = useState<LoggedWorkoutExercise | null>(null)
  const [niggleConfirmed, setNiggleConfirmed] = useState(false)
  const [acceptedChallenges, setAcceptedChallenges] = useState<string[]>([])
  const [actionSheetOpen, setActionSheetOpen] = useState(false)
  // After "＋ Szett" we offer to persist the bumped set count to the template (F2).
  const [addSetPrompt, setAddSetPrompt] = useState<{ exerciseId: string } | null>(null)
  // F4 durable per-exercise note: the edit sheet's open flag + a per-exercise
  // local override so the pill updates instantly in BOTH modes (mock no-ops the
  // mutation; real refetches /today, but the override avoids a flash in between).
  const [noteEditOpen, setNoteEditOpen] = useState(false)
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({})

  // Auto-hide the PR toast (leak-safe: cleared on unmount / re-trigger).
  useEffect(() => {
    if (!showPR) return
    const t = setTimeout(() => setShowPR(null), PR_TOAST_MS)
    return () => clearTimeout(t)
  }, [showPR])

  // On-screen exercise: the pinned feedback target while debriefing, else the
  // model's derived current exercise. Drives the active card, dots, history & PR.
  const current = feedbackEx ?? W.exercises.find((e) => e.id === currentExerciseId(session)) ?? W.exercises[0]
  const currentIdx = W.exercises.findIndex((e) => e.id === current.id)
  // The engine's prescribed target for the current set (warmup then working, aligned
  // to setIdx). Null on a first-ever workout / no-engine day → the panel falls back
  // to lastWeek. Drives the pre-fill effect below, the kind chip and the set-dots.
  const curTarget = prescribedAt(session, current.id, session.setIdx)
  // Plyo / bodyweight sets carry no load: hide the kg stepper and log weightKg 0.
  const weightless = current.type === 'plyo' || (curTarget != null && curTarget.targetWeightKg == null)
  // Effective note for the on-screen exercise: a just-saved local override wins,
  // else the backend/mock note, else empty (drives the pill + the editor prefill).
  const effectiveNote = localNotes[current.id] ?? current.note ?? ''

  // Pre-fill the logging panel for the current set from the prescribed target
  // (weight/reps/RIR). Re-runs on every set advance and exercise change; with no
  // prescription it falls back to the lastWeek-based prefill so first-session /
  // no-engine days keep their prior behavior. This is the single prefill source —
  // the feedback/skip advance handlers no longer set the inputs by hand.
  useEffect(() => {
    const t = prescribedAt(session, current.id, session.setIdx)
    if (t) {
      setWeight(t.targetWeightKg ?? 0)
      setReps(t.targetReps)
      setRir(t.targetRIR ?? 0)
    } else {
      const p = prefill(current)
      setWeight(p.weight)
      setReps(p.reps)
      setRir(p.rir)
    }
    // Reset only on set-index / exercise transitions — NOT on extra-set or note changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.id, session.setIdx])
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
    const finishing = current // the exercise being logged right now
    const finishingIdx = W.exercises.findIndex((e) => e.id === finishing.id)
    const wasSetIdx = session.setIdx // pre-update cursor (for the PR trigger + persisted setIndex)
    const next = completeSetModel(session, { weight, reps, rir })
    setSession(next)
    if (workoutId) {
      logSet(workoutId, {
        exerciseId: finishing.id, setIndex: wasSetIdx,
        // Plyo / bodyweight sets carry no load.
        weightKg: weightless ? 0 : weight, reps, rir,
        kind: prescribedAt(session, finishing.id, wasSetIdx)?.kind ?? 'working',
        ...(side ? { side } : {}), ...(note.trim() ? { note: note.trim() } : {}),
      })
    }
    setNote('')

    // PR demo: only set 3 of the first exercise at/above the threshold counts,
    // and only when a last-week reference exists to compare against.
    const firstLastWeek = W.exercises[0].lastWeek
    if (finishingIdx === 0 && wasSetIdx === 2 && firstLastWeek && weight >= PR_DEMO_THRESHOLD_KG) {
      setShowPR({
        delta: (weight - firstLastWeek.weight).toFixed(1),
        prev: firstLastWeek.weight,
        prevReps: firstLastWeek.reps,
      })
    }

    // Last set of this exercise → pin it for the debrief sheet. Otherwise
    // completeSetModel already advanced the cursor for the same exercise.
    if (wasSetIdx + 1 >= effectiveSetCount(session, finishing.id)) {
      setFeedbackEx(finishing)
    }
  }

  // The save button of the debrief persists the RP values for the just-finished exercise.
  const saveFeedback = (vals: ExerciseFeedbackValues) => {
    if (workoutId && feedbackEx) saveWorkoutFeedback(workoutId, [{ exerciseId: feedbackEx.id, ...vals }])
  }

  // Finish the workout and present the gamified level-up. Real mode POSTs with the
  // instance id; mock has no instance (workoutId null) but the mock finish mutation
  // still returns a seeded LevelUpResult so the prototype shows the overlay. The
  // overlay (the global LevelUpProvider host) portals OVER the WorkoutComplete recap
  // and is dismissed on its Tovább CTA, revealing the recap. Switch-off / no-levelUp
  // (real `levelUp` absent) simply shows the recap with no overlay.
  const finishAndCelebrate = () => {
    finishWorkout(workoutId ?? 'mock', {
      onSuccess: (r) => {
        if (r?.levelUp) {
          setHadPrFromSignal(r.levelUp.levelUps.includes('max_strength'))
          showLevelUp(r.levelUp)
        }
      },
    })
  }

  // Feedback resolution (skip or save both advance). Prefill the next
  // exercise's logging panel from its last-week numbers, or finish.
  const advanceAfterFeedback = () => {
    setFeedbackEx(null)
    setSide(null)
    // All exercises resolved now? (the last set is already in `session`.)
    const allDone = W.exercises.every(
      (e) => session.skipped.includes(e.id) || (session.logged[e.id]?.length ?? 0) >= effectiveSetCount(session, e.id),
    )
    if (!allDone) {
      // The prefill effect (keyed on the derived current exercise) resets the
      // logging inputs once the advanced session re-renders.
      setSession(advance(session))
    } else {
      finishAndCelebrate()
      setPhase('complete')
    }
  }

  // Skip the current exercise (NO debrief): persist the skip marker, then either
  // finish (if it was the last unresolved exercise) or advance to the next one,
  // prefilling the logging panel from its targets. Mirrors advanceAfterFeedback.
  const handleSkip = () => {
    const exId = currentExerciseId(session)
    if (workoutId) skipExercise(workoutId, exId)
    const afterSkip = skipExerciseModel(session, exId)
    const allDone = W.exercises.every(
      (e) => afterSkip.skipped.includes(e.id) || (afterSkip.logged[e.id]?.length ?? 0) >= effectiveSetCount(afterSkip, e.id),
    )
    if (allDone) {
      finishAndCelebrate()
      setSession(afterSkip)
      setPhase('complete')
    } else {
      // The prefill effect resets the inputs from the next exercise's target.
      setSession(advance(afterSkip))
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
                      {e.sets} × {e.repMin}-{e.repMax}
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
    // WorkoutComplete is index-keyed (unchanged) — adapt the exerciseId-keyed
    // session into its `ex{i}` shape at the boundary.
    const completedByIdx: CompletedSets = Object.fromEntries(
      W.exercises.map((e, i) => ['ex' + i, session.logged[e.id] ?? []]),
    )
    // Real PR framing now comes from the progression signal (a max_strength
    // level-up) rather than the old 105 kg session scan; the mid-workout PR
    // toast (showPR) is unchanged.
    const hadPR = !!showPR || hadPrFromSignal
    return (
      <WorkoutComplete workout={W} completedSets={completedByIdx} hadPR={hadPR} onExit={onExit} skippedExerciseIds={session.skipped} />
    )
  }

  // ---------- ACTIVE ----------
  const totalSets = W.exercises.reduce((a, e) => a + effectiveSetCount(session, e.id), 0)
  const doneSets = Object.values(session.logged).reduce((a, arr) => a + arr.length, 0)
  const activeChallenge = W.challenges.find((c) => c.exerciseId === current.id && acceptedMap[c.id])
  const exHistory = session.logged[current.id] ?? []
  const currentSetCount = effectiveSetCount(session, current.id)
  const plannedCount = session.planned[current.id] ?? currentSetCount

  // Reorderable segment for the ⋯ action sheet: the done + current exercises
  // stay FIXED; only the FUTURE exercises (after the current one in session.order)
  // can be reordered. Reorder is client-only / ephemeral — it just replaces
  // session.order, never persists.
  const remaining = (() => {
    const currentId = currentExerciseId(session)
    const ci = session.order.indexOf(currentId)
    return session.order.slice(ci + 1).map((id) => {
      const e = W.exercises.find((x) => x.id === id)!
      return { id, label: e.name }
    })
  })()
  const handleReorder = (newRemaining: string[]) =>
    setSession((s) => {
      // Recompute fixed segment from the latest session to avoid a stale closure.
      const ci = s.order.indexOf(currentExerciseId(s))
      const fixed = s.order.slice(0, ci + 1)
      return { ...s, order: [...fixed, ...newRemaining] }
    })

  // F2 "Minden hétre": persist the extra set to the TEMPLATE by bumping this
  // exercise's set count in its meso day and reusing the day-exercises PUT. The
  // day is the one whose exercise list contains the current exercise (by id).
  const writeExtraSetToTemplate = (exerciseId: string) => {
    const day = activeMeso.days?.find((d) => d.exercises?.some((e) => e.id === exerciseId))
    if (!day?.id) return
    const exercises: GymExerciseInput[] = day.exercises.map((e) => ({
      name: e.name,
      muscle: e.muscle,
      warmupSets: e.warmupSets,
      // The extra set is a working set — bump the working count for this exercise only.
      workingSets: e.id === exerciseId ? e.workingSets + 1 : e.workingSets,
      repMin: e.repMin,
      repMax: e.repMax,
      targetRIR: e.targetRIR,
      type: e.type,
      ...(e.anchorWeightKg != null ? { anchorWeightKg: e.anchorWeightKg } : {}),
      ...(e.warning ? { warning: e.warning } : {}),
      ...(e.catalogId ? { catalogId: e.catalogId } : {}),
    }))
    saveDayExercises(activeMeso.id, day.id, exercises)
  }

  return (
    <>
      {showPR && <PRToast pr={showPR} />}
      {feedbackEx && (
        <FeedbackModal
          ex={feedbackEx}
          isLastExercise={W.exercises.findIndex((e) => e.id === feedbackEx.id) + 1 >= W.exercises.length}
          onResolve={advanceAfterFeedback}
          onSave={saveFeedback}
        />
      )}
      {actionSheetOpen && !feedbackEx && (
        <ExerciseActionSheet
          exerciseName={current.name}
          remaining={remaining}
          onReorder={handleReorder}
          onSkip={handleSkip}
          onAddSet={() => {
            const id = currentExerciseId(session)
            setSession((s) => addExtraSet(s, currentExerciseId(s)))
            setAddSetPrompt({ exerciseId: id })
          }}
          onEditNote={() => setNoteEditOpen(true)}
          hasNote={!!effectiveNote}
          onClose={() => setActionSheetOpen(false)}
        />
      )}
      {noteEditOpen && (
        <NoteEditSheet
          initialNote={effectiveNote}
          onClose={() => setNoteEditOpen(false)}
          onSave={(text) => {
            saveExerciseNote(current.id, text)
            setLocalNotes((prev) => ({ ...prev, [current.id]: text }))
          }}
        />
      )}
      {addSetPrompt && (
        <Sheet onClose={() => setAddSetPrompt(null)} labelledBy="add-set-prompt-title" className="sheet-nested">
          {(close) => (
            <div style={{ padding: '4px 2px 2px' }}>
              <span className="eyebrow brand">Extra szett hozzáadva</span>
              <h3
                id="add-set-prompt-title"
                style={{ fontFamily: 'var(--ff-display)', fontSize: 20, fontWeight: 600, marginTop: 8, color: 'var(--text-primary)' }}
              >
                A tervbe is felvegyük?
              </h3>
              <p style={{ fontSize: 13, marginTop: 8, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
                Csak erre az alkalomra szól, vagy minden hétre — ilyenkor a mesociklus terve is eggyel több szettet ír elő ennél a gyakorlatnál.
              </p>
              <div className="col gap-sm" style={{ marginTop: 16 }}>
                <button
                  type="button"
                  className="cta-primary notch-8"
                  style={{ padding: '12px 18px', fontSize: 14 }}
                  onClick={() => {
                    writeExtraSetToTemplate(addSetPrompt.exerciseId)
                    close()
                  }}
                >
                  Minden hétre
                </button>
                <button
                  type="button"
                  className="cta-ghost notch-4"
                  style={{ padding: 12, fontSize: 13 }}
                  onClick={close}
                >
                  Csak ma
                </button>
              </div>
            </div>
          )}
        </Sheet>
      )}

      <div>
        {/* Header — pinned below the status bar so progress stays visible (mezo-wdk) */}
        <div className="sticky-top" style={{ padding: '8px 24px 10px' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <button onClick={onExit} className="row gap-sm">
              <Icon name="x" size={16} color="var(--text-secondary)" />
              <span className="eyebrow">Bezárás</span>
            </button>
            <div className="row gap-sm" style={{ alignItems: 'center' }}>
              <span className="label-mono">
                {currentIdx + 1}/{W.exercises.length} · {doneSets}/{totalSets} szet
              </span>
              <button
                type="button"
                aria-label="Gyakorlat műveletek"
                disabled={!!feedbackEx}
                onClick={() => setActionSheetOpen(true)}
                className="chip notch-4"
                style={{ padding: '6px 10px', fontSize: 14, lineHeight: 1 }}
              >
                ⋯
              </button>
            </div>
          </div>
          <div className="bar mt-sm">
            <div className="bar-fill glow" style={{ width: (doneSets / totalSets) * 100 + '%' }} />
          </div>
        </div>

        {/* Niggle banner if active */}
        {niggleActive && currentIdx <= 1 && (
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
              ⚠ Jobb váll aktív · {currentIdx === 1 ? 'pronated grif' : 'óvatos, először warm-up'}
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
                {current.type === 'compound' ? 'Compound' : 'Isolation'} · Set {session.setIdx + 1}/{currentSetCount}
              </span>
              <span className="chip brand" style={{ fontSize: 9, padding: '3px 8px' }}>
                {curTarget?.kind === 'warmup' ? 'Bemelegítő' : `Cél · ${current.repMin}-${current.repMax} @ RIR ${current.targetRIR}`}
              </span>
            </div>
            <div style={{ marginTop: 10 }}>
              <Display size="lg">{current.name}</Display>
            </div>

            {/* Durable per-exercise note pill (F4) — always visible while a note exists */}
            {effectiveNote && (
              <div
                aria-label="Gyakorlat-jegyzet"
                className="exercise-note-pill row gap-sm mt-sm"
                style={{
                  alignItems: 'center',
                  padding: '6px 10px',
                  background: 'var(--surface-2)',
                  borderLeft: '2px solid var(--brand-glow)',
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.4,
                }}
              >
                <Icon name="tool" size={11} color="var(--brand-glow)" />
                <span style={{ flex: 1 }}>{effectiveNote}</span>
              </div>
            )}

            {/* Múlt hét — hero comparison block (only with a previous completed instance) */}
            {current.lastWeek && (
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
                  <LastWeekStat label="Súly" val={current.lastWeek.weight} unit="kg" />
                  <div style={{ width: 1, height: 32, background: 'var(--border-subtle)' }} />
                  <LastWeekStat label="Reps" val={'× ' + current.lastWeek.reps} />
                  <div style={{ width: 1, height: 32, background: 'var(--border-subtle)' }} />
                  <LastWeekStat label="RIR" val={current.lastWeek.rir} />
                </div>
              </div>
            )}

            {/* Engine rationale — rendered whenever the engine returns one, INDEPENDENT
                of lastWeek: a first-ever workout (no lastWeek) still surfaces its
                rationale (e.g. "Kezdő súly (anchor)" / "Első alkalom — add meg a súlyt"). */}
            {current.rationale && (
              <div className="row mt-lg gap-sm" style={{ alignItems: 'center' }}>
                <Icon name="sparkle" size={11} color="var(--brand-glow)" />
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  {current.rationale}
                </span>
              </div>
            )}

            {/* Set dots */}
            <div className="row mt-lg" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="set-dots">
                {Array.from({ length: currentSetCount }, (_, i) => {
                  const isExtra = i >= plannedCount
                  const isWarm = prescribedAt(session, current.id, i)?.kind === 'warmup'
                  return (
                    <div
                      key={i}
                      className={'set-dot' + (i < session.setIdx ? ' done' : i === session.setIdx ? ' active' : '')
                        + (isExtra ? ' extra' : '') + (isWarm ? ' warm' : '')}
                    />
                  )
                })}
              </div>
              <span className="label-mono" style={{ fontSize: 10 }}>
                {session.setIdx}/{currentSetCount} done
              </span>
            </div>

            {/* Completed sets history */}
            {exHistory.length > 0 && (
              <div className="col gap-xs mt-md" style={{ paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
                <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)', marginBottom: 4 }}>
                  Mai szetek
                </span>
                {exHistory.map((s, i) => {
                  const delta = current.lastWeek ? s.weight - current.lastWeek.weight : 0
                  const isPR = currentIdx === 0 && s.weight >= PR_DEMO_THRESHOLD_KG
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
              {/* Plyo / bodyweight → reps-only (no load to log). */}
              {!weightless && (
                <CompactStepper label="kg" value={weight} step={2.5} onChange={setWeight} primary min={0} max={999} />
              )}
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
              {current.type === 'isolation' && (
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

// F4 durable per-exercise note editor — a nested sheet (mirrors the add-set
// prompt). Prefilled with the effective note; "Mentés" persists + closes,
// "Mégse"/backdrop dismiss without saving. maxLength matches the contract (500).
function NoteEditSheet({
  initialNote,
  onSave,
  onClose,
}: {
  initialNote: string
  onSave: (note: string) => void
  onClose: () => void
}) {
  const [text, setText] = useState(initialNote)
  return (
    <Sheet onClose={onClose} labelledBy="note-edit-title" className="sheet-nested">
      {(close) => (
        <div style={{ padding: '4px 2px 2px' }}>
          <span className="eyebrow brand">Gyakorlat-jegyzet</span>
          <h3
            id="note-edit-title"
            style={{ fontFamily: 'var(--ff-display)', fontSize: 20, fontWeight: 600, marginTop: 8, color: 'var(--text-primary)' }}
          >
            Jegyzet a gyakorlathoz
          </h3>
          <textarea
            aria-label="Gyakorlat-jegyzet szerkesztése"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={500}
            rows={4}
            placeholder="Forma-emlékeztető, beállítás, fájdalom-jelzés…"
            style={{
              width: '100%',
              marginTop: 14,
              fontSize: 13,
              padding: '10px 12px',
              background: 'var(--surface-2)',
              lineHeight: 1.5,
              resize: 'none',
            }}
          />
          <div className="col gap-sm" style={{ marginTop: 16 }}>
            <button
              type="button"
              className="cta-primary notch-8"
              style={{ padding: '12px 18px', fontSize: 14 }}
              onClick={() => {
                onSave(text.trim())
                close()
              }}
            >
              Mentés
            </button>
            <button type="button" className="cta-ghost notch-4" style={{ padding: 12, fontSize: 13 }} onClick={close}>
              Mégse
            </button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
