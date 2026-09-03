// Day evaluation (mezo-jcpt.4) — dual-mode read of the day page's
// `GET /api/me/day/{date}/evaluation`. MOCK: one of the four named fixtures from
// `dayEvaluation.ts`, re-dated to whatever date is requested (`meWeekHooks.ts`'s
// `VITE_USE_MOCK` idiom). REAL: fetches the backend; `data` stays `undefined` while the
// fetch is unresolved — never a fabricated fallback (the same "no static seed in real mode"
// invariant `useDualQuery` enforces elsewhere, applied directly here since the contract this
// task hands to Task 10 is an OPTIONAL `data`, not a `realEmpty`-backed non-null value).
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
