import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { addDays, huMonthDay, huMonthDayDow, localDateString } from '@/shared/lib/dates'
import { evaluateMockSetMedals, type MockMedalContext } from '@/data/train/medalEvaluator'
import {
  trainApi,
  type CatalogExerciseCreateRequest,
  type ExerciseCatalogItem,
  type ExerciseRecordResponse,
  type ExerciseSetResponse,
  type GymExerciseInput,
  type GymScheduleSlotInput,
  type GymScheduleSlotResponse,
  type MesocycleReportResponse,
  type MesocycleResponse,
  type SetLogRequest,
  type SetUpdateRequest,
  type SportEventCreateRequest,
  type SportEventResponse,
  type SportScheduleSlotInput,
  type SportScheduleSlotResponse,
  type SportSessionCreateRequest,
  type SportSessionResponse,
  type WorkoutFeedbackInput,
  type WorkoutInstanceResponse,
  type WorkoutTodayResponse,
} from '@/data/train/trainApi'
import {
  DAY_ORDER,
  mesocycles,
  activeMeso,
  workout as trainWorkout,
  gymSchedule as trainGymSchedule,
  gymScheduleMock,
  sport,
  exerciseLibrary,
} from '@/data/train/train'
import { mesoReportQueryKey } from '@/data/train/mesoReportHooks'
import { gymLevelUpMock, sportLevelUpMock } from '@/data/progression/progressionMock'
import { awardGamificationEvent } from '@/data/gamification/gamificationStore'
import type {
  ExerciseLibraryItem,
  GymSchedule,
  GymScheduleSlot,
  Mesocycle,
  MusclePriorities,
  Sport,
  SportSchedule,
  SportSession,
  SportWeek,
  VolleyballSession,
  WorkoutPlan,
} from '@/data/types'

// /today -> the Phase-1 WorkoutPlan shape. AI extras (challenges, niggleWarning)
// are Phase 3 — empty/absent in real mode. `tag` is display-derived elsewhere.
export function toWorkoutPlan(r: WorkoutTodayResponse | null | undefined): WorkoutPlan | null {
  if (!r?.templateSessionId || !r.exercises?.length) return null
  return {
    title: r.title ?? '',
    tag: '',
    durationEst: r.durationEst ?? 0,
    exercises: r.exercises.map((e) => ({
      id: e.id, name: e.name, muscle: e.muscle,
      warmupSets: e.warmupSets, workingSets: e.workingSets,
      repMin: e.repMin, repMax: e.repMax, targetRIR: e.targetRIR,
      anchorWeightKg: e.anchorWeightKg ?? null,
      type: e.type,
      sets: e.warmupSets + e.workingSets,
      // Normalize the contract's optional targetWeightKg/targetRIR to the domain's
      // required `number | null` (the engine always emits both; null-coalesce is a no-op).
      prescribedSets:
        e.prescribedSets?.map((p) => ({
          kind: p.kind,
          targetWeightKg: p.targetWeightKg ?? null,
          targetReps: p.targetReps,
          targetRIR: p.targetRIR ?? null,
        })) ?? null,
      rationale: e.rationale ?? null,
      note: e.note ?? null,
      videoUrl: e.videoUrl ?? null,
      imageStartUrl: e.imageStartUrl ?? null,
      imageEndUrl: e.imageEndUrl ?? null,
      lastWeek: e.lastWeek
        ? { weight: Number(e.lastWeek.weightKg), reps: e.lastWeek.reps, rir: e.lastWeek.rir }
        : null,
      progression: e.progression
        ? {
            lever: e.progression.lever,
            deltaKg: e.progression.deltaKg ?? null,
            deltaReps: e.progression.deltaReps ?? null,
            targetWeightKg: e.progression.targetWeightKg ?? null,
            targetReps: e.progression.targetReps,
            rationale: e.progression.rationale,
          }
        : null,
    })),
    challenges: [],
    overloadSummary: r.overloadSummary
      ? { weightUp: r.overloadSummary.weightUp, repUp: r.overloadSummary.repUp, hold: r.overloadSummary.hold }
      : null,
  }
}

// Gym weekly row derived from the active meso's template days (WHAT) joined with the
// standalone weekly gym slots (WHEN). DAY_ORDER index (0=Hét..6=Vas) == slot.dayOfWeek;
// a gym day with no matching slot keeps time=null. Duration has no DB home (out of scope).
export function deriveGymSchedule(meso: Mesocycle | null, slots: GymScheduleSlot[] = []): GymSchedule | null {
  const days = meso?.days
  if (!days?.length) return null
  const todayLabel = DAY_ORDER[(new Date().getDay() + 6) % 7]
  const timeFor = (dayLabel: string): string | null => {
    const idx = DAY_ORDER.indexOf(dayLabel as (typeof DAY_ORDER)[number])
    return slots.find((s) => s.dayOfWeek === idx)?.time ?? null
  }
  return {
    weeklyTimes: DAY_ORDER.map((d) => {
      const md = days.find((x) => x.day === d && x.exerciseCount > 0)
      return md
        ? { day: d, type: md.type, time: timeFor(d), duration: null, active: true, today: d === todayLabel }
        : { day: d, type: null, time: null, duration: null, active: false }
    }),
  }
}

// Backend serves ISO dates (`2026-05-01`); the UI expects HU display strings.
// The generated MesocycleResponse is structurally close to the domain Mesocycle
// (goal is optional in the contract, delta keys are a looser string map) — the
// boundary cast mirrors the Slice A biometrics-api idiom.
// Exported so mesoTemplateHooks.ts (startTemplate's response mapping) reuses the same
// ISO->HU boundary cast instead of duplicating it.
export function toMesocycle(r: MesocycleResponse): Mesocycle {
  return {
    ...r,
    startDate: huMonthDay(r.startDate),
    endDate: huMonthDay(r.endDate),
    goal: r.goal ?? '',
    // Narrowed explicitly (mezo-ltk0) rather than left to the blanket spread above + the
    // `as Mesocycle` cast — mirrors mesoTemplateHooks.ts's toMesoTemplate.
    musclePriorities: (r.musclePriorities as MusclePriorities | null) ?? null,
  } as Mesocycle
}

function toSportSession(r: SportSessionResponse): SportSession {
  return {
    id: r.id, sport: r.sport, date: huMonthDayDow(r.date), isoDate: r.date, time: r.time,
    duration: r.duration, setsPlayed: r.setsPlayed ?? null, rounds: r.rounds ?? null, intensity: r.intensity ?? null,
    rpe: r.rpe, shoulderStrain: r.shoulderStrain ?? null, jumpCount: r.jumpCount ?? null,
    notes: r.notes ?? null,
  }
}

// Weekly slots -> the Phase-1 SportSchedule shape. team/season have no DB home in
// Phase 2 (slot table only) — empty in real mode, the view renders them conditionally.
function toSportSchedule(slots: SportScheduleSlotResponse[]): SportSchedule | null {
  if (!slots.length) return null
  const todayIdx = (new Date().getDay() + 6) % 7
  return {
    volleyball: {
      team: '',
      season: '',
      weeklyHours: Math.round((slots.reduce((a, s) => a + s.durationMin, 0) / 60) * 10) / 10,
      sessions: slots.map((s) => ({
        day: DAY_ORDER[s.dayOfWeek],
        time: s.time,
        duration: s.durationMin,
        court: s.location ?? '',
        intensity: s.intensityLabel ?? '',
        role: s.kind === 'match' ? 'meccs' : 'edzés',
        sport: (s.sport as VolleyballSession['sport']) ?? 'volleyball',
        ...(s.dayOfWeek === todayIdx ? { today: true } : {}),
      })),
    },
  }
}

// Gym slot responses -> the lean domain slot shape (drops the server `id`); the
// derive join only needs weekday + time.
function toGymSlots(slots: GymScheduleSlotResponse[]): GymScheduleSlot[] {
  return slots.map((s) => ({ dayOfWeek: s.dayOfWeek, time: s.time }))
}

/** DAY_ORDER index (0=Hét..6=Vas) of an ISO date — local-time parse, mirrors deriveSportWeek. */
function dayIdxOf(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return (new Date(y, m - 1, d).getDay() + 6) % 7
}

// One-off events (mezo-e1sp) join the weekly rhythm as extra dated sessions. Only the
// current Mon–Sun week's events merge in — every downstream surface (Mai/Heti agenda,
// Today hero, the fuel day-plan blocks) reasons over this week — and each carries its
// concrete `date` so weekAgenda pins it to that one day instead of every same-weekday.
// `today` is date-based (never weekday-based) for a one-off. Base passes through
// untouched when the week has no events, keeping mock mode byte-identical to Phase 1.
export function mergeEventsIntoSchedule(
  base: SportSchedule | null,
  events: SportEventResponse[],
): SportSchedule | null {
  const now = new Date()
  const mondayIso = localDateString(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7)),
  )
  const sundayIso = addDays(mondayIso, 6)
  const week = events.filter((e) => e.date >= mondayIso && e.date <= sundayIso)
  if (!week.length) return base
  const today = localDateString()
  const extra: VolleyballSession[] = week.map((e) => ({
    day: DAY_ORDER[dayIdxOf(e.date)],
    date: e.date,
    oneOff: true,
    time: e.time,
    duration: e.durationMin,
    court: e.location ?? '',
    intensity: e.intensityLabel ?? '',
    role: e.kind === 'match' ? 'meccs' : 'edzés',
    sport: (e.sport as VolleyballSession['sport']) ?? 'volleyball',
    ...(e.date === today ? { today: true } : {}),
  }))
  const vb = base?.volleyball
  return {
    volleyball: {
      team: vb?.team ?? '',
      season: vb?.season ?? '',
      // The hero's `Heti ritmus · {n}h` stays the RECURRING rhythm — one-offs don't move it.
      weeklyHours: vb?.weeklyHours ?? 0,
      sessions: [...(vb?.sessions ?? []), ...extra],
    },
  }
}

// Catalog row -> the Phase-1 library shape; `id` doubles as the catalog uuid and
// `catalogId` flags "came from the backend catalog" (mock statics never set it).
// `videoUrl`/`editable` carry the authoring metadata (video demo + user-authored flag).
export function toLibraryItem(r: ExerciseCatalogItem): ExerciseLibraryItem {
  return {
    id: r.id, catalogId: r.id, name: r.name, muscle: r.muscle, type: r.type, stim: r.stim, fatigue: r.fatigue,
    videoUrl: r.videoUrl ?? null, editable: r.editable,
    imageStartUrl: r.imageStartUrl ?? null, imageEndUrl: r.imageEndUrl ?? null,
  }
}

function isoWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

// Current ISO week (Mon-Sun) stats from the logged sessions; null when the week is
// empty so the hero ghost ("megjelenik az első logolt session után") stays truthful.
// Trend analysis is Phase 3 — 'stabil' is a constant (the field is not rendered).
function deriveSportWeek(rs: SportSessionResponse[]): SportWeek | null {
  const now = new Date()
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
  const afterSunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7)
  const inWeek = rs.filter((r) => {
    const [y, m, d] = r.date.split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    return dt >= monday && dt < afterSunday
  })
  if (inWeek.length === 0) return null
  const round1 = (n: number) => Math.round(n * 10) / 10
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6)
  const isoDate = (dt: Date) => new Intl.DateTimeFormat('en-CA').format(dt)
  const range = monday.getMonth() === sunday.getMonth()
    ? `${huMonthDay(isoDate(monday))}-${sunday.getDate()}`
    : `${huMonthDay(isoDate(monday))} - ${huMonthDay(isoDate(sunday))}`
  // Shoulder load is a volleyball-specific signal — average only over rows that carry it
  // (cross/TRX sessions log a null shoulderStrain), so a mixed week doesn't deflate the stat.
  const withStrain = inWeek.filter((r) => r.shoulderStrain != null)
  return {
    label: `Hét ${isoWeekNumber(now)} · ${range}`,
    sessions: inWeek.length,
    hoursPlayed: round1(inWeek.reduce((a, r) => a + r.duration, 0) / 60),
    avgRPE: round1(inWeek.reduce((a, r) => a + r.rpe, 0) / inWeek.length),
    avgShoulderStrain: withStrain.length
      ? round1(withStrain.reduce((a, r) => a + (r.shoulderStrain ?? 0), 0) / withStrain.length)
      : 0,
    shoulderLoadTrend: 'stabil',
  }
}

/**
 * Mock-mode close (mezo-meyc.2) — emulates the backend's TWO effects in the client-owned
 * cache (the sportEvents/mesoTemplateHooks idiom) so the offline demo stays self-consistent:
 * the run flips to `archived` AND a report appears at its report key. Without this, the close
 * sheet's navigation lands on a page that reports the run is still going.
 *
 * The seeded report is deliberately EMPTY of derived numbers (adherence zeros, no volume arc,
 * no strength rows, no records): mock mode has no logged set history to freeze, and inventing
 * plausible-looking totals for a run the user just closed would be a lie. The one thing it can
 * carry honestly is the note the owner just typed. Dates are ISO (the report contract's format
 * — the domain `Mesocycle` carries HU display strings, which the page's formatter would choke
 * on), reconstructed as a `weeks`-long window ending today.
 */
function mockClose(qc: QueryClient, id: string, selfEval?: string | null): void {
  const today = localDateString()
  qc.setQueryData<Mesocycle[]>(['train', 'mesocycles'], (prev) =>
    (prev ?? mesocycles).map((m) =>
      // `hasReport` flips with the status because a report is seeded below in the same
      // breath (mezo-meyc.4) — the Történet card's „riport" chip must not lie.
      m.id === id ? { ...m, status: 'archived', closedAt: `${today}T00:00:00Z`, hasReport: true } : m,
    ),
  )
  // Cache first, STATIC FIXTURE as the last resort (the mockRerun/mockStart idiom): the
  // seeded report's identity must not depend on what happens to be in the cache at close
  // time, or a cache in an unexpected shape silently titles the report 'Mesociklus'.
  const cached = qc.getQueryData<Mesocycle[]>(['train', 'mesocycles']) ?? mesocycles
  const meso = cached.find((m) => m.id === id) ?? mesocycles.find((m) => m.id === id)
  const weeks = meso?.weeks ?? 1
  const report: MesocycleReportResponse = {
    mesocycleId: id,
    templateId: meso?.templateId ?? null,
    title: meso?.title ?? 'Mesociklus',
    startDate: addDays(today, -(weeks * 7 - 1)),
    endDate: today,
    closedAt: `${today}T00:00:00Z`,
    weeks,
    selfEval: selfEval?.trim() || null,
    aiEval: null,
    // Backend parity: a freshly written report is always `pending` with the feature off.
    aiEvalStatus: 'pending',
    aiEvalGeneratedAt: null,
    aiEvalEnabled: false,
    adherence: {
      plannedSessions: 0, completedSessions: 0, plannedWeeks: weeks, completedWeeks: weeks, completionPct: 0,
    },
    volume: null,
    strength: [],
    records: { medalCount: 0, top: [] },
    context: null,
  }
  qc.setQueryData(mesoReportQueryKey(id), report)
}

/**
 * Mock-mode muscle-priorities update (mezo-3m5m): the real endpoint replaces the map
 * wholesale and returns the FULL assembled run (days/volumePerMuscle/hasReport included).
 * Mock mirrors that "full run" semantic by patching just the `musclePriorities` key of the
 * already-cached run object in place (the mockClose idiom) — every other field rides along
 * untouched, so the write can never silently drop volumePerMuscle/days/hasReport.
 */
function mockUpdateMusclePriorities(
  qc: QueryClient,
  id: string,
  musclePriorities: MusclePriorities | null,
): Mesocycle | undefined {
  qc.setQueryData<Mesocycle[]>(['train', 'mesocycles'], (prev) =>
    (prev ?? mesocycles).map((m) => (m.id === id ? { ...m, musclePriorities } : m)))
  const cached = qc.getQueryData<Mesocycle[]>(['train', 'mesocycles']) ?? mesocycles
  return cached.find((m) => m.id === id)
}

type MutateOpts = { onSuccess?: () => void; onError?: () => void }

/** Finish options — `note` is the workout's closing note (mezo-d20.8.2.2), optional and
 *  fill-if-empty server-side, so a retry after a failed finish cannot erase it. */
type FinishOpts = {
  note?: string | null
  onSuccess?: (r?: WorkoutInstanceResponse) => void
  onSettled?: () => void
}

// Real mode has no static fallback (T0 "tiszta lap"): an empty backend must
// surface as null, not silently render Phase-1 demo data. `sport.sessions`
// loads from the API, `sport.schedule` from the weekly slots (T3), `sport.week`
// derives client-side from the current week's sessions (T3); only `crossLoad`
// stays null (Phase 3). `exerciseLibrary` loads from GET /api/train/exercises
// in real mode (curated master data, mezo-7ot). Mock mode returns the byte-identical
// Phase-1 statics, and the write mutations no-op so Phase-1 interactions keep
// their local behavior.
type TrainData = {
  mesocycles: Mesocycle[]
  activeMeso: Mesocycle | null
  workout: WorkoutPlan | null
  gymSchedule: GymSchedule | null
  gymSlots: GymScheduleSlot[]
  sport: { [K in keyof Sport]: K extends 'sessions' ? SportSession[] : Sport[K] | null }
  exerciseLibrary: ExerciseLibraryItem[]
  exerciseRecords: ExerciseRecordResponse[]
  todaySession: { templateSessionId: string; openWorkout: WorkoutInstanceResponse | null } | null
  /** Today's COMPLETED instance of today's template day (real mode) — drives the Kész/Megnézem hero + the session-route review redirect. */
  completedTodayWorkout: WorkoutInstanceResponse | null
  /** ISO dates (this Mon–Sun week) with a logged gym workout — drives the Mai gym done-state. Real mode only. */
  gymDoneDates: string[]
  /** True while the meso//today queries are still loading (real mode) — guards must not redirect yet. */
  workoutPending: boolean
  /** True while the sport-sessions query is still loading (real mode) — drives the Sport skeleton. */
  sportPending: boolean
  /** True while the exercise catalog/records queries are still loading (real mode) — drives the Exercises skeleton. */
  exercisesPending: boolean
  activateMesocycle: (id: string, opts?: MutateOpts) => void
  /** Closes (archives) a run. `selfEval` is the owner's optional close-time note (mezo-meyc.2). */
  closeMesocycle: (id: string, selfEval?: string | null, opts?: MutateOpts) => void
  /** Replaces a run's per-muscle priority tiers wholesale (mezo-3m5m); null/empty -> all-Grow. */
  updateMusclePriorities: (id: string, musclePriorities: MusclePriorities | null, opts?: MutateOpts) => void
  saveDayExercises: (mesoId: string, dayId: string, exercises: GymExerciseInput[]) => void
  startWorkout: (templateSessionId: string, opts?: { onSuccess?: (w: WorkoutInstanceResponse) => void }) => void
  // `ctx` is the mock evaluator's baseline (exercise name + lastWeek + date) — the caller
  // (ActiveWorkoutPage) supplies it because only it knows which exercise/lastWeek is being
  // logged; real mode ignores it. The response carries `medals` in BOTH modes. `onError`
  // (mezo-l3on fix-round-2, N1) lets the caller roll back its own optimistic local append
  // when the POST fails — otherwise a strayed set can never bind a server id.
  logSet: (
    workoutId: string,
    set: SetLogRequest,
    opts?: { ctx?: MockMedalContext; onSuccess?: (r?: ExerciseSetResponse) => void; onError?: (err: unknown) => void },
  ) => void
  /** Overwrite one logged set (mezo-l3on). Mock mode is a no-op that echoes the id. */
  updateSet: (
    workoutId: string,
    setId: string,
    body: SetUpdateRequest,
    opts?: { onSuccess?: (r?: ExerciseSetResponse) => void },
  ) => void
  /** Soft-delete one logged set; the server renumbers the exercise's remaining setIndexes. */
  deleteSet: (workoutId: string, setId: string) => void
  skipExercise: (workoutId: string, exerciseId: string) => void
  saveExerciseNote: (exerciseId: string, note: string) => void
  saveWorkoutFeedback: (workoutId: string, items: WorkoutFeedbackInput[]) => void
  finishWorkout: (workoutId: string, opts?: FinishOpts) => void
  logSportSession: (req: SportSessionCreateRequest, opts?: { onSuccess?: (r?: SportSessionResponse) => void; onSettled?: () => void }) => void
  saveSportSchedule: (slots: SportScheduleSlotInput[], opts?: MutateOpts) => void
  /** All one-off (non-recurring) sport events, date+time ascending (mezo-e1sp) — the Sport tab's upcoming list. */
  sportEvents: SportEventResponse[]
  addSportEvent: (req: SportEventCreateRequest, opts?: { onSuccess?: () => void; onSettled?: () => void }) => void
  deleteSportEvent: (id: string, opts?: MutateOpts) => void
  saveGymSchedule: (slots: GymScheduleSlotInput[], opts?: MutateOpts) => void
  createCatalogExercise: (req: CatalogExerciseCreateRequest, opts?: MutateOpts) => void
  updateCatalogExercise: (id: string, req: CatalogExerciseCreateRequest, opts?: MutateOpts) => void
  deleteCatalogExercise: (id: string, opts?: MutateOpts) => void
  setExerciseVideo: (id: string, videoUrl: string | null, opts?: MutateOpts) => void
  mesoMutationPending: boolean
}

export function useTrain(opts?: { workoutDay?: string | null }): TrainData {
  const mock = isMockMode()
  const qc = useQueryClient()
  // Cross-day start (mezo-p7rp): the session route may pin a template day (?day=...).
  // Day resolution is server-side (open instance > param > weekday label); param-less
  // callers keep the plain today context. Mock ignores the param (static plan).
  const workoutDay = opts?.workoutDay ?? null
  const { data: mesoData, isPending: mesoPending } = useQuery({
    queryKey: ['train', 'mesocycles'],
    // Mock resolves SEEDED CACHE first, static fixture second (mesoReportHooks' mockResolve
    // idiom): mockStart/mockRerun (mezo-meyc.1) and mockClose (mezo-meyc.2) all edit this list
    // via setQueryData, and a queryFn that returned the frozen array unconditionally regresses
    // every one of those edits the moment anything re-resolves the query. `staleTime` below
    // removes the routine trigger; this removes the failure mode itself.
    queryFn: mock
      ? async () => qc.getQueryData<Mesocycle[]>(['train', 'mesocycles']) ?? mesocycles
      : () => trainApi.mesocycles().then(rs => rs.map(toMesocycle)),
    // Mock mode seeds synchronously so the first render matches the Phase-1
    // static return exactly (the visual baselines + component tests). Real mode loads.
    initialData: mock ? mesocycles : undefined,
    // Mock is a CLIENT-OWNED cache — mockStart/mockRerun (mezo-meyc.1) and mockClose
    // (mezo-meyc.2) all edit this list via setQueryData. Without pinning staleTime, the
    // seed is stale on arrival and the mount refetch resolves the FROZEN static array back
    // over those edits (a race: it clobbered a just-closed run back to `active`). Same
    // guard the sibling mock caches below already carry (gymSchedule, sportEvents) — the
    // pantry/useDualQuery pattern. Real mode keeps the TanStack default.
    staleTime: mock ? Infinity : undefined,
  })
  // Week stats derive from the RAW ISO-dated responses (the mapped sessions carry
  // HU display dates), so the derivation happens inside the queryFn.
  const { data: sportData, isPending: sportQueryPending } = useQuery({
    queryKey: ['train', 'sportSessions'],
    queryFn: mock
      ? async () => ({ sessions: sport.sessions, week: sport.week })
      : () => trainApi.sportSessions().then((rs) => ({ sessions: rs.map(toSportSession), week: deriveSportWeek(rs) })),
    initialData: mock ? { sessions: sport.sessions, week: sport.week } : undefined,
  })
  const { data: scheduleData } = useQuery({
    queryKey: ['train', 'sportSchedule'],
    queryFn: mock ? async () => sport.schedule : () => trainApi.sportSchedule().then(toSportSchedule),
    initialData: mock ? sport.schedule : undefined,
  })
  // One-off (non-recurring) sport events (mezo-e1sp). The FULL list loads — it stays small
  // and the Sport tab renders upcoming ones beyond this week; the current week's slice is
  // merged into `sport.schedule` below. Mock is a client-owned cache (the event mutations
  // edit it via setQueryData), so staleTime pins it like the gym-slot cache above.
  const { data: eventsData } = useQuery({
    queryKey: ['train', 'sportEvents'],
    queryFn: mock ? async () => [] as SportEventResponse[] : () => trainApi.sportEvents(),
    initialData: mock ? ([] as SportEventResponse[]) : undefined,
    staleTime: mock ? Infinity : undefined,
  })
  // Standalone weekly gym slots (WHEN) — joined onto the active meso's gym days
  // by `deriveGymSchedule`. Mock serves the static slots; real fetches + maps.
  const { data: gymSlotsData } = useQuery({
    queryKey: ['train', 'gymSchedule'],
    queryFn: mock ? async () => gymScheduleMock : () => trainApi.gymSchedule().then(toGymSlots),
    initialData: mock ? gymScheduleMock : undefined,
    // Mock is a client-owned cache: the morning-training reschedule (mezo-67rb) edits it via
    // setQueryData, which a stale-triggered refetch would clobber (the pantry/useDualQuery pattern).
    staleTime: mock ? Infinity : undefined,
  })
  // Exercise catalog — master data; one fetch per app session is plenty.
  const { data: catalogData, isPending: catalogPending } = useQuery({
    queryKey: ['train', 'exerciseCatalog'],
    queryFn: mock ? async () => exerciseLibrary : () => trainApi.exerciseCatalog().then((rs) => rs.map(toLibraryItem)),
    initialData: mock ? exerciseLibrary : undefined,
    staleTime: 60 * 60 * 1000,
  })
  // Per-exercise records — computed server-side from logged sets; mock mode has no
  // set history (Phase 1), so it serves an empty list and the view ghost-guards.
  const { data: recordsData, isPending: recordsPending } = useQuery({
    queryKey: ['train', 'exerciseRecords'],
    queryFn: mock ? async () => [] as ExerciseRecordResponse[] : () => trainApi.exerciseRecords(),
    initialData: mock ? [] : undefined,
  })
  // Today's workout context — only meaningful in real mode (mock serves the static plan).
  // The day param joins the key so a pinned-day session and the plain today context
  // cache separately; invalidateToday's ['train','workoutToday'] prefix hits both.
  const { data: todayData, isPending: todayPending } = useQuery({
    queryKey: ['train', 'workoutToday', workoutDay],
    queryFn: mock ? async () => null : () => trainApi.workoutToday(workoutDay ?? undefined),
    initialData: mock ? null : undefined,
  })

  // Write mutations: mock mode no-ops (Phase-1 local behavior stays untouched);
  // real mode persists then refetches the meso list (Slice A invalidate idiom).
  const invalidate = () => {
    if (!mock) qc.invalidateQueries({ queryKey: ['train', 'mesocycles'] })
  }
  const activateMutation = useMutation({
    mutationFn: mock ? async (_id: string) => undefined : (id: string) => trainApi.activate(id),
    onSuccess: invalidate,
  })
  // Closing writes the frozen run report server-side (mezo-meyc.2), so the run's report
  // query is invalidated alongside the list — a re-close that fills a still-null selfEval
  // must not leave a stale report on screen. Mock mode emulates BOTH server effects in the
  // client-owned cache (see mockClose) instead of no-oping: the close sheet navigates to the
  // report, and a no-op close would land the offline demo on a page insisting the run is
  // still active.
  const closeMutation = useMutation({
    mutationFn: mock
      ? async (args: { id: string; selfEval?: string | null }) => {
          mockClose(qc, args.id, args.selfEval)
          return undefined
        }
      : (args: { id: string; selfEval?: string | null }) =>
          trainApi.close(args.id, args.selfEval ? { selfEval: args.selfEval } : undefined),
    onSuccess: (_data, args) => {
      invalidate()
      if (!mock) qc.invalidateQueries({ queryKey: mesoReportQueryKey(args.id) })
    },
  })
  // Muscle-priority tiers (mezo-3m5m): real mode PUTs the whole map and remaps the FULL
  // returned run; mock patches the client-owned cache in place (mockUpdateMusclePriorities)
  // instead of no-oping — a no-op here would leave the picker UI (Task 8) showing a tier
  // change that never sticks, the same trap `mockClose` was written to avoid.
  const updateMusclePrioritiesMutation = useMutation({
    mutationFn: mock
      ? async (args: { id: string; musclePriorities: MusclePriorities | null }) =>
          mockUpdateMusclePriorities(qc, args.id, args.musclePriorities)
      : (args: { id: string; musclePriorities: MusclePriorities | null }) =>
          trainApi.updateMusclePriorities(args.id, args.musclePriorities).then(toMesocycle),
    onSuccess: invalidate,
  })
  const replaceMutation = useMutation({
    mutationFn: mock
      ? async (_args: { mesoId: string; dayId: string; exercises: GymExerciseInput[] }) => undefined
      : (args: { mesoId: string; dayId: string; exercises: GymExerciseInput[] }) =>
          trainApi.replaceDayExercises(args.mesoId, args.dayId, args.exercises),
    onSuccess: invalidate,
  })

  // T2 workout-execution mutations: mock no-ops; real persists then refetches
  // /today so a mid-workout reload resumes from the open instance.
  const invalidateToday = () => {
    if (!mock) qc.invalidateQueries({ queryKey: ['train', 'workoutToday'] })
  }
  // XP-producing writes (gym finish, sport log) refresh the progression profile
  // so the Me/Profile radar + muscle levels reflect the just-earned XP (P6).
  const invalidateProgression = () => {
    if (!mock) qc.invalidateQueries({ queryKey: ['progressionProfile'] })
  }
  // Finishing a gym session satisfies the training_done_today habit + gym_session_done quest,
  // both DERIVED server-side and re-evaluated only on the next read — nudge both so the ✓
  // appears on the routine / quest surfaces without a remount.
  const invalidateHabitAndQuests = () => {
    if (!mock) {
      qc.invalidateQueries({ queryKey: ['habitDay'] })
      qc.invalidateQueries({ queryKey: ['dailyQuests', localDateString()] })
    }
  }
  const startMutation = useMutation<WorkoutInstanceResponse | undefined, Error, string>({
    mutationFn: mock ? async () => undefined : (templateSessionId) => trainApi.startWorkout(templateSessionId),
    onSuccess: invalidateToday,
  })
  // Mock runs the mock medal evaluator; real persists and returns the backend's response.
  // Both branches carry `medals` so callers never have to branch on mode (mezo-wp6n).
  // Eligibility mirrors the backend: working sets only (kind defaults to 'working' when
  // omitted, per the contract), and evaluation is skipped when the caller didn't supply
  // a MockMedalContext (e.g. existing tests that call logSet without opts).
  const logSetMutation = useMutation({
    mutationFn: mock
      ? async (args: { workoutId: string; set: SetLogRequest; ctx?: MockMedalContext }) => {
          const isWorking = (args.set.kind ?? 'working') === 'working'
          const medals = isWorking && args.ctx
            ? evaluateMockSetMedals({
                exerciseName: args.ctx.exerciseName,
                lastWeek: args.ctx.lastWeek,
                date: args.ctx.date,
                weightKg: args.set.weightKg,
                reps: args.set.reps,
                targetWeightKg: args.set.targetWeightKg ?? null,
                targetReps: args.set.targetReps ?? null,
                setIndex: args.set.setIndex,
              })
            : []
          // `id` is synthesised too (mezo-l3on): the set-edit sheet addresses sets by their server
          // id, so mock mode needs a stable one per logged set.
          return { id: crypto.randomUUID(), medals } as ExerciseSetResponse
        }
      : (args: { workoutId: string; set: SetLogRequest; ctx?: MockMedalContext }) =>
          trainApi.logSet(args.workoutId, args.set),
    onSuccess: invalidateToday,
  })
  // Set edit/delete (mezo-l3on). The mock branch deliberately does NOT re-run
  // evaluateMockSetMedals: that evaluator keeps a module-level running history and pushes every
  // evaluated set into it, so re-evaluating an edit would record the set a SECOND time and inflate
  // the next record. Mock mode simply shows no medal chips for an edited exercise.
  const updateSetMutation = useMutation({
    mutationFn: mock
      ? async (args: { workoutId: string; setId: string; body: SetUpdateRequest }) =>
          ({ id: args.setId, medals: [] as ExerciseSetResponse['medals'] }) as ExerciseSetResponse
      : (args: { workoutId: string; setId: string; body: SetUpdateRequest }) =>
          trainApi.updateSet(args.workoutId, args.setId, args.body),
    onSuccess: invalidateToday,
  })
  const deleteSetMutation = useMutation({
    mutationFn: mock
      ? async (_args: { workoutId: string; setId: string }) => undefined
      : (args: { workoutId: string; setId: string }) => trainApi.deleteSet(args.workoutId, args.setId),
    onSuccess: invalidateToday,
  })
  const skipMutation = useMutation({
    mutationFn: mock
      ? async (_args: { workoutId: string; exerciseId: string }) => undefined
      : (args: { workoutId: string; exerciseId: string }) => trainApi.skip(args.workoutId, args.exerciseId),
    onSuccess: invalidateToday,
  })
  // F4 durable per-exercise note: real persists then refetches /today so the note
  // survives a reload; mock no-ops (the screen keeps a local override for parity).
  const noteMutation = useMutation({
    mutationFn: mock
      ? async (_args: { exerciseId: string; note: string }) => undefined
      : (args: { exerciseId: string; note: string }) => trainApi.saveExerciseNote(args.exerciseId, args.note),
    onSuccess: invalidateToday,
  })
  const feedbackMutation = useMutation({
    mutationFn: mock
      ? async (_args: { workoutId: string; items: WorkoutFeedbackInput[] }) => undefined
      : (args: { workoutId: string; items: WorkoutFeedbackInput[] }) =>
          trainApi.saveWorkoutFeedback(args.workoutId, args.items),
  })
  const finishMutation = useMutation({
    // Mock returns a seeded LevelUpResult-carrying response (the no-op finish
    // can't compute one) so the gym complete flow shows the level-up overlay.
    mutationFn: mock
      ? async (_v: { id: string; note?: string | null }) => {
          awardGamificationEvent(qc, { type: 'GYM' })
          return { levelUp: gymLevelUpMock } as WorkoutInstanceResponse
        }
      : (v: { id: string; note?: string | null }) => trainApi.finishWorkout(v.id, v.note),
    onSuccess: () => { invalidateToday(); invalidateProgression(); invalidateHabitAndQuests() },
  })

  // T3 sport mutations: real persists then refetches the affected query. Mock
  // appends the logged session to the cache (mirrors running's mock log) so the
  // Mai hero flips to its done-state and the Napló reflects it without a backend.
  const logSportMutation = useMutation({
    // Forward the full response (carries levelUp). Mock appends the logged
    // session to the cache (Mai done-state flip) AND returns a seeded
    // LevelUpResult-carrying response so the prototype shows the overlay.
    mutationFn: mock
      ? async (req: SportSessionCreateRequest): Promise<SportSessionResponse> => {
          const now = new Date()
          const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
          // Retroactive logging (mezo-9bbc) sends the LOGGED day's ISO date; only an
          // absent `date` means "now". Hardcoding today here dropped a Pótold log onto
          // today's card instead of the past day it was written for (mock-mode parity
          // with the real backend, whose server-side default is the same rule).
          const iso = req.date ?? localDateString()
          qc.setQueryData<{ sessions: SportSession[]; week: SportWeek | null }>(
            ['train', 'sportSessions'],
            (prev) => {
              const logged: SportSession = {
                id: `ss-${performance.now()}`, sport: req.sport ?? 'volleyball',
                date: huMonthDayDow(iso), isoDate: iso, time: hhmm,
                duration: req.duration, setsPlayed: req.setsPlayed ?? null, rounds: req.rounds ?? null, intensity: null,
                rpe: req.rpe, shoulderStrain: req.shoulderStrain ?? null, jumpCount: null, notes: req.notes ?? null,
              }
              return { sessions: [logged, ...(prev?.sessions ?? [])], week: prev?.week ?? null }
            },
          )
          awardGamificationEvent(qc, { type: 'SPORT' })
          // Only levelUp is read downstream; provide the required fields + the
          // captured effort, omitting the optional nullables.
          return {
            id: `ss-${performance.now()}`, sport: req.sport ?? 'volleyball', date: iso, time: hhmm,
            duration: req.duration, rpe: req.rpe, setsPlayed: req.setsPlayed, shoulderStrain: req.shoulderStrain,
            rounds: req.rounds, levelUp: sportLevelUpMock,
          } as SportSessionResponse
        }
      : (req: SportSessionCreateRequest) => trainApi.logSportSession(req),
    onSuccess: () => { if (!mock) qc.invalidateQueries({ queryKey: ['train', 'sportSessions'] }); invalidateProgression() },
  })
  const sportScheduleMutation = useMutation({
    mutationFn: mock
      ? async (_slots: SportScheduleSlotInput[]) => undefined
      : (slots: SportScheduleSlotInput[]) => trainApi.replaceSportSchedule(slots),
    onSuccess: () => { if (!mock) qc.invalidateQueries({ queryKey: ['train', 'sportSchedule'] }) },
  })
  // One-off sport events (mezo-e1sp): real persists then refetches; mock emulates the
  // server in the client-owned cache so the demo shows the event on Sport/Mai/Fuel too.
  const addSportEventMutation = useMutation({
    mutationFn: mock
      ? async (req: SportEventCreateRequest): Promise<SportEventResponse> => {
          const created: SportEventResponse = {
            id: `se-${performance.now()}`,
            date: req.date, time: req.time, durationMin: req.durationMin,
            kind: (req.kind as SportEventResponse['kind']) ?? 'training',
            sport: req.sport ?? 'volleyball',
            location: req.location, intensityLabel: req.intensityLabel,
          }
          qc.setQueryData<SportEventResponse[]>(['train', 'sportEvents'], (prev) =>
            [...(prev ?? []), created].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)))
          return created
        }
      : (req: SportEventCreateRequest) => trainApi.createSportEvent(req),
    onSuccess: () => { if (!mock) qc.invalidateQueries({ queryKey: ['train', 'sportEvents'] }) },
  })
  const deleteSportEventMutation = useMutation({
    mutationFn: mock
      ? async (id: string) => {
          qc.setQueryData<SportEventResponse[]>(['train', 'sportEvents'], (prev) =>
            (prev ?? []).filter((e) => e.id !== id))
        }
      : (id: string) => trainApi.deleteSportEvent(id),
    onSuccess: () => { if (!mock) qc.invalidateQueries({ queryKey: ['train', 'sportEvents'] }) },
  })
  const gymScheduleMutation = useMutation({
    mutationFn: mock
      ? async (_slots: GymScheduleSlotInput[]) => undefined
      : (slots: GymScheduleSlotInput[]) => trainApi.replaceGymSchedule(slots),
    onSuccess: () => { if (!mock) qc.invalidateQueries({ queryKey: ['train', 'gymSchedule'] }) },
  })

  // Catalog authoring mutations (mezo-52zg): mock no-ops (Phase-1 statics stay
  // read-only); real persists then refetches the catalog so the new/edited/deleted
  // row (and its video) surfaces in the library list.
  const invalidateCatalog = () => {
    if (!mock) qc.invalidateQueries({ queryKey: ['train', 'exerciseCatalog'] })
  }
  const createExerciseMutation = useMutation({
    mutationFn: mock
      ? async (_req: CatalogExerciseCreateRequest) => undefined
      : (req: CatalogExerciseCreateRequest) => trainApi.createExercise(req),
    onSuccess: invalidateCatalog,
  })
  const updateExerciseMutation = useMutation({
    mutationFn: mock
      ? async (_args: { id: string; req: CatalogExerciseCreateRequest }) => undefined
      : (args: { id: string; req: CatalogExerciseCreateRequest }) => trainApi.updateExercise(args.id, args.req),
    onSuccess: invalidateCatalog,
  })
  const deleteExerciseMutation = useMutation({
    mutationFn: mock ? async (_id: string) => undefined : (id: string) => trainApi.deleteExercise(id),
    onSuccess: invalidateCatalog,
  })
  const setExerciseVideoMutation = useMutation({
    mutationFn: mock
      ? async (_args: { id: string; videoUrl: string | null }) => undefined
      : (args: { id: string; videoUrl: string | null }) => trainApi.setExerciseVideo(args.id, args.videoUrl),
    onSuccess: invalidateCatalog,
  })

  const activateMesocycle = useCallback(
    (id: string, opts?: MutateOpts) => activateMutation.mutate(id, opts),
    [activateMutation],
  )
  const closeMesocycle = useCallback(
    (id: string, selfEval?: string | null, opts?: MutateOpts) =>
      closeMutation.mutate({ id, selfEval }, opts),
    [closeMutation],
  )
  const updateMusclePriorities = useCallback(
    (id: string, musclePriorities: MusclePriorities | null, opts?: MutateOpts) =>
      updateMusclePrioritiesMutation.mutate({ id, musclePriorities }, opts),
    [updateMusclePrioritiesMutation],
  )
  const saveDayExercises = useCallback(
    (mesoId: string, dayId: string, exercises: GymExerciseInput[]) =>
      replaceMutation.mutate({ mesoId, dayId, exercises }),
    [replaceMutation],
  )
  const startWorkout = useCallback(
    (templateSessionId: string, opts?: { onSuccess?: (w: WorkoutInstanceResponse) => void }) =>
      startMutation.mutate(templateSessionId, {
        onSuccess: (w) => { if (w) opts?.onSuccess?.(w) },
      }),
    [startMutation],
  )
  const logSet = useCallback(
    (
      workoutId: string,
      set: SetLogRequest,
      opts?: { ctx?: MockMedalContext; onSuccess?: (r?: ExerciseSetResponse) => void; onError?: (err: unknown) => void },
    ) =>
      logSetMutation.mutate(
        { workoutId, set, ctx: opts?.ctx },
        { onSuccess: (r) => opts?.onSuccess?.(r), onError: (err) => opts?.onError?.(err) },
      ),
    [logSetMutation],
  )
  const updateSet = useCallback(
    (
      workoutId: string,
      setId: string,
      body: SetUpdateRequest,
      opts?: { onSuccess?: (r?: ExerciseSetResponse) => void },
    ) =>
      updateSetMutation.mutate({ workoutId, setId, body }, { onSuccess: (r) => opts?.onSuccess?.(r) }),
    [updateSetMutation],
  )
  const deleteSet = useCallback(
    (workoutId: string, setId: string) => deleteSetMutation.mutate({ workoutId, setId }),
    [deleteSetMutation],
  )
  const skipExercise = useCallback(
    (workoutId: string, exerciseId: string) => skipMutation.mutate({ workoutId, exerciseId }),
    [skipMutation],
  )
  const saveExerciseNote = useCallback(
    (exerciseId: string, note: string) => noteMutation.mutate({ exerciseId, note }),
    [noteMutation],
  )
  const saveWorkoutFeedback = useCallback(
    (workoutId: string, items: WorkoutFeedbackInput[]) => feedbackMutation.mutate({ workoutId, items }),
    [feedbackMutation],
  )
  const finishWorkout = useCallback(
    (workoutId: string, opts?: FinishOpts) =>
      finishMutation.mutate({ id: workoutId, note: opts?.note },
        { onSuccess: (r) => opts?.onSuccess?.(r), onSettled: () => opts?.onSettled?.() }),
    [finishMutation],
  )
  const logSportSession = useCallback(
    (req: SportSessionCreateRequest, opts?: { onSuccess?: (r?: SportSessionResponse) => void; onSettled?: () => void }) =>
      logSportMutation.mutate(req, { onSuccess: (r) => opts?.onSuccess?.(r), onSettled: () => opts?.onSettled?.() }),
    [logSportMutation],
  )
  const saveSportSchedule = useCallback(
    (slots: SportScheduleSlotInput[], opts?: MutateOpts) => sportScheduleMutation.mutate(slots, opts),
    [sportScheduleMutation],
  )
  const addSportEvent = useCallback(
    (req: SportEventCreateRequest, opts?: { onSuccess?: () => void; onSettled?: () => void }) =>
      addSportEventMutation.mutate(req, { onSuccess: () => opts?.onSuccess?.(), onSettled: () => opts?.onSettled?.() }),
    [addSportEventMutation],
  )
  const deleteSportEvent = useCallback(
    (id: string, opts?: MutateOpts) => deleteSportEventMutation.mutate(id, opts),
    [deleteSportEventMutation],
  )
  const saveGymSchedule = useCallback(
    (slots: GymScheduleSlotInput[], opts?: MutateOpts) => gymScheduleMutation.mutate(slots, opts),
    [gymScheduleMutation],
  )
  const createCatalogExercise = useCallback(
    (req: CatalogExerciseCreateRequest, opts?: MutateOpts) => createExerciseMutation.mutate(req, opts),
    [createExerciseMutation],
  )
  const updateCatalogExercise = useCallback(
    (id: string, req: CatalogExerciseCreateRequest, opts?: MutateOpts) => updateExerciseMutation.mutate({ id, req }, opts),
    [updateExerciseMutation],
  )
  const deleteCatalogExercise = useCallback(
    (id: string, opts?: MutateOpts) => deleteExerciseMutation.mutate(id, opts),
    [deleteExerciseMutation],
  )
  const setExerciseVideo = useCallback(
    (id: string, videoUrl: string | null, opts?: MutateOpts) => setExerciseVideoMutation.mutate({ id, videoUrl }, opts),
    [setExerciseVideoMutation],
  )

  const mesos = mesoData ?? []
  const realActiveMeso = mesos.find(m => m.status === 'active') ?? null
  const gymSlots = gymSlotsData ?? []
  return {
    mesocycles: mesos,
    // real mode: no static fallback — empty backend means null, components ghost-guard (T0)
    activeMeso: realActiveMeso ?? (mock ? activeMeso : null),
    workout: mock ? trainWorkout : toWorkoutPlan(todayData),
    // Mock serves the full static weekly schedule (Phase-1 parity); real derives
    // the meso's gym days (WHAT) joined with the standalone gym slots (WHEN).
    gymSchedule: mock ? trainGymSchedule : deriveGymSchedule(realActiveMeso, gymSlots),
    gymSlots,
    todaySession: !mock && todayData?.templateSessionId
      ? { templateSessionId: todayData.templateSessionId, openWorkout: todayData.openWorkout ?? null }
      : null,
    completedTodayWorkout: mock ? null : (todayData?.completedWorkout ?? null),
    // Gym done-state dates: real mode reads them from /today (computed server-side);
    // mock mode has no persisted instances, so the gym never flips to done offline.
    gymDoneDates: mock ? [] : (todayData?.weekDoneDates ?? []),
    workoutPending: !mock && (mesoPending || todayPending),
    sportPending: !mock && sportQueryPending,
    exercisesPending: !mock && (catalogPending || recordsPending),
    // One-off events merge into the schedule in BOTH modes (mezo-e1sp); with no events
    // the base passes through untouched, so mock stays byte-identical to Phase 1.
    sport: mock
      ? { ...sport, schedule: mergeEventsIntoSchedule(sport.schedule, eventsData ?? []), sessions: sportData?.sessions ?? [] }
      : { schedule: mergeEventsIntoSchedule(scheduleData ?? null, eventsData ?? []), week: sportData?.week ?? null, crossLoad: null, sessions: sportData?.sessions ?? [] },
    sportEvents: eventsData ?? [],
    exerciseLibrary: catalogData ?? [], // API catalog in real mode, Phase-1 statics in mock
    exerciseRecords: recordsData ?? [],
    activateMesocycle,
    closeMesocycle,
    updateMusclePriorities,
    saveDayExercises,
    startWorkout,
    logSet,
    updateSet,
    deleteSet,
    skipExercise,
    saveExerciseNote,
    saveWorkoutFeedback,
    finishWorkout,
    logSportSession,
    saveSportSchedule,
    addSportEvent,
    deleteSportEvent,
    saveGymSchedule,
    createCatalogExercise,
    updateCatalogExercise,
    deleteCatalogExercise,
    setExerciseVideo,
    mesoMutationPending: activateMutation.isPending || closeMutation.isPending,
  }
}

/**
 * Lightweight any-route read of today's open (resumable) gym workout — the
 * FloatingReturnLayer's data source (mezo-78sd). Shares `useTrain`'s param-less
 * `['train','workoutToday', null]` key, so on Train/Today routes it dedupes
 * against the already-warm cache and adds zero network; elsewhere it costs one
 * GET instead of `useTrain`'s full 8-query fan-out. Set-logging/finish already
 * invalidate the `['train','workoutToday']` prefix, so the badge stays live.
 * Mock mode has no persisted instances (Phase-1 parity): the cache-first
 * queryFn preserves test-seeded values instead of clobbering them back to null.
 */
export function useOpenWorkout(): {
  openWorkout: WorkoutInstanceResponse | null
  title: string | null
  doneSets: number
} {
  const mock = isMockMode()
  const qc = useQueryClient()
  // Two literal option objects, NOT one with `x: mock ? y : undefined` fields — an
  // explicitly-undefined key still overrides the client's defaultOptions on merge,
  // which would silently drop a caller-configured staleTime in real mode.
  const { data } = useQuery(
    mock
      ? {
          queryKey: ['train', 'workoutToday', null],
          queryFn: async () =>
            qc.getQueryData<WorkoutTodayResponse | null>(['train', 'workoutToday', null]) ?? null,
          initialData: null as WorkoutTodayResponse | null,
          staleTime: Infinity,
        }
      : {
          queryKey: ['train', 'workoutToday', null],
          queryFn: (): Promise<WorkoutTodayResponse | null> => trainApi.workoutToday(),
        },
  )
  // A completed today-instance means the open one is stale chrome, not a resumable
  // session — the same gate TrainTodayPage/useToday apply.
  const open = data && !data.completedWorkout ? data.openWorkout ?? null : null
  return {
    openWorkout: open,
    title: open ? data?.title ?? null : null,
    doneSets: open ? open.sets.filter((s) => !s.skipped).length : 0,
  }
}
