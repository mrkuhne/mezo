import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'

// Contract types generated from api/openapi.yml — regenerate with `pnpm generate:api`.
export type LlmUsageSummaryResponse = components['schemas']['LlmUsageSummaryResponse']
export type LlmUsagePeriod = components['schemas']['LlmUsagePeriod']

// LLM usage rollups over the audit log (llm_log_history) — day/week/month call
// counts + summed cost. Read-only: the log is written by the backend's LLM layer,
// never by the client.
export type LlmUsageBreakdownResponse = components['schemas']['LlmUsageBreakdownResponse']
export type LlmUsageGroup = components['schemas']['LlmUsageGroup']
export type LlmCallListResponse = components['schemas']['LlmCallListResponse']
export type LlmCallListItem = components['schemas']['LlmCallListItem']
export type LlmCallDetailResponse = components['schemas']['LlmCallDetailResponse']

/** The three calendar periods the backend cuts every rollup on (mezo.llm-log.report-zone). */
export type LlmUsagePeriodKey = 'DAY' | 'WEEK' | 'MONTH'

/** Server-side filters — an omitted key means "don't narrow on this axis". */
export interface LlmCallFilters {
  feature?: string
  status?: string
  callKind?: string
  /** created_by — only an account's own calls; background rows never match */
  userId?: string
}

function callsQuery(period: LlmUsagePeriodKey, filters: LlmCallFilters, limit: number): string {
  const params = new URLSearchParams({ period, limit: String(limit) })
  if (filters.feature) params.set('feature', filters.feature)
  if (filters.status) params.set('status', filters.status)
  if (filters.callKind) params.set('callKind', filters.callKind)
  if (filters.userId) params.set('userId', filters.userId)
  return params.toString()
}

export const llmUsageApi = {
  getSummary: (): Promise<LlmUsageSummaryResponse> =>
    apiFetch<LlmUsageSummaryResponse>('/api/llm-usage/summary'),
  getBreakdown: (period: LlmUsagePeriodKey): Promise<LlmUsageBreakdownResponse> =>
    apiFetch<LlmUsageBreakdownResponse>(`/api/llm-usage/breakdown?period=${period}`),
  listCalls: (period: LlmUsagePeriodKey, filters: LlmCallFilters, limit: number): Promise<LlmCallListResponse> =>
    apiFetch<LlmCallListResponse>(`/api/llm-usage/calls?${callsQuery(period, filters, limit)}`),
  getCall: (id: string): Promise<LlmCallDetailResponse> =>
    apiFetch<LlmCallDetailResponse>(`/api/llm-usage/calls/${id}`),
}
