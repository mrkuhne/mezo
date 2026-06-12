import { apiFetch } from './api'
import type { components } from './api.gen'

// Contract types generated from api/openapi.yml — regenerate with `pnpm generate:api`.
export type MesocycleResponse = components['schemas']['MesocycleResponse']
export type SportSessionResponse = components['schemas']['SportSessionResponse']
export type MesocycleCreateRequest = components['schemas']['MesocycleCreateRequest']
export type GymExerciseInput = components['schemas']['GymExerciseInput']
export type MesoDayResponse = components['schemas']['MesoDay']
export type WorkoutTodayResponse = components['schemas']['WorkoutTodayResponse']
export type WorkoutInstanceResponse = components['schemas']['WorkoutInstanceResponse']
export type WorkoutStartRequest = components['schemas']['WorkoutStartRequest']
export type SetLogRequest = components['schemas']['SetLogRequest']
export type ExerciseSetResponse = components['schemas']['ExerciseSetResponse']
export type WorkoutFeedbackInput = components['schemas']['WorkoutFeedbackInput']

export const trainApi = {
  mesocycles: (): Promise<MesocycleResponse[]> => apiFetch<MesocycleResponse[]>('/api/train/mesocycles'),
  sportSessions: (): Promise<SportSessionResponse[]> => apiFetch<SportSessionResponse[]>('/api/train/sport-sessions'),
  create: (body: MesocycleCreateRequest): Promise<MesocycleResponse> =>
    apiFetch<MesocycleResponse>('/api/train/mesocycles', { method: 'POST', body: JSON.stringify(body) }),
  activate: (id: string): Promise<MesocycleResponse> =>
    apiFetch<MesocycleResponse>(`/api/train/mesocycles/${id}/activate`, { method: 'POST' }),
  close: (id: string): Promise<MesocycleResponse> =>
    apiFetch<MesocycleResponse>(`/api/train/mesocycles/${id}/close`, { method: 'POST' }),
  replaceDayExercises: (mesoId: string, dayId: string, body: GymExerciseInput[]): Promise<MesoDayResponse> =>
    apiFetch<MesoDayResponse>(`/api/train/mesocycles/${mesoId}/days/${dayId}/exercises`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  workoutToday: (): Promise<WorkoutTodayResponse> =>
    apiFetch<WorkoutTodayResponse>('/api/train/workouts/today'),
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
  saveWorkoutFeedback: (workoutId: string, body: WorkoutFeedbackInput[]): Promise<void> =>
    apiFetch<void>(`/api/train/workouts/${workoutId}/feedback`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  finishWorkout: (workoutId: string): Promise<WorkoutInstanceResponse> =>
    apiFetch<WorkoutInstanceResponse>(`/api/train/workouts/${workoutId}/finish`, { method: 'POST' }),
}
