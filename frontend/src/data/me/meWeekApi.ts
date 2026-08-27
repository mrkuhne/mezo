import { apiFetch } from '@/data/_client/api'
import type { MeWeek } from '@/data/me/meWeek'

export const meWeekApi = {
  /** `startIso` must be an ISO Monday — the backend 400s otherwise (`GET /api/me/week/{start}`). */
  get: (startIso: string) => apiFetch<MeWeek>(`/api/me/week/${startIso}`),
}
