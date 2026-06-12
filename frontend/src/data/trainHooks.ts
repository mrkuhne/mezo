import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/lib/mode'
import { huMonthDay, huMonthDayDow } from '@/lib/dates'
import {
  trainApi,
  type GymExerciseInput,
  type MesocycleCreateRequest,
  type MesocycleResponse,
  type SetLogRequest,
  type SportSessionResponse,
  type WorkoutFeedbackInput,
  type WorkoutInstanceResponse,
  type WorkoutTodayResponse,
} from '@/lib/trainApi'
import {
  DAY_ORDER,
  mesocycles,
  activeMeso,
  workout as trainWorkout,
  gymSchedule as trainGymSchedule,
  sport,
  exerciseLibrary,
} from './train'
import type {
  ExerciseLibraryItem,
  GymSchedule,
  Mesocycle,
  Sport,
  SportSession,
  WorkoutPlan,
} from './types'

// /today -> the Phase-1 WorkoutPlan shape. AI extras (challenges, niggleWarning)
// are Phase 3 — empty/absent in real mode. `tag` is display-derived elsewhere.
function toWorkoutPlan(r: WorkoutTodayResponse | null | undefined): WorkoutPlan | null {
  if (!r?.templateSessionId || !r.exercises?.length) return null
  return {
    title: r.title ?? '',
    tag: '',
    durationEst: r.durationEst ?? 0,
    exercises: r.exercises.map((e) => ({
      id: e.id, name: e.name, muscle: e.muscle, sets: e.sets,
      targetReps: e.targetReps, targetRIR: e.targetRIR, type: e.type,
      lastWeek: e.lastWeek
        ? { weight: Number(e.lastWeek.weightKg), reps: e.lastWeek.reps, rir: e.lastWeek.rir }
        : null,
    })),
    challenges: [],
  }
}

// Gym weekly row derived from the active meso's template days (no schedule
// template in Phase 2 — FR-2.1.12 is out of scope, so time/duration are null).
function deriveGymSchedule(meso: Mesocycle | null): GymSchedule | null {
  const days = meso?.days
  if (!days?.length) return null
  const todayLabel = DAY_ORDER[(new Date().getDay() + 6) % 7]
  return {
    weeklyTimes: DAY_ORDER.map((d) => {
      const md = days.find((x) => x.day === d && x.exerciseCount > 0)
      return md
        ? { day: d, type: md.type, time: null, duration: null, active: true, today: d === todayLabel }
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
    duration: r.duration, setsPlayed: r.setsPlayed, intensity: r.intensity,
    rpe: r.rpe, shoulderStrain: r.shoulderStrain, jumpCount: r.jumpCount,
    notes: r.notes ?? null,
  }
}

type MutateOpts = { onSuccess?: () => void }

// Real mode has no static fallback (T0 "tiszta lap"): an empty backend must
// surface as null, not silently render Phase-1 demo data. `sport.sessions`
// always loads from the API; the other sport facets (schedule/week/crossLoad)
// are derived data that lands in T2/T3, so they're null until then.
// `exerciseLibrary` stays static — it's a content catalog, not user data (spec
// decision). Mock mode returns the byte-identical Phase-1 statics, and the
// T1 write mutations no-op so Phase-1 interactions keep their local behavior.
type TrainData = {
  mesocycles: Mesocycle[]
  activeMeso: Mesocycle | null
  workout: WorkoutPlan | null
  gymSchedule: GymSchedule | null
  sport: { [K in keyof Sport]: K extends 'sessions' ? SportSession[] : Sport[K] | null }
  exerciseLibrary: ExerciseLibraryItem[]
  todaySession: { templateSessionId: string; openWorkout: WorkoutInstanceResponse | null } | null
  createMesocycle: (req: MesocycleCreateRequest, opts?: MutateOpts) => void
  activateMesocycle: (id: string, opts?: MutateOpts) => void
  closeMesocycle: (id: string, opts?: MutateOpts) => void
  saveDayExercises: (mesoId: string, dayId: string, exercises: GymExerciseInput[]) => void
  startWorkout: (templateSessionId: string, opts?: { onSuccess?: (w: WorkoutInstanceResponse) => void }) => void
  logSet: (workoutId: string, set: SetLogRequest) => void
  saveWorkoutFeedback: (workoutId: string, items: WorkoutFeedbackInput[]) => void
  finishWorkout: (workoutId: string) => void
  mesoMutationPending: boolean
}

export function useTrain(): TrainData {
  const mock = isMockMode()
  const qc = useQueryClient()
  const { data: mesoData } = useQuery({
    queryKey: ['train', 'mesocycles'],
    queryFn: mock ? async () => mesocycles : () => trainApi.mesocycles().then(rs => rs.map(toMesocycle)),
    // Mock mode seeds synchronously so the first render matches the Phase-1
    // static return exactly (parity + component tests). Real mode loads.
    initialData: mock ? mesocycles : undefined,
  })
  const { data: sportSessions } = useQuery({
    queryKey: ['train', 'sportSessions'],
    queryFn: mock ? async () => sport.sessions : () => trainApi.sportSessions().then(rs => rs.map(toSportSession)),
    initialData: mock ? sport.sessions : undefined,
  })
  // Today's workout context — only meaningful in real mode (mock serves the static plan).
  const { data: todayData } = useQuery({
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
  const feedbackMutation = useMutation({
    mutationFn: mock
      ? async (_args: { workoutId: string; items: WorkoutFeedbackInput[] }) => undefined
      : (args: { workoutId: string; items: WorkoutFeedbackInput[] }) =>
          trainApi.saveWorkoutFeedback(args.workoutId, args.items),
  })
  const finishMutation = useMutation({
    mutationFn: mock ? async (_id: string) => undefined : (id: string) => trainApi.finishWorkout(id),
    onSuccess: invalidateToday,
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
  const saveWorkoutFeedback = useCallback(
    (workoutId: string, items: WorkoutFeedbackInput[]) => feedbackMutation.mutate({ workoutId, items }),
    [feedbackMutation],
  )
  const finishWorkout = useCallback(
    (workoutId: string) => finishMutation.mutate(workoutId),
    [finishMutation],
  )

  const mesos = mesoData ?? []
  const realActiveMeso = mesos.find(m => m.status === 'active') ?? null
  return {
    mesocycles: mesos,
    // real mode: no static fallback — empty backend means null, components ghost-guard (T0)
    activeMeso: realActiveMeso ?? (mock ? activeMeso : null),
    workout: mock ? trainWorkout : toWorkoutPlan(todayData),
    gymSchedule: mock ? trainGymSchedule : deriveGymSchedule(realActiveMeso),
    todaySession: !mock && todayData?.templateSessionId
      ? { templateSessionId: todayData.templateSessionId, openWorkout: todayData.openWorkout ?? null }
      : null,
    sport: mock
      ? { ...sport, sessions: sportSessions ?? [] }
      : { ...sport, schedule: null, week: null, crossLoad: null, sessions: sportSessions ?? [] },
    exerciseLibrary, // static catalog — content, not user data (spec decision)
    createMesocycle,
    activateMesocycle,
    closeMesocycle,
    saveDayExercises,
    startWorkout,
    logSet,
    saveWorkoutFeedback,
    finishWorkout,
    mesoMutationPending: createMutation.isPending || activateMutation.isPending || closeMutation.isPending,
  }
}
