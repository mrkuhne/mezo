import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useDualQuery } from '@/data/useDualQuery'
import { isMockMode } from '@/data/_client/mode'
import { ApiError } from '@/data/_client/api'
import { graphApi } from '@/data/insights/graphApi'
import { lifeEventCandidateSeed, graphNodeSeed } from '@/data/insights/graph'
import type { KnowledgeGraphNode, LifeEventCandidate, LifeEventDecision } from '@/data/types'

const GRAPH_CANDIDATE_KEY = ['graph', 'candidates'] as const
const GRAPH_NODE_KEY = ['graph', 'nodes'] as const

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

/** Elfogad → aktív csomópont + a javasolt kapcsolatok; Elvet → nyom nélkül eltűnik. */
export function useLifeEventActions() {
  const qc = useQueryClient()
  const mock = isMockMode()

  const decideM = useMutation({
    mutationFn: async (input: { id: string; decision: LifeEventDecision }) => {
      if (mock) {
        mockDecide(qc, input.id)
        return
      }
      await graphApi.decideCandidate(input.id, input.decision)
    },
    onSuccess: mock ? undefined : () => qc.invalidateQueries({ queryKey: GRAPH_CANDIDATE_KEY }),
  })

  return {
    decide: (id: string, decision: LifeEventDecision) => decideM.mutate({ id, decision }),
    pending: decideM.isPending,
  }
}

/** Mindkét döntés ugyanazt teszi a listával: a jelölt lekerül róla (elfogadva a gráfba került,
 *  elvetve eldobtuk) — mock módban nincs gráf-nézet, ahol az elfogadott megjelenhetne. */
function mockDecide(qc: QueryClient, id: string) {
  qc.setQueryData<LifeEventCandidate[]>(GRAPH_CANDIDATE_KEY, (old) =>
    (old ?? lifeEventCandidateSeed).filter((c) => c.id !== id))
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
  return { nodes: data, isPending, isError, refetch }
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
