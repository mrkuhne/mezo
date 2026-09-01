// ============================================================
// Mezo · KindNodeList (mezo-2243) — the Tudásgráf category view behind a
// KindTileGrid tile: CategoryHeader + one COMPACT row per node (icon disc,
// title, edge count). Summary/edges/archive moved to the NodeDetailSheet —
// that is what keeps the rows one line tall, so a category stays scannable
// even at dozens of nodes.
//
// mezo-ni86: the in-body „‹ Kategóriák" chip moved up into the page-head
// (KnowledgePage owns it) — a second back button under the summary tile read
// as a different destination than the head chip while doing the same thing.
// ============================================================
import { CategoryHeader } from '@/features/me/components/CategoryHeader'
import { ClayIcon } from '@/shared/ui/clay'
import { KIND_ICON, KIND_INK, KIND_WASH } from '@/features/me/logic/knowledgeNodeVisuals'
import type { GraphNodeKind, KnowledgeGraphNode } from '@/data/types'

export function KindNodeList({ kind, label, nodes, onOpenNode }: {
  kind: GraphNodeKind
  label: string
  nodes: KnowledgeGraphNode[]
  onOpenNode: (node: KnowledgeGraphNode) => void
}) {
  return (
    <div className="col">
      <div className="rise" style={{ '--d': '40ms' } as React.CSSProperties}>
        <CategoryHeader label={label} color={KIND_INK[kind]} count={nodes.length} />
      </div>
      <div className="col gap-xs">
        {nodes.map((n, i) => (
          <button
            key={n.id}
            type="button"
            data-kind-node-row
            className={`mz-facttile mz-w-${KIND_WASH[kind]} rise`}
            style={{ textAlign: 'left', cursor: 'pointer', '--d': `${60 + i * 30}ms` } as React.CSSProperties}
            onClick={() => onOpenNode(n)}
          >
            <div className="mz-fic"><ClayIcon name={KIND_ICON[kind]} size={20} /></div>
            <div className="mz-fact-grow">
              <span className="mz-fact-tx">{n.title}</span>
              {n.topEdges.length > 0 && (
                <span className="mz-fact-sb" style={{ display: 'block', marginTop: 2 }}>
                  {n.topEdges.length} kapcsolat
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
