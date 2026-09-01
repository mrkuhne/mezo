import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'
import type { MusclePriorities } from '@/data/types'

// Contract types generated from api/openapi.yml — regenerate with `pnpm generate:api`.
export type MesocycleResponse = components['schemas']['MesocycleResponse']
export type SportSessionResponse = components['schemas']['SportSessionResponse']
export type GymExerciseInput = components['schemas']['GymExerciseInput']
export type MesoDayResponse = components['schemas']['MesoDay']
export type MesoDayInput = components['schemas']['MesoDayInput']
export type MesoTemplateResponse = components['schemas']['MesoTemplateResponse']
export type MesoTemplateUpsertRequest = components['schemas']['MesoTemplateUpsertRequest']
export type MesoTemplateStartRequest = components['schemas']['MesoTemplateStartRequest']
export type MesoRerunResponse = components['schemas']['MesoRerunResponse']
export type MusclePrioritiesUpdateRequest = components['schemas']['MusclePrioritiesUpdateRequest']
export type WorkoutTodayResponse = components['schemas']['WorkoutTodayResponse']
export type WorkoutInstanceResponse = components['schemas']['WorkoutInstanceResponse']
export type WorkoutStartRequest = components['schemas']['WorkoutStartRequest']
export type SetLogRequest = components['schemas']['SetLogRequest']
export type SetUpdateRequest = components['schemas']['SetUpdateRequest']
export type WorkoutSkipRequest = components['schemas']['WorkoutSkipRequest']
export type WorkoutNoteRequest = components['schemas']['WorkoutNoteRequest']
export type ExerciseSetResponse = components['schemas']['ExerciseSetResponse']
export type PrescribedSet = components['schemas']['PrescribedSet']
export type WorkoutFeedbackInput = components['schemas']['WorkoutFeedbackInput']
export type SportSessionCreateRequest = components['schemas']['SportSessionCreateRequest']
export type SportScheduleSlotInput = components['schemas']['SportScheduleSlotInput']
export type SportScheduleSlotResponse = components['schemas']['SportScheduleSlotResponse']
export type SportEventCreateRequest = components['schemas']['SportEventCreateRequest']
export type SportEventResponse = components['schemas']['SportEventResponse']
export type GymScheduleSlotInput = components['schemas']['GymScheduleSlotInput']
export type GymScheduleSlotResponse = components['schemas']['GymScheduleSlotResponse']
export type ExerciseCatalogItem = components['schemas']['ExerciseCatalogItem']
export type CatalogExerciseCreateRequest = components['schemas']['CatalogExerciseCreateRequest']
export type CatalogVideoRequest = components['schemas']['CatalogVideoRequest']
export type ExerciseRecordResponse = components['schemas']['ExerciseRecordResponse']
export type ExerciseNoteRequest = components['schemas']['ExerciseNoteRequest']
export type LevelUpResult = components['schemas']['LevelUpResult']
export type LevelUpGain = components['schemas']['LevelUpGain']
export type LevelUpPerk = components['schemas']['LevelUpPerk']
export type LevelUpRobustness = components['schemas']['LevelUpRobustness']
export type WorkoutSummaryResponse = components['schemas']['WorkoutSummaryResponse']
export type WorkoutDetailResponse = components['schemas']['WorkoutDetailResponse']
export type WorkoutDetailExercise = components['schemas']['WorkoutDetailExercise']
export type CustomWorkoutResponse = components['schemas']['CustomWorkoutResponse']
export type CustomWorkoutUpsertRequest = components['schemas']['CustomWorkoutUpsertRequest']
export type MesocycleVolumeArcResponse = components['schemas']['MesocycleVolumeArcResponse']
export type MesocycleCloseRequest = components['schemas']['MesocycleCloseRequest']
export type MesocycleReportResponse = components['schemas']['MesocycleReportResponse']
export type MesoStrengthDelta = components['schemas']['MesoStrengthDelta']
export type MesoRecordHighlight = components['schemas']['MesoRecordHighlight']
export type MesoContext = components['schemas']['MesoContext']
export type MesoContextWeek = components['schemas']['MesoContextWeek']
export type MesoContextTotals = components['schemas']['MesoContextTotals']

export const trainApi = {
  mesocycles: (): Promise<MesocycleResponse[]> => apiFetch<MesocycleResponse[]>('/api/train/mesocycles'),
  sportSessions: (): Promise<SportSessionResponse[]> => apiFetch<SportSessionResponse[]>('/api/train/sport-sessions'),
  rerunMesocycle: (id: string): Promise<MesoRerunResponse> =>
    apiFetch<MesoRerunResponse>(`/api/train/mesocycles/${id}/rerun`, { method: 'POST' }),
  mesoTemplates: (): Promise<MesoTemplateResponse[]> =>
    apiFetch<MesoTemplateResponse[]>('/api/train/meso-templates'),
  createMesoTemplate: (body: MesoTemplateUpsertRequest): Promise<MesoTemplateResponse> =>
    apiFetch<MesoTemplateResponse>('/api/train/meso-templates', { method: 'POST', body: JSON.stringify(body) }),
  updateMesoTemplate: (id: string, body: MesoTemplateUpsertRequest): Promise<MesoTemplateResponse> =>
    apiFetch<MesoTemplateResponse>(`/api/train/meso-templates/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteMesoTemplate: (id: string): Promise<void> =>
    apiFetch<void>(`/api/train/meso-templates/${id}`, { method: 'DELETE' }),
  startMesoTemplate: (id: string, body: MesoTemplateStartRequest): Promise<MesocycleResponse> =>
    apiFetch<MesocycleResponse>(`/api/train/meso-templates/${id}/start`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  activate: (id: string): Promise<MesocycleResponse> =>
    apiFetch<MesocycleResponse>(`/api/train/mesocycles/${id}/activate`, { method: 'POST' }),
  // Replaces the whole map (mezo-3m5m): empty/null normalizes to NULL server-side (all-Grow).
  // Returns the FULL assembled run (days/volumePerMuscle/hasReport included).
  updateMusclePriorities: (id: string, musclePriorities: MusclePriorities | null): Promise<MesocycleResponse> =>
    apiFetch<MesocycleResponse>(`/api/train/mesocycles/${id}/muscle-priorities`, {
      method: 'PUT',
      body: JSON.stringify({ musclePriorities } satisfies MusclePrioritiesUpdateRequest),
    }),
  // The close body is OPTIONAL by contract (mezo-meyc.2): only a non-blank self-eval note
  // travels, so a plain close stays a bodyless POST exactly as before.
  close: (id: string, body?: MesocycleCloseRequest): Promise<MesocycleResponse> =>
    apiFetch<MesocycleResponse>(`/api/train/mesocycles/${id}/close`, {
      method: 'POST',
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
  getMesoReport: (id: string): Promise<MesocycleReportResponse> =>
    apiFetch<MesocycleReportResponse>(`/api/train/mesocycles/${id}/report`),
  // 202 Accepted, no body — the report is (re)written server-side; the caller refetches.
  regenerateMesoReport: (id: string): Promise<void> =>
    apiFetch<void>(`/api/train/mesocycles/${id}/report/regenerate`, { method: 'POST' }),
  replaceDayExercises: (mesoId: string, dayId: string, body: GymExerciseInput[]): Promise<MesoDayResponse> =>
    apiFetch<MesoDayResponse>(`/api/train/mesocycles/${mesoId}/days/${dayId}/exercises`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  // Day resolution is server-side: open instance > templateSessionId param > today's
  // weekday label (cross-day start, mezo-p7rp).
  workoutToday: (templateSessionId?: string): Promise<WorkoutTodayResponse> =>
    apiFetch<WorkoutTodayResponse>(
      templateSessionId
        ? `/api/train/workouts/today?templateSessionId=${templateSessionId}`
        : '/api/train/workouts/today',
    ),
  listWorkouts: (from: string, to: string): Promise<WorkoutSummaryResponse[]> =>
    apiFetch<WorkoutSummaryResponse[]>(`/api/train/workouts?from=${from}&to=${to}`),
  getWorkout: (id: string): Promise<WorkoutDetailResponse> =>
    apiFetch<WorkoutDetailResponse>(`/api/train/workouts/${id}`),
  mesocycleVolumeArc: (id: string): Promise<MesocycleVolumeArcResponse> =>
    apiFetch<MesocycleVolumeArcResponse>(`/api/train/mesocycles/${id}/volume-arc`),
  startWorkout: (templateSessionId: string): Promise<WorkoutInstanceResponse> =>
    apiFetch<WorkoutInstanceResponse>('/api/train/workouts', {
      method: 'POST',
      body: JSON.stringify({ templateSessionId } satisfies WorkoutStartRequest),
    }),
  logSet: (workoutId: string, body: SetLogRequest): Promise<ExerciseSetResponse> =>
    apiFetch<ExerciseSetResponse>(`/api/train/workouts/${workoutId}/sets`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateSet: (workoutId: string, setId: string, body: SetUpdateRequest): Promise<ExerciseSetResponse> =>
    apiFetch<ExerciseSetResponse>(`/api/train/workouts/${workoutId}/sets/${setId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  deleteSet: (workoutId: string, setId: string): Promise<void> =>
    apiFetch<void>(`/api/train/workouts/${workoutId}/sets/${setId}`, { method: 'DELETE' }),
  skip: (workoutId: string, exerciseId: string): Promise<void> =>
    apiFetch<void>(`/api/train/workouts/${workoutId}/skip`, {
      method: 'POST',
      body: JSON.stringify({ exerciseId } satisfies WorkoutSkipRequest),
    }),
  saveWorkoutFeedback: (workoutId: string, body: WorkoutFeedbackInput[]): Promise<void> =>
    apiFetch<void>(`/api/train/workouts/${workoutId}/feedback`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  /** The optional body carries the closing note (mezo-d20.8.2.2); fill-if-empty server-side. */
  finishWorkout: (workoutId: string, note?: string | null): Promise<WorkoutInstanceResponse> =>
    apiFetch<WorkoutInstanceResponse>(`/api/train/workouts/${workoutId}/finish`, {
      method: 'POST',
      ...(note ? { body: JSON.stringify({ note } satisfies WorkoutNoteRequest) } : null),
    }),
  /** Overwrite or clear the workout's closing note — the review page's write path. */
  saveWorkoutNote: (workoutId: string, note: string | null): Promise<void> =>
    apiFetch<void>(`/api/train/workouts/${workoutId}/note`, {
      method: 'PUT',
      body: JSON.stringify({ note } satisfies WorkoutNoteRequest),
    }),
  logSportSession: (body: SportSessionCreateRequest): Promise<SportSessionResponse> =>
    apiFetch<SportSessionResponse>('/api/train/sport-sessions', { method: 'POST', body: JSON.stringify(body) }),
  sportSchedule: (): Promise<SportScheduleSlotResponse[]> =>
    apiFetch<SportScheduleSlotResponse[]>('/api/train/sport-schedule'),
  replaceSportSchedule: (body: SportScheduleSlotInput[]): Promise<SportScheduleSlotResponse[]> =>
    apiFetch<SportScheduleSlotResponse[]>('/api/train/sport-schedule', { method: 'PUT', body: JSON.stringify(body) }),
  sportEvents: (from?: string, to?: string): Promise<SportEventResponse[]> =>
    apiFetch<SportEventResponse[]>(
      from && to ? `/api/train/sport-events?from=${from}&to=${to}` : '/api/train/sport-events',
    ),
  createSportEvent: (body: SportEventCreateRequest): Promise<SportEventResponse> =>
    apiFetch<SportEventResponse>('/api/train/sport-events', { method: 'POST', body: JSON.stringify(body) }),
  deleteSportEvent: (id: string): Promise<void> =>
    apiFetch<void>(`/api/train/sport-events/${id}`, { method: 'DELETE' }),
  gymSchedule: (): Promise<GymScheduleSlotResponse[]> =>
    apiFetch<GymScheduleSlotResponse[]>('/api/train/gym-schedule'),
  replaceGymSchedule: (body: GymScheduleSlotInput[]): Promise<GymScheduleSlotResponse[]> =>
    apiFetch<GymScheduleSlotResponse[]>('/api/train/gym-schedule', { method: 'PUT', body: JSON.stringify(body) }),
  exerciseCatalog: (): Promise<ExerciseCatalogItem[]> =>
    apiFetch<ExerciseCatalogItem[]>('/api/train/exercises'),
  createExercise: (body: CatalogExerciseCreateRequest): Promise<ExerciseCatalogItem> =>
    apiFetch<ExerciseCatalogItem>('/api/train/exercises', { method: 'POST', body: JSON.stringify(body) }),
  updateExercise: (id: string, body: CatalogExerciseCreateRequest): Promise<ExerciseCatalogItem> =>
    apiFetch<ExerciseCatalogItem>(`/api/train/exercises/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteExercise: (id: string): Promise<void> =>
    apiFetch<void>(`/api/train/exercises/${id}`, { method: 'DELETE' }),
  setExerciseVideo: (id: string, videoUrl: string | null): Promise<ExerciseCatalogItem> =>
    apiFetch<ExerciseCatalogItem>(`/api/train/exercises/${id}/video`, {
      method: 'PUT', body: JSON.stringify({ videoUrl } satisfies CatalogVideoRequest),
    }),
  exerciseRecords: (): Promise<ExerciseRecordResponse[]> =>
    apiFetch<ExerciseRecordResponse[]>('/api/train/exercise-records'),
  saveExerciseNote: (exerciseId: string, note: string): Promise<void> =>
    apiFetch<void>(`/api/train/exercises/${exerciseId}/note`, {
      method: 'PUT',
      body: JSON.stringify({ note } satisfies ExerciseNoteRequest),
    }),
  customWorkouts: (): Promise<CustomWorkoutResponse[]> =>
    apiFetch<CustomWorkoutResponse[]>('/api/train/custom-workouts'),
  createCustomWorkout: (body: CustomWorkoutUpsertRequest): Promise<CustomWorkoutResponse> =>
    apiFetch<CustomWorkoutResponse>('/api/train/custom-workouts', { method: 'POST', body: JSON.stringify(body) }),
  updateCustomWorkout: (id: string, body: CustomWorkoutUpsertRequest): Promise<CustomWorkoutResponse> =>
    apiFetch<CustomWorkoutResponse>(`/api/train/custom-workouts/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteCustomWorkout: (id: string): Promise<void> =>
    apiFetch<void>(`/api/train/custom-workouts/${id}`, { method: 'DELETE' }),
}
