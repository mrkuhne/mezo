import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'

// Admin hub insights (mezo-d5iy) — OWNER-only read surface; every call answers 403
// AUTH_FORBIDDEN for a non-owner (backend concern, see AdminInsightsIT). Nothing here writes.
export type AdminOverviewResponse = components['schemas']['AdminOverviewResponse']
export type AdminUserInsightResponse = components['schemas']['AdminUserInsightResponse']
export type AdminUserDetailResponse = components['schemas']['AdminUserDetailResponse']
export type AdminFeatureUsageResponse = components['schemas']['AdminFeatureUsageResponse']
export type AdminCostMatrixResponse = components['schemas']['AdminCostMatrixResponse']
export type AdminScreenUsageResponse = components['schemas']['AdminScreenUsageResponse']
export type AdminScreenUsageRow = components['schemas']['AdminScreenUsageRow']
export type AdminDayCount = components['schemas']['AdminDayCount']
export type AdminDaySeries = components['schemas']['AdminDaySeries']
export type AdminDayAmount = components['schemas']['AdminDayAmount']
export type AdminFeatureCost = components['schemas']['AdminFeatureCost']
export type AdminTableFootprint = components['schemas']['AdminTableFootprint']
export type AdminCostMatrixCell = components['schemas']['AdminCostMatrixCell']
export type AdminCostMatrixUser = components['schemas']['AdminCostMatrixUser']

export type AdminPeriod = '7d' | '30d' | '90d'
export type AdminUserInsightSort = 'name' | 'createdAt' | 'lastActivityAt' | 'rowCount' | 'cost30dUsd' | 'activeDays30d'
export type AdminSortDir = 'asc' | 'desc'

/** Builds a query string, dropping null/undefined/empty values — a null `q` never becomes `"null"`. */
function qs(params: Record<string, string | null | undefined>): string {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => { if (v != null && v !== '') search.set(k, v) })
  const s = search.toString()
  return s ? `?${s}` : ''
}

export const adminInsightsApi = {
  overview: (): Promise<AdminOverviewResponse> => apiFetch<AdminOverviewResponse>('/api/admin/overview'),
  listUsers: (q: string | null, sort: AdminUserInsightSort, dir: AdminSortDir): Promise<AdminUserInsightResponse[]> =>
    apiFetch<AdminUserInsightResponse[]>(`/api/admin/users-insight${qs({ q, sort, dir })}`),
  userDetail: (id: string): Promise<AdminUserDetailResponse> =>
    apiFetch<AdminUserDetailResponse>(`/api/admin/users/${id}/insight`),
  featureUsage: (period: AdminPeriod): Promise<AdminFeatureUsageResponse> =>
    apiFetch<AdminFeatureUsageResponse>(`/api/admin/usage/features${qs({ period })}`),
  costMatrix: (period: AdminPeriod): Promise<AdminCostMatrixResponse> =>
    apiFetch<AdminCostMatrixResponse>(`/api/admin/usage/cost-matrix${qs({ period })}`),
  // Screen usage (mezo-o5cz) — reads the lean screen_event log. Answers 200 with zero rows when
  // the screen-telemetry switch is off, so the page never has to special-case a 404.
  screenUsage: (period: AdminPeriod): Promise<AdminScreenUsageResponse> =>
    apiFetch<AdminScreenUsageResponse>(`/api/admin/usage/screens${qs({ period })}`),
}
