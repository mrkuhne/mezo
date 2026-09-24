// A napom S3 (spec 2026-09-24 §4): today is LIVE. Any successful write can move a day input
// (a meal, a set, a check-in, a sleep or weight log, a habit tick), so instead of wiring each
// logging mutation by hand, the global MutationCache calls this once per success. Invalidation
// only refetches ACTIVE queries; an unmounted day page just goes stale — cheap by construction.
import type { QueryClient } from '@tanstack/react-query'
import { localDateString, mondayOf } from '@/shared/lib/dates'

export async function invalidateTodayDay(client: QueryClient, now: Date = new Date()): Promise<void> {
  const today = localDateString(now)
  await Promise.all([
    client.invalidateQueries({ queryKey: ['dayEvaluation', today], exact: true }),
    client.invalidateQueries({ queryKey: ['meWeek', mondayOf(today)], exact: true }),
  ])
}
