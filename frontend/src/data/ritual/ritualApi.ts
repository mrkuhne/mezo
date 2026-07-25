import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'
import type { RitualDay } from '@/data/types'

type Wire = components['schemas']['RitualDayResponse']

const toDay = (w: Wire): RitualDay => ({
  date: w.date,
  closed: w.closed,
  closedAt: w.closedAt ?? null,
  window: { opensAt: w.window.opensAt, prepStartsAt: w.window.prepStartsAt, bedTime: w.window.bedTime },
})

export const ritualApi = {
  day: async (date: string) => toDay(await apiFetch<Wire>(`/api/ritual/day/${date}`)),
  close: async (date: string) =>
    toDay(await apiFetch<Wire>('/api/ritual/close', { method: 'POST', body: JSON.stringify({ date }) })),
}
