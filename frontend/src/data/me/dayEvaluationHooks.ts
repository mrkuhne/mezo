// Day evaluation (mezo-jcpt.4) — dual-mode read of the day page's
// `GET /api/me/day/{date}/evaluation`. MOCK: one of the four named fixtures from
// `dayEvaluation.ts`, re-dated to whatever date is requested (`meWeekHooks.ts`'s
// `VITE_USE_MOCK` idiom). REAL: fetches the backend; `data` stays `undefined` while the
// fetch is unresolved — never a fabricated fallback (the same "no static seed in real mode"
// invariant `useDualQuery` enforces elsewhere, applied directly here since the contract this
// task hands to Task 10 is an OPTIONAL `data`, not a `realEmpty`-backed non-null value).
//
// RESOLVED (mezo-jcpt.10) — this hook deliberately does NOT call `useDualQuery` (see
// `useDualQuery.ts`), unlike every sibling `me/*` hook, and that is the considered outcome,
// not an oversight: `useDualQuery` requires a non-optional `realEmpty: T` so `data` is always
// non-null, and `DayEvaluationResponse` has no natural "empty" shape to synthesize for that —
// inventing one would itself be a fabricated value, the exact thing `useDualQuery` exists to
// forbid. Forcing this hook through `useDualQuery` was rejected FOR that reason, not chosen
// against for being more typing. The "no fabricated fallback in real mode" guarantee is
// instead upheld BY HAND here, via `initialData: mock ? seed : undefined` below — real mode
// passes no `initialData`, so `q.data` genuinely stays `undefined` until the fetch resolves.
// This is no longer merely tolerated by coincidence: `dualMode.guard.test.ts`'s second guard
// ("manual useDualQuery (initialData) seed-leak guard") parses every `useQuery` call's
// `initialData` argument and fails the build if it is not `undefined` or a `<mock-flag> ? seed
// : undefined` ternary that degrades to `undefined` — the same invariant `useDualQuery` bakes
// in, enforced here by hand and checked deliberately, not inherited by accident.
import { useQuery } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { DEFAULT_QUERY_STALE_TIME_MS } from '@/data/useDualQuery'
import { dayEvaluationApi } from '@/data/me/dayEvaluationApi'
import { mockDayEvaluation, type DayEvaluationResponse } from '@/data/me/dayEvaluation'

export type { DayEvaluationResponse }

export interface DayEvaluationQuery {
  data: DayEvaluationResponse | undefined
  isPending: boolean
  error: Error | null
  refetch: () => void
}

/** `dateIso` — the day to evaluate. */
export function useDayEvaluation(dateIso: string): DayEvaluationQuery {
  const mock = isMockMode()
  const q = useQuery({
    queryKey: ['dayEvaluation', dateIso],
    queryFn: mock ? async () => mockDayEvaluation(dateIso) : () => dayEvaluationApi.get(dateIso),
    initialData: mock ? mockDayEvaluation(dateIso) : undefined,
    staleTime: mock ? Infinity : DEFAULT_QUERY_STALE_TIME_MS,
  })
  return {
    data: q.data,
    isPending: q.isPending,
    error: q.error,
    refetch: () => { void q.refetch() },
  }
}
