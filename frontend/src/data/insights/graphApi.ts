import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'
import type { KnowledgeGraphNode, LifeEventCandidate, LifeEventDecision } from '@/data/types'

export type GraphNodeResponse = components['schemas']['GraphNodeResponse']
export type GraphCandidateDecisionRequest = components['schemas']['GraphCandidateDecisionRequest']
export type GraphEdgeCountResponse = components['schemas']['GraphEdgeCountResponse']

const NODE = '/api/companion/graph/node'
const EDGE = '/api/companion/graph/edge'

/** Edit-then-approve fields on a candidate accept (mezo-ms9a) — omitted (undefined) means "keep
 *  the candidate's own title/summary", never an empty-string overwrite. */
export interface RefinedCandidate { title?: string; summary?: string }

/** Wire → FE domain (W2.3): only the fields the L2 inbox card needs. */
export function toLifeEventCandidate(n: GraphNodeResponse): LifeEventCandidate {
  return {
    id: n.id,
    // A backend enum hat kind-ot ismer, de az L2 inboxba csak ez a kettő kerülhet (W2.3 + W5.3);
    // bármi más ismeretlen jelölt volna, amire nincs őszinte copy — LIFE_EVENT a biztonságos default.
    kind: n.kind === 'SEASON' ? 'SEASON' : 'LIFE_EVENT',
    title: n.title,
    summary: n.summary ?? null,
    occurredOn: n.occurredOn ?? null,
    proposedEdgeCount: n.proposedEdgeCount ?? 0,
  }
}

/** Wire → FE domain (W2.6): the Tudástár "Kapcsolatok" card shape. */
export function toKnowledgeGraphNode(n: GraphNodeResponse): KnowledgeGraphNode {
  return {
    id: n.id,
    kind: n.kind,
    title: n.title,
    summary: n.summary ?? null,
    topEdges: n.topEdges ?? [],
    sourceKind: n.sourceKind ?? null,
    updatedAt: n.updatedAt,
  }
}

export const graphApi = {
  listCandidates: async () =>
    (await apiFetch<GraphNodeResponse[]>(`${NODE}/candidate`)).map(toLifeEventCandidate),
  decideCandidate: (id: string, decision: LifeEventDecision, refined?: RefinedCandidate) =>
    apiFetch<GraphNodeResponse>(`${NODE}/${id}/decision`, {
      method: 'POST',
      body: JSON.stringify({
        decision,
        refinedTitle: refined?.title,
        refinedSummary: refined?.summary,
      } satisfies GraphCandidateDecisionRequest),
    }),
  listNodes: async () => (await apiFetch<GraphNodeResponse[]>(NODE)).map(toKnowledgeGraphNode),
  archiveNode: (id: string) => apiFetch<GraphNodeResponse>(`${NODE}/${id}/archive`, { method: 'POST' }),
  edgeCount: () => apiFetch<GraphEdgeCountResponse>(`${EDGE}/count`),
}
