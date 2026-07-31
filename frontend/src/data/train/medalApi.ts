import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'
import type { Medal } from '@/data/train/medalTypes'

export type MedalListResponse = components['schemas']['MedalListResponse']

export const medalApi = {
  list: (): Promise<Medal[]> =>
    apiFetch<MedalListResponse>('/api/train/medals').then((r) => r.medals ?? []),
}
