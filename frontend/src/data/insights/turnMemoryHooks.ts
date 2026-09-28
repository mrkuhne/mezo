import { useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { usePeople } from '@/data/me/peopleHooks'
import { useKnowledgeActions } from '@/data/insights/knowledgeHooks'
import { useKnowledgeHubActions } from '@/data/insights/knowledgeHubHooks'
import {
  EMPTY_TURN_MEMORY, turnMemoryApi, type MemoryItem, type TurnAnchor, type TurnMemory,
} from '@/data/insights/turnMemoryApi'
import { MOCK_FORGET_ALL_PREVIEW, mockTurnMemory } from '@/data/insights/turnMemory'

/** The S3 back-off ladder (ms) — both extractors land independently, so the WHOLE ladder runs
 *  unless the turn is a forget request (its list is synchronous with the reply). */
const TURN_MEMORY_POLL_DELAYS = [2000, 3000, 5000]

export const turnMemoryKey = (conversationId: string | null, anchorId: string) =>
  ['turn-memory', conversationId, anchorId] as const
const previewKey = (conversationId: string | null) => ['forget-all-preview', conversationId] as const

const isEmpty = (m: TurnMemory) => m.learned.length + m.proposed.length + m.forgotten.length === 0

/**
 * S8 (mezo-d6ivw.12): one chat turn's memory — replaces S3's `useTurnFacts`. Real mode polls
 * `GET …/turn-memory` on the 2s/3s/5s ladder; mock mode serves the inline seed through the SAME
 * query cache, so the actions below patch one place in both modes.
 */
export function useTurnMemory(conversationId: string | null, anchor: TurnAnchor | null): { memory: TurnMemory; pending: boolean } {
  const mock = isMockMode()
  const attempts = useRef(0)
  const lastId = useRef<string | null>(null)
  if (lastId.current !== (anchor?.id ?? null)) {
    lastId.current = anchor?.id ?? null
    attempts.current = 0
  }
  const { data } = useQuery<TurnMemory>({
    queryKey: turnMemoryKey(conversationId, anchor?.id ?? ''),
    enabled: !!anchor && (mock || !!conversationId),
    queryFn: async () => {
      if (mock) return mockTurnMemory(anchor!.ordinal, anchor!.text)
      attempts.current += 1
      return turnMemoryApi.get(conversationId!, anchor!.id)
    },
    refetchInterval: (query) => {
      if (mock) return false
      if ((query.state.data?.forgotten.length ?? 0) > 0) return false
      if (attempts.current >= TURN_MEMORY_POLL_DELAYS.length) return false
      return TURN_MEMORY_POLL_DELAYS[Math.min(attempts.current, TURN_MEMORY_POLL_DELAYS.length - 1)]
    },
    staleTime: Infinity,
    gcTime: 5 * 60_000,
  })
  const memory = data ?? EMPTY_TURN_MEMORY
  const pending = !mock && !!anchor && isEmpty(memory) && attempts.current < TURN_MEMORY_POLL_DELAYS.length
  return { memory, pending }
}

/** The four chip actions of one turn, each a promise the chip turns into busy/error/done. */
export function useTurnMemoryActions(conversationId: string | null, anchor: TurnAnchor | null) {
  const qc = useQueryClient()
  const mock = isMockMode()
  const { undoFactAsync } = usePeople()
  const { decide } = useKnowledgeActions()
  const { forgetFact } = useKnowledgeHubActions()
  const key = turnMemoryKey(conversationId, anchor?.id ?? '')
  const patch = (fn: (m: TurnMemory) => TurnMemory) =>
    qc.setQueryData<TurnMemory>(key, (old) => fn(old ?? EMPTY_TURN_MEMORY))

  return {
    undoLearned: async (personId: string, factId: string) => { await undoFactAsync(personId, factId) },
    accept: async (candidateId: string) => {
      await decide(candidateId, 'accept')
      if (mock) {
        patch((m) => ({ ...m, proposed: m.proposed.map((c) => c.id === candidateId
          ? { ...c, state: 'kept' as const, promotedFactId: `mock-fact-${candidateId}` } : c) }))
      } else {
        await qc.invalidateQueries({ queryKey: key })
      }
    },
    reject: async (candidateId: string) => { await decide(candidateId, 'reject') },
    forgetKept: async (factId: string) => { await forgetFact(factId) },
    forgetAll: async (): Promise<MemoryItem[]> => {
      const items = mock ? MOCK_FORGET_ALL_PREVIEW : await turnMemoryApi.forgetAll(conversationId!, anchor!.id)
      patch((m) => ({ ...m, forgotten: [...m.forgotten, ...items.filter((i) => !m.forgotten.some((f) => f.refId === i.refId))] }))
      void qc.invalidateQueries({ queryKey: previewKey(conversationId) })
      return items
    },
  }
}

/** What "Mindent ebből a beszélgetésből?" would forget — fetched once a forget chip shows. */
export function useForgetAllPreview(conversationId: string | null, enabled: boolean) {
  const mock = isMockMode()
  return useQuery<MemoryItem[]>({
    queryKey: previewKey(conversationId),
    enabled: enabled && (mock || !!conversationId),
    queryFn: () => (mock ? Promise.resolve(MOCK_FORGET_ALL_PREVIEW) : turnMemoryApi.previewForgetAll(conversationId!)),
    staleTime: 30_000,
  })
}
