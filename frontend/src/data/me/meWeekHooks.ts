// Weekly review (mezo-p2tr) — dual-mode read of the 7-day `/api/me/week/{start}` rollup.
// MOCK: the deterministic demo week (`meWeek.ts`), re-dated to whatever Monday is requested so
//   the mock page can browse weeks. REAL: fetches the backend week; while unresolved returns
//   `week: null` — NEVER the mock seed (the "no static fallback in real mode" invariant, see
//   docs/features/_platform-data-layer.md and `src/data/dualMode.guard.test.ts`).
import { useDualQuery } from '@/data/useDualQuery'
import { meWeekApi } from '@/data/me/meWeekApi'
import { mockMeWeek, type MeWeek, type MeWeekDay } from '@/data/me/meWeek'

export type { MeWeek, MeWeekDay }

/** The week PAYLOAD — what the query resolves to. Deliberately free of query state:
 *  it is also the shape of `REAL_EMPTY`, so anything added here has to be inventable
 *  for a week that does not exist. */
export interface MeWeekBootstrap {
  week: MeWeek | null
  mode: 'mock' | 'live'
}

/** ADDITIVE (mezo-d20.6.10): the query's own liveness, so a screen can tell "still loading"
 *  and "the fetch FAILED" apart from the honest "resolved, and the week is empty" — without
 *  these three, `realEmpty` reads identically for all three cases and a failed fetch shows as
 *  a silently blank week. Same additive treatment `useLlmCall`/`useDecisions` already carry.
 *  Existing `const { week } = useMeWeek(...)` callers are untouched — the bootstrap fields
 *  keep their names and meanings. Mock mode never pends (`initialData`) and never rejects,
 *  so both flags are always false there. */
export interface MeWeekQuery extends MeWeekBootstrap {
  /** The real-mode fetch has not resolved yet — the Heti surfaces render a skeleton, not an
   *  empty week. A cold load used to look like "no data", which is a lie. */
  isPending: boolean
  /** The fetch FAILED — a retryable error state, which is not the same as "nothing logged". */
  isError: boolean
  refetch: () => void
}

const REAL_EMPTY: MeWeekBootstrap = { week: null, mode: 'live' }

/** `startIso` — ISO Monday of the week to load. */
export function useMeWeek(startIso: string): MeWeekQuery {
  const { data, isPending, isError, refetch } = useDualQuery<MeWeekBootstrap>({
    queryKey: ['meWeek', startIso],
    mockData: { week: mockMeWeek(startIso), mode: 'mock' },
    realFetch: async () => ({ week: await meWeekApi.get(startIso), mode: 'live' }),
    realEmpty: REAL_EMPTY,
  })
  return { ...data, isPending, isError, refetch }
}
