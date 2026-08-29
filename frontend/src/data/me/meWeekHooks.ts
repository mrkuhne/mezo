// Weekly review (mezo-p2tr) — dual-mode read of the 7-day `/api/me/week/{start}` rollup.
// MOCK: the deterministic demo week (`meWeek.ts`), re-dated to whatever Monday is requested so
//   the mock page can browse weeks. REAL: fetches the backend week; while unresolved returns
//   `week: null` — NEVER the mock seed (the "no static fallback in real mode" invariant, see
//   docs/features/_platform-data-layer.md and `src/data/dualMode.guard.test.ts`).
import { useDualQuery } from '@/data/useDualQuery'
import { meWeekApi } from '@/data/me/meWeekApi'
import { mockMeWeek, type MeWeek, type MeWeekDay } from '@/data/me/meWeek'

export type { MeWeek, MeWeekDay }

export interface MeWeekBootstrap {
  week: MeWeek | null
  mode: 'mock' | 'live'
  /** The real-mode fetch has not resolved yet — the Heti surfaces render a skeleton, not an
   *  empty week (mezo-d20.6.10; the hook used to throw this away, so a cold load looked like
   *  "no data" — a lie). Always false in mock mode, where the seed is synchronous. */
  isPending: boolean
  /** The fetch FAILED — a retryable error state, which is not the same as "nothing logged". */
  isError: boolean
  retry: () => void
}

const REAL_EMPTY = { week: null, mode: 'live' } as const

/** `startIso` — ISO Monday of the week to load. */
export function useMeWeek(startIso: string): MeWeekBootstrap {
  const { data, isPending, isError, refetch } = useDualQuery<{ week: MeWeek | null; mode: 'mock' | 'live' }>({
    queryKey: ['meWeek', startIso],
    mockData: { week: mockMeWeek(startIso), mode: 'mock' },
    realFetch: async () => ({ week: await meWeekApi.get(startIso), mode: 'live' }),
    realEmpty: REAL_EMPTY,
  })
  return { ...data, isPending, isError, retry: refetch }
}
