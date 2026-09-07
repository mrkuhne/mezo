import { DEFAULT_QUERY_STALE_TIME_MS, useDualQuery } from '@/data/useDualQuery'
import {
  adminDataApi,
  type AdminRowPageResponse,
  type AdminRowsParams,
  type AdminTableListResponse,
  type AdminViewDescriptor,
} from '@/data/admin/adminDataApi'
import {
  ADMIN_ROWS_EMPTY,
  ADMIN_TABLES_EMPTY,
  ADMIN_TABLES_MOCK,
  ADMIN_VIEWS_EMPTY,
  ADMIN_VIEWS_MOCK,
  adminRowsMockFor,
} from '@/data/admin/adminDataMock'

// Admin data-browser hooks (mezo-d5iy.12), following Task 10's dual-mode recipe: every hook
// takes/passes `isOwner` as `enabled` and `realStaleTime: DEFAULT_QUERY_STALE_TIME_MS`
// explicitly (an omitted value overwrites the client default — useDualQuery.ts:36-45).

export const ADMIN_TABLES_KEY = ['admin', 'data', 'tables'] as const
export const ADMIN_VIEWS_KEY = ['admin', 'data', 'views'] as const
export const ADMIN_ROWS_KEY = ['admin', 'data', 'rows'] as const

export function useAdminTables(isOwner: boolean) {
  return useDualQuery<AdminTableListResponse>({
    queryKey: ADMIN_TABLES_KEY,
    mockData: ADMIN_TABLES_MOCK,
    realFetch: adminDataApi.tables,
    realEmpty: ADMIN_TABLES_EMPTY,
    realStaleTime: DEFAULT_QUERY_STALE_TIME_MS,
    enabled: isOwner,
  })
}

export function useAdminViews(isOwner: boolean) {
  return useDualQuery<AdminViewDescriptor[]>({
    queryKey: ADMIN_VIEWS_KEY,
    mockData: ADMIN_VIEWS_MOCK,
    realFetch: adminDataApi.views,
    realEmpty: ADMIN_VIEWS_EMPTY,
    realStaleTime: DEFAULT_QUERY_STALE_TIME_MS,
    enabled: isOwner,
  })
}

/**
 * A page of rows from one browsable table. `params.table === ''` (no table picked yet — every
 * picker on this surface starts unselected) is folded into `enabled` here rather than left for
 * the caller to remember, and `keepPreviousRealData: true` so paging/sorting/toggling
 * "Törölt sorok" doesn't blank the table for the width of a round-trip. Every parameter that
 * can change what the server returns rides in the query key — table, userId, page, size, sort,
 * dir, includeDeleted — so switching any one of them never serves another combination's cache.
 */
export function useAdminRows(params: AdminRowsParams, isOwner: boolean) {
  // Fix round: final review Finding 3 — same permanently-`pending`-while-disabled trap as
  // `useAdminUserDetail` above (see that hook's comment). Fold `enabled` into `isPending` here
  // too, so callers that still branch on `params.table !== ''` locally (AdminDataPage,
  // AdminUserDetailPage's embedded browser) can rely on `isPending` instead.
  const enabled = isOwner && params.table !== ''
  const q = useDualQuery<AdminRowPageResponse>({
    queryKey: [
      ...ADMIN_ROWS_KEY,
      params.table,
      params.userId ?? null,
      params.page ?? 0,
      params.size ?? 50,
      params.sort ?? null,
      params.dir ?? 'desc',
      !!params.includeDeleted,
    ],
    mockData: adminRowsMockFor(params.table),
    realFetch: () => adminDataApi.rows(params),
    realEmpty: ADMIN_ROWS_EMPTY,
    realStaleTime: DEFAULT_QUERY_STALE_TIME_MS,
    keepPreviousRealData: true,
    enabled,
  })
  return { ...q, isPending: enabled && q.isPending }
}
