import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'

// Contract types generated from api/openapi.yml — regenerate with `pnpm generate:api`.
export type ExpenditureExplanation = components['schemas']['ExpenditureExplanationResponse']
export type ExpenditureSeriesPoint = components['schemas']['ExpenditureSeriesPoint']
export type ExpenditureExcludedDay = components['schemas']['ExpenditureExcludedDay']
export type ExpenditureWaterEvent = components['schemas']['ExpenditureWaterEvent']

// Learned-expenditure part 2 (mezo-3n2so, spec §6.3/§7) — weekly history, the "how did I learn"
// weekly card, and the live per-day marking that re-chains the learned base.
export type ExpenditureHistory = components['schemas']['ExpenditureHistoryResponse']
export type ExpenditureWeek = components['schemas']['ExpenditureWeek']
export type ExpenditureWeeklyCard = components['schemas']['ExpenditureWeeklyCardResponse']
export type IntakeDayStatus = components['schemas']['IntakeDayStatus']
export type IntakeDayMarkResult = components['schemas']['IntakeDayMarkResult']

export const expenditureApi = {
  /** „Hogy tanultam?” (mezo-y72o3) — the latest explained week; `null` on 204 (never explained yet). */
  explanation: async (): Promise<ExpenditureExplanation | null> =>
    (await apiFetch<ExpenditureExplanation | undefined>('/api/goals/expenditure/explanation')) ?? null,

  /** The caller's last N reviewed weeks, oldest first, plus the learning switch (mezo-3n2so). */
  history: (limit?: number): Promise<ExpenditureHistory> =>
    apiFetch<ExpenditureHistory>(
      `/api/goals/expenditure/weeks${limit != null ? `?limit=${limit}` : ''}`,
    ),

  /** The current weekly-summary card; `null` on 204 (nothing worth showing). */
  weeklyCard: async (): Promise<ExpenditureWeeklyCard | null> =>
    (await apiFetch<ExpenditureWeeklyCard | undefined>('/api/goals/expenditure/weekly-card')) ?? null,

  /** Dismiss the weekly-summary card for one reviewed week — cross-device, per week. */
  dismissWeeklyCard: (weekStart: string): Promise<void> =>
    apiFetch<void>(`/api/goals/expenditure/weekly-card/${weekStart}/dismiss`, { method: 'POST' }),

  /** Live per-day statuses for a range — never past today. */
  days: (from: string, to: string): Promise<IntakeDayStatus[]> =>
    apiFetch<IntakeDayStatus[]>(`/api/goals/expenditure/days?from=${from}&to=${to}`),

  /** Mark a logged, non-future day complete/incomplete — re-chains the learned base from that week on. */
  setMark: (date: string, status: 'complete' | 'incomplete'): Promise<IntakeDayMarkResult> =>
    apiFetch<IntakeDayMarkResult>(`/api/goals/expenditure/days/${date}/mark`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),

  /** Clear a day's mark — re-chains the learned base from that week on. */
  clearMark: (date: string): Promise<IntakeDayMarkResult> =>
    apiFetch<IntakeDayMarkResult>(`/api/goals/expenditure/days/${date}/mark`, { method: 'DELETE' }),
}
