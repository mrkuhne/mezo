import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useDualQuery } from '@/data/useDualQuery'
import { isMockMode } from '@/data/_client/mode'
import { ApiError } from '@/data/_client/api'
import { graphApi, type RefinedCandidate } from '@/data/insights/graphApi'
import { lifeEventCandidateSeed, graphNodeSeed } from '@/data/insights/graph'
import { edges as edgeSeed } from '@/data/insights/knowledge'
import type { KnowledgeGraphNode, LifeEventCandidate, LifeEventDecision } from '@/data/types'

const GRAPH_CANDIDATE_KEY = ['graph', 'candidates'] as const
const GRAPH_NODE_KEY = ['graph', 'nodes'] as const
const GRAPH_EDGE_COUNT_KEY = ['graph', 'edgeCount'] as const

/** DESC-by-`updatedAt` — newest-touched node first (mezo-ms9a). ISO strings sort lexicographically. */
function byUpdatedAtDesc(nodes: KnowledgeGraphNode[]): KnowledgeGraphNode[] {
  return [...nodes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

/**
 * W2.3 életesemény-jelöltek (L2 inbox). A gráf-kapcsoló FÜGGETLEN a társ-kapcsolótól, ezért a
 * 404 itt nem „degraded" állapot, hanem őszinte üres lista: a Tudástár többi része ilyenkor is
 * teljes értékű marad (IDENT-3 — a hiányzó réteg nem törhet el egy működő oldalt).
 */
export function useLifeEventCandidates() {
  const { data, isPending, isError, refetch } = useDualQuery<LifeEventCandidate[]>({
    queryKey: GRAPH_CANDIDATE_KEY,
    mockData: lifeEventCandidateSeed,
    realFetch: async () => {
      try {
        return await graphApi.listCandidates()
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return []
        throw err
      }
    },
    realEmpty: [],
  })
  return { candidates: data, isPending, isError, refetch }
}

/** Elfogad → aktív csomópont + a javasolt kapcsolatok; Elvet → nyom nélkül eltűnik. `refined`
 *  (mezo-ms9a) az edit-then-approve cím/összefoglaló felülírás — csak accept mellett van
 *  értelme, reject-nél figyelmen kívül marad. */
export function useLifeEventActions() {
  const qc = useQueryClient()
  const mock = isMockMode()

  const decideM = useMutation({
    mutationFn: async (input: { id: string; decision: LifeEventDecision; refined?: RefinedCandidate }) => {
      if (mock) {
        mockDecide(qc, input.id, input.decision, input.refined)
        return
      }
      await graphApi.decideCandidate(input.id, input.decision, input.refined)
    },
    onSuccess: mock ? undefined : () => qc.invalidateQueries({ queryKey: GRAPH_CANDIDATE_KEY }),
  })

  return {
    decide: (id: string, decision: LifeEventDecision, refined?: RefinedCandidate) =>
      decideM.mutate({ id, decision, refined }),
    pending: decideM.isPending,
  }
}

/** Elvetve nyom nélkül eltűnik a jelölt-listáról. Elfogadva ugyanúgy lekerül a jelölt-listáról,
 *  DE ALSO belép a csomópont-cache-be (mezo-ms9a) — a `refined` cím/összefoglaló felülírja a
 *  jelölt eredeti szövegét, ha adott. */
function mockDecide(
  qc: QueryClient,
  id: string,
  decision: LifeEventDecision,
  refined?: RefinedCandidate,
) {
  const candidates = qc.getQueryData<LifeEventCandidate[]>(GRAPH_CANDIDATE_KEY) ?? lifeEventCandidateSeed
  const candidate = candidates.find((c) => c.id === id)

  qc.setQueryData<LifeEventCandidate[]>(GRAPH_CANDIDATE_KEY, (old) =>
    (old ?? lifeEventCandidateSeed).filter((c) => c.id !== id))

  if (decision !== 'accept' || !candidate) return

  const promoted: KnowledgeGraphNode = {
    id: candidate.id,
    kind: candidate.kind,
    title: refined?.title ?? candidate.title,
    summary: refined?.summary ?? candidate.summary,
    topEdges: [],
    sourceKind: null,
    updatedAt: new Date().toISOString(),
  }
  qc.setQueryData<KnowledgeGraphNode[]>(GRAPH_NODE_KEY, (old) => [promoted, ...(old ?? graphNodeSeed)])
}

/**
 * W2.6 (mezo-b3pp.11): active knowledge-graph nodes for the Tudástár "Kapcsolatok" section. The
 * graph switch is independent of the companion switch, so a 404 here (graph off) is an honest
 * empty list, not `degraded` — the `useLifeEventCandidates` idiom.
 */
export function useKnowledgeGraphNodes() {
  const { data, isPending, isError, refetch } = useDualQuery<KnowledgeGraphNode[]>({
    queryKey: GRAPH_NODE_KEY,
    mockData: graphNodeSeed,
    realFetch: async () => {
      try {
        return await graphApi.listNodes()
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return []
        throw err
      }
    },
    realEmpty: [],
  })
  return { nodes: byUpdatedAtDesc(data), isPending, isError, refetch }
}

/**
 * W-tudastar-egyben (mezo-ms9a): the hero's "N kapcsolat" segment — the active-edge count
 * between active nodes. Independent of both the companion AND the graph node switches, so any
 * failure (404, network, still pending) reads as `null`, never a fabricated 0 — the hero simply
 * omits the segment rather than lying about having zero edges.
 */
export function useGraphEdgeCount(): { count: number | null } {
  const { data } = useDualQuery<number | null>({
    queryKey: GRAPH_EDGE_COUNT_KEY,
    mockData: edgeSeed.length,
    realFetch: async () => {
      try {
        return (await graphApi.edgeCount()).count
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null
        throw err
      }
    },
    realEmpty: null,
  })
  return { count: data }
}

/** Archivál egy csomópontot — L2 kontroll, azonnal lekerül az aktív listáról/promptból. */
export function useKnowledgeGraphActions() {
  const qc = useQueryClient()
  const mock = isMockMode()

  const archiveM = useMutation({
    mutationFn: async (id: string) => {
      if (mock) {
        mockArchiveNode(qc, id)
        return
      }
      await graphApi.archiveNode(id)
    },
    onSuccess: mock ? undefined : () => qc.invalidateQueries({ queryKey: GRAPH_NODE_KEY }),
  })

  return {
    archive: (id: string) => archiveM.mutate(id),
    pending: archiveM.isPending,
  }
}

function mockArchiveNode(qc: QueryClient, id: string) {
  qc.setQueryData<KnowledgeGraphNode[]>(GRAPH_NODE_KEY, (old) => (old ?? graphNodeSeed).filter((n) => n.id !== id))
}
