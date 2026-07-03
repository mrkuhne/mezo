import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useDualQuery } from '@/data/useDualQuery'
import { isMockMode } from '@/data/_client/mode'
import { ApiError } from '@/data/_client/api'
import { knowledgeApi } from '@/data/insights/knowledgeApi'
import { facts as factSeed, edges as edgeSeed, candidateSeed } from '@/data/insights/knowledge'
import type { FactCandidate, FactDecision, KnowledgeEdge, KnowledgeFact } from '@/data/types'

export interface KnowledgeBootstrap {
  facts: KnowledgeFact[]
  /** V1.2 pending extraction candidates — the L2 confirm inbox. */
  candidates: FactCandidate[]
  /** Graph edges exist only in the mock prototype — real mode is an honest []. */
  edges: KnowledgeEdge[]
  degraded: boolean
  mode: 'mock' | 'live'
}

const KNOWLEDGE_KEY = ['knowledge'] as const
const EMPTY_KNOWLEDGE: KnowledgeBootstrap = {
  facts: [], candidates: [], edges: [], degraded: false, mode: 'live',
}
const MOCK_KNOWLEDGE: KnowledgeBootstrap = {
  facts: factSeed, candidates: candidateSeed, edges: edgeSeed, degraded: false, mode: 'mock',
}

/**
 * Dual-mode knowledge bootstrap: confirmed facts + pending candidates (+ mock-only edges).
 * Real mode maps the companion switch-off 404 to `degraded: true` (IDENT-3, the chatHooks
 * pattern); everything else follows the useDualQuery ghost-guard recipe.
 */
export function useKnowledge() {
  const { data, isPending } = useDualQuery<KnowledgeBootstrap>({
    queryKey: KNOWLEDGE_KEY,
    mockData: MOCK_KNOWLEDGE,
    realFetch: async () => {
      try {
        const [facts, candidates] = await Promise.all([
          knowledgeApi.listFacts(),
          knowledgeApi.listCandidates(),
        ])
        return { facts, candidates, edges: [], degraded: false, mode: 'live' as const }
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return { ...EMPTY_KNOWLEDGE, degraded: true }
        throw err
      }
    },
    realEmpty: EMPTY_KNOWLEDGE,
  })
  return { ...data, activeCount: data.facts.filter((f) => f.active).length, isPending }
}

interface DecideInput { id: string; decision: FactDecision; refinedText?: string }

/**
 * Fact actions: `toggle` (include_in_prompt PATCH) + `decide` (candidate accept/refine/reject).
 * Mock mode mutates the ['knowledge'] cache via setQueryData (the medicationHooks pattern);
 * real mode calls the API and invalidates the bootstrap.
 */
export function useKnowledgeActions() {
  const qc = useQueryClient()
  const mock = isMockMode()

  const invalidate = () => qc.invalidateQueries({ queryKey: KNOWLEDGE_KEY })

  const toggleM = useMutation({
    mutationFn: async (input: { id: string; active: boolean }) => {
      if (mock) {
        mockToggle(qc, input.id, input.active)
        return
      }
      await knowledgeApi.toggleFact(input.id, input.active)
    },
    onSuccess: mock ? undefined : invalidate,
  })
  const decideM = useMutation({
    mutationFn: async (input: DecideInput) => {
      if (mock) {
        mockDecide(qc, input)
        return
      }
      await knowledgeApi.decide(input.id, input.decision, input.refinedText)
    },
    onSuccess: mock ? undefined : invalidate,
  })

  return {
    toggle: (id: string, active: boolean) => toggleM.mutate({ id, active }),
    decide: (id: string, decision: FactDecision, refinedText?: string) =>
      decideM.mutate({ id, decision, refinedText }),
    pending: toggleM.isPending || decideM.isPending,
  }
}

function mockToggle(qc: QueryClient, id: string, active: boolean) {
  qc.setQueryData<KnowledgeBootstrap>(KNOWLEDGE_KEY, (old) => {
    const base = old ?? MOCK_KNOWLEDGE
    return { ...base, facts: base.facts.map((f) => (f.id === id ? { ...f, active } : f)) }
  })
}

function mockDecide(qc: QueryClient, input: DecideInput) {
  qc.setQueryData<KnowledgeBootstrap>(KNOWLEDGE_KEY, (old) => {
    const base = old ?? MOCK_KNOWLEDGE
    const candidate = base.candidates.find((c) => c.id === input.id)
    if (!candidate) return base
    const remaining = base.candidates.filter((c) => c.id !== input.id)
    if (input.decision === 'reject') return { ...base, candidates: remaining }
    const promoted: KnowledgeFact = {
      id: `kf-${candidate.id}`,
      text: input.decision === 'refine' && input.refinedText ? input.refinedText : candidate.text,
      category: candidate.category,
      active: true,
      reinforced: 0,
    }
    return { ...base, candidates: remaining, facts: [promoted, ...base.facts] }
  })
}
