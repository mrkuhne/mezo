import { useDualQuery } from '@/data/useDualQuery'
import { llmUsageApi, type LlmUsageSummaryResponse } from '@/data/me/llmUsageApi'

/** Believable demo numbers for the Profil "AI-használat" card (mock mode only). */
export const LLM_USAGE_MOCK: LlmUsageSummaryResponse = {
  day: { callCount: 12, costUsd: 0.04, currency: 'USD' },
  week: { callCount: 78, costUsd: 0.31, currency: 'USD' },
  month: { callCount: 305, costUsd: 1.22, currency: 'USD' },
}

/**
 * Honest empty for real mode (never the seed): zero calls and NO cost — a null
 * `costUsd` renders as "—", so an unresolved read can't imply a $0.00 spend.
 */
export const LLM_USAGE_EMPTY: LlmUsageSummaryResponse = {
  day: { callCount: 0, costUsd: null, currency: 'USD' },
  week: { callCount: 0, costUsd: null, currency: 'USD' },
  month: { callCount: 0, costUsd: null, currency: 'USD' },
}

/**
 * LLM usage summary (mezo-h3gb) — day/week/month call counts + estimated cost from
 * the backend's LLM audit log, feeding the Profil `AiUsageCard`. Dual-mode read:
 * the seeded demo numbers in mock mode, `GET /api/llm-usage/summary` in real mode,
 * `LLM_USAGE_EMPTY` (not the seed) while unresolved. Read-only — no write path.
 */
export function useLlmUsageSummary() {
  return useDualQuery({
    queryKey: ['llmUsageSummary'],
    mockData: LLM_USAGE_MOCK,
    realFetch: () => llmUsageApi.getSummary(),
    realEmpty: LLM_USAGE_EMPTY,
    realStaleTime: 60_000,
  })
}
