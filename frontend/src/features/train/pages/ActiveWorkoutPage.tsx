// ============================================================
// Mezo · ActiveWorkoutPage — full-screen active-workout mode
// (sibling route /train/session, NO sub-nav). Four-phase state machine:
//   prep    → niggle pre-flag · challenges · warmup · exercise list · CTA
//   active  → per-set logging (weight/reps/RIR), Múlt hét comparison,
//             set dots, today's set history, PR toast + feedback debrief
//   summary → explicit-finish WorkoutSummary (closing): stats + challenge
//             outcomes + recap; "Edzés lezárása ✓" is the ONLY finish trigger
//   complete→ the same WorkoutSummary read-only (post-finish, set lines)
// Every exit (Bezárás / back / Mentés) navigates back to /train.
// Ported from prototype train.jsx (the active-workout TrainSection).
// ============================================================
import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useChallengeActions, useChallenges, useTrain } from '@/data/hooks'
import { localDateString } from '@/shared/lib/dates'
import { useLevelUp } from '@/features/progression/LevelUpProvider'
import { useLiveActivity } from '@/app/providers/LiveActivityProvider'
import { restSecondsFor } from '@/features/train/logic/restTimer'
import type { LastWeekSet, LoggedWorkoutExercise, Mesocycle, WorkoutPlan } from '@/data/types'
import type { GymExerciseInput, SetLogRequest, WorkoutFeedbackInput, WorkoutInstanceResponse } from '@/data/train/trainApi'
import {
  type Session,
  addExtraSet,
  completeSet as completeSetModel,
  currentExerciseId,
  effectiveSetCount,
  makeSession,
  mergePlan,
  nextSetIdx,
  nextUnfinishedAfter,
  prescribedAt,
  seedFromOpen,
  skipExercise as skipExerciseModel,
} from '@/features/train/logic/workoutState'
import { PageTitle } from '@/shared/ui/PageTitle'
import { ScreenSkeleton } from '@/shared/ui/ScreenSkeleton'
import { Chip } from '@/shared/ui/Chip'
import { Icon } from '@/shared/ui/Icon'
import { Sheet } from '@/shared/ui/Sheet'
import { SetStepper } from '@/features/train/components/SetStepper'
import { VideoDemo, youTubeId } from '@/features/train/components/VideoDemo'
import { PRToast, type PRState } from '@/features/train/components/PRToast'
import { FeedbackModal, type ExerciseFeedbackValues } from '@/features/train/sheets/FeedbackModal'
import { WorkoutSummary, type SummaryChallenge, type SummaryExercise } from '@/features/train/components/WorkoutSummary'
import { evaluateChallenge } from '@/features/train/logic/challengeOutcome'
import { ChallengesCarousel } from '@/features/train/components/ChallengesCarousel'
import { ExerciseActionSheet } from '@/features/train/sheets/ExerciseActionSheet'
import { ExerciseOverviewSheet, type OverviewExercise } from '@/features/train/sheets/ExerciseOverviewSheet'

type Phase = 'prep' | 'active' | 'summary' | 'complete'
type Side = 'L' | 'B' | 'R'

const WARMUP_ROWS = [
  { label: 'Dinamikus stretching', time: '3 perc' },
  { label: 'Cardio-lite · evezőpad', time: '3 perc' },
  { label: 'Aktiváció · band pull-apart × 20', time: '2 perc' },
] as const

const AMBER_TINT_6 = 'color-mix(in srgb, var(--warning) 6%, transparent)'
const AMBER_BORDER = 'color-mix(in srgb, var(--warning) 30%, transparent)'
const CORAL_TINT_4 = 'color-mix(in srgb, var(--coral) 4%, transparent)'

// PR demo (prototype-scripted moment): the 3rd set of exercise 0 at/above this
// weight triggers the Personal Record toast, which auto-hides after PR_TOAST_MS.
const PR_DEMO_THRESHOLD_KG = 105
const PR_TOAST_MS = 4500

// Guard wrapper: the session screen's hooks (useState×N) are initialized from
// workout data, so the null case must redirect BEFORE the inner component mounts
// — a conditional early return between hook calls would break the hook order
// now that `workout` is query-driven (T2).
export function ActiveWorkoutPage() {
  const { workout, activeMeso, todaySession, completedTodayWorkout, workoutPending, startWorkout, logSet, skipExercise, saveExerciseNote, saveWorkoutFeedback, finishWorkout, saveDayExercises } = useTrain()
  // A hard reload lands here with the queries still loading — redirecting now
  // would kill the resume flow (live-smoke catch). Show the generic skeleton
  // until loaded (was `return null` — mezo-f2z). `workoutPending` is already
  // `!mock`-gated (false in mock, synchronous seed), so no skeleton flashes in
  // mock mode.
  if (workoutPending) return <ScreenSkeleton />
  // T0 clean slate: never render the session without a workout (and at least one exercise).
  if (!workout || workout.exercises.length === 0 || !activeMeso) return <Navigate to="/train" replace />
  // Completed today + nothing open → the session is over; review instead of restart
  // (spec 2026-07-15 gating — the prep screen must be unreachable, challenges included).
  // Mock mode has no completedTodayWorkout (always null), so this never fires there.
  if (completedTodayWorkout && !todaySession?.openWorkout) {
    return <Navigate to={`/train/review/${completedTodayWorkout.id}`} replace />
  }
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
  finishWorkout: (workoutId: string, opts?: { onSuccess?: (r?: WorkoutInstanceResponse) => void; onSettled?: () => void }) => void
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
  const qc = useQueryClient()
  const { startRest, clearRest } = useLiveActivity()
  // Exiting the session (Bezárás / back / Mentés — all route through here) must not
  // leave a rest ticking in the shell's Dynamic Island after the user has left.
  const onExit = () => {
    clearRest()
    navigate('/train')
  }

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
  // Free navigation (spec 2026-07-15): the VIEWED exercise is the logging target.
  // Seeds from the linear resume point; Task 7's nav UI drives setViewedId.
  const [viewedId, setViewedId] = useState<string>(() => currentExerciseId(initialSession))
  const [weight, setWeight] = useState(startPrefill.weight)
  const [reps, setReps] = useState(startPrefill.reps)
  const [rir, setRir] = useState(startPrefill.rir)
  const [workoutId, setWorkoutId] = useState<string | null>(open?.id ?? null)
  const [side, setSide] = useState<Side | null>(null)
  // Transient per-SET note (SetLogRequest.note, max 500 chars) — distinct from the
  // durable per-EXERCISE note (effectiveNote/localNotes above). Cleared after each log.
  const [note, setNote] = useState('')
  const [showPR, setShowPR] = useState<PRState | null>(null)
  // Progression: a real max_strength level-up from the finish signal drives the
  // recap's "PR" framing (replaces the old 105 kg demo scan). Captured here so it
  // survives after the level-up overlay (showLevelUp's host) is dismissed.
  const [hadPrFromSignal, setHadPrFromSignal] = useState(false)
  // The explicit-finish POST is in flight — disables the "Edzés lezárása ✓" CTA.
  const [finishPending, setFinishPending] = useState(false)
  const { showLevelUp } = useLevelUp()
  // The just-finished exercise pinned for the debrief modal (and the active card
  // it overlays): once resolved, the view advances to the next exercise, so we keep
  // an explicit feedback target that overrides `viewedId` until the debrief closes.
  const [feedbackEx, setFeedbackEx] = useState<LoggedWorkoutExercise | null>(null)
  const [niggleConfirmed, setNiggleConfirmed] = useState(false)
  const [acceptedChallenges, setAcceptedChallenges] = useState<string[]>([])
  const [actionSheetOpen, setActionSheetOpen] = useState(false)
  // Free navigation (spec 2026-07-15): the header counter opens a jump-to overview.
  const [overviewOpen, setOverviewOpen] = useState(false)
  // Swipe on the excard: a large horizontal drag jumps to the neighbour exercise.
  const swipeStart = useRef<number | null>(null)
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

  // The rest Live-Activity must not survive past this session: clear it once the
  // summary/recap phase is reached, and on unmount (mid-workout navigation away,
  // e.g. a deep-link change) as a final safety net.
  useEffect(() => {
    if (phase === 'complete' || phase === 'summary') clearRest()
  }, [phase, clearRest])
  useEffect(() => () => clearRest(), [clearRest])

  // Plan growth mid-session (mezo-ohvm): the server-side closing block can append
  // template exercises while this session is already open — a refetch then grows
  // W.exercises. Fold the new exercises into the model so the cursor VISITS them
  // instead of counting them as done (an id missing from session.planned reads as
  // 0 planned sets). mergePlan is identity-stable, so re-renders don't loop.
  useEffect(() => {
    setSession((s) => mergePlan(s, W.exercises))
  }, [W.exercises])

  // On-screen exercise: the pinned feedback target while debriefing, else the FREELY
  // NAVIGATED viewed exercise (the logging target — spec 2026-07-15 free navigation).
  const current = feedbackEx ?? W.exercises.find((e) => e.id === viewedId) ?? W.exercises[0]
  const currentIdx = W.exercises.findIndex((e) => e.id === current.id)
  // Free navigation jump (pager / dots / swipe / overview): moves the VIEWED (logging)
  // exercise. No-ops while a debrief is open — the pinned feedback target wins then.
  const jumpTo = (id: string | undefined | null) => { if (id && !feedbackEx) setViewedId(id) }
  // Per-exercise cursor: the next set index to log for the on-screen exercise
  // (derived from its logged count — replaces the old scalar session.setIdx).
  const cursor = nextSetIdx(session, current.id)
  // Only genuinely load-less exercises (plyo) hide the kg stepper. A null target
  // weight ALSO happens on a first-ever workout (no history, no anchor) — there the
  // user must still enter a starting weight, so we must NOT hide the stepper then.
  const weightless = current.type === 'plyo'
  // Warmups come first in the prescribed list; used to label rows (B1.. vs working 1..).
  const warmupCount = (session.prescribed[current.id] ?? []).filter((p) => p.kind === 'warmup').length
  // The current set's prescription drives the card's kind tag + the RIR row: a warmup
  // set is signalled explicitly and logs NO RIR (effort tracking is working-set-only).
  const currentTarget = prescribedAt(session, current.id, cursor)
  const isWarmupSet = currentTarget?.kind === 'warmup'
  // Effective note for the on-screen exercise: a just-saved local override wins,
  // else the backend/mock note, else empty (drives the pill + the editor prefill).
  const effectiveNote = localNotes[current.id] ?? current.note ?? ''

  // Pre-fill the logging panel for the current set. Weight inherits within the
  // exercise (mezo-eerq): a null engine target (first session, no anchor) or a
  // mid-session deviation must never reset a hand-entered load — the previous
  // logged set wins over a static working target, and only the warmup ramp
  // (per-set distinct targets) overrides inheritance. With no prescription at all
  // it falls back to the lastWeek-based prefill. This is the single prefill
  // source — the feedback/skip advance handlers no longer set the inputs by hand.
  useEffect(() => {
    const t = prescribedAt(session, current.id, cursor)
    const prev = (session.logged[current.id] ?? [])[cursor - 1]
    const p = prefill(current)
    if (t?.kind === 'warmup') {
      // Warmups follow the engine ramp; a null target inherits the previous
      // warmup's hand-entered weight instead of resetting to 0.
      setWeight(t.targetWeightKg ?? prev?.weight ?? p.weight)
      setReps(t.targetReps)
      setRir(t.targetRIR ?? 0)
    } else {
      // Working sets: the just-logged WORKING set (never a warmup) wins over the
      // static engine target; the engine seeds only the first working set.
      const prevWorking = cursor > warmupCount ? prev : undefined
      setWeight(prevWorking?.weight ?? t?.targetWeightKg ?? prev?.weight ?? p.weight)
      setReps(t?.targetReps ?? prevWorking?.reps ?? p.reps)
      setRir(t?.targetRIR ?? prevWorking?.rir ?? p.rir)
    }
    // Reset only on set-index / exercise transitions — NOT on extra-set or note changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.id, cursor])
  // Challenges: unified across modes — the hook returns the Phase-1 seed in mock
  // and the live session/day list (or honest []) in real. Accept/dismiss is a
  // local toggle in mock (byte-parity with Phase-1) and a persisted L2 decision
  // in live (status-derived accepted map + decide()).
  const localToday = localDateString()
  const templateSessionId = todaySession?.templateSessionId ?? null
  const { challenges, mode: challengeMode } = useChallenges(templateSessionId, localToday)
  const { decide } = useChallengeActions(templateSessionId, localToday)
  const isMock = challengeMode === 'mock'

  const acceptedMap: Record<string, boolean> = isMock
    ? Object.fromEntries(acceptedChallenges.map((id) => [id, true]))
    : Object.fromEntries(
        challenges.map((c) => [
          c.id,
          c.status === 'accepted' || c.status === 'hit' || c.status === 'miss',
        ]),
      )
  const toggleChallenge = (id: string) => {
    if (isMock) {
      setAcceptedChallenges((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
      )
    } else {
      decide(id, acceptedMap[id] ? 'dismiss' : 'accept')
    }
  }

  // Summary rows (used by both the closing 'summary' and read-only 'complete' phases).
  const summaryExercises: SummaryExercise[] = W.exercises.map((e) => ({
    id: e.id,
    name: e.name,
    plannedSets: effectiveSetCount(session, e.id),
    sets: session.logged[e.id] ?? [],
    skipped: session.skipped.includes(e.id),
  }))
  // Challenge rows: dismissed/undecided -> skippelted; accepted -> live server outcome when
  // resolved, else the FE preview over the session's logged sets (pre-finish).
  const summaryChallenges: SummaryChallenge[] = challenges.map((c) => {
    const accepted = acceptedMap[c.id]
    const resolved = c.status === 'hit' || c.status === 'miss' || c.status === 'inconclusive'
    const state = !accepted && !resolved
      ? 'skipped' as const
      : resolved
        ? (c.status as 'hit' | 'miss' | 'inconclusive')
        : evaluateChallenge(c, session.logged[c.exerciseId] ?? [])
    return { id: c.id, typeLabel: c.typeLabel, exercise: c.exercise, target: c.target, state, detail: c.outcome ?? undefined }
  })

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
    const wasSetIdx = nextSetIdx(session, finishing.id) // pre-update cursor (for the PR trigger + persisted setIndex)
    const next = completeSetModel(session, finishing.id, { weight, reps, rir })
    setSession(next)
    if (workoutId) {
      const kind = prescribedAt(session, finishing.id, wasSetIdx)?.kind ?? 'working'
      logSet(workoutId, {
        exerciseId: finishing.id, setIndex: wasSetIdx,
        // Plyo / bodyweight sets carry no load.
        weightKg: weightless ? 0 : weight, reps,
        // Warmup sets log no RIR — effort tracking applies to working sets only.
        ...(kind === 'warmup' ? {} : { rir }),
        kind,
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
    // completeSetModel already advanced the cursor for the same exercise, and the
    // island rest starts (spec §4.5): "next" is the current exercise's name when
    // more of its sets remain, else the upcoming exercise's (or null on the last).
    if (wasSetIdx + 1 >= effectiveSetCount(session, finishing.id)) {
      setFeedbackEx(finishing)
    } else {
      startRest({
        seconds: restSecondsFor(current.type),
        next: wasSetIdx + 1 < currentSetCount ? current.name : (nextEx?.name ?? null),
      })
    }
  }

  // The save button of the debrief persists the RP values for the just-finished exercise.
  const saveFeedback = (vals: ExerciseFeedbackValues) => {
    if (workoutId && feedbackEx) saveWorkoutFeedback(workoutId, [{ exerciseId: feedbackEx.id, ...vals }])
  }

  // Finish the workout (the ONLY completion trigger — the summary's "Edzés lezárása ✓"
  // CTA) and present the gamified level-up. Real mode POSTs with the instance id; mock
  // has no instance (workoutId null → 'mock' sentinel) but the mock finish mutation
  // still returns a seeded LevelUpResult so the prototype shows the overlay. The overlay
  // (the global LevelUpProvider host) portals OVER the closed summary and is dismissed on
  // its Tovább CTA, revealing it. Switch-off / no-levelUp (real `levelUp` absent) simply
  // flips to the closed summary with no overlay. On success the server re-evaluates the
  // challenges lazily on the next list read, so we invalidate them (real only).
  const finishAndCelebrate = () => {
    setFinishPending(true)
    finishWorkout(workoutId ?? 'mock', {
      onSuccess: (r) => {
        if (r?.levelUp) {
          setHadPrFromSignal(r.levelUp.levelUps.includes('max_strength'))
          showLevelUp(r.levelUp)
        }
        if (!isMock) qc.invalidateQueries({ queryKey: ['challenges', templateSessionId, localToday] })
        setPhase('complete')
      },
      // Reset the pending flag on BOTH success and failure — a failed finish POST must
      // re-enable the "Edzés lezárása ✓" CTA so it can be retried (never stuck disabled).
      onSettled: () => setFinishPending(false),
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
      // Free navigation: point the viewed exercise at the next unfinished one after
      // the just-debriefed exercise (wraps around). The prefill effect (keyed on
      // current.id + cursor) resets the logging inputs once the view moves.
      const nextId = feedbackEx ? nextUnfinishedAfter(session, feedbackEx.id) : nextUnfinishedAfter(session, current.id)
      if (nextId) setViewedId(nextId)
    } else {
      // Explicit finish (spec 2026-07-15): land on the summary; finishing is now the
      // user's "Edzés lezárása ✓" tap, not an implicit side effect of the last debrief.
      setPhase('summary')
    }
  }

  // Skip the current exercise (NO debrief): persist the skip marker, then either
  // finish (if it was the last unresolved exercise) or advance to the next one,
  // prefilling the logging panel from its targets. Mirrors advanceAfterFeedback.
  const handleSkip = () => {
    // Abandoning the current exercise must not leave the island counting down
    // toward it (final-review fix, mezo-8141 — Ride-along A).
    clearRest()
    const exId = current.id // skip the VIEWED exercise (free navigation)
    if (workoutId) skipExercise(workoutId, exId)
    const afterSkip = skipExerciseModel(session, exId)
    const allDone = W.exercises.every(
      (e) => afterSkip.skipped.includes(e.id) || (afterSkip.logged[e.id]?.length ?? 0) >= effectiveSetCount(afterSkip, e.id),
    )
    if (allDone) {
      // Skipping the last unresolved exercise ends the workout — land on the summary
      // (explicit finish); the "Edzés lezárása ✓" CTA there drives finishWorkout.
      setSession(afterSkip)
      setPhase('summary')
    } else {
      // Move the view to the next unfinished exercise; the prefill effect resets
      // the inputs from its target once the view moves.
      const nextId = nextUnfinishedAfter(afterSkip, exId)
      setSession(afterSkip)
      if (nextId) setViewedId(nextId)
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
          challenges={challenges}
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
              <div
                key={i}
                className="row"
                style={{
                  padding: '10px 14px',
                  alignItems: 'center',
                  background: 'var(--surface)',
                  borderRadius: 20,
                  boxShadow: 'var(--np-shadow-row)',
                }}
              >
                <span
                  className="label-mono"
                  style={{ fontSize: 9, color: 'var(--coral-deep)', marginRight: 12 }}
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
              const exChallenge = challenges.find(
                (c) => c.exerciseId === e.id && acceptedMap[c.id],
              )
              return (
                <div
                  key={i}
                  style={{
                    padding: 12,
                    borderRadius: 20,
                    boxShadow: 'var(--np-shadow-row)',
                    background: exChallenge ? CORAL_TINT_4 : 'var(--surface)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {exChallenge && (
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: 'var(--coral)' }} />
                  )}
                  <div
                    className="row"
                    style={{ justifyContent: 'space-between', alignItems: 'flex-start', paddingLeft: exChallenge ? 6 : 0 }}
                  >
                    <div className="col flex-1">
                      <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{e.name}</span>
                      {exChallenge && (
                        <div className="row gap-sm mt-xs" style={{ alignItems: 'center' }}>
                          <Icon name="sparkle" size={10} color="var(--coral)" />
                          <span className="label-mono" style={{ fontSize: 9, color: 'var(--coral-deep)' }}>
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
          <button type="button" className="np-cta np-press" onClick={beginWorkout}>
            <span>Kezdjük el</span>
            <span style={{ opacity: 0.5, fontWeight: 400 }}>·</span>
            <span>{W.title}</span>
          </button>
        </div>
      </div>
    )
  }

  // ---------- SUMMARY (closing) / COMPLETE (closed) ----------
  // Both render the WorkoutSummary: 'summary' is the pre-finish closing screen whose
  // "Edzés lezárása ✓" CTA drives finishWorkout; 'complete' is the same layout read-only
  // (set lines) after the finish POST resolves. Real PR framing comes from the progression
  // signal (a max_strength level-up); the mid-workout PR toast (showPR) is unchanged.
  if (phase === 'summary' || phase === 'complete') {
    const closing = phase === 'summary'
    return (
      <WorkoutSummary
        title={W.title}
        eyebrow={closing ? `Edzés vége · ${W.title}` : 'Lezárva · ma'}
        mode={closing ? 'closing' : 'closed'}
        exercises={summaryExercises}
        challenges={summaryChallenges}
        hadPR={!!showPR || hadPrFromSignal}
        showSetLines={!closing}
        onFinish={finishAndCelebrate}
        finishPending={finishPending}
        onBack={() => setPhase('active')}
        onExit={onExit}
      />
    )
  }

  // ---------- ACTIVE ----------
  const totalSets = W.exercises.reduce((a, e) => a + effectiveSetCount(session, e.id), 0)
  const doneSets = Object.values(session.logged).reduce((a, arr) => a + arr.length, 0)
  const activeChallenge = challenges.find((c) => c.exerciseId === current.id && acceptedMap[c.id])
  const currentSetCount = effectiveSetCount(session, current.id)

  // Reorderable segment for the ⋯ action sheet: the exercises up to and including
  // the VIEWED one stay FIXED; only the ones after it in session.order can be
  // reordered. Reorder is client-only / ephemeral — it just replaces session.order,
  // never persists.
  const remaining = (() => {
    const ci = session.order.indexOf(current.id)
    return session.order.slice(ci + 1).map((id) => {
      const e = W.exercises.find((x) => x.id === id)!
      return { id, label: e.name }
    })
  })()
  const handleReorder = (newRemaining: string[]) =>
    setSession((s) => {
      // Fixed segment anchors on the viewed exercise (from the render closure).
      const ci = s.order.indexOf(current.id)
      const fixed = s.order.slice(0, ci + 1)
      return { ...s, order: [...fixed, ...newRemaining] }
    })
  // Two-way pager (spec 2026-07-15, mockup "B · pager-sáv"): plain order-neighbours
  // of the viewed exercise — browsing is free, so it does NOT skip done ones; the
  // list edges disable the ends. (Replaces the old one-way `remaining[0]` next row.)
  const viewedPos = session.order.indexOf(current.id)
  const prevEx = viewedPos > 0 ? W.exercises.find((e) => e.id === session.order[viewedPos - 1]) ?? null : null
  const nextEx = viewedPos < session.order.length - 1 ? W.exercises.find((e) => e.id === session.order[viewedPos + 1]) ?? null : null
  // Overview rows for the jump sheet — every exercise with its live resolved state.
  const overviewRows: OverviewExercise[] = session.order.map((id) => {
    const e = W.exercises.find((x) => x.id === id)!
    const done = session.logged[id]?.length ?? 0
    const total = effectiveSetCount(session, id)
    const state = session.skipped.includes(id) ? 'skipped' as const
      : done >= total ? 'done' as const
      : done > 0 ? 'progress' as const
      : 'todo' as const
    return { id, name: e.name, state, done, total }
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
            setSession((s) => addExtraSet(s, current.id))
            setAddSetPrompt({ exerciseId: current.id })
          }}
          onEditNote={() => setNoteEditOpen(true)}
          onFinishWorkout={() => setPhase('summary')}
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
      {overviewOpen && (
        <ExerciseOverviewSheet
          exercises={overviewRows}
          currentId={current.id}
          onJump={jumpTo}
          onClose={() => setOverviewOpen(false)}
        />
      )}
      {addSetPrompt && (
        <Sheet onClose={() => setAddSetPrompt(null)} labelledBy="add-set-prompt-title" className="sheet-nested">
          {(close) => (
            <div style={{ padding: '4px 2px 2px' }}>
              <span className="eyebrow" style={{ color: 'var(--coral-deep)' }}>Extra szett hozzáadva</span>
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
        {/* Header — Napív wk-top (spec §4.5): back pill, title + counter, exercise
            dots, and the ⋯ actions chip, all in one sticky row (mezo-8141). */}
        <div className="wk-top np-anim" style={{ '--i': 0 } as React.CSSProperties}>
          <button type="button" className="back np-press" aria-label="Vissza" onClick={onExit}>‹</button>
          {/* Counter is now a button — tapping it opens the jump-to overview sheet
              (spec 2026-07-15 free navigation). ▾ signals the drop-down affordance. */}
          <button type="button" className="tt" aria-label="Gyakorlatlista" disabled={!!feedbackEx} onClick={() => setOverviewOpen(true)} style={{ textAlign: 'left' }}>
            <div className="t1">{W.title}</div>
            <div className="t2">▾ {currentIdx + 1}/{W.exercises.length} gyakorlat · {doneSets}/{totalSets} szett</div>
          </button>
          <div className="exdots">
            {W.exercises.map((e) => {
              // Resolved-state classing (free navigation): a fully-logged or skipped
              // exercise is done/skipped regardless of order; the viewed one is current.
              const resolved = session.skipped.includes(e.id)
                ? 'skp'
                : (session.logged[e.id]?.length ?? 0) >= effectiveSetCount(session, e.id)
                  ? 'don'
                  : undefined
              // Dots are tappable (free navigation) — each jumps to its exercise.
              return (
                <button key={e.id} type="button" aria-label={`Ugrás: ${e.name}`} onClick={() => jumpTo(e.id)} style={{ padding: 2, lineHeight: 0 }}>
                  <i className={e.id === current.id ? 'cur' : resolved} />
                </button>
              )
            })}
          </div>
          <button
            type="button"
            aria-label="Gyakorlat műveletek"
            disabled={!!feedbackEx}
            onClick={() => setActionSheetOpen(true)}
            className="back np-press"
            style={{ fontSize: 15 }}
          >
            ⋯
          </button>
        </div>

        {/* Niggle banner if active */}
        {niggleActive && currentIdx <= 1 && (
          <div style={{ padding: '8px 24px' }}>
            <div className="warmstrip">
              ⚠ Jobb váll aktív · {currentIdx === 1 ? 'pronated grif' : 'óvatos, először warm-up'}
            </div>
          </div>
        )}

        {/* Execution card — Napív §4.5: challenge banner, exo/name/prev, video +
            note pill, set-dots, giant steppers, RIR/Side pills, Szett kész ✓
            (mezo-8141). Replaces the old eyebrow/Múlt-hét-hero/tool-row layout. */}
        <div
          className="excard np-anim"
          style={{ '--i': 1 } as React.CSSProperties}
          // Swipe navigation (free nav): only large horizontal drags fire, so taps on
          // the inner steppers/buttons are ignored. Left = next, right = previous.
          onPointerDown={(e) => { swipeStart.current = e.clientX }}
          onPointerUp={(e) => {
            if (swipeStart.current == null) return
            const dx = e.clientX - swipeStart.current
            swipeStart.current = null
            if (dx <= -60) jumpTo(nextEx?.id)
            else if (dx >= 60) jumpTo(prevEx?.id)
          }}
        >
          {activeChallenge && (
            <div className="warmstrip">
              <Icon name="sparkle" size={14} color="var(--coral)" />
              <div className="col flex-1">
                <span className="label-mono" style={{ fontSize: 9, color: 'var(--coral-deep)' }}>
                  Aktív kihívás · {activeChallenge.typeLabel}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-primary)', marginTop: 2 }}>
                  Cél: <strong style={{ color: 'var(--coral-deep)', fontWeight: 500 }}>{activeChallenge.target}</strong>
                </span>
              </div>
            </div>
          )}
          <div className="exo">{currentIdx + 1}. gyakorlat · {current.muscle}</div>
          <h2>{current.name}</h2>
          {current.lastWeek && (
            <div className="prev">
              múlt héten: {current.lastWeek.weight.toLocaleString('hu-HU')} kg × {current.lastWeek.reps} @ RIR {current.lastWeek.rir}
            </div>
          )}

          {/* Inline demo video (catalog-resolved) — the wrapper renders only when a real
              YouTube id is extractable, so a stored non-YouTube url leaves no empty gap. */}
          {current.videoUrl && youTubeId(current.videoUrl) && (
            <div className="mt-sm">
              <VideoDemo url={current.videoUrl} />
            </div>
          )}

          {/* Durable per-exercise note pill (F4) — always visible while a note exists */}
          {effectiveNote && (
            <div
              aria-label="Gyakorlat-jegyzet"
              className="exercise-note-pill row gap-sm mt-sm"
              style={{
                alignItems: 'center',
                padding: '6px 10px',
                background: 'var(--surface-2)',
                borderLeft: '2px solid var(--coral)',
                fontSize: 12,
                color: 'var(--text-secondary)',
                lineHeight: 1.4,
              }}
            >
              <Icon name="tool" size={11} color="var(--coral)" />
              <span style={{ flex: 1 }}>{effectiveNote}</span>
            </div>
          )}

          {/* Set-dots — one per planned+extra set; ✓ done, coral current, amber
              "B{n}" pending warmups, plain ordinal pending working sets. */}
          <div className="setdots">
            {Array.from({ length: currentSetCount }, (_, i) => {
              const warm = prescribedAt(session, current.id, i)?.kind === 'warmup'
              const cls = i < cursor ? 'sd don' : i === cursor ? 'sd cur' : 'sd'
              // An F2-added set (index at/past the exercise's planned baseline)
              // gets a distinct dashed marker while still pending — restored in
              // the final-review fix (mezo-8141 — Finding 2), gone since S5.
              const extra = i >= (session.planned[current.id] ?? 0)
              return (
                <div key={i} className={cls + (warm ? ' wu' : '') + (extra && cls === 'sd' ? ' extra' : '')}>
                  {i < cursor ? '✓' : warm ? `B${i + 1}` : i + 1 - warmupCount}
                </div>
              )
            })}
          </div>

          {/* Current-set kind tag (mezo-eerq): the logging surface itself says
              warmup vs working — the tiny set-dot label alone was missed. */}
          {currentTarget && (
            <div className="row mt-sm" style={{ justifyContent: 'center' }}>
              <span
                className="stag"
                style={{
                  fontSize: 10,
                  padding: '4px 10px',
                  background: `color-mix(in srgb, ${isWarmupSet ? 'var(--warning)' : 'var(--coral)'} 14%, transparent)`,
                  color: isWarmupSet ? 'var(--warning)' : 'var(--coral-deep)',
                }}
              >
                {isWarmupSet
                  ? `Bemelegítő · B${cursor + 1}`
                  : `Working · ${cursor + 1 - warmupCount}/${currentSetCount - warmupCount}`}
              </span>
            </div>
          )}

          {/* Giant steppers — the single logging surface (spec §4.5). Only
              genuinely load-less exercises (plyo) hide the kg stepper. */}
          <div className="steprow">
            {current.type !== 'plyo' && (
              <SetStepper label="Súly" value={weight} step={2.5} unit="kg" min={0} max={999} onChange={setWeight} />
            )}
            <SetStepper label="Ismétlés" value={reps} step={1} integer min={1} max={100} onChange={setReps} />
          </div>

          {/* No RIR on a warmup set — effort tracking is working-set-only (mezo-eerq). */}
          {!isWarmupSet && (
            <div className="rirrow">
              <span className="rk">RIR</span>
              {[0, 1, 2, 3].map((n) => (
                <button key={n} type="button" aria-pressed={rir === n} aria-label={`RIR ${n}`} onClick={() => setRir(n)}>
                  {n}
                </button>
              ))}
            </div>
          )}
          {current.type === 'isolation' && (
            <div className="rirrow">
              <span className="rk">Side</span>
              {(['L', 'B', 'R'] as const).map((s) => (
                <button key={s} type="button" aria-pressed={side === s} onClick={() => setSide(side === s ? null : s)}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Transient per-set note (SetLogRequest.note) — cleared after each log;
              distinct from the durable per-exercise note pill/editor above. */}
          <input
            className="setnote"
            aria-label="Szett megjegyzés"
            placeholder="Megjegyzés ehhez a szetthez (opcionális)"
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          <button type="button" className="donebtn np-press" onClick={completeSet}>
            Szett kész ✓
          </button>
        </div>

        {/* Two-way pager bar (mockup B) — big tap targets, neighbour name + live n/m. */}
        <div className="pagerbar">
          <button type="button" className="pg" disabled={!prevEx} aria-label={prevEx ? `Előző: ${prevEx.name}` : 'Előző'} onClick={() => jumpTo(prevEx?.id)}>
            <span className="ar" aria-hidden="true">‹</span>
            <span className="lbl">
              <span className="k">Előző</span>
              <span className="n">{prevEx ? `${prevEx.name} · ${(session.logged[prevEx.id]?.length ?? 0)}/${effectiveSetCount(session, prevEx.id)}` : '—'}</span>
            </span>
          </button>
          <button type="button" className="pg next" disabled={!nextEx} aria-label={nextEx ? `Következő: ${nextEx.name}` : 'Következő'} onClick={() => jumpTo(nextEx?.id)}>
            <span className="lbl">
              <span className="k">Következő</span>
              <span className="n">{nextEx ? `${nextEx.name} · ${(session.logged[nextEx.id]?.length ?? 0)}/${effectiveSetCount(session, nextEx.id)}` : '—'}</span>
            </span>
            <span className="ar" aria-hidden="true">›</span>
          </button>
        </div>

        {/* Engine rationale — rendered whenever the engine returns one, INDEPENDENT
            of lastWeek: a first-ever workout (no lastWeek) still surfaces its
            rationale (e.g. "Kezdő súly (anchor)" / "Első alkalom — add meg a súlyt"). */}
        {current.rationale && (
          <div className="aistrip">
            <span aria-hidden="true">✨</span>
            <p>{current.rationale}</p>
          </div>
        )}

        {/* Prescribed set list (spec §6): demoted to read-only status rows now that
            logging lives in the excard above — targets for pending sets, logged
            actuals for done sets; ALL information survives, only the input
            controls moved out. */}
        <div style={{ padding: '6px 24px 20px' }}>
          <div className="col gap-sm">
            {Array.from({ length: currentSetCount }, (_, i) => {
              const t = prescribedAt(session, current.id, i)
              const warm = t?.kind === 'warmup'
              const setLabel = warm ? `B${i + 1}` : `${i - warmupCount + 1}`
              const kindLabel = warm ? 'Bemel.' : 'Working'
              const accent = warm ? 'var(--warning)' : 'var(--coral)'
              const actual = session.logged[current.id]?.[i]
              const isDone = i < cursor

              // A read-only row — target for pending sets, logged actuals for done ones.
              const w = isDone ? actual?.weight : t?.targetWeightKg
              const r = isDone ? actual?.reps : t?.targetReps
              const rr = isDone ? actual?.rir : t?.targetRIR
              return (
                <div
                  key={i}
                  className="row gap-sm"
                  style={{ padding: '10px 12px', alignItems: 'center', background: 'var(--surface-2)', borderLeft: '2px solid ' + accent, opacity: isDone ? 0.5 : 1 }}
                >
                  <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)', width: 20 }}>{setLabel}</span>
                  <span className="stag" style={{ background: 'color-mix(in srgb, ' + accent + ' 14%, transparent)', color: accent }}>{kindLabel}</span>
                  <span
                    style={{ fontFamily: 'var(--ff-display)', fontSize: 15, fontWeight: 600, color: isDone ? 'var(--text-primary)' : 'var(--text-secondary)', whiteSpace: 'nowrap', marginLeft: 4 }}
                  >
                    {w == null ? '—' : w}
                    <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'var(--text-tertiary)', margin: '0 1px 0 2px' }}>kg</span>
                    <span style={{ color: 'var(--text-tertiary)', margin: '0 6px', fontWeight: 400 }}>×</span>
                    {r ?? '—'}
                  </span>
                  <span style={{ flex: 1 }} />
                  {/* Logged working sets show their ACTUAL RIR (user fix 1); warmups log none. */}
                  {isDone ? (
                    <span className="row gap-xs" style={{ alignItems: 'center' }}>
                      {!warm && (
                        <span className="chip" style={{ fontSize: 9, padding: '2px 6px' }}>RIR {rr ?? '–'}</span>
                      )}
                      <Icon name="check" size={13} color="var(--coral)" />
                    </span>
                  ) : warm ? null : (
                    <span className="chip" style={{ fontSize: 9, padding: '2px 6px' }}>RIR {rr ?? current.targetRIR}</span>
                  )}
                </div>
              )
            })}
          </div>
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
          <span className="eyebrow" style={{ color: 'var(--coral-deep)' }}>Gyakorlat-jegyzet</span>
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
