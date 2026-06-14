import { apiFetch } from './api'
import type { components } from './api.gen'

// Contract types generated from api/openapi.yml — regenerate with `pnpm generate:api`.
export type RunningBlockResponse = components['schemas']['RunningBlockResponse']
export type RunningBlockUpsertRequest = components['schemas']['RunningBlockUpsertRequest']
export type RunningBlockStructureDto = components['schemas']['RunningBlockStructureDto']
export type RunWeek = components['schemas']['RunWeek']
export type RunPrescribedSession = components['schemas']['RunPrescribedSession']
export type RunSegment = components['schemas']['RunSegment']
export type RpeTarget = components['schemas']['RpeTarget']
export type RunSessionLogResponse = components['schemas']['RunSessionLogResponse']
export type RunSessionLogRequest = components['schemas']['RunSessionLogRequest']

export const runningApi = {
  blocks: (): Promise<RunningBlockResponse[]> =>
    apiFetch<RunningBlockResponse[]>('/api/train/running-blocks'),
  runSessions: (): Promise<RunSessionLogResponse[]> =>
    apiFetch<RunSessionLogResponse[]>('/api/train/run-sessions'),
  create: (body: RunningBlockUpsertRequest): Promise<RunningBlockResponse> =>
    apiFetch<RunningBlockResponse>('/api/train/running-blocks', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: RunningBlockUpsertRequest): Promise<RunningBlockResponse> =>
    apiFetch<RunningBlockResponse>(`/api/train/running-blocks/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  activate: (id: string): Promise<RunningBlockResponse> =>
    apiFetch<RunningBlockResponse>(`/api/train/running-blocks/${id}/activate`, { method: 'POST' }),
  close: (id: string): Promise<RunningBlockResponse> =>
    apiFetch<RunningBlockResponse>(`/api/train/running-blocks/${id}/close`, { method: 'POST' }),
  remove: (id: string): Promise<void> =>
    apiFetch<void>(`/api/train/running-blocks/${id}`, { method: 'DELETE' }),
  logRunSession: (body: RunSessionLogRequest): Promise<RunSessionLogResponse> =>
    apiFetch<RunSessionLogResponse>('/api/train/run-sessions', { method: 'POST', body: JSON.stringify(body) }),
}
