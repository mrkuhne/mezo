import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'
import type { FactCandidate, FactCategory, FactDecision, KnowledgeFact } from '@/data/types'

export type KnowledgeFactResponse = components['schemas']['KnowledgeFactResponse']
export type FactCandidateResponse = components['schemas']['FactCandidateResponse']
export type UpdateFactRequest = components['schemas']['UpdateFactRequest']
export type FactDecisionRequest = components['schemas']['FactDecisionRequest']

const FACT = '/api/companion/fact'

/** Wire → FE domain (mock-era shape): factText→text, includeInPrompt→active, reinforcementCount→reinforced. */
export function toKnowledgeFact(f: KnowledgeFactResponse): KnowledgeFact {
  return {
    id: f.id,
    text: f.factText,
    // wire category is a plain string; values come from our own backend CHECK constraint
    category: f.category as FactCategory,
    active: f.includeInPrompt,
    reinforced: f.reinforcementCount,
    patternTitle: f.patternTitle ?? undefined,
  }
}

export function toFactCandidate(c: FactCandidateResponse): FactCandidate {
  return { id: c.id, text: c.candidateText, category: c.category as FactCategory }
}

export const knowledgeApi = {
  listFacts: async () => (await apiFetch<KnowledgeFactResponse[]>(FACT)).map(toKnowledgeFact),
  listCandidates: async () =>
    (await apiFetch<FactCandidateResponse[]>(`${FACT}/candidate`)).map(toFactCandidate),
  toggleFact: (id: string, active: boolean) =>
    apiFetch<KnowledgeFactResponse>(`${FACT}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ includeInPrompt: active } satisfies UpdateFactRequest),
    }),
  decide: (id: string, decision: FactDecision, refinedText?: string) =>
    apiFetch<FactCandidateResponse>(`${FACT}/candidate/${id}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision, refinedText } satisfies FactDecisionRequest),
    }),
}
