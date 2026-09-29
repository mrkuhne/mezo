import { useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { usePeople } from '@/data/me/peopleHooks'
import { useKnowledgeActions } from '@/data/insights/knowledgeHooks'
import { useKnowledgeHubActions } from '@/data/insights/knowledgeHubHooks'
import {
  EMPTY_TURN_MEMORY, turnMemoryApi, type MemoryItem, type TurnAnchor, type TurnMemory, type TurnProposed,
} from '@/data/insights/turnMemoryApi'
import { MOCK_FORGET_ALL_PREVIEW, mockTurnMemory } from '@/data/insights/turnMemory'

/** The S3 back-off ladder (ms) — both extractors land independently, so the WHOLE ladder runs
 *  unless the turn is a forget request (its list is synchronous with the reply). */
const TURN_MEMORY_POLL_DELAYS = [2000, 3000, 5000]

export const turnMemoryKey = (conversationId: string | null, anchorId: string) =>
  ['turn-memory', conversationId, anchorId] as const
const previewKey = (conversationId: string | null) => ['forget-all-preview', conversationId] as const
/** The Tudástár facts list (knowledgeHooks / knowledgeHubHooks) — a „Rólam is" copy lands there. */
const KNOWLEDGE_KEY = ['knowledge'] as const

const isEmpty = (m: TurnMemory) => m.learned.length + m.proposed.length + m.forgotten.length === 0

/** Keeps the previous list's order: an item the owner acted on stays (the backend lists only LIVE
 *  items, so it is missing from the fresh answer), every other one takes its fresh version or
 *  drops; brand-new items follow. */
function keepActed<T extends { id: string }>(prev: T[], next: T[], acted: (item: T) => boolean): T[] {
  const fresh = new Map(next.map((i) => [i.id, i]))
  const kept = prev.flatMap((i) => (acted(i) ? [i] : fresh.has(i.id) ? [fresh.get(i.id)!] : []))
  return [...kept, ...next.filter((i) => !prev.some((p) => p.id === i.id))]
}

/**
 * Final review (mezo-d6ivw.12): a fresh answer never erases what the owner did on this turn — a
 * rejected / undone / locally-kept item keeps its done state (its chip's confirmation stays on
 * screen) and a forgotten item stays in the list. The belt to the `settled` braces: an acted-on
 * turn stops polling, but any refetch that still lands (one in flight) goes through here.
 */
export function mergeTurnMemory(prev: TurnMemory | undefined, next: TurnMemory): TurnMemory {
  if (!prev) return next
  const settled = prev.settled === true // settled: everything already shown stays shown
  return {
    ...next,
    learned: keepActed(prev.learned, next.learned, (f) => settled || !!f.undone),
    proposed: keepActed(prev.proposed, next.proposed, (c) => settled || !!c.rejected || !!c.undone),
    forgotten: [...next.forgotten, ...prev.forgotten.filter((f) => !next.forgotten.some((n) => n.refId === f.refId))],
    settled: prev.settled || next.settled,
  }
}

/**
 * S8 (mezo-d6ivw.12): one chat turn's memory — replaces S3's `useTurnFacts`. Real mode polls
 * `GET …/turn-memory` on the 2s/3s/5s ladder; mock mode serves the inline seed through the SAME
 * query cache, so the actions below patch one place in both modes.
 */
export function useTurnMemory(conversationId: string | null, anchor: TurnAnchor | null): {
  memory: TurnMemory; pending: boolean; loaded: boolean
} {
  const qc = useQueryClient()
  const mock = isMockMode()
  const attempts = useRef(0)
  const lastId = useRef<string | null>(null)
  if (lastId.current !== (anchor?.id ?? null)) {
    lastId.current = anchor?.id ?? null
    attempts.current = 0
  }
  const key = turnMemoryKey(conversationId, anchor?.id ?? '')
  const { data, isFetched } = useQuery<TurnMemory>({
    queryKey: key,
    enabled: !!anchor && (mock || !!conversationId),
    queryFn: async () => {
      if (mock) return mergeTurnMemory(qc.getQueryData<TurnMemory>(key), mockTurnMemory(anchor!.ordinal, anchor!.text))
      attempts.current += 1
      const fresh = await turnMemoryApi.get(conversationId!, anchor!.id)
      // read the cache AFTER the await: a chip action that patched it meanwhile is kept
      return mergeTurnMemory(qc.getQueryData<TurnMemory>(key), fresh)
    },
    refetchInterval: (query) => {
      if (mock) return false
      // a chip action ran here: the cache is the truth now, a poll could only take it away
      if (query.state.data?.settled) return false
      // a forget turn's list is synchronous with the reply, and its row is extraction-blocked —
      // it can never gain content, so one answer is final
      if (query.state.data?.forgetRequest || (query.state.data?.forgotten.length ?? 0) > 0) return false
      // attempts.current counts COMPLETED fetches (incremented before the await in queryFn), so
      // the delay for the NEXT poll is indexed one behind it — fix round 1 (mezo-d6ivw.12): the
      // un-shifted index skipped delays[0] entirely, running 3s/5s instead of 2s/3s/5s.
      if (attempts.current > TURN_MEMORY_POLL_DELAYS.length) return false
      return TURN_MEMORY_POLL_DELAYS[Math.max(0, Math.min(attempts.current - 1, TURN_MEMORY_POLL_DELAYS.length - 1))]
    },
    staleTime: Infinity,
    gcTime: 5 * 60_000,
  })
  const memory = data ?? EMPTY_TURN_MEMORY
  // Symmetric with the refetchInterval stop condition above: attempts.current counts completed
  // fetches, and the ladder still has a poll queued up through (and including) the 3rd follow-up.
  const pending = !mock && !!anchor && !memory.forgetRequest && !memory.settled && isEmpty(memory)
    && attempts.current <= TURN_MEMORY_POLL_DELAYS.length
  return { memory, pending, loaded: isFetched }
}

/**
 * The chip actions of one turn, each a promise the chip turns into busy/error/done. Every success
 * PATCHES this turn's cache and settles it (final review, mezo-d6ivw.12): the backend lists only
 * live items, so a refetch after Ne / Visszavonom would drop the item and unmount its chip together
 * with the confirmation the owner is reading.
 */
export function useTurnMemoryActions(conversationId: string | null, anchor: TurnAnchor | null) {
  const qc = useQueryClient()
  const mock = isMockMode()
  const { undoFactAsync } = usePeople()
  const { decide } = useKnowledgeActions()
  const { forgetFact } = useKnowledgeHubActions()
  const key = turnMemoryKey(conversationId, anchor?.id ?? '')
  const settle = (fn: (m: TurnMemory) => TurnMemory) =>
    qc.setQueryData<TurnMemory>(key, (old) => ({ ...fn(old ?? EMPTY_TURN_MEMORY), settled: true }))
  const patchProposed = (match: (c: TurnProposed) => boolean, fn: (c: TurnProposed) => TurnProposed) =>
    settle((m) => ({ ...m, proposed: m.proposed.map((c) => (match(c) ? fn(c) : c)) }))

  return {
    undoLearned: async (personId: string, factId: string) => {
      await undoFactAsync(personId, factId)
      settle((m) => ({ ...m, learned: m.learned.map((f) => (f.id === factId ? { ...f, undone: true } : f)) }))
      // mezo-d6ivw.13: the undo takes its „Rólam is" copy with it (server-side cascade)
      if (!mock) void qc.invalidateQueries({ queryKey: KNOWLEDGE_KEY })
    },
    accept: async (candidateId: string) => {
      const decided = await decide(candidateId, 'accept')
      const promotedFactId = mock ? `mock-fact-${candidateId}` : (decided?.promotedFactId ?? null)
      patchProposed((c) => c.id === candidateId, (c) => ({ ...c, state: 'kept' as const, promotedFactId }))
    },
    reject: async (candidateId: string) => {
      await decide(candidateId, 'reject')
      patchProposed((c) => c.id === candidateId, (c) => ({ ...c, rejected: true }))
    },
    forgetKept: async (factId: string) => {
      await forgetFact(factId)
      patchProposed((c) => c.promotedFactId === factId, (c) => ({ ...c, undone: true }))
    },
    /** mezo-d6ivw.13 „Rólam is": copy the person fact into the owner's own facts (on) or take the
     *  copy back (off, no veto). Mock mode mints a stand-in id; real mode refreshes the Tudástár. */
    toggleAboutMe: async (factId: string, on: boolean) => {
      const aboutMeFactId = mock ? (on ? `mock-aboutme-${factId}` : null) : await turnMemoryApi.setAboutMe(factId, on)
      settle((m) => ({ ...m, learned: m.learned.map((f) => (f.id === factId ? { ...f, aboutMeFactId } : f)) }))
      if (!mock) void qc.invalidateQueries({ queryKey: KNOWLEDGE_KEY })
    },
    forgetAll: async (): Promise<MemoryItem[]> => {
      const items = mock ? MOCK_FORGET_ALL_PREVIEW : await turnMemoryApi.forgetAll(conversationId!, anchor!.id)
      settle((m) => ({ ...m, forgotten: [...m.forgotten, ...items.filter((i) => !m.forgotten.some((f) => f.refId === i.refId))] }))
      // every other turn of the conversation keeps what it showed ("Elfelejtve · …" via the
      // page's forgotten set) — a later poll there would drop the now-forgotten items
      qc.setQueriesData<TurnMemory>({ queryKey: ['turn-memory', conversationId] },
        (m) => (m ? { ...m, settled: true } : m))
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
