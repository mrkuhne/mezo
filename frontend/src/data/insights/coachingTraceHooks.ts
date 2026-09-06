import { coachingTraceApi } from '@/data/insights/coachingTraceApi'
import { mockCoachingDay } from '@/data/insights/coachingTraceMock'
import { useDualQuery, DEFAULT_QUERY_STALE_TIME_MS } from '@/data/useDualQuery'
import { localDateString } from '@/shared/lib/dates'
import type { CoachingTraceDay } from '@/data/types'

/**
 * One day of the coaching engine's decision (mezo-6269.2). `useDualQuery` because the honest-state
 * rule bites hard here: a half-loaded observer that shows 13 fabricated "Rendben" tiles would be
 * the worst possible version of a transparency surface. Real mode returns an EMPTY day while
 * unresolved — never the mock seed — and `isError` lets the page render a real error instead of a
 * misleadingly calm one.
 */
export function useCoachingTrace(date: string = localDateString()): {
  day: CoachingTraceDay
  isPending: boolean
  isError: boolean
} {
  const { data, isPending, isError } = useDualQuery<CoachingTraceDay>({
    queryKey: ['coachingTrace', date],
    mockData: mockCoachingDay(date),
    realFetch: () => coachingTraceApi.get(date),
    realEmpty: { date, rules: [], transitions: [] },
    realStaleTime: DEFAULT_QUERY_STALE_TIME_MS,
  })
  return { day: data, isPending, isError }
}
