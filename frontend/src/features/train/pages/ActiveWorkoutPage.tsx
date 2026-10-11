// ============================================================
// Mezo · ActiveWorkoutPage — full-screen active-workout mode
// (sibling route /train/session, NO sub-nav). Three-phase state machine:
//   brief   → the Eligazítás (mezo-mgu2r, owner 2026-09-28 — it reverses mezo-e1ii9's
//             "no prep screen"): a FRESH start opens here, a resumed workout never does.
//             Duration band, counts, niggle, the day's challenges to opt into (pre-ticked),
//             the overload line, the exercise list; Indulás sends the challenge decisions,
//             POSTs the start and flips to `active`. The old prep mosaic (XP forecast, six
//             tiles, "Kezdjük el") stays retired.
//   active  → the session page (Folyadék F4, mezo-n4wf5.4): ONE exercise on top with its set grid, the
//             others as rows (tap → on top). Session-level panels live on the briefing only; a
//             challenge shows as the badge on its own card (tap → release / take back).
//             Per-set logging (weight/reps/RIR), the vs-last-week chip,
//             set dots, today's set history, PR toast + feedback debrief
//   summary → the post-finish two-step closing ceremony (WorkoutCeremony): stars +
//             counters + stats + records + the accepted küldetések' outcomes (owner-
//             approved, mezo-me75u.4), then muscles + kcal. The full challenge strip
//             lives on the review page; picking them, on the briefing.
// Every exit (Bezárás / back / Mentés) navigates back to /train.
// Ported from prototype train.jsx (the active-workout TrainSection).
// ============================================================
import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useChallengeActions, useChallenges, useGoal, useTimingProfile, useTrain, useWorkoutNote } from '@/data/hooks'
import { huMonthDay, localDateString } from '@/shared/lib/dates'
import { screenScroller, scrollToTop } from '@/shared/lib/screenScroll'
import { useBackNav } from '@/shared/hooks/useBackNav'
import { useTutorial } from '@/features/tutorial/TutorialProvider'
import { restSecondsFor } from '@/features/train/logic/restTimer'
import { useRestTimer } from '@/features/train/logic/useRestTimer'
import { KalauzButton, WorkoutSessionView } from '@/features/train/components/WorkoutSessionView'
import { type FocusEvent, dockNumbers, finishState as finishStateOf, heroExerciseId, nextFocus } from '@/features/train/logic/sessionFocus'
import { WorkoutSessionSheets } from '@/features/train/components/WorkoutSessionSheets'
import type { ChallengeBadgeState } from '@/features/train/components/WorkoutMenuGlass'
import { WorkoutBriefing } from '@/features/train/components/WorkoutBriefing'
import { briefingDecisions, durationRange, preTicked } from '@/features/train/logic/briefing'
import { overflowWhy, progressionChip } from '@/features/train/logic/progressionChip'
import { FinishConfirmGlass } from '@/features/train/components/FinishConfirmGlass'
import type { ExerciseLibraryItem, LoggedWorkoutExercise, Mesocycle, WorkoutPlan } from '@/data/types'
import type { ExerciseSetResponse, SetLogRequest, SetUpdateRequest, WorkoutExerciseChangeRequest, WorkoutFeedbackInput, WorkoutInstanceResponse } from '@/data/train/trainApi'
import type { ChangeScope } from '@/features/train/sheets/ExerciseScopeSheet'
import { libraryToGymExercise } from '@/features/train/logic/exerciseDefaults'
import type { Medal } from '@/data/train/medalTypes'
import type { MockMedalContext } from '@/data/train/medalEvaluator'
import {
  type Session,
  attachSetId,
  completeSet as completeSetModel,
  effectiveSetCount,
  makeSession,
  mergePlan,
  nextSetIdx,
  pendingByExercise,
  pendingSetCount,
  prescribedAt,
  removeSet,
  slotIndex,
  seedFromOpen,
  skipExercise as skipExerciseModel,
  swapExercise,
  warmupSlotCount,
  addExercise,
  unskipExercise as unskipExerciseModel,
  updateLoggedSet,
} from '@/features/train/logic/workoutState'
import { Page, Skel, TitleRow } from '@/shared/ui/folyadek'
import type { ExerciseFeedbackValues } from '@/features/train/sheets/FeedbackModal'
import { WorkoutCeremony, ceremonyChallenges, ceremonyRecord } from '@/features/train/components/WorkoutCeremony'
import { cerScore, muscleStarRows } from '@/features/train/logic/cerScore'
import { estimateSessionMinutes } from '@/features/train/logic/sessionLength'
import { trainDayEnergy } from '@/features/train/logic/trainDayEnergy'
import { restKcalPerHour } from '@/data/train/activityEnergy'
import { actualMinutes, type SessionTiming } from '@/features/train/logic/actualDuration'
import type { SetEditValues } from '@/features/train/sheets/SetEditSheet'
import { adjustedTarget } from '@/features/train/logic/repEquivalence'

type Phase = 'brief' | 'active' | 'summary'
type Side = 'L' | 'B' | 'R'

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
  // Day PIN (mezo-z9kft). The resume paths (floating button, Mai poster/card) open this
  // route WITHOUT `?day=`, and the param-less /today describes the open instance only
  // while it IS open: once `finishWorkout` refetches it, nothing is open and the server
  // falls back to TODAY's weekday template — so a resumed off-day workout closed on
  // today's plan (ceremony muscles, `mergePlan`), or bounced to /train on a rest day.
  // The first resolved template is latched and every later read asks for THAT day.
  // The pinned key is seeded from the param-less cache (same server answer: open > param)
  // so the switch neither refetches into a skeleton nor remounts the session.
  const qc = useQueryClient()
  const dayParam = searchParams.get('day')
  const [pinnedDay, setPinnedDay] = useState<string | null>(null)
  const { workout, activeMeso, todaySession, completedTodayWorkout, workoutPending, workoutFetching, startWorkout, logSet, updateSet, deleteSet, skipExercise, changeExercise, addPlanWorkingSets, saveExerciseNote, saveWorkoutFeedback, finishWorkout } = useTrain({ workoutDay: dayParam ?? pinnedDay })
  const resolvedTemplate = todaySession?.templateSessionId ?? null
  useEffect(() => {
    if (dayParam || pinnedDay || !resolvedTemplate) return
    qc.setQueryData(['train', 'workoutToday', resolvedTemplate], qc.getQueryData(['train', 'workoutToday', null]))
    setPinnedDay(resolvedTemplate)
  }, [dayParam, pinnedDay, resolvedTemplate, qc])
  // BELÉPÉSI döntés, nem folyamatos őr (mezo-0uuy3). A lenti átirányítás arra való, hogy egy
  // már lezárt napra ÉRKEZŐ felhasználó az értékelőn kössön ki — nem arra, hogy a futó lapot
  // elrántsa. Márpedig pontosan ezt tette: a `finishWorkout` sikere érvényteleníti a
  // ['train','workoutToday'] lekérdezést, az újratöltött nap `completedWorkout`-ot ad és
  // `openWorkout: null`-t, tehát az őr UGYANABBAN a pillanatban elnavigált a záró ceremóniáról
  // a régi összesítőre. A tulajdonos éppen ezt látta élesben: „Lezárás → egyből a régi
  // összesítő, a csillagos képernyőt meg sem láttam."
  //
  // Mock módban a `completedTodayWorkout` MINDIG null (trainHooks.ts), ezért az egész
  // jsdom-lefedettség vak volt rá — a regressziós teszt ezért valós módban fut
  // (`ActiveWorkoutPage.realFinish.test.tsx`).
  const entryRedirectRef = useRef<boolean | null>(null)
  const mountSyncedRef = useRef(false)
  // A hard reload lands here with the queries still loading — redirecting now
  // would kill the resume flow (live-smoke catch). Show the generic skeleton
  // until loaded (was `return null` — mezo-f2z). `workoutPending` is already
  // `!mock`-gated (false in mock, synchronous seed), so no skeleton flashes in
  // mock mode.
  if (workoutPending) return <SessionSkeleton />
  // Resume on a FRESH read (the "Folytatás → an extra set" report): the session seeds ONCE
  // from `openWorkout.sets`, so a cached today snapshot that predates the last logged set
  // (the POST's invalidate-refetch had not landed when the user left, or the param-less key
  // only held the snapshot copied in at the previous mount's pin) would seed the card one
  // set behind the server — the user re-ticks it and the server stores a duplicate. Wait for
  // the mount-time refetch ONCE; later in-session refetches must never unmount the session,
  // so the latch closes on the first settled read and stays closed.
  if (!mountSyncedRef.current && workoutFetching) return <SessionSkeleton />
  mountSyncedRef.current = true
  // T0 clean slate: never render the session without a workout (and at least one exercise).
  // Meso-independence (mezo-ws2x D4): getToday resolves custom (saját) templates with NO
  // active meso, so `activeMeso` is legitimately null here — it must NOT gate the redirect.
  if (!workout || workout.exercises.length === 0) return <Navigate to="/train" replace />
  // Completed today + nothing open → the session is over; review instead of restart
  // (spec 2026-07-15 gating — a finished day must not be re-enterable as a live session;
  // the prep screen the original wording named no longer exists at all since mezo-e1ii9).
  // Mock mode has no completedTodayWorkout (always null), so this never fires there.
  // A latch az ELSŐ betöltött renderen dől el, és a mount hátralévő részére érvényes marad.
  if (entryRedirectRef.current === null) {
    entryRedirectRef.current = Boolean(completedTodayWorkout && !todaySession?.openWorkout)
  }
  if (entryRedirectRef.current && completedTodayWorkout) {
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
      changeExercise={changeExercise}
      addPlanWorkingSets={addPlanWorkingSets}
    />
  )
}

/** The loading frame of the chrome-free route (prototype `#w-edzes-session.tolt`): the title row with a working back
 *  button, and the page's blocks as a skeleton. */
function SessionSkeleton() {
  const goBack = useBackNav('/train')
  return (
    <Page className="ek-page" nonav>
      <TitleRow sticky title="Edzés" context="Betöltés…" onBack={goBack} />
      <Skel blocks={[40, 430, 220]} />
    </Page>
  )
}

interface SessionProps {
  workout: WorkoutPlan
  // Nullable (mezo-ws2x D4): a custom (saját) template session runs with no active meso.
  activeMeso: Mesocycle | null
  todaySession: { templateSessionId: string; openWorkout: WorkoutInstanceResponse | null } | null
  startWorkout: (templateSessionId: string, opts?: { onSuccess?: (w: WorkoutInstanceResponse) => void; onError?: (err: unknown) => void }) => void
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
  changeExercise: (
    workoutId: string,
    req: WorkoutExerciseChangeRequest,
    opts?: { loggedOnReplaced?: number; onSuccess?: (created: LoggedWorkoutExercise) => void; onError?: (err: unknown) => void },
  ) => void
  addPlanWorkingSets: (workoutId: string, exerciseId: string) => void
}

function ActiveWorkoutSession({
  workout, activeMeso, todaySession, startWorkout, logSet, updateSet, deleteSet, skipExercise, saveExerciseNote, saveWorkoutFeedback, finishWorkout, changeExercise, addPlanWorkingSets,
}: SessionProps) {
  const W = workout
  const goBack = useBackNav('/train')
  const navigate = useNavigate()
  const qc = useQueryClient()
  const rest = useRestTimer()
  // The ceremony's kcal tile mirrors Mai's energy card (T5, mezo-88iwa.6): the SAME
  // calibrated session estimate and the SAME weight source Fuel's budget reads, so the two
  // screens can never disagree. Both hooks are unconditional here: the summary phase below
  // is their only reader, but hook order must not depend on the phase.
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

  const open = todaySession?.openWorkout ?? null
  // Seed once on mount — a mid-workout reload resumes straight into 'active'.
  // The exerciseId-keyed pure model owns the per-set bookkeeping (workoutState.ts).
  const [initialSession] = useState<Session>(() =>
    open ? seedFromOpen(W.exercises, { sets: open.sets }) : makeSession(W.exercises),
  )
  // Decided ONCE at mount (mezo-mgu2r): a fresh start opens the Eligazítás, an already-open
  // instance (resume FAB, "Folytassuk", a reload mid-workout) goes straight to the list. A
  // later refetch must never flip a running session back to the briefing.
  const [phase, setPhase] = useState<Phase>(() => (open ? 'active' : 'brief'))
  // Mezo-kalauz (mezo-gb1s.5, D11): ez az oldal chrome-mentes (AppLayout hideChrome),
  // a fejléc ?-e itt nem létezik — az újranyitás a kártyalista fejlécének mini ?-én át megy.
  const kalauz = useTutorial()
  const [session, setSession] = useState<Session>(initialSession)
  const [workoutId, setWorkoutId] = useState<string | null>(open?.id ?? null)
  // The start POST failed (mezo-e1ii9 fix round 1). Without this the failure was SILENT:
  // `workoutId` stayed null for the whole session while the card list looked perfectly
  // functional, and every `logSet(workoutId ?? 'mock', …)` then POSTed against a bogus
  // instance id. `startFailed` both surfaces the failure (the retry strip below the
  // header) and BLOCKS logging until a retry binds a real id — a set the server cannot
  // store must not look stored.
  const [startFailed, setStartFailed] = useState(false)
  const [startRetrying, setStartRetrying] = useState(false)
  // Medal collection (mezo-wp6n): every medal earned this session (set-log + finish),
  // the set-row lookup (keyed `${exerciseId}:${setIndex}`) driving the chips + the
  // tick colour, and the currently-shown RECORD-tier celebration toast (+ how many
  // other medals landed on the same set).
  const [sessionMedals, setSessionMedals] = useState<Medal[]>([])
  const [medalsBySet, setMedalsBySet] = useState<Record<string, Medal[]>>({})
  const [toastMedal, setToastMedal] = useState<{ medal: Medal; extra: number } | null>(null)
  // The explicit-finish POST is in flight — disables the "Edzés lezárása ✓" CTA
  // AND (T6 Task 6) the finish tile / the dock's Lezárás + the confirm sheet's own primary.
  const [finishPending, setFinishPending] = useState(false)
  // How many sets the close left unticked, frozen at finish time (T7 Task 4, mezo-88iwa.8):
  // the settled recap reads it back long after the finish POST resolved, and the live
  // `session` is not the honest source there (a later edit would rewrite history).
  const [pendingAtClose, setPendingAtClose] = useState(0)
  // Which exercise the CURRENT rest belongs to (T6 Task 6's dock needs a name to show,
  // "PIHENŐ · <EXERCISE>" — useRestTimer itself is exercise-agnostic). Set alongside the
  // one `rest.start` call site in handleLogSet; stale once idle is harmless (the dock only
  // reads it while `rest.status !== 'idle'`).
  const [restExerciseId, setRestExerciseId] = useState<string | null>(null)
  // The finish confirm sheet (T6 Task 6): opened by the finish tile
  // CTA or the dock's "Lezárás →" whenever pending sets remain — see handleFinishTap below.
  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false)
  /** The workout-level closing note (mezo-d20.8.2.2) — a page-owned draft, so stepping back to
   *  `active` and returning to the summary does not throw away what was already typed. */
  const [closingNote, setClosingNote] = useState('')
  /** The finish response's real XP (mezo-88iwa.8): the ceremony's +XP tile shows it, and
   *  renders nothing when the response carried no level-up payload at all. */
  const [xpGained, setXpGained] = useState<number | null>(null)
  /** The MEASURED duration of this session (mezo-e1ii9, Task 3). `WorkoutInstanceResponse`
   *  — the finish POST's OWN response — carries `startedAt` / `finishedAt` / `activeSeconds`
   *  (WorkoutService.finishWorkout derives activeSeconds and returns them via
   *  `toInstanceResponse`), so the ceremony's `a pulton töltött idő` tile needs no extra
   *  round trip: it reads the very response that closed the workout. `actualMinutes` returns
   *  null when nothing usable was measured — then the tile simply stays away. */
  const [finishTiming, setFinishTiming] = useState<SessionTiming | null>(null)
  /** Fallback clock for mock mode, where the finish mutation is a no-op with no wire
   *  response at all. This is still a MEASUREMENT, not an estimate: the route IS the
   *  session (entering it starts the workout, mezo-e1ii9 Task 1), so the wall clock from
   *  mount to the finish tap is exactly the time spent at the bench in this mode. */
  const enteredAtRef = useRef(Date.now())
  // The just-finished exercise pinned for the debrief modal (and the active card
  // it overlays): once resolved, the view advances to the next exercise, so we keep
  // an explicit feedback target that overrides `viewedId` until the debrief closes.
  const [feedbackEx, setFeedbackEx] = useState<LoggedWorkoutExercise | null>(null)
  const [acceptedChallenges, setAcceptedChallenges] = useState<string[]>([])
  // The briefing's tick draft (mezo-mgu2r): null = untouched, then the pre-tick rule applies to
  // whatever list is current (a late challenge fetch still arrives pre-ticked).
  const [tickDraft, setTickDraft] = useState<Record<string, boolean> | null>(null)
  // The challenges taken on at Indulás — their badge stays on the card even once released,
  // so the owner can take one back (spec D3).
  const [startedChallengeIds, setStartedChallengeIds] = useState<ReadonlySet<string>>(() => new Set())
  // The per-card glass surface open right now (T6 Task 4/5) — null = closed. `kind`
  // distinguishes the ⋮ menu itself, the Videó glass it can switch to, the records
  // glass opened straight from the card's own log button, and (mezo-mgu2r) one challenge's
  // detail glass opened from its card badge — there `id` is the CHALLENGE id; otherwise it
  // addresses the card, exactly like the old menuExId did for ExerciseActionSheet.
  const [glass, setGlass] = useState<{ kind: 'menu' | 'video' | 'records' | 'challenge'; id: string } | null>(null)
  // After "＋ Szett" we offer to persist the bumped set count to the template (F2).
  const [addSetPrompt, setAddSetPrompt] = useState<{ exerciseId: string } | null>(null)
  // Mid-workout swap/add (mezo-mobji): step 1 the picker, step 2 the „Csak ma / Mezociklusra is"
  // sheet; a failed write leaves the list untouched and says so above the finish button.
  const [pick, setPick] = useState<{ mode: 'swap' | 'add'; exerciseId?: string } | null>(null)
  const [scopeFor, setScopeFor] = useState<{ mode: 'swap' | 'add'; exerciseId?: string; item: ExerciseLibraryItem } | null>(null)
  const [changeFailed, setChangeFailed] = useState(false)
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
  // Which exercise is ON TOP (mezo-n4wf5.4): pure VIEW state. null = follow „Most" (the first exercise with an open
  // set). The session model knows nothing about it — every exercise keeps its own cursor and stays loggable; the
  // focus only moves through `nextFocus` (a row tap, a logged set, a closed debrief, a skip, a swap / add).
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const focus = (ev: FocusEvent) => setFocusedId((f) => nextFocus(f, ev))

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
    if (phase === 'summary') rest.skip()
  }, [phase, rest.skip])

  // Plan growth mid-session (mezo-ohvm): the server-side closing block can append
  // template exercises while this session is already open — a refetch then grows
  // W.exercises. Fold the new exercises into the model so the cursor VISITS them
  // instead of counting them as done (an id missing from session.planned reads as
  // 0 planned sets). mergePlan is identity-stable, so re-renders don't loop.
  useEffect(() => {
    setSession((s) => mergePlan(s, W.exercises))
  }, [W.exercises])

  // The exercise ON TOP (the hero): the focused one, else „Most" — the first exercise in `session.order` with an open
  // set. Logging pins the focus to the logged exercise, so its debrief opens over its own hero.
  const heroId = heroExerciseId(session, focusedId)
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
  const {
    challenges, mode: challengeMode, pending: challengesPending, failed: challengesFailed, retry: retryChallenges,
  } = useChallenges(templateSessionId, localToday)
  const { decide } = useChallengeActions(templateSessionId, localToday)
  const isMock = challengeMode === 'mock'

  // The record engine's e1RM history — the per-card Rekordok glass reads it.
  const { exerciseRecords } = useTrain()

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
      // An accepted challenge unticks back to an offer ('undo', mezo-oy91i) — 'dismiss' would
      // 409 on a non-proposed row and hide the challenge for good.
      decide(id, acceptedMap[id] ? 'undo' : 'accept')
    }
  }

  // The ceremony's stats card lists the ACCEPTED challenges with their outcome again
  // (owner-approved in the üveg prototype, mezo-me75u.4 — `ceremonyChallenges` below); the
  // review page (WorkoutReviewPage → WorkoutSummary) keeps the full challenge strip.

  // Starting the workout is the briefing's Indulás tap again (mezo-mgu2r; mezo-e1ii9 had moved
  // it onto mount). Two paths:
  //   · mock mode has no `todaySession` → nothing to POST, the local session model is the
  //     whole truth (byte-parity with the Phase-1 behaviour);
  //   · real mode POSTs `startWorkout` and binds the returned instance id.
  // A session resumed mid-workout (`open`) already HAS an instance and never sees the
  // briefing. The ref keeps the start once-per-mount (a second POST would be a second
  // workout instance).
  const startedRef = useRef(false)
  const runStart = (retry: boolean) => {
    if (!todaySession) return
    if (retry) setStartRetrying(true)
    startWorkout(todaySession.templateSessionId, {
      onSuccess: (w) => {
        setWorkoutId(w.id)
        setStartFailed(false)
        setStartRetrying(false)
      },
      onError: () => {
        setStartFailed(true)
        setStartRetrying(false)
      },
    })
  }
  // A card badge's state: a resolved outcome wins, else taken on vs released (spec D3).
  const badgeState = (c: (typeof challenges)[number]): ChallengeBadgeState =>
    c.status === 'hit' || c.status === 'miss' || c.status === 'inconclusive'
      ? c.status
      : acceptedMap[c.id] ? 'accepted' : 'released'
  const ticked = tickDraft ?? preTicked(challenges, acceptedMap)
  const toggleTick = (id: string) => setTickDraft({ ...ticked, [id]: !ticked[id] })
  const handleStart = () => {
    if (startedRef.current) return
    startedRef.current = true
    // The mock clock measures from the START, not from the briefing's mount.
    enteredAtRef.current = Date.now()
    const tickedIds = challenges.filter((c) => ticked[c.id]).map((c) => c.id)
    if (isMock) {
      setAcceptedChallenges(tickedIds)
    } else {
      // Decisions ride alongside the start and never block it: a failure surfaces through the
      // global mutation-error toast and the row keeps its server state.
      const d = briefingDecisions(challenges, ticked, acceptedMap)
      d.accept.forEach((id) => decide(id, 'accept'))
      d.undo.forEach((id) => decide(id, 'undo'))
    }
    setStartedChallengeIds(new Set(tickedIds))
    if (!open && todaySession) runStart(false)
    setPhase('active')
  }
  // Logging is blocked exactly while a start we ATTEMPTED has left us without an instance
  // id. Mock mode has no `todaySession` and never starts anything, so it never blocks.
  const logBlocked = startFailed && !workoutId

  const handleLogSet = (
    finishing: LoggedWorkoutExercise,
    input: { weight: number; reps: number; rir: number | null; side: Side | null },
  ) => {
    // Belt and braces (mezo-e1ii9 fix round 1): the cards already disable their ✓ while
    // the session has no instance id, but the handler refuses too — a set with nowhere
    // to go must never reach the local model either, or the UI would show it as saved.
    if (logBlocked) return
    const { weight, reps, side } = input
    // Warmup rows carry no RIR at all (mezo-eerq) — the card hands over null there;
    // the local model still needs a number, so it stores 0 and the payload omits it.
    const rir = input.rir ?? 0
    const weightless = finishing.type === 'plyo'
    const wasSetIdx = nextSetIdx(session, finishing.id) // pre-update cursor (for the medal ctx + persisted setIndex)
    // The cursor counts VISIBLE (working) slots; the prescription array still holds the
    // warm-up ramp in front of them, so the target is addressed through `slotIndex`
    // (mezo-i8ahy). Nothing warm-up-kinded is loggable any more — `kind` is always working.
    const target = prescribedAt(session, finishing.id, slotIndex(session, finishing.id, wasSetIdx))
    const kind = target?.kind ?? 'working'
    // A swapped weight is judged against its equivalent target, so the medal and the
    // adherence detector see the effort that was actually asked for (mezo-l95v4).
    const snapshot = (weightless ? null : adjustedTarget(target, weight)) ?? target
    // A client-side identity (mezo-l3on fix-round-2, N1), assigned NOW so the async logSet
    // response (success OR failure) can address THIS exact entry later — never by array
    // index, which shifts under a concurrent edit/delete or a second in-flight log.
    const localId = crypto.randomUUID()
    const next = completeSetModel(session, finishing.id, { weight, reps, rir, localId })
    setSession(next)
    focus({ type: 'logged', id: finishing.id })
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
      ...(snapshot?.targetWeightKg != null ? { targetWeightKg: snapshot.targetWeightKg } : {}),
      ...(snapshot?.targetReps != null ? { targetReps: snapshot.targetReps } : {}),
      // The engine's ORIGINAL weight, before any on-card swap — a near swap away from it teaches
      // the server's per-machine weight memory that it is missing (mezo-bk7l2).
      ...(target?.targetWeightKg != null ? { prescribedWeightKg: target.targetWeightKg } : {}),
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
    const isWarmup = prescribedAt(session, ex.id, slotIndex(session, ex.id, idx))?.kind === 'warmup'
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
      focus({ type: 'logged', id: ex.id })
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
      const onCeremony = phaseRef.current === 'summary'
      if (onCeremony && id && trimmed && trimmed !== lastSavedNoteRef.current) {
        saveNoteRef.current(id, trimmed)
        lastSavedNoteRef.current = trimmed
      }
    }
    // Mount-once: this is a page-lifetime unmount guard, not a per-render effect.
  }, [])

  // Finish the workout (the ONLY completion trigger — the active list's finish CTA) and land on
  // the closing ceremony. Real mode POSTs with the instance id; mock has no instance (workoutId
  // null → 'mock' sentinel) but the mock finish mutation still returns a seeded LevelUpResult,
  // which is where the ceremony's XP number comes from.
  //
  // mezo-e1ii9 (Train parity P1, Task 2): this path deliberately does NOT call `showLevelUp`.
  // The pre-Titanium overlay used to portal a full-frame layer OVER the ceremony, so the owner
  // never saw the star ceremony he had just earned — his headline complaint. The prototype's
  // close (companion-titanium/session.js) has exactly ONE layer and carries `+N szerzett XP`
  // itself, which `setXpGained` below feeds from the very same response, so no number is lost.
  // The skill/level breakdown has no prototype counterpart at this moment and lives on the
  // progression surface (/me/growth/skillek). The LevelUpProvider stays app-wide and untouched:
  // sport and run logging still raise it (SportPage, SportLogPage, RunningPage, QuickLogSurface,
  // TrainTodayPage).
  //
  // On success the server re-evaluates the challenges lazily on the next list read, so we
  // invalidate them (real only).
  //
  // T7 (mezo-88iwa.8): EVERY success path lands on 'summary' — the two-act closing
  // ceremony IS the close moment, so the zero-pending shortcut goes there too.
  const finishAndCelebrate = () => {
    // The same block the log path takes (fix wave, mezo-e1ii9). Without it a failed start
    // still closed the workout: `finishWorkout(workoutId ?? 'mock')` POSTed
    // /api/train/workouts/mock/finish in REAL mode, and the ceremony celebrated a session
    // the server never had. A close with nowhere to go must not look closed.
    if (logBlocked) return
    setFinishPending(true)
    setPendingAtClose(pendingSetCount(session))
    finishWorkout(workoutId ?? 'mock', {
      // The closing note is typed INSIDE the ceremony now, which renders after this POST
      // resolves — so the body can only carry a note an earlier attempt already had (the
      // retry path). The ceremony's own note is saved through `saveNote` on close/blur.
      note: closingNote.trim() || null,
      onSuccess: (r) => {
        // The ceremony's +XP tile is the wire's number or nothing — never a fabricated
        // count×10. `LevelUpResult.totalXp` is the session's real award (the schema has no
        // top-level XP field on the plain finish response); absent payload → no tile.
        setXpGained(r?.levelUp?.totalXp ?? null)
        // The measured clock, straight off the finish response (see `finishTiming`).
        // Real mode: the wire response is the ONLY source of truth — a response without
        // `startedAt` (pre-mezo-1jm8 row, or a resumed legacy instance) means unmeasurable,
        // and `actualMinutes` must return null so no tile renders (docs/features/train.md).
        // Mock mode has no wire response at all (the finish mutation is a local no-op), so
        // — and only here — the mount-to-finish client clock stands in: since Task 1,
        // entering the route genuinely IS the start of the session in mock, so this really
        // is a measurement, not a fabricated estimate.
        if (r?.startedAt) {
          setFinishTiming({ startedAt: r.startedAt, finishedAt: r.finishedAt, activeSeconds: r.activeSeconds })
        } else if (isMock) {
          setFinishTiming({ startedAt: new Date(enteredAtRef.current).toISOString(), finishedAt: new Date().toISOString() })
        } else {
          setFinishTiming(null)
        }
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
  // finish tile or the dock's „Lezárás" with pending sets remaining asks first (the
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
    // The hero moves on: without a focus it follows „Most" again.
    if (feedbackEx) focus({ type: 'debriefClosed', id: feedbackEx.id })
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
    focus({ type: 'skipped', id: exId })
  }

  // ---------- SUMMARY (the closing ceremony) ----------
  // 'summary' is the post-finish two-act ceremony (T7, mezo-88iwa.8): the finish POST has
  // already resolved when it renders, and its way out goes straight to Mai — there is no
  // intermediate read-only screen. The dead 'complete' phase (a settled read-back this page
  // never actually reached — `settled`/pendingSets were gated on a phase `setPhase` never
  // set) is retired here (T7 final fix wave, mezo-88iwa.8): the honest pending-sets line now
  // renders on THIS live ceremony instead, unconditionally. `WorkoutCeremony`'s own `settled`
  // prop and its tests stay — a future slice (T13, the review-page reface) reuses it there.
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
      restKcalPerHour(goalResponse?.tdeeBootstrap?.bmr, weightKg || null),
    )
    const kcal = energy.known && energy.earnedKcal > 0 && score.done.sets > 0
      ? ({ value: energy.earnedKcal, known: true } as const)
      : null
    return (
      <WorkoutCeremony
        score={score}
        // The title row's context line: the workout's own name and its day.
        context={`${W.title} · ${huMonthDay(localToday)}`}
        // The MEASURED duration (mezo-1jm8), now really wired (mezo-e1ii9, Task 3). T7 read it
        // off `todaySession.openWorkout`, which is indeed always stale — but the finish POST's
        // own response is not: `WorkoutInstanceResponse` carries startedAt/finishedAt/
        // activeSeconds, and WorkoutService.finishWorkout fills all three before returning.
        // So this is the real clock, with no extra fetch. Still null → still no tile: an
        // estimate is never printed as if it were a measurement.
        minutes={finishTiming ? actualMinutes(finishTiming) : null}
        xpGained={xpGained}
        records={sessionMedals
          .filter((m) => m.tier === 'RECORD')
          .map(ceremonyRecord)}
        // The stats card's Küldetések (owner-approved, mezo-me75u.4): the session's ACCEPTED
        // challenges with their server-resolved outcome — the same `useChallenges` list and
        // accept map the header's Küldetések glass reads; no new fetch.
        challenges={ceremonyChallenges(challenges, acceptedMap)}
        muscles={muscleStarRows(session, W.exercises)}
        kcal={kcal}
        // The honest pending-sets line now lives on the live ceremony itself: `pendingAtClose`
        // is frozen in `finishAndCelebrate` for every finish path, so this is always the real
        // count — 0 hides the line inside `WorkoutCeremony` (it only renders `pendingSets > 0`).
        pendingSets={pendingAtClose}
        note={closingNote}
        onNote={setClosingNote}
        onClose={() => {
          persistClosingNote()
          navigate('/train/mai', { replace: true })
        }}
        onGoFuel={() => {
          persistClosingNote()
          navigate('/fuel', { replace: true })
        }}
      />
    )
  }

  // ---------- BRIEF (Eligazítás, mezo-mgu2r) ----------
  if (phase === 'brief') {
    const fmtKg = (n: number) => n.toLocaleString('hu-HU')
    const goalOf = (e: LoggedWorkoutExercise): string | null => {
      const p = e.prescribedSets?.find((x) => x.kind === 'working')
      const kg = p?.targetWeightKg ?? e.progression?.targetWeightKg ?? null
      const reps = p?.targetReps ?? e.progression?.targetReps ?? null
      return kg != null && reps != null ? `${fmtKg(kg)} × ${reps}` : null
    }
    const ordered = session.order.map((id) => exerciseById(id)).filter((e): e is LoggedWorkoutExercise => !!e)
    return (
      <WorkoutBriefing
        title={W.title}
        eyebrow={activeMeso ? `${W.title} · ${activeMeso.currentWeek}. hét / ${activeMeso.weeks}` : W.title}
        minutes={timingProfilePending ? null : durationRange(estimateSessionMinutes(W.exercises, timingProfile ?? undefined))}
        exerciseCount={ordered.length}
        setCount={ordered.reduce((a, e) => a + effectiveSetCount(session, e.id), 0)}
        niggle={W.niggleWarning ?? null}
        challenges={challenges}
        pending={challengesPending}
        failed={challengesFailed}
        onRetry={retryChallenges}
        ticked={ticked}
        onToggle={toggleTick}
        overload={W.overloadSummary}
        exercises={ordered.map((e) => ({
          id: e.id,
          name: e.name,
          muscle: e.muscle,
          sets: effectiveSetCount(session, e.id),
          goal: goalOf(e),
          chip: e.progression ? progressionChip(e.progression) : null,
          why: overflowWhy(e.repMax, e.progression),
        }))}
        onBack={onExit}
        onStart={handleStart}
        kalauzButton={kalauz.current ? <KalauzButton kalauz={kalauz} /> : undefined}
      />
    )
  }

  // ---------- ACTIVE (Folyadék F4, mezo-n4wf5.4) ----------
  // ONE exercise is on top with its set grid (`heroId`), the others are rows; a tap on a row (or on a top vessel)
  // brings that exercise on top. The only ordering rule left is INSIDE an exercise: its sets are logged strictly in
  // cursor order (WorkoutCard owns that).
  const totalSets = W.exercises.reduce((a, e) => a + effectiveSetCount(session, e.id), 0)
  const doneSets = Object.values(session.logged).reduce((a, arr) => a + arr.length, 0)
  // A tap asks for an exercise: it comes on top, and the page shows it (the scroller jumps to the top, as a phase flip does).
  const onFocus = (id: string) => {
    focus({ type: 'tap', id })
    scrollToTop(screenScroller())
  }

  // The finish CTA / confirm glass's data (T6 Task 6): pending sets across the whole
  // session, per-exercise for the confirm list, and the resulting three-state CTA look.
  const pendingTotal = pendingSetCount(session)
  const pendingRows = pendingByExercise(session).map(({ id, left }) => {
    const e = exerciseById(id)
    return { id, left, total: effectiveSetCount(session, id), name: e?.name ?? '', muscle: e?.muscle ?? '' }
  })
  const finishState = finishStateOf(session)

  // The dock's „n / m szett" agrees with the finish button it sits next to (fix wave M3): both count the non-skipped
  // exercises only.
  const { done: dockDone, planned: dockPlanned } = dockNumbers(session)

  // The glass's target: the exercise whose menu / Technika / Rekordok was tapped — always the one on top; the
  // fallback only keeps the closed sheets fed.
  const menuEx = exerciseById(glass?.id) ?? exerciseById(heroId) ?? W.exercises[0]
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
      focus({ type: 'unskipped', id: exId })
    } else {
      handleSkip(exId)
    }
  }

  // F2 "Minden hétre": one plan row +1 working set (mezo-mobji) — the old full-list day PUT
  // re-minted every exercise id under the running session.
  const writeExtraSetToTemplate = (exerciseId: string) => {
    if (!canChange) return
    addPlanWorkingSets(workoutId ?? 'mock', exerciseId)
  }

  // ── Mid-workout swap / add (mezo-mobji) ──
  const mesoLine = activeMeso
    ? activeMeso.weeks - activeMeso.currentWeek > 0
      ? `A ${activeMeso.title} hátralévő ${activeMeso.weeks - activeMeso.currentWeek} hetében is.`
      : `A ${activeMeso.title} hátralévő részében is.`
    : null
  // Real mode needs the started instance; mock logs against 'mock' like every other write.
  const canChange = !logBlocked && (isMock || !!workoutId)
  const scopeTarget = scopeFor?.exerciseId ? exerciseById(scopeFor.exerciseId) ?? null : null
  const scopeLogged = scopeTarget ? session.logged[scopeTarget.id]?.length ?? 0 : 0
  // The replacement's WORKING sets = what is left of the slot. With a server prescription the
  // warm-up ramp is hidden (the visible count is working-only); without one the warm-up rows
  // are visible too, so the ones not yet done come off the count.
  const scopeNewSets = (() => {
    if (!scopeFor) return 0
    if (scopeFor.mode === 'add' || !scopeTarget) return libraryToGymExercise(scopeFor.item).workingSets
    const visibleLeft = effectiveSetCount(session, scopeTarget.id) - scopeLogged
    const warmupsLeft = warmupSlotCount(session, scopeTarget.id) > 0 ? 0 : Math.max(0, scopeTarget.warmupSets - scopeLogged)
    return Math.max(1, visibleLeft - warmupsLeft)
  })()
  const applyChange = (scope: ChangeScope) => {
    if (!scopeFor || !canChange) return
    const recipe = libraryToGymExercise(scopeFor.item)
    const old = scopeTarget
    const req: WorkoutExerciseChangeRequest = {
      catalogId: scopeFor.item.catalogId ?? null,
      name: scopeFor.item.name,
      muscle: scopeFor.item.muscle,
      type: scopeFor.item.type,
      // Mid-exercise the body is already warm: no new ramp for the rest of the slot.
      warmupSets: old && scopeLogged > 0 ? 0 : recipe.warmupSets,
      workingSets: scopeNewSets,
      // A swap keeps the slot's prescription shape; an add takes the type's defaults.
      repMin: old ? old.repMin : recipe.repMin,
      repMax: old ? old.repMax : recipe.repMax,
      targetRIR: old ? old.targetRIR : recipe.targetRIR,
      scope,
      replacesExerciseId: old?.id ?? null,
    }
    setChangeFailed(false)
    changeExercise(workoutId ?? 'mock', req, {
      loggedOnReplaced: scopeLogged,
      onSuccess: (created) => {
        const input = { id: created.id, warmupSets: created.warmupSets, workingSets: created.workingSets, prescribedSets: created.prescribedSets }
        setSession((s) => (old ? swapExercise(s, old.id, input) : addExercise(s, input, closingAfter(s))))
        // The new exercise comes on top (prototype `applyPick`).
        focus({ type: 'changed', id: created.id })
      },
      onError: () => setChangeFailed(true),
    })
  }
  /** An add lands before the fixed closing block, as the server places it: the first exercise
   *  of the session's trailing run of plan-slot-less, unchanged ones. */
  const closingAfter = (s: typeof session): string | undefined => {
    let at: string | undefined
    for (let i = s.order.length - 1; i >= 0; i--) {
      const e = exerciseById(s.order[i])
      if (!e || e.planSlot !== false || e.changeScope || e.replacedByName) break
      at = e.id
    }
    return at
  }

  return (
    <WorkoutSessionView
      v={{
        toastMedal, W, onExit, doneSets, totalSets, kalauz, setGlass, heroId, onFocus, session, logBlocked,
        startRetrying, runStart, isBusy, noteOf, medalsOf, failedSetLocalIds, challenges, acceptedMap, startedChallengeIds, badgeState,
        handleLogSet, setEditingSet, setNoteEditExId, changeFailed, setChangeFailed, canChange, setPick, finishState, handleFinishTap,
        rest, exerciseById, restExerciseId, dockDone, dockPlanned,
      }}
      overlays={(
        <WorkoutSessionSheets
          s={{
            feedbackEx, W, advanceAfterFeedback, saveFeedback, glass, setGlass, challenges, session, setSession, menuEx, noteOf,
            setNoteEditExId, setAddSetPrompt, handleSetDelete, movePosition, handleToggleSkip, canChange, setPick, badgeState, exerciseById,
            toggleChallenge, exerciseRecords, editingSet, editingEx, handleSetSave, setEditingSet, noteEditEx, saveExerciseNote, setLocalNotes,
            addSetPrompt, writeExtraSetToTemplate, pick, scopeFor, setScopeFor, scopeTarget, scopeLogged, scopeNewSets, mesoLine, applyChange,
          }}
        />
      )}
      after={(
          <FinishConfirmGlass
            open={finishConfirmOpen}
            onClose={() => setFinishConfirmOpen(false)}
            loggedCount={doneSets}
            pending={pendingRows}
            pendingTotal={pendingTotal}
            finishPending={finishPending}
            onConfirm={finishAndCelebrate}
          />
      )}
    />
  )
}
