import { useMutation } from '@tanstack/react-query'
import { DEFAULT_QUERY_STALE_TIME_MS, useDualQuery } from '@/data/useDualQuery'
import {
  adminMemoryApi,
  degradable,
  type AdminMemoryGlobalHealthResponse,
  type AdminMemoryGraphResponse,
  type AdminMemoryHealthResponse,
  type AdminMemoryNeighborsResponse,
  type AdminMemoryReplayRequest,
  type AdminMemoryRunDetailResponse,
  type AdminMemoryRunPageResponse,
  type AdminMemoryVectorsResponse,
  type Degradable,
} from '@/data/admin/adminMemoryApi'
import {
  ADMIN_MEMORY_GLOBAL_HEALTH_EMPTY,
  ADMIN_MEMORY_GLOBAL_HEALTH_MOCK,
  ADMIN_MEMORY_GRAPH_EMPTY,
  ADMIN_MEMORY_GRAPH_MOCK,
  ADMIN_MEMORY_HEALTH_EMPTY,
  ADMIN_MEMORY_HEALTH_MOCK,
  ADMIN_MEMORY_NEIGHBORS_EMPTY,
  ADMIN_MEMORY_NEIGHBORS_MOCK,
  ADMIN_MEMORY_RUNS_EMPTY,
  ADMIN_MEMORY_RUNS_MOCK,
  ADMIN_MEMORY_RUN_DETAIL_EMPTY,
  ADMIN_MEMORY_RUN_DETAIL_MOCK,
  ADMIN_MEMORY_VECTORS_EMPTY,
  ADMIN_MEMORY_VECTORS_MOCK,
  adminMemoryRunDetailFor,
} from '@/data/admin/adminMemoryMock'

// RAG memory explorer hooks (mezo-4qyt.3). Every hook takes an `isOwner` flag and passes it as
// `enabled` so a non-owner never fires an admin request, and every hook passes
// `realStaleTime: DEFAULT_QUERY_STALE_TIME_MS` EXPLICITLY — omitting it sends `staleTime:
// undefined`, which overwrites the QueryClient default and leaves the query permanently stale
// (useDualQuery.ts:36-45, the known trap that bit part 1).
//
// `degradable` wraps only the READS below. The replay mutation surfaces its 404 as a genuine
// error — the page renders the "ki van kapcsolva" tile from a read's `degraded` flag, never
// from the mutation (resolved ambiguity 6).

export const ADMIN_MEMORY_KEY = ['admin', 'memory'] as const

export function useAdminMemoryRuns(userId: string, page: number, size: number, isOwner: boolean) {
  const enabled = isOwner && userId !== ''
  const q = useDualQuery<Degradable<AdminMemoryRunPageResponse>>({
    queryKey: [...ADMIN_MEMORY_KEY, 'runs', userId, page, size],
    mockData: ADMIN_MEMORY_RUNS_MOCK,
    realFetch: degradable(() => adminMemoryApi.runs(userId, page, size), ADMIN_MEMORY_RUNS_EMPTY),
    realEmpty: ADMIN_MEMORY_RUNS_EMPTY,
    realStaleTime: DEFAULT_QUERY_STALE_TIME_MS,
    keepPreviousRealData: true, // paging must not blank the table for a round-trip
    enabled,
  })
  return { ...q, isPending: enabled && q.isPending }
}

export function useAdminMemoryRun(userId: string, runId: string, isOwner: boolean) {
  const enabled = isOwner && userId !== '' && runId !== ''
  const q = useDualQuery<Degradable<AdminMemoryRunDetailResponse>>({
    queryKey: [...ADMIN_MEMORY_KEY, 'run', userId, runId],
    mockData: runId ? adminMemoryRunDetailFor(runId) : ADMIN_MEMORY_RUN_DETAIL_MOCK,
    realFetch: degradable(() => adminMemoryApi.run(userId, runId), ADMIN_MEMORY_RUN_DETAIL_EMPTY),
    realEmpty: ADMIN_MEMORY_RUN_DETAIL_EMPTY,
    realStaleTime: DEFAULT_QUERY_STALE_TIME_MS,
    enabled,
  })
  return { ...q, isPending: enabled && q.isPending }
}

export function useAdminMemoryGraph(
  userId: string,
  includeArchived: boolean,
  includeDeleted: boolean,
  isOwner: boolean,
) {
  const enabled = isOwner && userId !== ''
  const q = useDualQuery<Degradable<AdminMemoryGraphResponse>>({
    queryKey: [...ADMIN_MEMORY_KEY, 'graph', userId, includeArchived, includeDeleted],
    mockData: ADMIN_MEMORY_GRAPH_MOCK,
    realFetch: degradable(() => adminMemoryApi.graph(userId, includeArchived, includeDeleted), ADMIN_MEMORY_GRAPH_EMPTY),
    realEmpty: ADMIN_MEMORY_GRAPH_EMPTY,
    realStaleTime: DEFAULT_QUERY_STALE_TIME_MS,
    enabled,
  })
  return { ...q, isPending: enabled && q.isPending }
}

export function useAdminMemoryVectors(userId: string, version: string | null, isOwner: boolean) {
  const enabled = isOwner && userId !== ''
  const q = useDualQuery<Degradable<AdminMemoryVectorsResponse>>({
    queryKey: [...ADMIN_MEMORY_KEY, 'vectors', userId, version],
    mockData: ADMIN_MEMORY_VECTORS_MOCK,
    realFetch: degradable(() => adminMemoryApi.vectors(userId, version), ADMIN_MEMORY_VECTORS_EMPTY),
    realEmpty: ADMIN_MEMORY_VECTORS_EMPTY,
    realStaleTime: DEFAULT_QUERY_STALE_TIME_MS,
    enabled,
  })
  return { ...q, isPending: enabled && q.isPending }
}

export function useAdminMemoryNeighbors(userId: string, itemId: string | null, k: number, isOwner: boolean) {
  const enabled = isOwner && userId !== '' && itemId !== null
  const q = useDualQuery<Degradable<AdminMemoryNeighborsResponse>>({
    queryKey: [...ADMIN_MEMORY_KEY, 'neighbors', userId, itemId, k],
    mockData: ADMIN_MEMORY_NEIGHBORS_MOCK,
    realFetch: degradable(() => adminMemoryApi.neighbors(userId, itemId ?? '', k), ADMIN_MEMORY_NEIGHBORS_EMPTY),
    realEmpty: ADMIN_MEMORY_NEIGHBORS_EMPTY,
    realStaleTime: DEFAULT_QUERY_STALE_TIME_MS,
    enabled,
  })
  return { ...q, isPending: enabled && q.isPending }
}

export function useAdminMemoryHealth(userId: string, isOwner: boolean) {
  const enabled = isOwner && userId !== ''
  const q = useDualQuery<Degradable<AdminMemoryHealthResponse>>({
    queryKey: [...ADMIN_MEMORY_KEY, 'health', userId],
    mockData: ADMIN_MEMORY_HEALTH_MOCK,
    realFetch: degradable(() => adminMemoryApi.health(userId), ADMIN_MEMORY_HEALTH_EMPTY),
    realEmpty: ADMIN_MEMORY_HEALTH_EMPTY,
    realStaleTime: DEFAULT_QUERY_STALE_TIME_MS,
    enabled,
  })
  return { ...q, isPending: enabled && q.isPending }
}

/** Installation-wide health (mezo-k5zy) — the Memória entry page's KPI tiles, NOT scoped to one
 *  inspected user and NOT a client-side aggregation over every user's per-user `useAdminMemoryHealth`. */
export function useAdminMemoryGlobalHealth(isOwner: boolean) {
  const q = useDualQuery<Degradable<AdminMemoryGlobalHealthResponse>>({
    queryKey: [...ADMIN_MEMORY_KEY, 'global-health'],
    mockData: ADMIN_MEMORY_GLOBAL_HEALTH_MOCK,
    realFetch: degradable(() => adminMemoryApi.globalHealth(), ADMIN_MEMORY_GLOBAL_HEALTH_EMPTY),
    realEmpty: ADMIN_MEMORY_GLOBAL_HEALTH_EMPTY,
    realStaleTime: DEFAULT_QUERY_STALE_TIME_MS,
    enabled: isOwner,
  })
  return { ...q, isPending: isOwner && q.isPending }
}

/** The replay is the only mutation on this surface — and it is side-effect-free server-side
 *  (D1: dry-run writes no `memory_retrieval_*` row). Its 404 is a real error, never `degraded`. */
export function useAdminMemoryReplay(userId: string) {
  return useMutation({
    mutationFn: (body: AdminMemoryReplayRequest) => adminMemoryApi.replay(userId, body),
  })
}
