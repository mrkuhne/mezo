import { apiFetch } from './api'
import type { components } from './api.gen'

// Contract types generated from api/openapi.yml — regenerate with `pnpm generate:api`.
export type MesocycleResponse = components['schemas']['MesocycleResponse']
export type SportSessionResponse = components['schemas']['SportSessionResponse']
export type MesocycleCreateRequest = components['schemas']['MesocycleCreateRequest']
export type GymExerciseInput = components['schemas']['GymExerciseInput']
export type MesoDayResponse = components['schemas']['MesoDay']

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
}
