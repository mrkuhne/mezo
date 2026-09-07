import { apiFetch, ApiError } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'

// RAG memory explorer (mezo-4qyt.3) — OWNER-only, one inspected user per call. Every path is
// /api/admin/users/{userId}/memory/**; the backend gates on currentUser.requireOwner() and
// answers 404 when mezo.feature.admin-memory.enabled (or the companion/graph switch a given
// endpoint needs) is off.
export type AdminMemoryRunSummary = components['schemas']['AdminMemoryRunSummary']
export type AdminMemoryRunPageResponse = components['schemas']['AdminMemoryRunPageResponse']
export type AdminMemoryRunDetailResponse = components['schemas']['AdminMemoryRunDetailResponse']
export type AdminMemoryGraphResponse = components['schemas']['AdminMemoryGraphResponse']
export type AdminMemoryVectorsResponse = components['schemas']['AdminMemoryVectorsResponse']
export type AdminMemoryNeighborsResponse = components['schemas']['AdminMemoryNeighborsResponse']
export type AdminMemoryHealthResponse = components['schemas']['AdminMemoryHealthResponse']
export type AdminMemoryReplayRequest = components['schemas']['AdminMemoryReplayRequest']
export type AdminMemoryCandidate = components['schemas']['AdminMemoryCandidate']
export type AdminMemoryScoreBreakdown = components['schemas']['AdminMemoryScoreBreakdown']
export type AdminMemoryFusionConfig = components['schemas']['AdminMemoryFusionConfig']
export type AdminMemoryPromptTraceItem = components['schemas']['AdminMemoryPromptTraceItem']
export type AdminMemoryRetrieverTrace = components['schemas']['AdminMemoryRetrieverTrace']
export type AdminMemoryGraphNode = components['schemas']['AdminMemoryGraphNode']
export type AdminMemoryGraphEdge = components['schemas']['AdminMemoryGraphEdge']
export type AdminMemoryEdgeEvidence = components['schemas']['AdminMemoryEdgeEvidence']
export type AdminMemoryVectorItem = components['schemas']['AdminMemoryVectorItem']
export type AdminMemoryNeighbor = components['schemas']['AdminMemoryNeighbor']
export type AdminMemoryCountBucket = components['schemas']['AdminMemoryCountBucket']

/** A read that answered "this layer is switched off" rather than failing. */
export type Degradable<T> = T & { degraded?: boolean }

/**
 * Turns "the feature is off" into a RESOLVED value carrying `degraded: true`, so one view can
 * say "ki van kapcsolva" while the other three keep working — instead of every view sharing one
 * error state.
 *
 * The discrimination is load-bearing and NOT just "status === 404": a hard-deleted run (the
 * 30-day retention job) is also a 404, and that one must reach the caller as a real error so the
 * list can refresh. A missing controller bean produces a BODYLESS Spring 404, which `apiFetch`
 * turns into a synthetic INTERNAL_ERROR message; our own 404s always carry an ADMIN_MEMORY_*
 * code. So: 404 with no ADMIN_MEMORY_* code => degraded; anything else re-throws.
 */
export function degradable<T>(fetcher: () => Promise<T>, empty: T): () => Promise<Degradable<T>> {
  return async () => {
    try {
      return (await fetcher()) as Degradable<T>
    } catch (e) {
      const ours = e instanceof ApiError && e.messages.some((m) => m.code.startsWith('ADMIN_MEMORY_'))
      if (e instanceof ApiError && e.status === 404 && !ours) {
        return { ...empty, degraded: true }
      }
      throw e
    }
  }
}

const base = (userId: string) => `/api/admin/users/${encodeURIComponent(userId)}/memory`

export const adminMemoryApi = {
  runs: (userId: string, page = 0, size = 25): Promise<AdminMemoryRunPageResponse> =>
    apiFetch(`${base(userId)}/runs?page=${page}&size=${size}`),
  run: (userId: string, runId: string): Promise<AdminMemoryRunDetailResponse> =>
    apiFetch(`${base(userId)}/runs/${encodeURIComponent(runId)}`),
  replay: (userId: string, body: AdminMemoryReplayRequest): Promise<AdminMemoryRunDetailResponse> =>
    apiFetch(`${base(userId)}/replay`, { method: 'POST', body: JSON.stringify(body) }),
  graph: (userId: string, includeArchived: boolean, includeDeleted: boolean): Promise<AdminMemoryGraphResponse> =>
    apiFetch(`${base(userId)}/graph?includeArchived=${includeArchived}&includeDeleted=${includeDeleted}`),
  vectors: (userId: string, version?: string | null): Promise<AdminMemoryVectorsResponse> =>
    apiFetch(`${base(userId)}/vectors${version ? `?version=${encodeURIComponent(version)}` : ''}`),
  neighbors: (userId: string, itemId: string, k: number): Promise<AdminMemoryNeighborsResponse> =>
    apiFetch(`${base(userId)}/vectors/${encodeURIComponent(itemId)}/neighbors?k=${k}`),
  health: (userId: string): Promise<AdminMemoryHealthResponse> => apiFetch(`${base(userId)}/health`),
}
