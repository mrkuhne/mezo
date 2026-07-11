import { apiFetch } from '@/data/_client/api'
import type { paths } from '@/data/_client/api.gen'
import type { WeeklyGrowth } from '@/data/types'

type GrowthWeekWire =
  paths['/api/progression/growth-week/{date}']['get']['responses']['200']['content']['application/json']

export const growthWeekApi = {
  /** The Monday-keyed weekly growth aggregate for the week containing the FE's local day. */
  get: (date: string): Promise<WeeklyGrowth> =>
    apiFetch<GrowthWeekWire>(`/api/progression/growth-week/${date}`).then((w) => ({ ...w })),
}
