import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/lib/mode'
import { huMonthDay, huMonthDayDow } from '@/lib/dates'
import {
  trainApi,
  type GymExerciseInput,
  type MesocycleCreateRequest,
  type MesocycleResponse,
  type SportSessionResponse,
} from '@/lib/trainApi'
import {
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
  createMesocycle: (req: MesocycleCreateRequest, opts?: MutateOpts) => void
  activateMesocycle: (id: string, opts?: MutateOpts) => void
  closeMesocycle: (id: string, opts?: MutateOpts) => void
  saveDayExercises: (mesoId: string, dayId: string, exercises: GymExerciseInput[]) => void
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

  const mesos = mesoData ?? []
  return {
    mesocycles: mesos,
    // real mode: no static fallback — empty backend means null, components ghost-guard (T0)
    activeMeso: mesos.find(m => m.status === 'active') ?? (mock ? activeMeso : null),
    workout: mock ? trainWorkout : null,          // real value arrives in T2 (/today endpoint)
    gymSchedule: mock ? trainGymSchedule : null,  // real derivation arrives in T2
    sport: mock
      ? { ...sport, sessions: sportSessions ?? [] }
      : { ...sport, schedule: null, week: null, crossLoad: null, sessions: sportSessions ?? [] },
    exerciseLibrary, // static catalog — content, not user data (spec decision)
    createMesocycle,
    activateMesocycle,
    closeMesocycle,
    saveDayExercises,
    mesoMutationPending: createMutation.isPending || activateMutation.isPending || closeMutation.isPending,
  }
}
