import { DEFAULT_QUERY_STALE_TIME_MS, useDualQuery } from '@/data/useDualQuery'
import {
  adminInsightsApi,
  type AdminCostMatrixResponse,
  type AdminFeatureUsageResponse,
  type AdminOverviewResponse,
  type AdminPeriod,
  type AdminSortDir,
  type AdminUserDetailResponse,
  type AdminUserInsightResponse,
  type AdminUserInsightSort,
} from '@/data/admin/adminInsightsApi'
import {
  ADMIN_COST_MATRIX_EMPTY,
  ADMIN_COST_MATRIX_MOCK,
  ADMIN_FEATURE_USAGE_EMPTY,
  ADMIN_FEATURE_USAGE_MOCK,
  ADMIN_OVERVIEW_EMPTY,
  ADMIN_OVERVIEW_MOCK,
  ADMIN_USER_DETAIL_EMPTY,
  ADMIN_USER_DETAIL_MOCK,
  ADMIN_USER_INSIGHTS_EMPTY,
  ADMIN_USER_INSIGHTS_MOCK,
} from '@/data/admin/adminInsightsMock'

// Admin hub insights hooks (mezo-d5iy.10). Every hook takes an `isOwner` flag and passes it as
// `enabled` so a non-owner never fires an admin request (Task 11 decides where `isOwner` comes
// from — see the hooks test / task report for the recommendation: `useMe()`, cached, re-read per
// page). Every hook passes `realStaleTime: DEFAULT_QUERY_STALE_TIME_MS` explicitly — see the
// gotcha documented at useDualQuery.ts:36-45 (an omitted value overwrites the client default and
// leaves the query permanently stale).

export const ADMIN_OVERVIEW_KEY = ['admin', 'insights', 'overview'] as const
export const ADMIN_USER_INSIGHTS_KEY = ['admin', 'insights', 'users'] as const
export const ADMIN_USER_DETAIL_KEY = ['admin', 'insights', 'user'] as const
export const ADMIN_FEATURE_USAGE_KEY = ['admin', 'insights', 'usage', 'features'] as const
export const ADMIN_COST_MATRIX_KEY = ['admin', 'insights', 'usage', 'cost-matrix'] as const

export function useAdminOverview(isOwner: boolean) {
  return useDualQuery<AdminOverviewResponse>({
    queryKey: ADMIN_OVERVIEW_KEY,
    mockData: ADMIN_OVERVIEW_MOCK,
    realFetch: adminInsightsApi.overview,
    realEmpty: ADMIN_OVERVIEW_EMPTY,
    realStaleTime: DEFAULT_QUERY_STALE_TIME_MS,
    enabled: isOwner,
  })
}

export function useAdminUserInsights(
  q: string | null,
  sort: AdminUserInsightSort,
  dir: AdminSortDir,
  isOwner: boolean,
) {
  return useDualQuery<AdminUserInsightResponse[]>({
    queryKey: [...ADMIN_USER_INSIGHTS_KEY, q, sort, dir],
    mockData: ADMIN_USER_INSIGHTS_MOCK,
    realFetch: () => adminInsightsApi.listUsers(q, sort, dir),
    realEmpty: ADMIN_USER_INSIGHTS_EMPTY,
    realStaleTime: DEFAULT_QUERY_STALE_TIME_MS,
    enabled: isOwner,
  })
}

export function useAdminUserDetail(id: string, isOwner: boolean) {
  return useDualQuery<AdminUserDetailResponse>({
    queryKey: [...ADMIN_USER_DETAIL_KEY, id],
    mockData: ADMIN_USER_DETAIL_MOCK,
    realFetch: () => adminInsightsApi.userDetail(id),
    realEmpty: ADMIN_USER_DETAIL_EMPTY,
    realStaleTime: DEFAULT_QUERY_STALE_TIME_MS,
    enabled: isOwner && id !== '',
  })
}

export function useAdminFeatureUsage(period: AdminPeriod, isOwner: boolean) {
  return useDualQuery<AdminFeatureUsageResponse>({
    queryKey: [...ADMIN_FEATURE_USAGE_KEY, period],
    mockData: ADMIN_FEATURE_USAGE_MOCK,
    realFetch: () => adminInsightsApi.featureUsage(period),
    realEmpty: ADMIN_FEATURE_USAGE_EMPTY,
    realStaleTime: DEFAULT_QUERY_STALE_TIME_MS,
    enabled: isOwner,
  })
}

export function useAdminCostMatrix(period: AdminPeriod, isOwner: boolean) {
  return useDualQuery<AdminCostMatrixResponse>({
    queryKey: [...ADMIN_COST_MATRIX_KEY, period],
    mockData: ADMIN_COST_MATRIX_MOCK,
    realFetch: () => adminInsightsApi.costMatrix(period),
    realEmpty: ADMIN_COST_MATRIX_EMPTY,
    realStaleTime: DEFAULT_QUERY_STALE_TIME_MS,
    enabled: isOwner,
  })
}
