// ============================================================
// Mezo · KategoriakView (mezo-ms9a, task 7) — the Tudásgráf kind-chain
// (KindTileGrid ⇄ KindNodeList) moved one level in as the Tudástár's
// `?view=kategoriak` view. `kind` is derived by the shell from `?kind=`,
// validated against GRAPH_KIND_GROUPS — an invalid value already reads as
// `null` there (spec §3.3), so this component only renders the two states.
// It owns no URL/back logic itself: mezo-ni86's one-back-affordance idiom
// keeps the return chip in the shell's TudasFrame page-head (`‹ Kategóriák`),
// not a second chip in the body.
// ============================================================
import { KindTileGrid } from './KindTileGrid'
import { KindNodeList } from './KindNodeList'
import { GRAPH_KIND_GROUPS } from '@/data/insights/graph'
import type { GraphNodeKind, KnowledgeGraphNode } from '@/data/types'

const KIND_LABELS = new Map(GRAPH_KIND_GROUPS)

export function KategoriakView({ nodes, kind, onOpenKind, onOpenNode }: {
  nodes: KnowledgeGraphNode[]
  kind: GraphNodeKind | null
  onOpenKind: (kind: GraphNodeKind) => void
  onOpenNode: (node: KnowledgeGraphNode) => void
}) {
  if (kind === null) {
    return <KindTileGrid nodes={nodes} onOpenKind={onOpenKind} />
  }
  return (
    <KindNodeList
      kind={kind}
      label={KIND_LABELS.get(kind)!}
      nodes={nodes.filter((n) => n.kind === kind)}
      onOpenNode={onOpenNode}
    />
  )
}
