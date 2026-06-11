import { apiFetch } from './api'
import type { components } from './api.gen'

// Contract types generated from api/openapi.yml — regenerate with `pnpm generate:api`.
export type MesocycleResponse = components['schemas']['MesocycleResponse']
export type SportSessionResponse = components['schemas']['SportSessionResponse']

export const trainApi = {
  mesocycles: (): Promise<MesocycleResponse[]> => apiFetch<MesocycleResponse[]>('/api/train/mesocycles'),
  sportSessions: (): Promise<SportSessionResponse[]> => apiFetch<SportSessionResponse[]>('/api/train/sport-sessions'),
}
