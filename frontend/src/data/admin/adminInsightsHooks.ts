import { ApiError } from '@/data/_client/api'
import { DEFAULT_QUERY_STALE_TIME_MS, useDualQuery } from '@/data/useDualQuery'
import {
  adminInsightsApi,
  type AdminAlertsResponse,
  type AdminCostMatrixResponse,
  type AdminFeatureBoardResponse,
  type AdminFeatureDetailResponse,
  type AdminFeaturePeriod,
  type AdminFeedbackSummaryResponse,
  type AdminOverviewResponse,
  type AdminPeriod,
  type AdminScreenUsageResponse,
  type AdminSortDir,
  type AdminUserDetailResponse,
  type AdminUserInsightResponse,
  type AdminUserInsightSort,
} from '@/data/admin/adminInsightsApi'
import {
  ADMIN_ALERTS_EMPTY,
  ADMIN_ALERTS_MOCK,
  ADMIN_COST_MATRIX_EMPTY,
  ADMIN_COST_MATRIX_MOCK,
  ADMIN_COST_MATRIX_7D_MOCK,
  ADMIN_FEATURE_BOARD_EMPTY,
  ADMIN_FEATURE_DETAIL_EMPTY,
  ADMIN_FEEDBACK_SUMMARY_EMPTY,
  ADMIN_FEEDBACK_SUMMARY_MOCK,
  ADMIN_OVERVIEW_EMPTY,
  ADMIN_SCREEN_USAGE_EMPTY,
  ADMIN_SCREEN_USAGE_MOCK,
  ADMIN_OVERVIEW_MOCK,
  ADMIN_USER_DETAIL_EMPTY,
  ADMIN_USER_DETAIL_MOCK,
  ADMIN_USER_INSIGHTS_EMPTY,
  ADMIN_USER_INSIGHTS_MOCK,
  featureBoardMockFor,
  featureDetailMockFor,
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
export const ADMIN_COST_MATRIX_KEY = ['admin', 'insights', 'usage', 'cost-matrix'] as const
export const ADMIN_SCREEN_USAGE_KEY = ['admin', 'insights', 'usage', 'screens'] as const
export const ADMIN_ALERTS_KEY = ['admin', 'insights', 'alerts'] as const
export const ADMIN_FEATURE_BOARD_KEY = ['admin', 'insights', 'features', 'board'] as const
export const ADMIN_FEATURE_DETAIL_KEY = ['admin', 'insights', 'features', 'detail'] as const
export const ADMIN_FEEDBACK_SUMMARY_KEY = ['admin', 'insights', 'feedback', 'summary'] as const

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
    // Fix round: final review Finding 5 — `q` rides in the query key, so every keystroke is a
    // new key. Without this, real mode drops to `realEmpty` between each request (hero flips to
    // "0 fiók", table to "Nincs találat.") for the width of every round-trip; `useAdminRows`
    // already had this (see its own doc comment) but this sibling hook didn't. AdminUsersPage
    // also debounces the input itself so a keystroke burst is one request, not three.
    keepPreviousRealData: true,
    enabled: isOwner,
  })
}

export function useAdminUserDetail(id: string, isOwner: boolean) {
  // Fix round: final review Finding 3. A TanStack v5 query that is `enabled: false` with no
  // cached data never leaves `status: 'pending'` — so a disabled `useAdminUserDetail` (no id,
  // or a non-owner) would hand callers an `isPending` that is permanently `true`, the exact
  // trap Task 11 already paid to fix once at the page (see AdminUserDetailPage's `notFound`
  // comment). Following the established precedent at `goalOverviewHooks.ts` (`pending: goalId
  // !== null && isPending`), fold the `enabled` condition into `isPending` itself here so every
  // caller gets a correct value without re-deriving it.
  const enabled = isOwner && id !== ''
  const q = useDualQuery<AdminUserDetailResponse>({
    queryKey: [...ADMIN_USER_DETAIL_KEY, id],
    mockData: ADMIN_USER_DETAIL_MOCK,
    realFetch: () => adminInsightsApi.userDetail(id),
    realEmpty: ADMIN_USER_DETAIL_EMPTY,
    realStaleTime: DEFAULT_QUERY_STALE_TIME_MS,
    enabled,
  })
  return { ...q, isPending: enabled && q.isPending }
}

// Final review F6a: mock mode used to serve the SAME 30-day object for every `period`, so
// Pulzus's "· 7 nap" top-list tiles (`useAdminCostMatrix('7d', ...)`) were fed 30-day totals in
// mock mode — not what a real 7-day window would ever look like next to the 30-day one.
// `period`-aware mock selection; MSW's own handler mirrors this same mapping.
function costMatrixMockFor(period: AdminPeriod): AdminCostMatrixResponse {
  return period === '7d' ? ADMIN_COST_MATRIX_7D_MOCK : ADMIN_COST_MATRIX_MOCK
}

export function useAdminCostMatrix(period: AdminPeriod, isOwner: boolean) {
  return useDualQuery<AdminCostMatrixResponse>({
    queryKey: [...ADMIN_COST_MATRIX_KEY, period],
    mockData: costMatrixMockFor(period),
    realFetch: () => adminInsightsApi.costMatrix(period),
    realEmpty: ADMIN_COST_MATRIX_EMPTY,
    realStaleTime: DEFAULT_QUERY_STALE_TIME_MS,
    enabled: isOwner,
  })
}

/**
 * Screen usage (mezo-o5cz) — the Funkciók scorecard's "Képernyők" panel. Same recipe as its
 * siblings: `enabled: isOwner` so a non-owner never fires the request, and an EXPLICIT
 * `realStaleTime` (an omitted one overwrites the client default and leaves the query permanently
 * stale — see the note at the top of this file).
 */
export function useAdminScreenUsage(period: AdminPeriod, isOwner: boolean) {
  return useDualQuery<AdminScreenUsageResponse>({
    queryKey: [...ADMIN_SCREEN_USAGE_KEY, period],
    mockData: ADMIN_SCREEN_USAGE_MOCK,
    realFetch: () => adminInsightsApi.screenUsage(period),
    realEmpty: ADMIN_SCREEN_USAGE_EMPTY,
    realStaleTime: DEFAULT_QUERY_STALE_TIME_MS,
    enabled: isOwner,
  })
}

// Alerts (mezo-kjwa) — owner-facing rule-based warnings on the admin hub. Same recipe as its
// siblings: `enabled: isOwner`, explicit `realStaleTime` (an omitted one overwrites the client
// default and leaves the query permanently stale — see the note at the top of this file).
export function useAdminAlerts(isOwner: boolean) {
  return useDualQuery<AdminAlertsResponse>({
    queryKey: ADMIN_ALERTS_KEY,
    mockData: ADMIN_ALERTS_MOCK,
    realFetch: adminInsightsApi.alerts,
    realEmpty: ADMIN_ALERTS_EMPTY,
    realStaleTime: DEFAULT_QUERY_STALE_TIME_MS,
    enabled: isOwner,
  })
}

// Feature scorecard (mezo-clgz) — the Funkciók tab's board/detail/feedback-summary hooks. Same
// recipe as every sibling above: `enabled: isOwner`, explicit `realStaleTime` (an omitted one
// overwrites the client default and leaves the query permanently stale — see the note at the
// top of this file).
export function useAdminFeatureBoard(period: AdminFeaturePeriod, isOwner: boolean) {
  return useDualQuery<AdminFeatureBoardResponse>({
    queryKey: [...ADMIN_FEATURE_BOARD_KEY, period],
    mockData: featureBoardMockFor(period),
    realFetch: () => adminInsightsApi.featureBoard(period),
    realEmpty: ADMIN_FEATURE_BOARD_EMPTY,
    realStaleTime: DEFAULT_QUERY_STALE_TIME_MS,
    enabled: isOwner,
  })
}

export function useAdminFeatureDetail(key: string, period: AdminFeaturePeriod, isOwner: boolean) {
  // Same fold-`enabled`-into-`isPending` precedent as `useAdminUserDetail` above — a disabled
  // query (no key, or a non-owner) would otherwise report `isPending: true` forever.
  const enabled = isOwner && key !== ''
  const q = useDualQuery<AdminFeatureDetailResponse>({
    queryKey: [...ADMIN_FEATURE_DETAIL_KEY, key, period],
    mockData: featureDetailMockFor(key),
    // An unknown feature key (mezo-kxnn Task 3) answers 404 — the `patternDetailHooks.ts`/
    // `memoirHooks.ts` precedent: caught here and folded into the honest `ADMIN_FEATURE_DETAIL_EMPTY`
    // (`key: ''`) instead of surfacing as `isError`, so the page's "ismeretlen funkció" state is a
    // plain `data.key === ''` read, not a distinct error branch to special-case everywhere.
    realFetch: async () => {
      try {
        return await adminInsightsApi.featureDetail(key, period)
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return ADMIN_FEATURE_DETAIL_EMPTY
        throw e
      }
    },
    realEmpty: ADMIN_FEATURE_DETAIL_EMPTY,
    realStaleTime: DEFAULT_QUERY_STALE_TIME_MS,
    enabled,
  })
  return { ...q, isPending: enabled && q.isPending }
}

export function useAdminFeedbackSummary(period: AdminFeaturePeriod, isOwner: boolean) {
  return useDualQuery<AdminFeedbackSummaryResponse>({
    queryKey: [...ADMIN_FEEDBACK_SUMMARY_KEY, period],
    mockData: ADMIN_FEEDBACK_SUMMARY_MOCK,
    realFetch: () => adminInsightsApi.feedbackSummary(period),
    realEmpty: ADMIN_FEEDBACK_SUMMARY_EMPTY,
    realStaleTime: DEFAULT_QUERY_STALE_TIME_MS,
    enabled: isOwner,
  })
}
