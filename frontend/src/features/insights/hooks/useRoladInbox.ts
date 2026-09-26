import { useState } from 'react'
import {
  useKnowledge, useKnowledgeActions, useLifeEventCandidates, useLifeEventActions,
} from '@/data/hooks'
import type { RefinedCandidate } from '@/data/insights/graphApi'
import type { FactCandidate, FactDecision, LifeEventCandidate, LifeEventDecision } from '@/data/types'

export type Settled = {
  id: string
  kind: 'FACT' | 'LIFE_EVENT' | 'SEASON'
  title: string
  outcome: 'keep' | 'snooze' | 'reject'
  edgeCount: number
}

const OUTCOME: Record<FactDecision | LifeEventDecision, Settled['outcome']> = {
  accept: 'keep', refine: 'keep', snooze: 'snooze', reject: 'reject',
}

/**
 * U9b (mezo-zpxv7): the Rólad decision inbox as one hook — lifts the `acceptedEvents`
 * page-state idea out of `KnowledgeListPage` (now generalized to every outcome, not just
 * life-event accepts) and layers it over the four Tudástár data hooks. `settled` is
 * page-level state so a decision's afterlife line survives the real-mode refetch window:
 * `candidates`/`lifeEvents` filter out ids already in `settled`, which hides the interval
 * where the server list still carries the just-decided candidate.
 */
export function useRoladInbox() {
  const { facts, candidates, degraded, isPending, isError, refetch } = useKnowledge()
  const { decide: decideFactM, toggle: toggleFactM } = useKnowledgeActions()
  const {
    candidates: lifeEvents, isError: isLifeEventsError, refetch: refetchLifeEvents,
  } = useLifeEventCandidates()
  const { decide: decideLifeEventM } = useLifeEventActions()

  const [settled, setSettled] = useState<Settled[]>([])

  const settledIds = new Set(settled.map((s) => s.id))
  const pendingCandidates = candidates.filter((c) => !settledIds.has(c.id))
  const pendingLifeEvents = lifeEvents.filter((c) => !settledIds.has(c.id))

  // A settled id rolls back on a failed mutation (final-review fix, mezo-zpxv7): the candidate
  // comes back to the open list, and the global MutationCache still toasts the error — this hook
  // only owns the afterlife-line bookkeeping, not the error message.
  const rollback = (id: string) => setSettled((prev) => prev.filter((s) => s.id !== id))

  const decideFact = (c: FactCandidate, decision: FactDecision, refinedText?: string) => {
    const title = decision === 'refine' && refinedText ? refinedText : c.text
    setSettled((prev) => [...prev, { id: c.id, kind: 'FACT', title, outcome: OUTCOME[decision], edgeCount: 0 }])
    decideFactM(c.id, decision, refinedText).catch(() => rollback(c.id))
  }

  const decideLifeEvent = (c: LifeEventCandidate, decision: LifeEventDecision, refined?: RefinedCandidate) => {
    const title = refined?.title ?? c.title
    setSettled((prev) => [
      ...prev,
      { id: c.id, kind: c.kind, title, outcome: OUTCOME[decision], edgeCount: c.proposedEdgeCount },
    ])
    decideLifeEventM(c.id, decision, refined).catch(() => rollback(c.id))
  }

  return {
    facts,
    candidates: pendingCandidates,
    lifeEvents: pendingLifeEvents,
    settled,
    degraded,
    isPending,
    isError,
    refetch,
    // mezo-plbev item 2: the life-event/season candidate query is a SEPARATE honest layer from
    // the fact candidates above (its own 404 semantics, its own failure) — a working fact half
    // must keep rendering even when this one errors, so it gets its own isError/refetch pair
    // rather than being folded into the fact-side `isError`.
    isLifeEventsError,
    refetchLifeEvents,
    decideFact,
    decideLifeEvent,
    toggleFact: toggleFactM,
  }
}
