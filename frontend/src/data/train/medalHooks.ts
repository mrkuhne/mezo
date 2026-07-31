import { medalApi } from '@/data/train/medalApi'
import { medalsMock } from '@/data/train/medalMock'
import type { Medal } from '@/data/train/medalTypes'
import { useDualQuery } from '@/data/useDualQuery'

/**
 * The medal cabinet read (`GET /api/train/medals`). Dual-mode per frontend_conventions.md
 * §4: mock mode serves the seeded `medalsMock` synchronously; real mode fetches and never
 * falls back to the seed while loading.
 */
export function useMedals(): { data: Medal[]; isPending: boolean } {
  return useDualQuery<Medal[]>({
    queryKey: ['train', 'medals'],
    mockData: medalsMock,
    realFetch: () => medalApi.list(),
    realEmpty: [],
  })
}
