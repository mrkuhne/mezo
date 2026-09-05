import { useCallback, useMemo } from 'react'
import { useMutation, useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { useDualQuery } from '@/data/useDualQuery'
import {
  memoryFeedbackApi,
  type MemoryRetrievalFeedback,
  type MemoryRetrievalFeedbackAction,
} from '@/data/insights/memoryFeedbackApi'
import { emitToast } from '@/shared/lib/toastBus'

const EMPTY: MemoryRetrievalFeedback[] = []
const MAX_RESULT_IDS = 100
const QUERY_PREFIX = ['memory-retrieval-feedback'] as const

export interface MemoryRetrievalFeedbackHandle {
  get: (resultId: string) => MemoryRetrievalFeedback | undefined
  act: (runId: string, resultId: string, action: MemoryRetrievalFeedbackAction) => void
  pending: boolean
}

function feedbackQueryKeys(qc: QueryClient): QueryKey[] {
  return qc.getQueryCache().findAll({ queryKey: QUERY_PREFIX }).map((query) => query.queryKey)
}

function writeRow(qc: QueryClient, next: MemoryRetrievalFeedback): void {
  for (const queryKey of feedbackQueryKeys(qc)) {
    qc.setQueryData<MemoryRetrievalFeedback[]>(queryKey, (rows) => [
      ...(rows ?? []).filter((row) => row.resultId !== next.resultId),
      next,
    ])
  }
}

/** One batch read for every recalled-memory card currently rendered by the chat page. */
export function useMemoryRetrievalFeedback(resultIds: string[]): MemoryRetrievalFeedbackHandle {
  const qc = useQueryClient()
  const mock = isMockMode()
  const requestIds = useMemo(() => [...new Set(resultIds)].slice(-MAX_RESULT_IDS), [resultIds])
  const fingerprint = useMemo(() => [...requestIds].sort().join(','), [requestIds])
  const queryKey = useMemo(
    () => (mock ? [...QUERY_PREFIX] : [...QUERY_PREFIX, fingerprint]),
    [mock, fingerprint],
  )

  const { data } = useDualQuery<MemoryRetrievalFeedback[]>({
    queryKey,
    mockData: EMPTY,
    realFetch: async () => requestIds.length ? memoryFeedbackApi.list(requestIds) : EMPTY,
    realEmpty: EMPTY,
    keepPreviousRealData: true,
  })
  const byId = useMemo(() => new Map(data.map((row) => [row.resultId, row])), [data])

  const mutation = useMutation({
    scope: { id: 'memory-retrieval-feedback' },
    mutationFn: async (next: MemoryRetrievalFeedback) => {
      if (mock) return next
      return memoryFeedbackApi.put(next.runId, next.resultId, next.action)
    },
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: QUERY_PREFIX })
      const previous = feedbackQueryKeys(qc).map(
        (key) => [key, qc.getQueryData<MemoryRetrievalFeedback[]>(key)] as const,
      )
      writeRow(qc, next)
      return { previous }
    },
    onError: (_error, _next, context) => {
      for (const [key, rows] of context?.previous ?? []) qc.setQueryData(key, rows)
    },
    onSuccess: (stored) => {
      writeRow(qc, stored)
      if (stored.action === 'suppress') {
        emitToast({ kind: 'success', text: 'Ezt az emléket többé nem használjuk.' })
      }
    },
  })

  const get = useCallback((resultId: string) => byId.get(resultId), [byId])
  const { mutate } = mutation
  const act = useCallback(
    (runId: string, resultId: string, action: MemoryRetrievalFeedbackAction) => {
      mutate({ runId, resultId, action, updatedAt: new Date().toISOString() })
    },
    [mutate],
  )

  return { get, act, pending: mutation.isPending }
}
