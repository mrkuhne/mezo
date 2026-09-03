// ============================================================
// Mezo · ActiveWorkoutPage — full-screen active-workout mode
// (sibling route /train/session, NO sub-nav). Four-phase state machine:
//   prep    → mission-briefing hero (XP/skill forecast) · niggle pre-flag ·
//             challenges (quest cards + pending state) · warmup · muscle-sectioned
//             exercise cards (1RM badges) · sticky start CTA (mezo-bxpg)
//   active  → per-set logging (weight/reps/RIR), Múlt hét comparison,
//             set dots, today's set history, PR toast + feedback debrief
//   summary → explicit-finish WorkoutSummary (closing): stats + challenge
//             outcomes + recap; "Edzés lezárása ✓" is the ONLY finish trigger
//   complete→ the same WorkoutSummary read-only (post-finish, set lines)
// Every exit (Bezárás / back / Mentés) navigates back to /train.
// Ported from prototype train.jsx (the active-workout TrainSection).
// ============================================================
import { useEffect, useRef, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useChallengeActions, useChallenges, useProgressionProfile, useTrain, useWeekMuscleLog } from '@/data/hooks'
import { huWeekdayFull, localDateString } from '@/shared/lib/dates'
import { screenScroller, scrollToTop } from '@/shared/lib/screenScroll'
import { useBackNav } from '@/shared/hooks/useBackNav'
import { useLevelUp } from '@/features/progression/LevelUpProvider'
import { restSecondsFor } from '@/features/train/logic/restTimer'
import { identityKeyOf, oneRmByIdentity, prepForecast, prepStats, pseudoDayFromPlan } from '@/features/train/logic/prepBriefing'
import { REGION_LABELS, muscleColor, muscleRegion, regionColor } from '@/features/train/logic/muscleColors'
import { setStyle } from '@/features/train/logic/setBudget'
import { selectPrepRows, weekZoneRows } from '@/features/train/logic/weekZone'
import { avgWorkingRir, exerciseTonnage, sessionProgressSegments, setStatus, topSetDeltaPct, warmupPctLabel } from '@/features/train/logic/workoutCardMeta'
import { MUSCLE_LABELS } from '@/data/train/train'
import { useRestTimer } from '@/features/train/logic/useRestTimer'
import { RestTimerBar } from '@/features/train/components/RestTimerBar'
import { ProgressionBanner, progressionDeltaLabel } from '@/features/train/components/ProgressionBanner'
import { ExerciseImage } from '@/features/train/components/ExerciseImage'
import type { LastWeekSet, LoggedWorkoutExercise, Mesocycle, WorkoutPlan } from '@/data/types'
import type { ExerciseSetResponse, GymExerciseInput, SetLogRequest, SetUpdateRequest, WorkoutFeedbackInput, WorkoutInstanceResponse } from '@/data/train/trainApi'
import type { Medal } from '@/data/train/medalTypes'
import type { MockMedalContext } from '@/data/train/medalEvaluator'
import {
  type Session,
  addExtraSet,
  attachSetId,
  canRemoveSet,
  completeSet as completeSetModel,
  currentExerciseId,
  effectiveSetCount,
  makeSession,
  mergePlan,
  nextSetIdx,
  nextUnfinishedAfter,
  prescribedAt,
  removeSet,
  seedFromOpen,
  skipExercise as skipExerciseModel,
  updateLoggedSet,
} from '@/features/train/logic/workoutState'
import { ScreenSkeleton } from '@/shared/ui/ScreenSkeleton'
import { Sheet } from '@/shared/ui/Sheet'
import { SetStepper } from '@/features/train/components/SetStepper'
import { videoEmbed } from '@/features/train/components/VideoDemo'
import { MedalChip } from '@/features/train/components/MedalChip'
import { MedalToast } from '@/features/train/components/MedalToast'
import { FeedbackModal, type ExerciseFeedbackValues } from '@/features/train/sheets/FeedbackModal'
import { WorkoutSummary, type SummaryChallenge, type SummaryExercise } from '@/features/train/components/WorkoutSummary'
import { evaluateChallenge } from '@/features/train/logic/challengeOutcome'
import { ExerciseActionSheet } from '@/features/train/sheets/ExerciseActionSheet'
import { ExerciseOverviewSheet, type OverviewExercise } from '@/features/train/sheets/ExerciseOverviewSheet'
import { SetEditSheet, type SetEditValues } from '@/features/train/sheets/SetEditSheet'
import { ClayIcon } from '@/shared/ui/clay'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { CollapsibleStrip, Mosaic, StatCell, StatStrip, Tile } from '@/shared/ui/mozaik'
import { PrepGyakorlatokPage } from '@/features/train/pages/prep/PrepGyakorlatokPage'
import { PrepFejlodesPage } from '@/features/train/pages/prep/PrepFejlodesPage'
import { PrepHetiZonaPage } from '@/features/train/pages/prep/PrepHetiZonaPage'
import { PrepKuldetesekPage } from '@/features/train/pages/prep/PrepKuldetesekPage'
import { PrepBemelegitesPage, type WarmupRow } from '@/features/train/pages/prep/PrepBemelegitesPage'
import { PrepNigglePage } from '@/features/train/pages/prep/PrepNigglePage'

type Phase = 'prep' | 'active' | 'summary' | 'complete'
type Side = 'L' | 'B' | 'R'
/** Which prep-mosaic tile page is open (mezo-d20.3.8); null = the hub itself. */
type PrepTile = 'gyakorlatok' | 'fejlodes' | 'zona' | 'kuldetesek' | 'bemelegites' | 'niggle'

const WARMUP_ROWS: readonly WarmupRow[] = [
  { label: 'Dinamikus stretching', time: '3 perc', minutes: 3 },
  { label: 'Cardio-lite · evezőpad', time: '3 perc', minutes: 3 },
  { label: 'Aktiváció · band pull-apart × 20', time: '2 perc', minutes: 2 },
] as const

// The RECORD-tier medal toast auto-hides after this long (mezo-wp6n; was PR_TOAST_MS).
const MEDAL_TOAST_MS = 4500

// Dedupe key for a Medal (mezo-wp6n): the finish response's `medals[]` carries the whole
// session's medals — including ones already folded into `sessionMedals` from a per-set
// `logSet` onSuccess — so merging it needs an identity. type+exerciseName+setIndex is
// unique per medal (SESSION_VOLUME's setIndex is NOT null — the backend's toMedal
// carries the session's top set's index there too — but it only ever arrives once per
// exercise per session, at finish time, so the same key still cannot collide).
function medalKey(m: Medal): string {
  return `${m.type}:${m.exerciseName}:${m.setIndex}`
}

/** The human label of one set slot — shared by the set-list row, its aria-label and the edit sheet. */
function setSlotLabel(index: number, warmup: boolean, warmupCount: number): string {
  return warmup ? `B${index + 1} bemelegítő szett` : `${index - warmupCount + 1}. working szett`
}

/** The index of the most recently LOGGED warmup set (strictly before `cursor`), or null when none. */
function lastLoggedWarmupIdx(s: Session, exerciseId: string, cursor: number): number | null {
  for (let i = cursor - 1; i >= 0; i--) {
    if (prescribedAt(s, exerciseId, i)?.kind === 'warmup') return i
  }
  return null
}

// Mission-briefing exercise sectioning (mezo-bxpg, T4): a simple group-by over the
// muscle-color family key, preserving PLAN order (first-appearance order of each
// family, not the fixed REGION_ORDER used by the muscle-week card grid) — the
// "simpler" option the plan offers over adapting muscleRegionGroups' MuscleWeekRow
// shape. Unmapped/off-day muscle keys (custom/saját exercises, e.g. 'full') fall
// into a single neutral catch-all so no exercise is ever silently dropped.
interface PrepExerciseGroup { key: string; label: string; deep: string; exercises: LoggedWorkoutExercise[] }
function groupExercisesByRegion(exercises: LoggedWorkoutExercise[]): PrepExerciseGroup[] {
  const order: string[] = []
  const groups = new Map<string, PrepExerciseGroup>()
  for (const e of exercises) {
    const region = muscleRegion(e.muscle)
    const key = region ?? 'other'
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: region ? REGION_LABELS[region] : 'Egyéb',
        deep: region ? regionColor(region).deep : 'var(--text-secondary)',
        exercises: [],
      })
      order.push(key)
    }
    groups.get(key)!.exercises.push(e)
  }
  return order.map((k) => groups.get(k)!)
}

// Guard wrapper: the session screen's hooks (useState×N) are initialized from
// workout data, so the null case must redirect BEFORE the inner component mounts
// — a conditional early return between hook calls would break the hook order
// now that `workout` is query-driven (T2).
export function ActiveWorkoutPage() {
  // Cross-day start (mezo-p7rp): /train/session?day={templateDayId} pins a template day.
  // Day resolution stays server-side (open instance > param > weekday label), so a deep
  // link while another workout runs resumes the running one, and a day already completed
  // this week falls through to the review redirect below (D5).
  const [searchParams] = useSearchParams()
  const { workout, activeMeso, todaySession, completedTodayWorkout, workoutPending, startWorkout, logSet, updateSet, deleteSet, skipExercise, saveExerciseNote, saveWorkoutFeedback, finishWorkout, saveDayExercises } = useTrain({ workoutDay: searchParams.get('day') })
  // A hard reload lands here with the queries still loading — redirecting now
  // would kill the resume flow (live-smoke catch). Show the generic skeleton
  // until loaded (was `return null` — mezo-f2z). `workoutPending` is already
  // `!mock`-gated (false in mock, synchronous seed), so no skeleton flashes in
  // mock mode.
  if (workoutPending) return <ScreenSkeleton />
  // T0 clean slate: never render the session without a workout (and at least one exercise).
  // Meso-independence (mezo-ws2x D4): getToday resolves custom (saját) templates with NO
  // active meso, so `activeMeso` is legitimately null here — it must NOT gate the redirect.
  if (!workout || workout.exercises.length === 0) return <Navigate to="/train" replace />
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
      updateSet={updateSet}
      deleteSet={deleteSet}
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
  // Nullable (mezo-ws2x D4): a custom (saját) template session runs with no active meso.
  activeMeso: Mesocycle | null
  todaySession: { templateSessionId: string; openWorkout: WorkoutInstanceResponse | null } | null
  startWorkout: (templateSessionId: string, opts?: { onSuccess?: (w: WorkoutInstanceResponse) => void }) => void
  logSet: (
    workoutId: string,
    set: SetLogRequest,
    opts?: { ctx?: MockMedalContext; onSuccess?: (r?: ExerciseSetResponse) => void; onError?: (err: unknown) => void },
  ) => void
  updateSet: (
    workoutId: string,
    setId: string,
    body: SetUpdateRequest,
    opts?: { onSuccess?: (r?: ExerciseSetResponse) => void },
  ) => void
  deleteSet: (workoutId: string, setId: string) => void
  skipExercise: (workoutId: string, exerciseId: string) => void
  saveExerciseNote: (exerciseId: string, note: string) => void
  saveWorkoutFeedback: (workoutId: string, items: WorkoutFeedbackInput[]) => void
  finishWorkout: (workoutId: string, opts?: { note?: string | null; onSuccess?: (r?: WorkoutInstanceResponse) => void; onSettled?: () => void }) => void
  saveDayExercises: (mesoId: string, dayId: string, exercises: GymExerciseInput[]) => void
}

// First-ever workout has no last week (and no engine prescription): prefill from
// the exercise's rep target (bottom of the range) instead.
function prefill(e: LoggedWorkoutExercise): LastWeekSet {
  return e.lastWeek ?? { weight: 0, reps: e.repMin || 10, rir: e.targetRIR }
}

function ActiveWorkoutSession({
  workout, activeMeso, todaySession, startWorkout, logSet, updateSet, deleteSet, skipExercise, saveExerciseNote, saveWorkoutFeedback, finishWorkout, saveDayExercises,
}: SessionProps) {
  const W = workout
  const goBack = useBackNav('/train')
  const qc = useQueryClient()
  const rest = useRestTimer()
  // Live weekly zone context (mezo-oyhy.7): unconditional hook call at the top —
  // the prep block below reads its result, but the hook itself must run every
  // render regardless of phase so hook order stays stable.
  const weekLog = useWeekMuscleLog()
  // Exiting the session (Bezárás / back / Mentés — all route through here) drops any
  // running rest; the state is page-local so unmount alone would clear it too.
  const onExit = () => {
    rest.skip()
    goBack()
  }

  // No active meso (custom/saját template, mezo-ws2x D4) ⇒ no week/phase to show —
  // fall back to the day title instead of dereferencing a null activeMeso.
  const weekLabel = activeMeso
    ? `W${activeMeso.currentWeek} · ${activeMeso.phaseCurve[activeMeso.currentWeek - 1]} hét`
    : W.title
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
  // Medal collection (mezo-wp6n): every medal earned this session (set-log + finish),
  // the set-row lookup (keyed `${exerciseId}:${setIndex}`) driving the chips + the
  // tick colour, and the currently-shown RECORD-tier celebration toast (+ how many
  // other medals landed on the same set).
  const [sessionMedals, setSessionMedals] = useState<Medal[]>([])
  const [medalsBySet, setMedalsBySet] = useState<Record<string, Medal[]>>({})
  const [toastMedal, setToastMedal] = useState<{ medal: Medal; extra: number } | null>(null)
  // The explicit-finish POST is in flight — disables the "Edzés lezárása ✓" CTA.
  const [finishPending, setFinishPending] = useState(false)
  /** The workout-level closing note (mezo-d20.8.2.2) — a page-owned draft, so stepping back to
   *  `active` and returning to the summary does not throw away what was already typed. */
  const [closingNote, setClosingNote] = useState('')
  const { showLevelUp } = useLevelUp()
  // The just-finished exercise pinned for the debrief modal (and the active card
  // it overlays): once resolved, the view advances to the next exercise, so we keep
  // an explicit feedback target that overrides `viewedId` until the debrief closes.
  const [feedbackEx, setFeedbackEx] = useState<LoggedWorkoutExercise | null>(null)
  const [niggleConfirmed, setNiggleConfirmed] = useState(false)
  // Prep mosaic (mezo-d20.3.8): which tile's own page is open, null = the hub.
  const [prepTile, setPrepTile] = useState<PrepTile | null>(null)
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
  // The set-list row tapped for edit/delete (mezo-l3on) — an index into the VIEWED
  // exercise's slots, so it must not survive a jump to another exercise (Step 4b below).
  const [editingSetIdx, setEditingSetIdx] = useState<number | null>(null)
  // The `localId`s of logged sets whose logSet POST errored (mezo-l3on fix-round-3, F1).
  // A failed log means "there is no server row" — that's certain, not transient — so the
  // honest UI keeps the set visible (no silent rollback, which was itself the round-2 bug:
  // it could desync `logged[i]` from `prescribed[i]`) and simply lets the row become
  // tappable again, same as a bound `id` would. The global mutation-error toast already
  // tells the user the save failed; this just keeps the row from being a dead end.
  const [failedSetLocalIds, setFailedSetLocalIds] = useState<Set<string>>(() => new Set())
  // Tap-to-reveal demo still (mezo-8xdl.4) — mirrors the video's hidden-until-asked
  // stance, so it never steals the logging surface mid-set. The demo VIDEO is gated
  // the same way from the head's icon button (mezo-d20.3.9).
  const [imageOpen, setImageOpen] = useState(false)
  const [videoOpen, setVideoOpen] = useState(false)
  // The per-set note is COLLAPSED in the calm default (mezo-d20.3.9) — the "＋ megjegyzés
  // a szetthez" toggle opens it; it re-collapses on every slot/exercise change.
  const [noteOpen, setNoteOpen] = useState(false)

  // Auto-hide the medal toast (leak-safe: cleared on unmount / re-trigger).
  useEffect(() => {
    if (!toastMedal) return
    const t = setTimeout(() => setToastMedal(null), MEDAL_TOAST_MS)
    return () => clearTimeout(t)
  }, [toastMedal])

  // A phase flip swaps the WHOLE screen without a route change (mezo-vad0): the prep
  // briefing is long and its "Kezdjük el" CTA sits at the very bottom, so the app
  // scroller would carry that offset into the execution card (and, likewise, into the
  // closing summary). ScreenContent only resets on navigation — an in-page phase change
  // has to ask for it itself.
  useEffect(() => {
    scrollToTop(screenScroller())
  }, [phase])

  // A rest must not survive into the summary/recap phase. (No unmount cleanup
  // needed anymore — the timer state is page-local and dies with the page.)
  useEffect(() => {
    if (phase === 'complete' || phase === 'summary') rest.skip()
  }, [phase, rest.skip])

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
    // Reset on set-index / exercise transitions, and on the exercise's own slot-count
    // change (N2, fix round 2): a delete of a PENDING slot changes neither `current.id`
    // nor `cursor`, but the prescription splice (removeSet, C1) shifts what
    // `prescribedAt(cursor)` returns — without this dep the steppers would keep
    // showing the stale target while the kind tag/RIR row (computed at render) already
    // moved on. NOT re-run on note changes (deliberately excluded).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.id, cursor, effectiveSetCount(session, current.id)])
  // The open set-edit sheet addresses a row index INTO the viewed exercise (mezo-l3on);
  // that index is meaningless against another exercise, so a jump (pager / dots /
  // overview / swipe) must close it rather than let it edit the wrong slot.
  useEffect(() => {
    setEditingSetIdx(null)
  }, [current.id])
  // The demo media must not stay open across an advance to the next exercise, and the
  // per-set note toggle re-collapses on every slot change (prototype UI.inpKey reset).
  useEffect(() => { setImageOpen(false); setVideoOpen(false) }, [current.id])
  useEffect(() => { setNoteOpen(false) }, [current.id, cursor])
  // Challenges: unified across modes — the hook returns the Phase-1 seed in mock
  // and the live session/day list (or honest []) in real. Accept/dismiss is a
  // local toggle in mock (byte-parity with Phase-1) and a persisted L2 decision
  // in live (status-derived accepted map + decide()).
  const localToday = localDateString()
  const templateSessionId = todaySession?.templateSessionId ?? null
  const { challenges, mode: challengeMode, pending: challengesPending } = useChallenges(templateSessionId, localToday)
  const { decide } = useChallengeActions(templateSessionId, localToday)
  const isMock = challengeMode === 'mock'

  // Mission-briefing prep data (mezo-bxpg, T4): the record engine's e1RM badges +
  // the progression profile's skill levels for the XP/skill forecast. Both are hook
  // calls, so — mirroring useChallenges above — they're read here unconditionally
  // even though only the 'prep' phase below renders them.
  const { exerciseRecords } = useTrain()
  const { data: progressionProfile } = useProgressionProfile()

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
  // `warmup` and the rep band feed the F7.2 exercise view (mezo-d20.8.2.1): the closing report
  // opens the SAME view as the review, so it has to hand over the same facts. Warmup-ness is
  // positional here — the session's prescription lists warmups first — where the review reads
  // it off `ExerciseSetResponse.kind`.
  const summaryExercises: SummaryExercise[] = W.exercises.map((e) => {
    const warmups = (session.prescribed[e.id] ?? []).filter((p) => p.kind === 'warmup').length
    return {
      id: e.id,
      name: e.name,
      muscle: e.muscle,
      plannedSets: effectiveSetCount(session, e.id),
      sets: (session.logged[e.id] ?? []).map((set, i) => ({ ...set, warmup: i < warmups })),
      skipped: session.skipped.includes(e.id),
      repMin: e.repMin,
      repMax: e.repMax,
    }
  })
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
    const wasSetIdx = nextSetIdx(session, finishing.id) // pre-update cursor (for the medal ctx + persisted setIndex)
    const target = prescribedAt(session, finishing.id, wasSetIdx)
    const kind = target?.kind ?? 'working'
    // A client-side identity (mezo-l3on fix-round-2, N1), assigned NOW so the async logSet
    // response (success OR failure) can address THIS exact entry later — never by array
    // index, which shifts under a concurrent edit/delete or a second in-flight log.
    const localId = crypto.randomUUID()
    const next = completeSetModel(session, finishing.id, { weight, reps, rir, localId })
    setSession(next)
    // Medals (mezo-wp6n): always logged — real mode never had a `workoutId` guard
    // reason to skip this (mirrors finishAndCelebrate's 'mock' sentinel below), and
    // mock mode needs the call too, to run the mock medal evaluator. targetWeightKg/
    // targetReps snapshot the Progresszió prescription in force for this set — without
    // it TARGET_HIT is underivable later (spec §5.1).
    logSet(workoutId ?? 'mock', {
      exerciseId: finishing.id, setIndex: wasSetIdx,
      // Plyo / bodyweight sets carry no load.
      weightKg: weightless ? 0 : weight, reps,
      // Warmup sets log no RIR — effort tracking applies to working sets only.
      ...(kind === 'warmup' ? {} : { rir }),
      kind,
      ...(side ? { side } : {}), ...(note.trim() ? { note: note.trim() } : {}),
      ...(target?.targetWeightKg != null ? { targetWeightKg: target.targetWeightKg } : {}),
      ...(target?.targetReps != null ? { targetReps: target.targetReps } : {}),
    }, {
      ctx: { exerciseName: finishing.name, lastWeek: finishing.lastWeek, date: localToday },
      onSuccess: (r) => {
        // Bind the server's set id onto the just-appended logged entry (mezo-l3on) —
        // BEFORE the medal-less early return below, so a plain set (no medal earned)
        // still gets an addressable id for a later edit/delete. Addressed by localId
        // (fix-round-2, N1): a no-op if the user already deleted this exact entry.
        if (r?.id) setSession((s) => attachSetId(s, finishing.id, localId, r.id!))
        const medals = r?.medals ?? []
        if (!medals.length) return
        setMedalsBySet((m) => ({ ...m, [`${finishing.id}:${wasSetIdx}`]: medals }))
        setSessionMedals((s) => [...s, ...medals])
        const records = medals.filter((m) => m.tier === 'RECORD')
        if (records.length) {
          const order = ['WEIGHT', 'E1RM', 'REPS_AT_WEIGHT', 'SESSION_VOLUME']
          const top = [...records].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type))[0]
          setToastMedal({ medal: top, extra: medals.length - 1 })
        }
      },
      // F1 (fix round 3): a failed POST (gym wifi) must NOT roll the local entry back —
      // round 2's rollback could desync `logged[i]` from `prescribed[i]` when the
      // dropped entry wasn't the LAST one (a later set shifts into a mismatched
      // prescription, and a second in-flight log can also collide on the reused
      // setIndex). There genuinely is no server row for this set — that's certain, not
      // transient — so the honest move is to keep it visible and mark it failed, which
      // the row-disabled rule below treats the same as a bound id (tappable, not a
      // dead end): the user can delete it (local-only, exactly like a pending slot) or
      // edit it locally.
      onError: () => {
        setFailedSetLocalIds((prev) => {
          const next = new Set(prev)
          next.add(localId)
          return next
        })
      },
    })
    setNote('')

    // Last set of this exercise → pin it for the debrief sheet. Otherwise
    // completeSetModel already advanced the cursor for the same exercise, and the
    // in-card rest starts (mezo-xt65): the CTA slot morphs into the RestTimerBar.
    if (wasSetIdx + 1 >= effectiveSetCount(session, finishing.id)) {
      setFeedbackEx(finishing)
      // The debrief takeover unmounts a possibly mid-close ExerciseActionSheet
      // (mount condition: actionSheetOpen && !feedbackEx) without its onClose
      // ever firing — reset the flag here or the sheet re-opens once the
      // debrief resolves. Pre-mezo-91rw the Sheet's leaked exit timer masked
      // this by firing the parent setState after the unmount.
      setActionSheetOpen(false)
    } else {
      // No "next" label anywhere — mid-exercise the next set is visible right
      // above the bar (set dots + prefilled steppers).
      rest.start(restSecondsFor(current.type))
    }
  }

  // Drop every in-session medal chip of one exercise (mezo-l3on): after an edit or a delete the
  // exercise's OTHER sets can gain or lose records too, and the authoritative list only arrives
  // with the finish response — a missing chip is honest, a stale one is not.
  // `dropped` reads the closure-captured `medalsBySet` STATE (not the updater's own argument),
  // so `setMedalsBySet`'s updater below is a plain, side-effect-free filter, and `setSessionMedals`
  // is called OUTSIDE any updater (fix round 1, minors) — an updater fn must be pure (StrictMode
  // double-invokes it to catch exactly this), so a side-effecting `setState` call must never live
  // inside one.
  const clearExerciseMedals = (ex: LoggedWorkoutExercise) => {
    const dropped = Object.entries(medalsBySet)
      .filter(([k]) => k.startsWith(`${ex.id}:`))
      .flatMap(([, v]) => v)
    setMedalsBySet((m) => {
      const next: Record<string, Medal[]> = {}
      for (const [k, v] of Object.entries(m)) {
        if (!k.startsWith(`${ex.id}:`)) next[k] = v
      }
      return next
    })
    const droppedKeys = new Set(dropped.map(medalKey))
    setSessionMedals((s) => s.filter((md) => !droppedKeys.has(medalKey(md))))
  }

  const handleSetSave = (idx: number, v: SetEditValues) => {
    const ex = current
    const setId = session.logged[ex.id]?.[idx]?.id
    setSession(updateLoggedSet(session, ex.id, idx, { weight: v.weight, reps: v.reps, rir: v.rir, side: v.side, note: v.note }))
    clearExerciseMedals(ex)
    const isWarmup = prescribedAt(session, ex.id, idx)?.kind === 'warmup'
    if (setId) {
      updateSet(workoutId ?? 'mock', setId, {
        weightKg: weightless ? 0 : v.weight,
        reps: v.reps,
        ...(isWarmup ? {} : { rir: v.rir }),
        ...(v.side ? { side: v.side } : {}),
        ...(v.note.trim() ? { note: v.note.trim() } : {}),
      }, {
        onSuccess: (r) => {
          const medals = r?.medals ?? []
          if (medals.length) {
            setMedalsBySet((m) => ({ ...m, [`${ex.id}:${idx}`]: medals }))
            setSessionMedals((s) => [...s, ...medals])
          }
        },
      })
    }
    setEditingSetIdx(null)
  }

  const handleSetDelete = (idx: number) => {
    const ex = current
    // I1 (fix round 1): removeSet returns the SAME session when it refuses (floor
    // reached, or an index at/beyond the slot count) — bail before any side effect
    // fires (rest.skip / medal clear / the server DELETE).
    const next = removeSet(session, ex.id, idx)
    if (next === session) return
    const loggedBefore = session.logged[ex.id] ?? []
    const wasLogged = idx < loggedBefore.length
    const setId = loggedBefore[idx]?.id
    // The removed set must not leave a rest countdown running toward it — but only
    // when the deleted row was itself LOGGED (minor fix): deleting an unrelated
    // pending slot must not kill an in-flight rest meant for a DIFFERENT set.
    if (wasLogged) rest.skip()
    setSession(next)
    clearExerciseMedals(ex)
    // A pending slot has no server row — the shrink is purely client state.
    if (setId) deleteSet(workoutId ?? 'mock', setId)
    setEditingSetIdx(null)
    // I2 (fix round 1): deleting the exercise's LAST PENDING slot can make it read as
    // fully logged with no debrief ever having run (completeSet only pins `feedbackEx`
    // when ITS OWN last-set log lands — a delete bypasses that entirely). Mirror the
    // same transition here, but only when the exercise WASN'T already fully resolved
    // before this delete (revisiting an already-debriefed exercise to trim a stray
    // logged set must not re-open its debrief).
    const wasFullyLogged = loggedBefore.length >= effectiveSetCount(session, ex.id)
    const isNowFullyLogged = (next.logged[ex.id]?.length ?? 0) >= effectiveSetCount(next, ex.id)
    if (!wasFullyLogged && isNowFullyLogged) {
      // No "next" set remains to rest toward — a rest that outlived the delete above
      // (deleting a PENDING slot while an unrelated rest was still counting down)
      // must not survive into the debrief either.
      rest.skip()
      setFeedbackEx(ex)
      setActionSheetOpen(false)
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
      // The closing note rides the finish body (mezo-d20.8.2.2). Server-side it is
      // fill-if-empty, so the retry path above cannot erase a note a first attempt landed.
      note: closingNote.trim() || null,
      onSuccess: (r) => {
        if (r?.levelUp) showLevelUp(r.levelUp)
        // SESSION_VOLUME (and any medal not already seen from a set-log onSuccess)
        // arrives here — the finish response carries the whole session's medals, so
        // merge with a dedupe against what's already in sessionMedals (mezo-wp6n).
        if (r?.medals?.length) {
          const finishMedals = r.medals
          setSessionMedals((prev) => {
            const seen = new Set(prev.map(medalKey))
            const additions = finishMedals.filter((m) => !seen.has(medalKey(m)))
            return additions.length ? [...prev, ...additions] : prev
          })
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
    // Abandoning the current exercise must not leave the rest bar counting down
    // toward it (final-review fix, mezo-8141 — Ride-along A).
    rest.skip()
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

  // ---------- PREP ("mission briefing", mezo-bxpg) ----------
  if (phase === 'prep') {
    // The forecast day is ALWAYS the pseudo-day adapted from W (mezo-87d2): it carries
    // the same recipe as the meso day PLUS the recommendation engine's target weights
    // as an anchor fallback — so anchor-less plans (the common case) still yield
    // e1RM/volume XP instead of collapsing to a sets-only Erő-állóképesség estimate.
    const forecastDay = pseudoDayFromPlan(W)
    const athletic = progressionProfile?.athletic ?? []
    const rawForecast = prepForecast(forecastDay, athletic)
    // Honest estimates (D2/spec): never fabricate a ring from an empty profile with
    // no actual XP behind it (growthForecast already omits zero-xp skills, so this
    // is effectively "no skills at all", kept explicit per the plan's wording).
    const forecast = athletic.length === 0 && rawForecast.skills.every((s) => s.xpEst === 0) ? null : rawForecast
    const stats = prepStats(W)
    const oneRmMap = oneRmByIdentity(exerciseRecords)
    const exerciseGroups = groupExercisesByRegion(W.exercises)
    // Live weekly zone context (mezo-oyhy.7): the week's logged sets + today's
    // plan on the optimal-zone scale, for the groups this session trains.
    const zoneRows = activeMeso?.days && !weekLog.pending
      ? selectPrepRows(weekZoneRows({
          plannedDays: activeMeso.days,
          completed: weekLog.details,
          todayPlan: W.exercises.map((e) => ({ muscle: e.muscle, type: e.type, workingSets: e.workingSets, targetRIR: e.targetRIR })),
        }))
      : []
    const zonePlanWorkouts = (activeMeso?.days ?? []).filter((d) => d.exerciseCount > 0).length
    const zoneDoneWorkouts = weekLog.completedSummaries.filter((s) => s.origin === 'meso').length

    // Tile-page dispatch (mezo-d20.3.8, Huawei pattern): a tile opens its OWN
    // page with a compact hero + stat strip; '‹ Indítás' returns to the hub.
    const backToHub = () => setPrepTile(null)
    if (prepTile === 'gyakorlatok') {
      const progressionCount = W.exercises.filter((e) => (e.progression?.deltaKg ?? 0) !== 0 || (e.progression?.deltaReps ?? 0) !== 0).length
      return (
        <PrepGyakorlatokPage
          groups={exerciseGroups}
          stats={stats}
          progressionCount={progressionCount}
          oneRmOf={(e) => oneRmMap.get(identityKeyOf(e)) ?? null}
          challengeOf={(e) => {
            const c = challenges.find((x) => x.exerciseId === e.id && acceptedMap[x.id])
            return c ? { typeLabel: c.typeLabel, target: c.target } : null
          }}
          onBack={backToHub}
        />
      )
    }
    if (prepTile === 'fejlodes' && forecast) {
      return <PrepFejlodesPage forecast={forecast} workSets={stats.workSets} overload={W.overloadSummary} onBack={backToHub} />
    }
    if (prepTile === 'zona') {
      return <PrepHetiZonaPage rows={zoneRows} doneWorkouts={zoneDoneWorkouts} planWorkouts={zonePlanWorkouts} onBack={backToHub} />
    }
    if (prepTile === 'kuldetesek') {
      return (
        <PrepKuldetesekPage
          challenges={challenges}
          accepted={acceptedMap}
          onToggle={toggleChallenge}
          pending={challengesPending}
          onBack={backToHub}
        />
      )
    }
    if (prepTile === 'bemelegites') {
      return (
        <PrepBemelegitesPage
          rows={WARMUP_ROWS}
          niggleNote={niggleActive && !niggleConfirmed && W.niggleWarning
            ? `${W.niggleWarning.muscleLabel} — a bemelegítés blokkjai erre készítenek fel.`
            : null}
          onBack={backToHub}
        />
      )
    }
    if (prepTile === 'niggle' && W.niggleWarning) {
      return (
        <PrepNigglePage
          muscleLabel={W.niggleWarning.muscleLabel}
          detail={W.niggleWarning.detail}
          confirmed={niggleConfirmed}
          onConfirm={() => setNiggleConfirmed(true)}
          onBack={backToHub}
        />
      )
    }

    // ---- hub: hero (eyebrow + name + 4 mini stat cells + CTA above the fold) + the 6-tile mosaic ----
    const warmupTotalMin = WARMUP_ROWS.reduce((s, w) => s + w.minutes, 0)
    const acceptedCount = challenges.filter((c) => acceptedMap[c.id]).length
    const niggleLine = W.niggleWarning
      ? `${W.niggleWarning.muscleLabel} · ${niggleConfirmed ? 'kezelve ✓' : 'aktív'}`
      : null

    return (
      <div>
        {/* Breadcrumb — pinned below the status bar like native nav chrome (mezo-wdk) */}
        <div className="sticky-top" style={{ padding: '8px 24px' }}>
          <button className="row gap-sm" onClick={onExit}>
            <span style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>←</span>
            <span className="eyebrow">Vissza</span>
          </button>
        </div>

        <EntranceGroup>
          <div style={{ padding: '6px 24px 0' }}>
            <div className="mz-tile mz-w-coral tp-hero rise" style={{ '--d': '0ms' } as React.CSSProperties}>
              <span className="mz-eyebrow" style={{ color: 'var(--coral-deep)' }}>{huWeekdayFull()} · {weekLabel}</span>
              <span className="tp-title">{W.title}</span>
              <StatStrip className="mt-sm">
                <StatCell value={forecast ? `+${forecast.totalXp}` : '—'} label="várható XP" />
                <StatCell value={stats.workSets} label="szett" />
                <StatCell value={stats.durationEst > 0 ? `~${stats.durationEst}′` : '—'} label="idő" />
                <StatCell value={stats.muscleCount} label="izomcsoport" />
              </StatStrip>
              <button type="button" className="np-cta np-press tp-cta" onClick={beginWorkout}>
                ⚡ Kezdjük el →
              </button>
            </div>
          </div>

          <div style={{ padding: '11px 24px 24px' }}>
            <Mosaic>
              <Tile
                wash="coral" icon="i-edzes" eyebrow="Gyakorlatok" delayMs={70}
                line={`${W.exercises.length} gyakorlat · ${stats.workSets + stats.warmupSets} szett`}
                onClick={() => setPrepTile('gyakorlatok')} aria-label="Gyakorlatok"
              />
              {forecast && (
                <Tile
                  wash="coral" icon="i-growth" eyebrow="Fejlődés" delayMs={100}
                  line={`+${forecast.totalXp} XP`}
                  onClick={() => setPrepTile('fejlodes')} aria-label="Várható fejlődés"
                />
              )}
              {zoneRows.length > 0 && (
                <Tile
                  wash="white" icon="i-edzes" eyebrow="Heti zóna" delayMs={130}
                  line={`kész ${zoneDoneWorkouts}/${zonePlanWorkouts} edzés`}
                  onClick={() => setPrepTile('zona')} aria-label="Heti zóna"
                />
              )}
              <button
                type="button" className="mz-tile mz-w-gold rise" style={{ '--d': '160ms' } as React.CSSProperties}
                onClick={() => setPrepTile('kuldetesek')} aria-label="A mai küldetések"
              >
                <div className="mz-tile-top"><span className="mz-eyebrow">Küldetések</span></div>
                <div className="mz-spotwrap">
                  <span className="tp-anchor">
                    <ClayIcon name="i-kihivas" size={38} />
                    {acceptedCount > 0 && <span className="tp-badge">{acceptedCount}</span>}
                  </span>
                </div>
                <div className="mz-tile-line">{challengesPending ? 'készül…' : `${acceptedCount}/${challenges.length} elfogadva`}</div>
              </button>
              <Tile
                wash="sky" icon="i-lang" eyebrow="Bemelegítés" delayMs={190}
                line={`${warmupTotalMin} perc · ${WARMUP_ROWS.length} blokk`}
                onClick={() => setPrepTile('bemelegites')} aria-label="Bemelegítés"
              />
              {niggleActive && W.niggleWarning && (
                <button
                  type="button" className="mz-tile mz-w-gold tp-niggle rise" style={{ '--d': '220ms' } as React.CSSProperties}
                  onClick={() => setPrepTile('niggle')} aria-label="Aktív niggle"
                >
                  <div className="mz-tile-top"><span className="mz-eyebrow">Niggle</span></div>
                  <div className="mz-spotwrap">
                    <span className="tp-anchor">
                      <ClayIcon name="i-eletjel" size={38} />
                      {!niggleConfirmed && <span className="tp-badge">!</span>}
                    </span>
                  </div>
                  <div className="mz-tile-line">{niggleLine}</div>
                </button>
              )}
            </Mosaic>
          </div>
        </EntranceGroup>
      </div>
    )
  }

  // ---------- SUMMARY (closing) / COMPLETE (closed) ----------
  // Both render the WorkoutSummary: 'summary' is the pre-finish closing screen whose
  // "Edzés lezárása ✓" CTA drives finishWorkout; 'complete' is the same layout read-only
  // (set lines) after the finish POST resolves. The real medals earned this session
  // (mezo-wp6n) drive the summary now — replaces the old boolean PR-flag framing.
  if (phase === 'summary' || phase === 'complete') {
    const closing = phase === 'summary'
    return (
      <WorkoutSummary
        title={W.title}
        eyebrow={closing ? 'Edzés vége' : 'Lezárva · ma'}
        mode={closing ? 'closing' : 'closed'}
        exercises={summaryExercises}
        challenges={summaryChallenges}
        medals={sessionMedals}
        durationMin={W.durationEst}
        // The draft lives on the page, not in the shell: the summary/complete phase flip
        // remounts nothing here, but the note must also survive a trip back to `active`.
        note={closing ? null : closingNote.trim() || null}
        draftNote={closingNote}
        onDraftNote={closing ? setClosingNote : undefined}
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

  // Execution card v2 (mezo-8xmf): muscle-family theming + structured context
  // zones. `family` drives the card wash/rail/glow + the CTA/active-RIR-pill/
  // current-dot fills (all via the --fam-* custom props set on .excard below);
  // `cardStyle` is the set-budget style (setBudget.ts) driving the Stílus cell
  // + the RIR-row hint. `doneWorkingSets` and `firstWorkingTargetKg` read the
  // SESSION's live prescription (not the static `current.prescribedSets`) so a
  // removeSet-shifted warmup/working split stays correct.
  const family = muscleColor(current.muscle)
  const muscleLabel = MUSCLE_LABELS[current.muscle] ?? current.muscle
  const cardStyle = setStyle(current.targetRIR)
  const doneWorkingSets = Math.max(0, cursor - warmupCount)
  // Live working-slot count (mezo-8xmf final review): the Szett stat-cell denominator must
  // track the SESSION's live prescription like the numerator above, not the static
  // `current.workingSets` — otherwise a ＋Szett extra set shows `4/3` and a removed working
  // slot sticks at `/3`.
  const liveWorkingSetCount = Math.max(0, currentSetCount - warmupCount)
  const lastWarmupIdx = lastLoggedWarmupIdx(session, current.id, cursor)
  const warmupNote = lastWarmupIdx != null ? warmupPctLabel(current, lastWarmupIdx) : null
  // Logging-panel slot label (mezo-d20.3.9, prototype `slotLbl`): the panel names the
  // slot it is about to fill AND its target, so the target never needs a cell of its
  // own. `cél` parts are omitted when the engine prescribed nothing (honest state).
  const repUnit = current.type === 'plyo' ? ' mp' : ''
  const slotLabel = cursor >= currentSetCount
    ? 'Kész'
    : isWarmupSet
      ? `Logolás · B${cursor + 1}${currentTarget?.targetWeightKg != null ? ` · cél ${currentTarget.targetWeightKg.toLocaleString('hu-HU')} × ${currentTarget.targetReps}` : ''}`
      : `Logolás · ${cursor + 1 - warmupCount}. working · cél ${currentTarget?.targetWeightKg != null ? `${currentTarget.targetWeightKg.toLocaleString('hu-HU')} × ` : ''}${currentTarget?.targetReps ?? `${current.repMin}–${current.repMax}`}${repUnit}`
  // The demo video's resolved embed (null when there is no recognizable URL) — the
  // head's icon button only renders when this exists.
  const videoEmbedTarget = videoEmbed(current.videoUrl)
  // Session progress bar (under the header): one flex segment per exercise,
  // weighted by its own planned set count, coloured by ITS OWN muscle family.
  const progressSegments = sessionProgressSegments(
    W.exercises,
    currentIdx,
    (exId) => session.skipped.includes(exId) || (session.logged[exId]?.length ?? 0) >= effectiveSetCount(session, exId),
  )

  // Reorderable segment for the ⋯ action sheet: the VIEWED exercise ITSELF plus
  // everything after it in session.order (mezo-vad0 — the busy-machine case is
  // exactly "push the one I'm on back", so excluding it was the wrong cut); only
  // the exercises BEFORE it stay fixed. Reorder is client-only / ephemeral — it
  // just replaces session.order, never persists.
  const reorderable = (() => {
    const ci = session.order.indexOf(current.id)
    return session.order.slice(ci).map((id) => {
      const e = W.exercises.find((x) => x.id === id)!
      return { id, label: e.name, ...(id === current.id ? { current: true } : {}) }
    })
  })()
  const handleReorder = (newSegment: string[]) => {
    setSession((s) => {
      // Fixed segment anchors on the viewed exercise (from the render closure).
      const ci = s.order.indexOf(current.id)
      const fixed = s.order.slice(0, ci)
      return { ...s, order: [...fixed, ...newSegment] }
    })
    // Moving the viewed exercise off the head of the segment MEANS "later" — so the
    // session hands over to whatever is up now: the first unresolved exercise of the
    // new segment (a done/skipped one at the head would be a dead end), falling back
    // to its head. No feedbackEx guard needed — the sheet is unmounted while a
    // debrief is open (mount condition: actionSheetOpen && !feedbackEx).
    if (newSegment[0] === current.id) return
    const nextId = newSegment.find(
      (id) => !session.skipped.includes(id) && (session.logged[id]?.length ?? 0) < effectiveSetCount(session, id),
    )
    setViewedId(nextId ?? newSegment[0])
  }
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
    // Meso-less custom (saját) sessions have no template day to persist against —
    // already an effective no-op (mezo-ws2x D4), made explicit here.
    if (!activeMeso) return
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
      ...(e.countsTowardVolume !== undefined ? { countsTowardVolume: e.countsTowardVolume } : {}),
    }))
    saveDayExercises(activeMeso.id, day.id, exercises)
  }

  return (
    <>
      {toastMedal && <MedalToast medal={toastMedal.medal} extraCount={toastMedal.extra} />}
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
          reorderable={reorderable}
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
      {editingSetIdx !== null && !feedbackEx && (() => {
        const idx = editingSetIdx
        const t = prescribedAt(session, current.id, idx)
        const warm = t?.kind === 'warmup'
        const actual = session.logged[current.id]?.[idx]
        return (
          <SetEditSheet
            exerciseName={current.name}
            setLabel={setSlotLabel(idx, warm, warmupCount)}
            mode={actual ? 'logged' : 'pending'}
            kind={warm ? 'warmup' : 'working'}
            exerciseType={current.type}
            initial={{
              weight: actual?.weight ?? t?.targetWeightKg ?? prefill(current).weight,
              reps: actual?.reps ?? t?.targetReps ?? prefill(current).reps,
              rir: actual?.rir ?? t?.targetRIR ?? current.targetRIR,
              side: actual?.side ?? null,
              note: actual?.note ?? '',
            }}
            canDelete={canRemoveSet(session, current.id)}
            onSave={(v) => handleSetSave(idx, v)}
            onDelete={() => handleSetDelete(idx)}
            onClose={() => setEditingSetIdx(null)}
          />
        )
      })()}
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
                  className="cta-primary"
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
                  className="cta-ghost"
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
        {/* Header — Napív wk-top (spec §4.5), re-faced (mezo-d20.3.9, prototype
            #page-active head): back pill, the centered title + counter button, and the
            ⋯ actions chip. The exercise dots dropped OUT of the header into their own
            centered row below it, so the title can breathe on a phone. */}
        <div className="wk-top np-anim" style={{ '--i': 0 } as React.CSSProperties}>
          <button type="button" className="back np-press" aria-label="Vissza" onClick={onExit}>‹</button>
          {/* Counter is now a button — tapping it opens the jump-to overview sheet
              (spec 2026-07-15 free navigation). ▾ signals the drop-down affordance. */}
          <button type="button" className="tt wkx-tt" aria-label="Gyakorlatlista" disabled={!!feedbackEx} onClick={() => setOverviewOpen(true)}>
            <div className="t1">{W.title}</div>
            <div className="t2">▾ {currentIdx + 1}/{W.exercises.length} gyakorlat · {doneSets}/{totalSets} szett</div>
          </button>
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
              <button key={e.id} type="button" aria-label={`Ugrás: ${e.name}`} onClick={() => jumpTo(e.id)}>
                <i className={e.id === current.id ? 'cur' : resolved} />
              </button>
            )
          })}
        </div>

        {/* Session progress bar (v2, mezo-8xmf): one segment per exercise, flex-weighted
            by its planned set count, family-coloured; opacity signals done/current/upcoming. */}
        <div className="wkx-progressbar" aria-hidden="true">
          {progressSegments.map((seg, i) => (
            <span
              key={i}
              style={{
                flex: seg.weight,
                background: muscleColor(seg.colorMuscle).rail,
                opacity: seg.state === 'done' ? 1 : seg.state === 'current' ? 0.45 : 0.25,
              }}
            />
          ))}
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
          className="excard wkx-excard np-anim"
          style={{
            '--i': 1,
            '--fam-rail': family.rail,
            '--fam-wash': family.wash,
            '--fam-deep': family.deep,
          } as React.CSSProperties}
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
          {/* ① head — the eyebrow (idx/n · muscleLabel · type) + a SINGLE-LINE name,
              with the media as small round icon buttons on the right (mezo-d20.3.9,
              prototype .mrow + .mbtn). The old labelled "⛶ Kép" / "▶ Demo" chips
              are gone: mid-set the card must read as one calm block. */}
          <div className="wkx-exhead">
            <div className="wkx-exhead-grow">
              <div className="exo" style={{ color: family.deep }}>
                {currentIdx + 1}/{W.exercises.length} · {muscleLabel} · {current.type}
              </div>
              <h2>{current.name}</h2>
            </div>
            {current.imageStartUrl && (
              <button
                type="button"
                className={'wkx-mbtn' + (imageOpen ? ' on' : '')}
                aria-label="Kép"
                aria-expanded={imageOpen}
                onClick={() => setImageOpen((v) => !v)}
              >
                <span aria-hidden="true">⛶</span>
              </button>
            )}
            {videoEmbed(current.videoUrl) && (
              <button
                type="button"
                className={'wkx-mbtn' + (videoOpen ? ' on' : '')}
                aria-label="Demo videó"
                aria-expanded={videoOpen}
                onClick={() => setVideoOpen((v) => !v)}
              >
                <ClayIcon name="i-video" size={15} />
              </button>
            )}
          </div>

          {/* ② metaline — the muted one-liner that replaced the 3-cell stat strip:
              style · rep range · RIR, plus the accepted challenge as a dashed chip
              (the old full-width "Aktív kihívás" banner). */}
          <div className="wkx-metaline">
            <span className={cardStyle === 'failure' ? 'hot' : 'cool'}>
              {cardStyle === 'failure' ? '🔥 Failure' : '🌿 Volume'}
            </span>
            <span>· {current.repMin}–{current.repMax} {current.type === 'plyo' ? 'mp' : 'rep'}</span>
            <span>· RIR {current.targetRIR}</span>
            {activeChallenge && (
              <span className="wkx-chmini" title={activeChallenge.typeLabel}>
                <ClayIcon name="i-kihivas" size={11} />
                {activeChallenge.target}
              </span>
            )}
          </div>

          {/* Durable per-exercise note pill (F4) — one line, clamped; the full text
              stays reachable through ⋯ → Jegyzet. */}
          {effectiveNote && (
            <div aria-label="Gyakorlat-jegyzet" className="exercise-note-pill wkx-notepill">
              <span aria-hidden="true">✎</span>
              <span className="ntext">{effectiveNote}</span>
            </div>
          )}

          {/* Tap-to-reveal demo media (mezo-8xdl.4) — neither still nor video ever
              steals the logging surface unasked. */}
          {imageOpen && current.imageStartUrl && (
            <div className="wkx-media">
              <ExerciseImage
                start={current.imageStartUrl}
                end={current.imageEndUrl}
                name={current.name}
                muscle={current.muscle}
              />
            </div>
          )}
          {videoOpen && videoEmbedTarget && (
            <div className="wkx-media exvideo" style={{ aspectRatio: videoEmbedTarget.aspectRatio }}>
              <iframe title="Demo videó" loading="lazy" allowFullScreen src={videoEmbedTarget.src} />
            </div>
          )}

          {/* ③ THE logging panel — the one clearly bounded input zone of the screen
              ("a kártyán logolsz, a sávokban utánanézel"): slot label with its
              target, set dots + warmup-% note, steppers, RIR (working sets only),
              L/B/R for isolation, the collapsed per-set note, and the CTA / rest bar. */}
          <div className="wkx-logbox">
            <div className="wkx-logtop">
              <span className="eyebrow" style={{ color: family.deep }}>{slotLabel}</span>
              <span style={{ flex: 1 }} />
              <span className="wkx-lgoal">{doneWorkingSets}/{liveWorkingSetCount} szett</span>
            </div>

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
              {/* ④ last-logged-warmup note (spec §Execution card v2): the % of the
                  first working target this warmup was loaded at. */}
              {warmupNote && <span className="mono wkx-setdots-note">{warmupNote} ✓</span>}
            </div>

            {/* The inputs only exist while there IS a slot to log — a finished
                exercise shows its dots and the done line, nothing to fill in. */}
            {cursor < currentSetCount && (
              <>
                {/* Flexible steppers (tap ± or type the exact value). Only genuinely
                    load-less exercises (plyo) hide the kg stepper. */}
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
                    <span style={{ flex: 1 }} />
                    {/* ⑥ inline style hint — failure pushes to bukásig, volume keeps reserve. */}
                    <span className="wkx-rirhint" style={{ color: cardStyle === 'failure' ? 'var(--amber-deep)' : 'var(--sage-deep)' }}>
                      {cardStyle === 'failure' ? '🔥 bukásig!' : '🌿 hagyj 2 rep tartalékot'}
                    </span>
                  </div>
                )}
                {current.type === 'isolation' && (
                  <div className="rirrow">
                    <span className="rk">Oldal</span>
                    {(['L', 'B', 'R'] as const).map((s) => (
                      <button key={s} type="button" aria-pressed={side === s} onClick={() => setSide(side === s ? null : s)}>
                        {s}
                      </button>
                    ))}
                  </div>
                )}

                {/* Transient per-set note (SetLogRequest.note) — COLLAPSED behind a
                    toggle in the calm default; cleared (and re-collapsed) after each
                    log. Distinct from the durable per-exercise note pill/editor. */}
                {noteOpen || note ? (
                  <input
                    className="setnote"
                    aria-label="Szett megjegyzés"
                    placeholder="Megjegyzés ehhez a szetthez (opcionális)"
                    maxLength={500}
                    autoFocus={noteOpen}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                ) : (
                  <button type="button" className="wkx-notetoggle" onClick={() => setNoteOpen(true)}>
                    ＋ megjegyzés a szetthez
                  </button>
                )}
              </>
            )}

            {/* I2 (fix round 1): a delete can complete the exercise WITHOUT going through
                completeSet's own last-set branch (which is what normally pins `feedbackEx`
                and never re-renders this CTA afterwards) — so the CTA is gated on the
                cursor directly: once there is no next slot to log, it must not linger.
                N3 (fix round 2): the REST BAR is a different story — a rest can still be
                genuinely running (free-navigated away from mid-rest, or navigated back to
                a since-completed exercise) and must stay visible/pausable regardless of
                whether this exercise still has a next slot; only the CTA is cursor-gated. */}
            {rest.status === 'idle' ? (
              cursor < currentSetCount ? (
                <button type="button" className="donebtn np-press" onClick={completeSet}>
                  Szett kész ✓
                </button>
              ) : (
                <div className="wkx-alldone">✓ Minden szett megvan ennél a gyakorlatnál</div>
              )
            ) : (
              <RestTimerBar
                remaining={rest.remaining}
                total={rest.total}
                paused={rest.status === 'paused'}
                onPause={rest.pause}
                onResume={rest.resume}
                onSkip={rest.skip}
              />
            )}
          </div>
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

        {/* Progressive-overload signal (mezo-5pfe): the structured banner when the engine
            emits a progression, else the plain rationale strip (first session / anchor).
            Re-face (mezo-d20.3.9): the banner is REFERENCE content, so it lives in a thin
            collapsible strip whose closed header already carries the delta chip
            ("⚡ Progresszió · +2,5 kg ▾"). The rationale strip stays as-is — one muted
            sentence is already calm. */}
        {current.progression ? (
          <CollapsibleStrip
            className="wkx-strip"
            eyebrow="⚡ Progresszió"
            chip={<span className="wkx-pochip" data-lever={current.progression.lever}>{progressionDeltaLabel(current.progression)}</span>}
          >
            <ProgressionBanner progression={current.progression} lastWeek={current.lastWeek} bare />
          </CollapsibleStrip>
        ) : current.rationale ? (
          <div className="aistrip">
            <span aria-hidden="true">✨</span>
            <p>{current.rationale}</p>
          </div>
        ) : null}

        {/* Set list (v4, mezo-8xmf — strict table): exercise-level constants
            (the rep-range/RIR target, the last-week comparison) appear ONCE —
            in the header pill and the footer — instead of repeating per row.
            Rows are fixed SZETT/KG/ISM/RIR/status columns; tap opens the same
            SetEditSheet as before. */}
        {(() => {
          // Zip the session's LoggedSet[] (weight/reps/rir, no `kind`) with each
          // slot's OWN prescribed kind so the pure workoutCardMeta helpers (which
          // take a generic {weightKg, reps, kind} shape) can run over it.
          const loggedForMeta = (session.logged[current.id] ?? []).map((s, j) => ({
            weightKg: s.weight,
            reps: s.reps,
            rir: s.rir,
            kind: (prescribedAt(session, current.id, j)?.kind ?? 'working') as 'warmup' | 'working',
          }))
          const tonnage = exerciseTonnage(loggedForMeta)
          const deltaPct = topSetDeltaPct(loggedForMeta, current.lastWeek?.weight ?? null)
          const avgRir = avgWorkingRir(loggedForMeta)
          return (
            <CollapsibleStrip
              className="wkx-strip"
              eyebrow="Szettek"
              summary={`${cursor}/${currentSetCount} ✓${tonnage ? ` · ${tonnage.toLocaleString('hu-HU')} kg` : ''}`}
            >
            <div
              className="wkx-slist"
              style={{ '--fam-rail': family.rail, '--fam-wash': family.wash, '--fam-deep': family.deep } as React.CSSProperties}
            >
              {/* Exercise-level target — the ONLY place the rep-range/RIR/style shows. */}
              <div className="wkx-shead">
                <span className="wkx-tgt" style={{ background: family.wash, color: family.deep }}>
                  cél: {current.repMin}–{current.repMax} rep · RIR {current.targetRIR} {cardStyle === 'failure' ? '🔥' : '🌿'}
                </span>
                <span style={{ flex: 1 }} />
                <span className="wkx-shint">sorra koppintva szerkeszthető</span>
              </div>

              <div className="wkx-srow wkx-srow-head">
                <span className="wkx-c-set">Szett</span>
                <span className="wkx-c-kg">kg</span>
                <span className="wkx-c-rep">ism</span>
                <span className="wkx-c-rir">RIR</span>
                <span className="wkx-c-st" />
              </div>

              {Array.from({ length: currentSetCount }, (_, i) => {
                const t = prescribedAt(session, current.id, i)
                const warm = t?.kind === 'warmup'
                const actual = session.logged[current.id]?.[i]
                const isDone = i < cursor
                const isCurrentRow = i === cursor
                // Medals earned by this already-logged set (mezo-wp6n): RECORD ones
                // still get a chip in the status cell (a TARGET_HIT carries no visual
                // of its own anymore — the rep-range status column below already
                // covers "hit vs missed", now the table's own doing).
                const setMedals = isDone ? medalsBySet[`${current.id}:${i}`] ?? [] : []

                // C2 (fix round 1): a LOGGED row whose log is still genuinely IN FLIGHT
                // (the window between the optimistic local append and logSet's response)
                // must not be tappable — editing/deleting it then would have nothing to
                // PUT/DELETE against, silently orphaning the server-side row forever. A
                // not-yet-logged (pending) row legitimately has no id and stays tappable.
                // F1 (fix round 3): a row whose log is KNOWN to have failed is NOT
                // in-flight — there is no server row, for certain, so it's tappable too
                // (delete falls back to local-only, same as a pending slot).
                const rowFailed = !!actual?.localId && failedSetLocalIds.has(actual.localId)
                const rowDisabled = isDone && !actual?.id && !rowFailed

                // aria-label — unchanged shape from the pre-v4 row (target for
                // pending sets, logged actuals for done ones); several tests assert
                // its exact text.
                const wLbl = isDone ? actual?.weight : t?.targetWeightKg
                const rLbl = isDone ? actual?.reps : t?.targetReps
                const rrLbl = isDone ? actual?.rir : t?.targetRIR
                const ariaLabel = `${setSlotLabel(i, warm, warmupCount)} szerkesztése${isDone ? ` — ${wLbl ?? '–'} kg × ${rLbl ?? '–'}${warm ? '' : ` — RIR ${rrLbl ?? '–'}`}` : ''}`

                const markLabel = warm ? `B${i + 1}` : String(i - warmupCount + 1)
                const markCls = isCurrentRow ? 'wkx-mark-cur' : warm ? 'wkx-mark-warm' : isDone ? 'wkx-mark-done' : 'wkx-mark-pend'

                // KG/ISM/RIR: logged actuals for done rows; ghosted TARGET values for
                // pending ones (the exercise's own rep RANGE for a pending working
                // row — its single targetReps is only meaningful for a warmup ramp).
                const kgVal = isDone ? actual?.weight ?? null : t?.targetWeightKg ?? null
                const kgDisplay = kgVal == null ? '—' : kgVal.toLocaleString('hu-HU')
                const repDisplay = isDone
                  ? String(actual?.reps ?? '—')
                  : warm
                    ? String(t?.targetReps ?? '—')
                    : `${current.repMin}–${current.repMax}`
                const rirDisplay = warm ? '–' : String(isDone ? actual?.rir ?? '–' : t?.targetRIR ?? current.targetRIR)

                let statusNode: React.ReactNode = null
                if (isCurrentRow) {
                  statusNode = <span className="wkx-stat-most" style={{ color: family.deep }}>MOST ↑</span>
                } else if (isDone && actual) {
                  const status = setStatus(current, { reps: actual.reps, kind: warm ? 'warmup' : 'working' })
                  statusNode = status === 'ok'
                    ? <span className="wkx-stat-ok">✓</span>
                    : <span className="wkx-stat-dev">{status === 'below' ? '▼ cél alatt' : '▲ cél felett'}</span>
                }

                return (
                  <button
                    key={i}
                    type="button"
                    className={'wkx-srow' + (isCurrentRow ? ' wkx-srow-cur' : warm ? ' wkx-srow-warm' : '')}
                    disabled={rowDisabled}
                    aria-label={ariaLabel}
                    onClick={() => setEditingSetIdx(i)}
                  >
                    <span className="wkx-c-set">
                      <span className={'wkx-mark ' + markCls}>{markLabel}</span>
                    </span>
                    <span className="wkx-c-kg num" style={{ color: isDone ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{kgDisplay}</span>
                    <span className="wkx-c-rep num" style={{ color: isDone ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{repDisplay}</span>
                    <span className="wkx-c-rir num" style={{ color: isDone ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{rirDisplay}</span>
                    <span className="wkx-c-st">
                      {statusNode}
                      {isDone && setMedals.filter((m) => m.tier === 'RECORD').map((m, mi) => <MedalChip key={mi} medal={m} />)}
                    </span>
                  </button>
                )
              })}

              {/* Exercise-level summary — the ONLY place volume/last-week/RIR shows. */}
              <div className="wkx-sfoot">
                <div>
                  <div className="l">Volumen</div>
                  <div className="v num">{tonnage.toLocaleString('hu-HU')} kg</div>
                </div>
                <div>
                  <div className="l">vs múlt hét</div>
                  <div className="v" style={{ color: deltaPct == null ? 'var(--text-tertiary)' : deltaPct >= 0 ? 'var(--sage-deep)' : 'var(--amber-deep)' }}>
                    {deltaPct == null ? '–' : `${deltaPct > 0 ? '+' : ''}${deltaPct}%`}
                  </div>
                </div>
                <div>
                  <div className="l">Átl. RIR</div>
                  <div className="v num">{avgRir == null ? '–' : avgRir.toLocaleString('hu-HU', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</div>
                </div>
              </div>
            </div>
            </CollapsibleStrip>
          )
        })()}
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
              className="cta-primary"
              style={{ padding: '12px 18px', fontSize: 14 }}
              onClick={() => {
                onSave(text.trim())
                close()
              }}
            >
              Mentés
            </button>
            <button type="button" className="cta-ghost" style={{ padding: 12, fontSize: 13 }} onClick={close}>
              Mégse
            </button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
