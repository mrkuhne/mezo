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
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useChallengeActions, useChallenges, useGoal, useProgressionProfile, useTimingProfile, useTrain, useWeekMuscleLog, useWorkoutNote } from '@/data/hooks'
import { huWeekdayFull, localDateString } from '@/shared/lib/dates'
import { screenScroller, scrollToTop } from '@/shared/lib/screenScroll'
import { useBackNav } from '@/shared/hooks/useBackNav'
import { useLevelUp } from '@/features/progression/LevelUpProvider'
import { useTutorial } from '@/features/tutorial/TutorialProvider'
import { restSecondsFor } from '@/features/train/logic/restTimer'
import { identityKeyOf, oneRmByIdentity, prepForecast, prepStats, pseudoDayFromPlan } from '@/features/train/logic/prepBriefing'
import { REGION_LABELS, muscleColor, muscleRegion, regionColor } from '@/features/train/logic/muscleColors'
import { selectPrepRows, weekZoneRows } from '@/features/train/logic/weekZone'
import { sessionProgressSegments } from '@/features/train/logic/workoutCardMeta'
import { useRestTimer } from '@/features/train/logic/useRestTimer'
import { WorkoutDock } from '@/features/train/components/WorkoutDock'
import { WorkoutCard, prefill, setSlotLabel } from '@/features/train/components/WorkoutCard'
import { WorkoutMenuGlass, WorkoutVideoGlass } from '@/features/train/components/WorkoutMenuGlass'
import { WorkoutRecordsGlass } from '@/features/train/components/WorkoutRecordsGlass'
import { FinishConfirmGlass } from '@/features/train/components/FinishConfirmGlass'
import { recordFor } from '@/features/train/logic/recordFor'
import type { LoggedWorkoutExercise, Mesocycle, WorkoutPlan } from '@/data/types'
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
  pendingByExercise,
  pendingSetCount,
  prescribedAt,
  removeSet,
  seedFromOpen,
  skipExercise as skipExerciseModel,
  unskipExercise as unskipExerciseModel,
  updateLoggedSet,
} from '@/features/train/logic/workoutState'
import { ScreenSkeleton } from '@/shared/ui/ScreenSkeleton'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { MedalToast } from '@/features/train/components/MedalToast'
import { FeedbackModal, type ExerciseFeedbackValues } from '@/features/train/sheets/FeedbackModal'
import { WorkoutSummary, type SummaryChallenge, type SummaryExercise } from '@/features/train/components/WorkoutSummary'
import { WorkoutCeremony } from '@/features/train/components/WorkoutCeremony'
import { cerScore, muscleStarRows } from '@/features/train/logic/cerScore'
import { medalValueLabel } from '@/features/train/logic/medalLabels'
import { estimateSessionMinutes } from '@/features/train/logic/sessionLength'
import { trainDayEnergy } from '@/features/train/logic/trainDayEnergy'
import { evaluateChallenge } from '@/features/train/logic/challengeOutcome'
import { SetEditSheet, type SetEditValues } from '@/features/train/sheets/SetEditSheet'
import { ClayIcon } from '@/shared/ui/clay'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { Mosaic, StatCell, StatStrip, Tile } from '@/shared/ui/mozaik'
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

function ActiveWorkoutSession({
  workout, activeMeso, todaySession, startWorkout, logSet, updateSet, deleteSet, skipExercise, saveExerciseNote, saveWorkoutFeedback, finishWorkout, saveDayExercises,
}: SessionProps) {
  const W = workout
  const goBack = useBackNav('/train')
  const navigate = useNavigate()
  const qc = useQueryClient()
  const rest = useRestTimer()
  // Live weekly zone context (mezo-oyhy.7): unconditional hook call at the top —
  // the prep block below reads its result, but the hook itself must run every
  // render regardless of phase so hook order stays stable.
  const weekLog = useWeekMuscleLog()
  // The ceremony's kcal tile mirrors Mai's energy card (T5, mezo-88iwa.6): the SAME
  // calibrated session estimate and the SAME weight source Fuel's budget reads, so the two
  // screens can never disagree. Both hooks are unconditional here for the same reason
  // `weekLog` is — the summary phase below is the only reader, but hook order must not
  // depend on the phase.
  const { data: timingProfile, isPending: timingProfilePending } = useTimingProfile()
  const { goal, goalResponse } = useGoal()
  // The closing note is written AFTER the finish POST now (the ceremony is post-finish, so
  // the note can no longer ride the finish body) — this is the review page's own write path.
  const { saveNote } = useWorkoutNote()
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

  const [phase, setPhase] = useState<Phase>(initialPhase)
  // Mezo-kalauz (mezo-gb1s.5, D11): ez az oldal chrome-mentes (AppLayout hideChrome),
  // a fejléc ?-e itt nem létezik — az újranyitás a prep breadcrumb mini ?-én át megy.
  const kalauz = useTutorial()
  const [session, setSession] = useState<Session>(initialSession)
  const [workoutId, setWorkoutId] = useState<string | null>(open?.id ?? null)
  // Medal collection (mezo-wp6n): every medal earned this session (set-log + finish),
  // the set-row lookup (keyed `${exerciseId}:${setIndex}`) driving the chips + the
  // tick colour, and the currently-shown RECORD-tier celebration toast (+ how many
  // other medals landed on the same set).
  const [sessionMedals, setSessionMedals] = useState<Medal[]>([])
  const [medalsBySet, setMedalsBySet] = useState<Record<string, Medal[]>>({})
  const [toastMedal, setToastMedal] = useState<{ medal: Medal; extra: number } | null>(null)
  // The explicit-finish POST is in flight — disables the "Edzés lezárása ✓" CTA
  // AND (T6 Task 6) the new .wo-finish / dock-Lezárás CTA + the confirm glass's own primary.
  const [finishPending, setFinishPending] = useState(false)
  // Which exercise the CURRENT rest belongs to (T6 Task 6's dock needs a name to show,
  // "PIHENŐ · <EXERCISE>" — useRestTimer itself is exercise-agnostic). Set alongside the
  // one `rest.start` call site in handleLogSet; stale once idle is harmless (the dock only
  // reads it while `rest.status !== 'idle'`).
  const [restExerciseId, setRestExerciseId] = useState<string | null>(null)
  // The finish confirm glass (T6 Task 6, prototype confirmGlass): opened by the .wo-finish
  // CTA or the dock's "Lezárás →" whenever pending sets remain — see handleFinishTap below.
  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false)
  /** The workout-level closing note (mezo-d20.8.2.2) — a page-owned draft, so stepping back to
   *  `active` and returning to the summary does not throw away what was already typed. */
  const [closingNote, setClosingNote] = useState('')
  /** The finish response's real XP (mezo-88iwa.8): the ceremony's +XP tile shows it, and
   *  renders nothing when the response carried no level-up payload at all. */
  const [xpGained, setXpGained] = useState<number | null>(null)
  const { showLevelUp } = useLevelUp()
  // The just-finished exercise pinned for the debrief modal (and the active card
  // it overlays): once resolved, the view advances to the next exercise, so we keep
  // an explicit feedback target that overrides `viewedId` until the debrief closes.
  const [feedbackEx, setFeedbackEx] = useState<LoggedWorkoutExercise | null>(null)
  const [niggleConfirmed, setNiggleConfirmed] = useState(false)
  // Prep mosaic (mezo-d20.3.8): which tile's own page is open, null = the hub.
  const [prepTile, setPrepTile] = useState<PrepTile | null>(null)
  const [acceptedChallenges, setAcceptedChallenges] = useState<string[]>([])
  // The per-card glass surface open right now (T6 Task 4/5) — null = closed. `kind`
  // distinguishes the ⋮ menu itself, the Videó glass it can switch to, and the
  // records glass opened straight from the card's own log button; `id` addresses
  // the card, exactly like the old menuExId did for ExerciseActionSheet.
  const [glass, setGlass] = useState<{ kind: 'menu' | 'video' | 'records'; id: string } | null>(null)
  // After "＋ Szett" we offer to persist the bumped set count to the template (F2).
  const [addSetPrompt, setAddSetPrompt] = useState<{ exerciseId: string } | null>(null)
  // F4 durable per-exercise note: which exercise's editor is open + a per-exercise
  // local override so the pill updates instantly in BOTH modes (mock no-ops the
  // mutation; real refetches /today, but the override avoids a flash in between).
  const [noteEditExId, setNoteEditExId] = useState<string | null>(null)
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({})
  // The set row tapped for edit/delete (mezo-l3on) — addressed by exerciseId + index,
  // because every exercise is on screen at once now.
  const [editingSet, setEditingSet] = useState<{ exerciseId: string; idx: number } | null>(null)
  // The `localId`s of logged sets whose logSet POST errored (mezo-l3on fix-round-3, F1).
  // A failed log means "there is no server row" — that's certain, not transient — so the
  // honest UI keeps the set visible (no silent rollback, which was itself the round-2 bug:
  // it could desync `logged[i]` from `prescribed[i]`) and simply lets the row become
  // tappable again, same as a bound `id` would. The global mutation-error toast already
  // tells the user the save failed; this just keeps the row from being a dead end.
  const [failedSetLocalIds, setFailedSetLocalIds] = useState<Set<string>>(() => new Set())

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

  // The session CURSOR exercise: the first unresolved one in `session.order`. The card
  // list shows every exercise at once (T6 Task 3), so this is no longer a "viewed"
  // exercise — it only drives the header's progress counter and the header ⋯ menu's
  // default target. A debrief pins its own exercise on top of it.
  const current = feedbackEx ?? W.exercises.find((e) => e.id === currentExerciseId(session)) ?? W.exercises[0]
  const currentIdx = W.exercises.findIndex((e) => e.id === current.id)
  const exerciseById = (id: string | null | undefined) => (id ? W.exercises.find((e) => e.id === id) ?? null : null)
  // Effective note of one exercise: a just-saved local override wins, else the
  // backend/mock note, else empty (drives the card's pill + the editor prefill).
  const noteOf = (e: LoggedWorkoutExercise) => localNotes[e.id] ?? e.note ?? ''
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

  const handleLogSet = (
    finishing: LoggedWorkoutExercise,
    input: { weight: number; reps: number; rir: number | null; side: Side | null },
  ) => {
    const { weight, reps, side } = input
    // Warmup rows carry no RIR at all (mezo-eerq) — the card hands over null there;
    // the local model still needs a number, so it stores 0 and the payload omits it.
    const rir = input.rir ?? 0
    const weightless = finishing.type === 'plyo'
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
      ...(side ? { side } : {}),
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

    // Last set of this exercise → pin it for the debrief sheet. Otherwise
    // completeSetModel already advanced the cursor for the same exercise, and the
    // rest starts (mezo-xt65).
    if (wasSetIdx + 1 >= effectiveSetCount(session, finishing.id)) {
      setFeedbackEx(finishing)
      // The debrief takeover unmounts a possibly mid-close menu glass (mount
      // condition: glass?.kind === 'menu' && !feedbackEx) without its onClose ever
      // firing — reset the target here or the glass re-opens once the debrief
      // resolves. Pre-mezo-91rw the Sheet's leaked exit timer masked this by
      // firing the parent setState after the unmount.
      setGlass(null)
    } else {
      rest.start(restSecondsFor(finishing.type))
      setRestExerciseId(finishing.id)
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

  const handleSetSave = (ex: LoggedWorkoutExercise, idx: number, v: SetEditValues) => {
    const setId = session.logged[ex.id]?.[idx]?.id
    setSession(updateLoggedSet(session, ex.id, idx, { weight: v.weight, reps: v.reps, rir: v.rir, side: v.side, note: v.note }))
    clearExerciseMedals(ex)
    const isWarmup = prescribedAt(session, ex.id, idx)?.kind === 'warmup'
    if (setId) {
      updateSet(workoutId ?? 'mock', setId, {
        weightKg: ex.type === 'plyo' ? 0 : v.weight,
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
    setEditingSet(null)
  }

  const handleSetDelete = (ex: LoggedWorkoutExercise, idx: number) => {
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
    setEditingSet(null)
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
      setGlass(null)
    }
  }

  // The save button of the debrief persists the RP values for the just-finished exercise.
  const saveFeedback = (vals: ExerciseFeedbackValues) => {
    if (workoutId && feedbackEx) saveWorkoutFeedback(workoutId, [{ exerciseId: feedbackEx.id, ...vals }])
  }

  /** The ceremony's closing note, saved on the way out (mezo-88iwa.8). It used to ride the
   *  finish POST, but the note field now lives in the post-finish ceremony — so the write
   *  goes through the workout-note endpoint the review page already uses. Mock mode has no
   *  instance id (and no server), so there is nothing to persist there.
   *
   *  Fix round 1: never PUTs an empty draft (the old unconditional call cleared the
   *  instance's note the moment either CTA fired, even with nothing typed) and never
   *  re-sends a draft byte-identical to the last save — `lastSavedNoteRef` is the dedupe
   *  key both this call and the unmount save below share, so a CTA tap immediately
   *  followed by the resulting unmount does not double-PUT. */
  const persistClosingNote = () => {
    const trimmed = closingNote.trim()
    if (!workoutId || !trimmed || trimmed === lastSavedNoteRef.current) return
    saveNote(workoutId, trimmed)
    lastSavedNoteRef.current = trimmed
  }

  // Refs mirroring the latest draft/id/phase/saveNote for the unmount-save effect below —
  // browser-back (or any other route change) unmounts this page without going through
  // either ceremony CTA, so the closing note would otherwise be silently dropped
  // (mezo-88iwa.8 fix round 1). The effect's cleanup only runs once, on unmount, so it
  // must read through refs rather than closing over stale render-time values.
  const closingNoteRef = useRef(closingNote)
  closingNoteRef.current = closingNote
  const workoutIdRef = useRef(workoutId)
  workoutIdRef.current = workoutId
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const lastSavedNoteRef = useRef('')
  const saveNoteRef = useRef(saveNote)
  saveNoteRef.current = saveNote

  useEffect(() => {
    return () => {
      const trimmed = closingNoteRef.current.trim()
      const id = workoutIdRef.current
      if (phaseRef.current === 'summary' && id && trimmed && trimmed !== lastSavedNoteRef.current) {
        saveNoteRef.current(id, trimmed)
        lastSavedNoteRef.current = trimmed
      }
    }
    // Mount-once: this is a page-lifetime unmount guard, not a per-render effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Finish the workout (the ONLY completion trigger — the active list's finish CTA) and
  // present the gamified level-up. Real mode POSTs with the instance id; mock has no
  // instance (workoutId null → 'mock' sentinel) but the mock finish mutation still returns
  // a seeded LevelUpResult so the prototype shows the overlay. The overlay (the global
  // LevelUpProvider host) portals OVER the ceremony and is dismissed on its Tovább CTA,
  // revealing it. Switch-off / no-levelUp (real `levelUp` absent) simply lands on the
  // ceremony with no overlay. On success the server re-evaluates the challenges lazily on
  // the next list read, so we invalidate them (real only).
  //
  // T7 (mezo-88iwa.8): EVERY success path lands on 'summary' — the two-act closing
  // ceremony IS the close moment, so the zero-pending shortcut goes there too.
  const finishAndCelebrate = () => {
    setFinishPending(true)
    finishWorkout(workoutId ?? 'mock', {
      // The closing note is typed INSIDE the ceremony now, which renders after this POST
      // resolves — so the body can only carry a note an earlier attempt already had (the
      // retry path). The ceremony's own note is saved through `saveNote` on close/blur.
      note: closingNote.trim() || null,
      onSuccess: (r) => {
        if (r?.levelUp) showLevelUp(r.levelUp)
        // The ceremony's +XP tile is the wire's number or nothing — never a fabricated
        // count×10. `LevelUpResult.totalXp` is the session's real award (the schema has no
        // top-level XP field on the plain finish response); absent payload → no tile.
        setXpGained(r?.levelUp?.totalXp ?? null)
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
        setPhase('summary')
      },
      // Reset the pending flag on BOTH success and failure — a failed finish POST must
      // re-enable the finish CTA so it can be retried (never stuck disabled).
      onSettled: () => setFinishPending(false),
    })
  }

  // The manual-finish entry point (T6 Task 6, prototype finishCta/dock): tapping the
  // .wo-finish CTA or the dock's "Lezárás →" with pending sets remaining asks first (the
  // confirm glass); with nothing pending it finishes right away — there is nothing to warn
  // about. Since T7 this is the ONLY way a workout closes: the pre-finish closing-review
  // screen is gone, and 'summary' is the post-finish ceremony.
  const handleFinishTap = () => {
    if (pendingSetCount(session) > 0) setFinishConfirmOpen(true)
    else finishAndCelebrate()
  }

  // Feedback resolution (skip or save both advance). The card list has nowhere to
  // advance TO — every exercise is already on screen — so this only drops the pinned
  // debrief target. Resolving the LAST exercise no longer flips the phase (T7,
  // mezo-88iwa.8): the ceremony is a post-finish reward, so the user stays on the card
  // list — now fully ticked, its finish CTA in its `full` state — and closes explicitly.
  const advanceAfterFeedback = () => {
    setFeedbackEx(null)
  }

  // Skip ONE exercise (NO debrief): persist the skip marker. The card collapses in place;
  // skipping the last unresolved exercise leaves the same explicit finish CTA as above.
  const handleSkip = (exId: string) => {
    // Abandoning the exercise must not leave the rest bar counting down
    // toward it (final-review fix, mezo-8141 — Ride-along A).
    rest.skip()
    if (workoutId) skipExercise(workoutId, exId)
    setSession(skipExerciseModel(session, exId))
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
        <div className="sticky-top" style={{ padding: '8px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button className="row gap-sm" onClick={onExit}>
            <span style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>←</span>
            <span className="eyebrow">Vissza</span>
          </button>
          {/* Mini ? (D11): a fejléc-gomb receptje, csak a prep-fázisban — az élő logolás
              fölé a kalauz nem nyúl. Auto-open az első belépéskor; ez az újranézés útja. */}
          {kalauz.current && (
            <button type="button" className="nap-roundbtn nap-q" aria-label="Kalauz ehhez az oldalhoz"
              aria-haspopup="dialog" onClick={() => kalauz.open(kalauz.current!.id)}>
              <span className="nap-q-glyph" aria-hidden="true">?</span>
            </button>
          )}
        </div>

        <EntranceGroup>
          <div style={{ padding: '6px 24px 0' }}>
            <div className="mz-tile mz-w-coral tp-hero rise" data-kalauz-anchor="session-start" style={{ '--d': '0ms' } as React.CSSProperties}>
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

  // ---------- SUMMARY (the closing ceremony) / COMPLETE (closed) ----------
  // 'summary' is the post-finish two-act ceremony (T7, mezo-88iwa.8): the finish POST has
  // already resolved when it renders, and its way out goes straight to Mai — there is no
  // intermediate read-only screen. 'complete' still renders the old WorkoutSummary; Task 4
  // turns it into the settled recap.
  if (phase === 'summary') {
    // The gym block's kcal, derived exactly the way Mai's energy card derives it (T5):
    // the calibrated session estimate × the MET math over the goal's weight. Held back
    // entirely when the estimate has no honest input — no weight, still-pending timing
    // profile, or a session that logged nothing at all (a skipped workout earns no kcal).
    // Fix round 1 (mezo-88iwa.8): the estimate above is for the WHOLE planned session —
    // scaled here by the done/planned set share (prototype rule, session.js:337) so 1 of
    // 22 sets doesn't earn the same kcal as all 22. Guard target.sets===0 (no prescribed
    // sets at all) to avoid a divide-by-zero; the existing done.sets>0 gate below still
    // hides the tile when nothing was logged.
    const score = cerScore(session, W.exercises)
    const setShare = score.target.sets > 0 ? Math.min(1, score.done.sets / score.target.sets) : 0
    const plannedGymMinutes = timingProfilePending
      ? 0
      : estimateSessionMinutes(W.exercises, timingProfile ?? undefined)
    const gymMinutes = plannedGymMinutes * setShare
    const weightKg = goal?.currentWeight ?? goalResponse?.startWeightKg ?? 0
    const energy = trainDayEnergy(
      gymMinutes > 0 ? [{ kind: 'gym' as const, minutes: gymMinutes, done: true }] : [],
      weightKg || null,
    )
    const kcal = energy.known && energy.earnedKcal > 0 && score.done.sets > 0
      ? ({ value: energy.earnedKcal, known: true } as const)
      : null
    return (
      <WorkoutCeremony
        score={score}
        eyebrow="EDZÉS LEZÁRVA"
        // The measured counterpart (mezo-1jm8) is deliberately NOT wired here. `open`
        // (todaySession.openWorkout) never carries it: the backend writes activeSeconds only
        // inside WorkoutService.finishWorkout, nowhere on the start/active path, so a pre-finish
        // instance has startedAt but never finishedAt/activeSeconds — and this page never
        // refetches /today after finishAndCelebrate's POST resolves, so even post-finish `open`
        // stays exactly as stale as it was pre-finish. There is no measurement this page can
        // show without a new fetch/invalidation, which the brief rules out. The review page
        // (WorkoutReviewPage, off the persisted WorkoutDetailResponse) is the surface that shows
        // the measured duration — the ceremony simply omits the tile rather than fabricating one.
        minutes={null}
        xpGained={xpGained}
        records={sessionMedals
          .filter((m) => m.tier === 'RECORD')
          .map((m) => ({ name: m.exerciseName, value: medalValueLabel(m) }))}
        muscles={muscleStarRows(session, W.exercises)}
        kcal={kcal}
        note={closingNote}
        onNote={setClosingNote}
        onClose={() => {
          persistClosingNote()
          navigate('/train/mai')
        }}
        onGoFuel={() => {
          persistClosingNote()
          navigate('/fuel')
        }}
      />
    )
  }

  if (phase === 'complete') {
    return (
      <WorkoutSummary
        title={W.title}
        eyebrow="Lezárva · ma"
        mode="closed"
        exercises={summaryExercises}
        challenges={summaryChallenges}
        medals={sessionMedals}
        durationMin={W.durationEst}
        // The measured counterpart (mezo-1jm8) is deliberately NOT wired here. `open`
        // (todaySession.openWorkout) never carries it: the backend writes activeSeconds only
        // inside WorkoutService.finishWorkout, nowhere on the start/active path, so a pre-finish
        // instance has startedAt but never finishedAt/activeSeconds — and this page never
        // refetches /today after finishAndCelebrate's POST resolves, so even post-finish `open`
        // stays exactly as stale as it was pre-finish. There is no measurement this page can
        // show without a new fetch/invalidation, which the brief rules out. The review page
        // (WorkoutReviewPage, off the persisted WorkoutDetailResponse) is the surface that shows
        // the measured duration — this screen keeps the estimate-only render it already had.
        actualMin={null}
        // The draft lives on the page, not in the shell: the summary/complete phase flip
        // remounts nothing here, but the note must also survive a trip back to `active`.
        note={closingNote.trim() || null}
        draftNote={closingNote}
        onFinish={finishAndCelebrate}
        finishPending={finishPending}
        onBack={() => setPhase('active')}
        onExit={onExit}
      />
    )
  }

  // ---------- ACTIVE (Titanium card list, mezo-88iwa.7 T6 Task 3) ----------
  // Every exercise is a `.wo-card` in one `.wo-list` — no viewed exercise, no rail,
  // no pager, no swipe. The only ordering rule left is INSIDE a card: its sets are
  // logged strictly in cursor order (WorkoutCard owns that).
  const totalSets = W.exercises.reduce((a, e) => a + effectiveSetCount(session, e.id), 0)
  const doneSets = Object.values(session.logged).reduce((a, arr) => a + arr.length, 0)
  // Session progress bar (under the header): one flex segment per exercise,
  // weighted by its own planned set count, coloured by ITS OWN muscle family.
  const progressSegments = sessionProgressSegments(
    W.exercises,
    currentIdx,
    (exId) => session.skipped.includes(exId) || (session.logged[exId]?.length ?? 0) >= effectiveSetCount(session, exId),
  )

  // The finish CTA / confirm glass's data (T6 Task 6): pending sets across the whole
  // session, per-exercise for the confirm list, and the resulting three-state CTA look.
  const pendingTotal = pendingSetCount(session)
  const pendingRows = pendingByExercise(session).map(({ id, left }) => {
    const e = exerciseById(id)
    return { id, left, name: e?.name ?? '', muscle: e?.muscle ?? '' }
  })
  const finishState: 'skip' | 'partial' | 'full' = doneSets === 0 ? 'skip' : pendingTotal === 0 ? 'full' : 'partial'

  // The dock's "n / m szett" must agree with the finish CTA it sits next to (fix wave M3):
  // the CTA's `full` state is driven by pendingSetCount, which SKIPS excluded exercises,
  // while the dock counted every exercise — so a session with one skipped exercise showed
  // e.g. "9 / 12 szett" beside a green "everything is done" CTA. Same exclusion here.
  const activeIds = session.order.filter((id) => !session.skipped.includes(id))
  const dockPlanned = activeIds.reduce((a, id) => a + effectiveSetCount(session, id), 0)
  const dockDone = activeIds.reduce((a, id) => a + (session.logged[id]?.length ?? 0), 0)

  // The glass's target: the card whose ⋮/Videó was tapped, else (the header's ⋯) the
  // session cursor exercise. A debrief unmounts the glass, so `current` is safe here.
  const menuEx = exerciseById(glass?.id) ?? current
  const editingEx = exerciseById(editingSet?.exerciseId)
  const noteEditEx = exerciseById(noteEditExId)
  // A log/edit write is in flight for an exercise while one of its logged entries has
  // neither a server id nor a known failure (the same window that keeps its row untappable).
  const isBusy = (exId: string) =>
    (session.logged[exId] ?? []).some((s) => !s.id && (!s.localId || !failedSetLocalIds.has(s.localId)))
  // RECORD medals of one exercise, re-keyed by set index for the card's row end cells.
  const medalsOf = (exId: string): Record<number, Medal[]> => {
    const out: Record<number, Medal[]> = {}
    for (const [k, v] of Object.entries(medalsBySet)) {
      const [id, idx] = k.split(':')
      if (id === exId) out[Number(idx)] = v
    }
    return out
  }

  // The ⋮ menu's Előrébb/Hátrébb (T6 Task 4): swap the addressed exercise with its
  // immediate neighbour in `session.order` — replaces the old ExerciseActionSheet's
  // SortableList sub-view with a single tap per hop. Reorder is client-only /
  // ephemeral — it just replaces `session.order`, never persists. A no-op at either
  // end (the menu already disables the row there, this is the defensive mirror).
  const movePosition = (id: string, dir: -1 | 1) => {
    setSession((s) => {
      const i = s.order.indexOf(id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= s.order.length) return s
      const order = [...s.order]
      ;[order[i], order[j]] = [order[j], order[i]]
      return { ...s, order }
    })
  }

  // Un-skip (T6 Task 4 "Visszavesszük"): purely local, the mirror of handleSkip's
  // model half — there is no server-side unskip endpoint (skip is a one-way audit
  // signal), so reversing it never touches the network.
  const handleToggleSkip = (exId: string) => {
    if (session.skipped.includes(exId)) {
      setSession((s) => unskipExerciseModel(s, exId))
    } else {
      handleSkip(exId)
    }
  }

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
      {(() => {
        const menuOpen = glass?.kind === 'menu' && !feedbackEx
        const videoOpen = glass?.kind === 'video' && !feedbackEx
        const recordsOpen = glass?.kind === 'records' && !feedbackEx
        const position = session.order.indexOf(menuEx.id)
        const slotCount = effectiveSetCount(session, menuEx.id)
        const lastSlotPending = (session.logged[menuEx.id]?.length ?? 0) < slotCount
        const tint = muscleColor(menuEx.muscle).rail
        return (
          <>
            <WorkoutMenuGlass
              open={!!menuOpen}
              exercise={menuEx}
              tint={tint}
              position={position}
              orderLength={session.order.length}
              slotCount={slotCount}
              skipped={session.skipped.includes(menuEx.id)}
              hasNote={!!noteOf(menuEx)}
              canRemoveTrailingSet={canRemoveSet(session, menuEx.id) && lastSlotPending}
              onClose={() => setGlass(null)}
              onVideo={() => setGlass({ kind: 'video', id: menuEx.id })}
              onEditNote={() => setNoteEditExId(menuEx.id)}
              onAddSet={() => {
                setSession((s) => addExtraSet(s, menuEx.id))
                setAddSetPrompt({ exerciseId: menuEx.id })
              }}
              onRemoveSet={() => handleSetDelete(menuEx, slotCount - 1)}
              onMoveEarlier={() => movePosition(menuEx.id, -1)}
              onMoveLater={() => movePosition(menuEx.id, 1)}
              onToggleSkip={() => handleToggleSkip(menuEx.id)}
            />
            <WorkoutVideoGlass
              open={!!videoOpen}
              exercise={videoOpen ? menuEx : null}
              tint={tint}
              onClose={() => setGlass(null)}
            />
            <WorkoutRecordsGlass
              open={!!recordsOpen}
              exercise={menuEx}
              record={recordFor(exerciseRecords, menuEx)}
              todaySets={session.logged[menuEx.id] ?? []}
              tint={tint}
              onClose={() => setGlass(null)}
            />
          </>
        )
      })()}
      {editingSet && editingEx && !feedbackEx && (() => {
        const ex = editingEx
        const idx = editingSet.idx
        const t = prescribedAt(session, ex.id, idx)
        const warm = t?.kind === 'warmup'
        const actual = session.logged[ex.id]?.[idx]
        const warmupCount = (session.prescribed[ex.id] ?? []).filter((p) => p.kind === 'warmup').length
        return (
          <SetEditSheet
            exerciseName={ex.name}
            setLabel={setSlotLabel(idx, warm, warmupCount)}
            mode={actual ? 'logged' : 'pending'}
            kind={warm ? 'warmup' : 'working'}
            exerciseType={ex.type}
            initial={{
              weight: actual?.weight ?? t?.targetWeightKg ?? prefill(ex).weight,
              reps: actual?.reps ?? t?.targetReps ?? prefill(ex).reps,
              rir: actual?.rir ?? t?.targetRIR ?? ex.targetRIR,
              side: actual?.side ?? null,
              note: actual?.note ?? '',
            }}
            canDelete={canRemoveSet(session, ex.id)}
            onSave={(v) => handleSetSave(ex, idx, v)}
            onDelete={() => handleSetDelete(ex, idx)}
            onClose={() => setEditingSet(null)}
          />
        )
      })()}
      {noteEditEx && (
        <NoteEditSheet
          initialNote={noteOf(noteEditEx)}
          onClose={() => setNoteEditExId(null)}
          onSave={(text) => {
            saveExerciseNote(noteEditEx.id, text)
            setLocalNotes((prev) => ({ ...prev, [noteEditEx.id]: text }))
          }}
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
        {/* Header — the one piece of chrome the card list keeps: back pill, the
            session title + its live set-progress line, and the ⋯ that opens the
            session/exercise actions for the exercise that is up now. Sticky by
            `.wk-top` itself (position: sticky; top: 0). */}
        <div className="wk-top np-anim" style={{ '--i': 0 } as React.CSSProperties}>
          <button type="button" className="back np-press" aria-label="Vissza" onClick={onExit}>‹</button>
          <div className="tt wkx-tt">
            <div className="t1">{W.title}</div>
            <div className="t2">{doneSets}/{totalSets} szett</div>
          </div>
          <button
            type="button"
            aria-label="Gyakorlat műveletek"
            disabled={!!feedbackEx}
            onClick={() => setGlass({ kind: 'menu', id: current.id })}
            className="back np-press"
            style={{ marginLeft: 'auto', fontSize: 15 }}
          >
            ⋯
          </button>
        </div>

        {/* Session progress bar: one segment per exercise, flex-weighted by its
            planned set count, family-coloured; opacity signals done/current/upcoming. */}
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
        {niggleActive && (
          <div style={{ padding: '8px 24px' }}>
            <div className="warmstrip">
              ⚠ {W.niggleWarning?.muscleLabel ?? 'Jobb váll'} aktív · óvatos, először warm-up
            </div>
          </div>
        )}

        {/* THE list — one card per exercise, in session order. */}
        {/* Padding (including the bottom room the portalled dock floats over) lives in
            `.wo-list`'s own CSS rule now — see prototype.css, fix wave C1. */}
        <div className="wo-list">
          {session.order.map((id) => {
            const e = W.exercises.find((x) => x.id === id)
            if (!e) return null
            return (
              <WorkoutCard
                key={id}
                exercise={e}
                session={session}
                busy={isBusy(id)}
                note={noteOf(e)}
                medalsBySetIdx={medalsOf(id)}
                failedLocalIds={failedSetLocalIds}
                challenge={(() => {
                  const c = challenges.find((x) => x.exerciseId === id && acceptedMap[x.id])
                  return c ? { label: c.typeLabel, target: c.target } : null
                })()}
                onLogSet={(input) => handleLogSet(e, input)}
                onTapDoneRow={(idx) => setEditingSet({ exerciseId: id, idx })}
                onOpenRecords={() => setGlass({ kind: 'records', id })}
                onOpenMenu={() => setGlass({ kind: 'menu', id })}
                onEditNote={() => setNoteEditExId(id)}
              />
            )
          })}

          {/* The one way out of the list, in three honest states (T6 Task 6, prototype
              finishCta): `skip` when nothing is logged, `partial` (gold) while sets remain
              unticked, `full` (green) once every non-skipped exercise is done. Replaces
              Task 4's temporary plain button. */}
          <button type="button" className={`wo-finish is-${finishState}`} onClick={handleFinishTap}>
            <span className="wo-finish-glow" aria-hidden="true" />
            <span className="wo-finish-art">
              <Icon name={finishState === 'skip' ? 'x' : finishState === 'full' ? 'check' : 'sparkle'} size={finishState === 'skip' ? 30 : 34} />
            </span>
            <strong>{finishState === 'skip' ? 'Edzés kihagyása' : 'Edzés befejezése'}</strong>
            <u className="chip-sheen" />
          </button>
        </div>
      </div>

      {/* The fixed session dock (T6 Task 6, prototype dock): replaces the old RestTimerBar
          render in this phase — same `useRestTimer()` instance, same start sites/durations,
          only the rendering moved. Constant height, always present in the active phase, so
          the list above it never jumps between its idle and resting looks. */}
      <WorkoutDock
        resting={rest.status !== 'idle'}
        remaining={rest.remaining}
        total={rest.total}
        exerciseName={exerciseById(restExerciseId)?.name ?? null}
        doneSets={dockDone}
        plannedSets={dockPlanned}
        onExtend={() => rest.extend(30)}
        onSkipRest={rest.skip}
        onFinish={handleFinishTap}
        finishDisabled={doneSets === 0}
      />

      <FinishConfirmGlass
        open={finishConfirmOpen}
        onClose={() => setFinishConfirmOpen(false)}
        loggedCount={doneSets}
        pending={pendingRows}
        pendingTotal={pendingTotal}
        finishPending={finishPending}
        onConfirm={finishAndCelebrate}
      />
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
