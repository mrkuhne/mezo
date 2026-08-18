// ============================================================
// Mezo · needsHooks — the needs-summary read + the mock napzárás award (mezo-dhzk, Task 9).
// `applyMockNeedsClose` lives HERE (beside NEEDS_SUMMARY_KEY) rather than in `ritualHooks.ts`
// so it can be unit-tested directly and reused from the ritual mock arm. Per the frontend
// conventions, `data/` must never import from `features/`, so the three award numbers below
// are duplicated local constants rather than an import of NEEDS_TUNING.bands.green —
// see the comment on GREEN/PER_RING_XP/ALL_GREEN_BONUS.
// Spec: .superpowers/sdd/2026-08-17-needs-rings/task-9-brief.md
// ============================================================
import type { QueryClient } from '@tanstack/react-query'
import { awardGamificationEvent } from '@/data/gamification/gamificationStore'
import { needsApi, type NeedsRingsWire, type NeedsSummary } from '@/data/needs/needsApi'
import { useDualQuery } from '@/data/useDualQuery'

export const NEEDS_SUMMARY_KEY = ['needsSummary'] as const

const EMPTY_SUMMARY: NeedsSummary = { streakDays: 0 }

export function useNeedsSummary(): { data: NeedsSummary; isPending: boolean } {
  return useDualQuery<NeedsSummary>({
    queryKey: NEEDS_SUMMARY_KEY,
    mockData: EMPTY_SUMMARY,
    realFetch: needsApi.summary,
    realEmpty: EMPTY_SUMMARY,
  })
}

// mirrors mezo.needs.* (application.yml) + NEEDS_TUNING.bands.green — keep in sync
const GREEN = 60
const PER_RING_XP = 5
const ALL_GREEN_BONUS = 30

/**
 * Mock mirror of the backend's day-close award (POST /api/needs/day-close): counts rings
 * ≥ GREEN, awards PER_RING_XP each + ALL_GREEN_BONUS when every ring is green, and rolls the
 * streak (mock has no "yesterday row" to check, so it simply +1s on an all-green close, resets
 * to 0 otherwise). Idempotency guard mirrors the ritual's own — a second close on the same date
 * (e.g. a re-close) must never double-award.
 */
export function applyMockNeedsClose(qc: QueryClient, date: string, rings: NeedsRingsWire): void {
  const prev = qc.getQueryData<NeedsSummary>(NEEDS_SUMMARY_KEY) ?? EMPTY_SUMMARY
  if (prev.lastCloseDate === date) return // idempotent: no double award on ritual re-close

  const values = Object.values(rings)
  const greenCount = values.filter((v) => v >= GREEN).length
  const allGreen = greenCount === values.length
  const xp = greenCount * PER_RING_XP + (allGreen ? ALL_GREEN_BONUS : 0)

  const streakDays = allGreen ? prev.streakDays + 1 : 0
  qc.setQueryData<NeedsSummary>(NEEDS_SUMMARY_KEY, { streakDays, lastCloseDate: date, lastAllGreen: allGreen })

  if (xp > 0) awardGamificationEvent(qc, { type: 'NEEDS_CLOSE', date, xpOverride: xp })
}
