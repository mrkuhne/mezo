import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { huMonthDay, huMonthDayDow, localDateString } from '@/shared/lib/dates'
import {
  trainApi,
  type CatalogExerciseCreateRequest,
  type ExerciseCatalogItem,
  type ExerciseRecordResponse,
  type GymExerciseInput,
  type GymScheduleSlotInput,
  type GymScheduleSlotResponse,
  type MesocycleCreateRequest,
  type MesocycleResponse,
  type SetLogRequest,
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
import { gymLevelUpMock, sportLevelUpMock } from '@/data/progression/progressionMock'
import type {
  ExerciseLibraryItem,
  GymSchedule,
  GymScheduleSlot,
  Mesocycle,
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
      lastWeek: e.lastWeek
        ? { weight: Number(e.lastWeek.weightKg), reps: e.lastWeek.reps, rir: e.lastWeek.rir }
        : null,
    })),
    challenges: [],
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
function toMesocycle(r: MesocycleResponse): Mesocycle {
  return {
    ...r,
    startDate: huMonthDay(r.startDate),
    endDate: huMonthDay(r.endDate),
    goal: r.goal ?? '',
  } as Mesocycle
}

function toSportSession(r: SportSessionResponse): SportSession {
  return {
    id: r.id, sport: r.sport, date: huMonthDayDow(r.date), time: r.time,
    duration: r.duration, setsPlayed: r.setsPlayed ?? null, intensity: r.intensity ?? null,
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

// Catalog row -> the Phase-1 library shape; `id` doubles as the catalog uuid and
// `catalogId` flags "came from the backend catalog" (mock statics never set it).
// `videoUrl`/`editable` carry the authoring metadata (video demo + user-authored flag).
export function toLibraryItem(r: ExerciseCatalogItem): ExerciseLibraryItem {
  return {
    id: r.id, catalogId: r.id, name: r.name, muscle: r.muscle, type: r.type, stim: r.stim, fatigue: r.fatigue,
    videoUrl: r.videoUrl ?? null, editable: r.editable,
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

type MutateOpts = { onSuccess?: () => void; onError?: () => void }

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
  /** ISO dates (this Mon–Sun week) with a logged gym workout — drives the Mai gym done-state. Real mode only. */
  gymDoneDates: string[]
  /** True while the meso//today queries are still loading (real mode) — guards must not redirect yet. */
  workoutPending: boolean
  /** True while the sport-sessions query is still loading (real mode) — drives the Sport skeleton. */
  sportPending: boolean
  /** True while the exercise catalog/records queries are still loading (real mode) — drives the Exercises skeleton. */
  exercisesPending: boolean
  createMesocycle: (req: MesocycleCreateRequest, opts?: MutateOpts) => void
  activateMesocycle: (id: string, opts?: MutateOpts) => void
  closeMesocycle: (id: string, opts?: MutateOpts) => void
  saveDayExercises: (mesoId: string, dayId: string, exercises: GymExerciseInput[]) => void
  startWorkout: (templateSessionId: string, opts?: { onSuccess?: (w: WorkoutInstanceResponse) => void }) => void
  logSet: (workoutId: string, set: SetLogRequest) => void
  skipExercise: (workoutId: string, exerciseId: string) => void
  saveExerciseNote: (exerciseId: string, note: string) => void
  saveWorkoutFeedback: (workoutId: string, items: WorkoutFeedbackInput[]) => void
  finishWorkout: (workoutId: string, opts?: { onSuccess?: (r?: WorkoutInstanceResponse) => void }) => void
  logSportSession: (req: SportSessionCreateRequest, opts?: { onSuccess?: (r?: SportSessionResponse) => void; onSettled?: () => void }) => void
  saveSportSchedule: (slots: SportScheduleSlotInput[], opts?: MutateOpts) => void
  saveGymSchedule: (slots: GymScheduleSlotInput[], opts?: MutateOpts) => void
  createCatalogExercise: (req: CatalogExerciseCreateRequest, opts?: MutateOpts) => void
  updateCatalogExercise: (id: string, req: CatalogExerciseCreateRequest, opts?: MutateOpts) => void
  deleteCatalogExercise: (id: string, opts?: MutateOpts) => void
  setExerciseVideo: (id: string, videoUrl: string | null, opts?: MutateOpts) => void
  mesoMutationPending: boolean
}

export function useTrain(): TrainData {
  const mock = isMockMode()
  const qc = useQueryClient()
  const { data: mesoData, isPending: mesoPending } = useQuery({
    queryKey: ['train', 'mesocycles'],
    queryFn: mock ? async () => mesocycles : () => trainApi.mesocycles().then(rs => rs.map(toMesocycle)),
    // Mock mode seeds synchronously so the first render matches the Phase-1
    // static return exactly (the visual baselines + component tests). Real mode loads.
    initialData: mock ? mesocycles : undefined,
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
  // Standalone weekly gym slots (WHEN) — joined onto the active meso's gym days
  // by `deriveGymSchedule`. Mock serves the static slots; real fetches + maps.
  const { data: gymSlotsData } = useQuery({
    queryKey: ['train', 'gymSchedule'],
    queryFn: mock ? async () => gymScheduleMock : () => trainApi.gymSchedule().then(toGymSlots),
    initialData: mock ? gymScheduleMock : undefined,
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
  const { data: todayData, isPending: todayPending } = useQuery({
    queryKey: ['train', 'workoutToday'],
    queryFn: mock ? async () => null : () => trainApi.workoutToday(),
    initialData: mock ? null : undefined,
  })

  // Write mutations: mock mode no-ops (Phase-1 local behavior stays untouched);
  // real mode persists then refetches the meso list (Slice A invalidate idiom).
  const invalidate = () => {
    if (!mock) qc.invalidateQueries({ queryKey: ['train', 'mesocycles'] })
  }
  const createMutation = useMutation({
    mutationFn: mock ? async (_req: MesocycleCreateRequest) => undefined : (req: MesocycleCreateRequest) => trainApi.create(req),
    onSuccess: invalidate,
  })
  const activateMutation = useMutation({
    mutationFn: mock ? async (_id: string) => undefined : (id: string) => trainApi.activate(id),
    onSuccess: invalidate,
  })
  const closeMutation = useMutation({
    mutationFn: mock ? async (_id: string) => undefined : (id: string) => trainApi.close(id),
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
  const startMutation = useMutation<WorkoutInstanceResponse | undefined, Error, string>({
    mutationFn: mock ? async () => undefined : (templateSessionId) => trainApi.startWorkout(templateSessionId),
    onSuccess: invalidateToday,
  })
  const logSetMutation = useMutation({
    mutationFn: mock
      ? async (_args: { workoutId: string; set: SetLogRequest }) => undefined
      : (args: { workoutId: string; set: SetLogRequest }) => trainApi.logSet(args.workoutId, args.set),
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
      ? async (_id: string) => ({ levelUp: gymLevelUpMock } as WorkoutInstanceResponse)
      : (id: string) => trainApi.finishWorkout(id),
    onSuccess: () => { invalidateToday(); invalidateProgression() },
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
          qc.setQueryData<{ sessions: SportSession[]; week: SportWeek | null }>(
            ['train', 'sportSessions'],
            (prev) => {
              const logged: SportSession = {
                id: `ss-${performance.now()}`, sport: req.sport ?? 'volleyball',
                date: huMonthDayDow(localDateString()), time: hhmm,
                duration: req.duration, setsPlayed: req.setsPlayed ?? null, intensity: null,
                rpe: req.rpe, shoulderStrain: req.shoulderStrain ?? null, jumpCount: null, notes: null,
              }
              return { sessions: [logged, ...(prev?.sessions ?? [])], week: prev?.week ?? null }
            },
          )
          // Only levelUp is read downstream; provide the required fields + the
          // captured effort, omitting the optional nullables.
          return {
            id: `ss-${performance.now()}`, sport: req.sport ?? 'volleyball', date: localDateString(), time: hhmm,
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

  const createMesocycle = useCallback(
    (req: MesocycleCreateRequest, opts?: MutateOpts) => createMutation.mutate(req, opts),
    [createMutation],
  )
  const activateMesocycle = useCallback(
    (id: string, opts?: MutateOpts) => activateMutation.mutate(id, opts),
    [activateMutation],
  )
  const closeMesocycle = useCallback(
    (id: string, opts?: MutateOpts) => closeMutation.mutate(id, opts),
    [closeMutation],
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
    (workoutId: string, set: SetLogRequest) => logSetMutation.mutate({ workoutId, set }),
    [logSetMutation],
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
    (workoutId: string, opts?: { onSuccess?: (r?: WorkoutInstanceResponse) => void }) =>
      finishMutation.mutate(workoutId, { onSuccess: (r) => opts?.onSuccess?.(r) }),
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
    // Gym done-state dates: real mode reads them from /today (computed server-side);
    // mock mode has no persisted instances, so the gym never flips to done offline.
    gymDoneDates: mock ? [] : (todayData?.weekDoneDates ?? []),
    workoutPending: !mock && (mesoPending || todayPending),
    sportPending: !mock && sportQueryPending,
    exercisesPending: !mock && (catalogPending || recordsPending),
    sport: mock
      ? { ...sport, sessions: sportData?.sessions ?? [] }
      : { schedule: scheduleData ?? null, week: sportData?.week ?? null, crossLoad: null, sessions: sportData?.sessions ?? [] },
    exerciseLibrary: catalogData ?? [], // API catalog in real mode, Phase-1 statics in mock
    exerciseRecords: recordsData ?? [],
    createMesocycle,
    activateMesocycle,
    closeMesocycle,
    saveDayExercises,
    startWorkout,
    logSet,
    skipExercise,
    saveExerciseNote,
    saveWorkoutFeedback,
    finishWorkout,
    logSportSession,
    saveSportSchedule,
    saveGymSchedule,
    createCatalogExercise,
    updateCatalogExercise,
    deleteCatalogExercise,
    setExerciseVideo,
    mesoMutationPending: createMutation.isPending || activateMutation.isPending || closeMutation.isPending,
  }
}
