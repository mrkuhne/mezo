import { apiFetch } from './api'
import type { WeightEntry, WeightLogInput } from '@/data/types'

export const weightApi = {
  list: () => apiFetch<WeightEntry[]>('/api/biometrics/weight'),
  log: (input: WeightLogInput) =>
    apiFetch<WeightEntry>('/api/biometrics/weight', {
      method: 'POST',
      body: JSON.stringify({ date: input.date, weightKg: input.weightKg, note: input.note }),
    }),
}
