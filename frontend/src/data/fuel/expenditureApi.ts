import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'

// Contract types generated from api/openapi.yml — regenerate with `pnpm generate:api`.
export type ExpenditureExplanation = components['schemas']['ExpenditureExplanationResponse']
export type ExpenditureSeriesPoint = components['schemas']['ExpenditureSeriesPoint']
export type ExpenditureExcludedDay = components['schemas']['ExpenditureExcludedDay']
export type ExpenditureWaterEvent = components['schemas']['ExpenditureWaterEvent']

export const expenditureApi = {
  /** „Hogy tanultam?” (mezo-y72o3) — the latest explained week; `null` on 204 (never explained yet). */
  explanation: async (): Promise<ExpenditureExplanation | null> =>
    (await apiFetch<ExpenditureExplanation | undefined>('/api/goals/expenditure/explanation')) ?? null,
}
