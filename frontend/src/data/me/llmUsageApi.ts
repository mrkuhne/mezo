import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'

// Contract types generated from api/openapi.yml — regenerate with `pnpm generate:api`.
export type LlmUsageSummaryResponse = components['schemas']['LlmUsageSummaryResponse']
export type LlmUsagePeriod = components['schemas']['LlmUsagePeriod']

// LLM usage rollups over the audit log (llm_log_history) — day/week/month call
// counts + summed cost. Read-only: the log is written by the backend's LLM layer,
// never by the client.
export const llmUsageApi = {
  getSummary: (): Promise<LlmUsageSummaryResponse> =>
    apiFetch<LlmUsageSummaryResponse>('/api/llm-usage/summary'),
}
