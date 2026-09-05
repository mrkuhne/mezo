import { apiFetch } from '@/data/_client/api'
import type { paths } from '@/data/_client/api.gen'

type FeedbackWire =
  paths['/api/companion/memory/retrieval-feedback']['get']['responses']['200']['content']['application/json'][number]
type PutFeedbackBody =
  paths['/api/companion/memory/retrieval/{runId}/result/{resultId}/feedback']['put']['requestBody']['content']['application/json']

export type MemoryRetrievalFeedbackAction = 'useful' | 'irrelevant' | 'suppress'

export interface MemoryRetrievalFeedback {
  runId: string
  resultId: string
  action: MemoryRetrievalFeedbackAction
  updatedAt: string
}

function fromWire(row: FeedbackWire): MemoryRetrievalFeedback {
  return {
    runId: row.runId,
    resultId: row.resultId,
    action: row.action,
    updatedAt: row.updatedAt,
  }
}

export const memoryFeedbackApi = {
  async list(resultIds: string[]): Promise<MemoryRetrievalFeedback[]> {
    if (resultIds.length === 0) return []
    const query = resultIds.map(encodeURIComponent).join(',')
    const rows = await apiFetch<FeedbackWire[]>(
      `/api/companion/memory/retrieval-feedback?resultIds=${query}`,
    )
    return rows.map(fromWire)
  },

  async put(
    runId: string,
    resultId: string,
    action: MemoryRetrievalFeedbackAction,
  ): Promise<MemoryRetrievalFeedback> {
    const body = { action } satisfies PutFeedbackBody
    const row = await apiFetch<FeedbackWire>(
      `/api/companion/memory/retrieval/${encodeURIComponent(runId)}/result/${encodeURIComponent(resultId)}/feedback`,
      { method: 'PUT', body: JSON.stringify(body) },
    )
    return fromWire(row)
  },
}
