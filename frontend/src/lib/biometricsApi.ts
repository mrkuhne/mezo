import { apiFetch } from './api'
import type { components } from './api.gen'
import type { WeightEntry, WeightLogInput, SleepEntry, SleepLogInput } from '@/data/types'

// Contract types generated from api/openapi.yml — regenerate with `pnpm generate:api`.
type WeightLogResponse = components['schemas']['WeightLogResponse']
type LogWeightRequest = components['schemas']['LogWeightRequest']
type SleepLogResponse = components['schemas']['SleepLogResponse']
type LogSleepRequest = components['schemas']['LogSleepRequest']
export type CheckInResponse = components['schemas']['CheckInResponse']
export type SaveCheckInBody = components['schemas']['SaveCheckInRequest']
export type WeightTrendResponse = components['schemas']['WeightTrendResponse']

export const weightApi = {
  // WeightLogResponse is structurally assignable to the domain WeightEntry — checked by tsc.
  list: (): Promise<WeightEntry[]> => apiFetch<WeightLogResponse[]>('/api/biometrics/weight'),
  log: (input: WeightLogInput): Promise<WeightEntry> =>
    apiFetch<WeightLogResponse>('/api/biometrics/weight', {
      method: 'POST',
      body: JSON.stringify({
        date: input.date, weightKg: input.weightKg, note: input.note,
      } satisfies LogWeightRequest),
    }),
  // G5 real EWMA trend (mezo-g1u). The backend computes the weekly rates from the
  // weight-log spine; useWeight folds these real numbers into the WeightTrends shape.
  trend: (): Promise<WeightTrendResponse> =>
    apiFetch<WeightTrendResponse>('/api/biometrics/weight/trend'),
}

export const sleepApi = {
  // The domain SleepEntry claims bedtime/duration/... are always present, but the contract
  // (and the DB) allows them to be null — explicit cast until normalized (see mezo bd issue).
  list: (): Promise<SleepEntry[]> =>
    apiFetch<SleepLogResponse[]>('/api/biometrics/sleep') as Promise<SleepEntry[]>,
  log: (input: SleepLogInput): Promise<SleepEntry> =>
    apiFetch<SleepLogResponse>('/api/biometrics/sleep', {
      method: 'POST',
      body: JSON.stringify({
        date: input.date, bedtime: input.bedtime, wakeup: input.wakeup,
        durationH: input.durationH, quality: input.quality,
        awakenings: input.awakenings, note: input.note,
      } satisfies LogSleepRequest),
    }) as Promise<SleepEntry>,
}

export const checkinApi = {
  listForDay: (date: string) => apiFetch<CheckInResponse[]>(`/api/biometrics/checkin?date=${date}`),
  save: (body: SaveCheckInBody) =>
    apiFetch<CheckInResponse>('/api/biometrics/checkin', { method: 'POST', body: JSON.stringify(body) }),
}
