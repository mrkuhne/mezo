import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'

// Contract types generated from api/openapi.yml — regenerate with `pnpm generate:api`.
export type RecoveryState = components['schemas']['RecoveryState']
export type RecoveryPeriod = components['schemas']['RecoveryPeriod']
export type RecoveryReturn = components['schemas']['RecoveryReturn']
export type RecoveryComeback = components['schemas']['RecoveryComeback']
export type RecoveryEstimateResponse = components['schemas']['RecoveryEstimate']
export type RecoveryReturnRule = components['schemas']['RecoveryReturnRule']
export type RecoveryUpsertRequest = components['schemas']['RecoveryUpsertRequest']
export type RecoveryCheckInRequest = components['schemas']['RecoveryCheckInRequest']
export type RecoveryCheckInAnswer = RecoveryCheckInRequest['answer']
export type RecoveryReleaseRequest = components['schemas']['RecoveryReleaseRequest']
export type TodayComeback = components['schemas']['TodayComeback']

const PATH = '/api/train/recovery'

/**
 * Kímélő mód (Kihagyás S2, mezo-q4xt2.2) — a multi-day recovery period for a serious reason.
 * GET reads the state (the open or today-ended period, protected dates in [today−7, today+13],
 * the comeback ramp); every write answers with the fresh state, except DELETE ("Tévedés volt",
 * 204).
 */
export const recoveryApi = {
  get: (): Promise<RecoveryState> => apiFetch<RecoveryState>(PATH),
  upsert: (req: RecoveryUpsertRequest): Promise<RecoveryState> =>
    apiFetch<RecoveryState>(PATH, { method: 'PUT', body: JSON.stringify(req satisfies RecoveryUpsertRequest) }),
  discard: (): Promise<void> => apiFetch<void>(PATH, { method: 'DELETE' }),
  checkIn: (answer: RecoveryCheckInAnswer): Promise<RecoveryState> =>
    apiFetch<RecoveryState>(`${PATH}/check-in`, {
      method: 'POST',
      body: JSON.stringify({ answer } satisfies RecoveryCheckInRequest),
    }),
  undoBetter: (): Promise<RecoveryState> => apiFetch<RecoveryState>(`${PATH}/undo-better`, { method: 'POST' }),
  release: (date: string, lighten: boolean): Promise<RecoveryState> =>
    apiFetch<RecoveryState>(`${PATH}/releases/${date}`, {
      method: 'PUT',
      body: JSON.stringify({ lighten } satisfies RecoveryReleaseRequest),
    }),
  unrelease: (date: string): Promise<RecoveryState> =>
    apiFetch<RecoveryState>(`${PATH}/releases/${date}`, { method: 'DELETE' }),
  waiveComeback: (): Promise<RecoveryState> =>
    apiFetch<RecoveryState>(`${PATH}/waive-comeback`, { method: 'POST' }),
}
