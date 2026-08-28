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
}

const REAL_EMPTY: MeWeekBootstrap = { week: null, mode: 'live' }

/** `startIso` — ISO Monday of the week to load. */
export function useMeWeek(startIso: string): MeWeekBootstrap {
  const { data } = useDualQuery<MeWeekBootstrap>({
    queryKey: ['meWeek', startIso],
    mockData: { week: mockMeWeek(startIso), mode: 'mock' },
    realFetch: async () => ({ week: await meWeekApi.get(startIso), mode: 'live' }),
    realEmpty: REAL_EMPTY,
  })
  return data
}
