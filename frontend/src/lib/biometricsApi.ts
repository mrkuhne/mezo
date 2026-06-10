import { apiFetch } from './api'
import type { WeightEntry, WeightLogInput, SleepEntry, SleepLogInput } from '@/data/types'

export const weightApi = {
  list: () => apiFetch<WeightEntry[]>('/api/biometrics/weight'),
  log: (input: WeightLogInput) =>
    apiFetch<WeightEntry>('/api/biometrics/weight', {
      method: 'POST',
      body: JSON.stringify({ date: input.date, weightKg: input.weightKg, note: input.note }),
    }),
}

export const sleepApi = {
  list: () => apiFetch<SleepEntry[]>('/api/biometrics/sleep'),
  log: (input: SleepLogInput) =>
    apiFetch<SleepEntry>('/api/biometrics/sleep', {
      method: 'POST',
      body: JSON.stringify({
        date: input.date, bedtime: input.bedtime, wakeup: input.wakeup,
        durationH: input.durationH, quality: input.quality,
        awakenings: input.awakenings, note: input.note,
      }),
    }),
}

export interface SaveCheckInBody {
  date: string; slotTime: string; state: string
  energy?: number; stress?: number; body?: number; mental?: number; note?: string
}
export const checkinApi = {
  listForDay: (date: string) => apiFetch<unknown[]>(`/api/biometrics/checkin?date=${date}`),
  save: (body: SaveCheckInBody) => apiFetch<unknown>('/api/biometrics/checkin', { method: 'POST', body: JSON.stringify(body) }),
}
