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
import { CategoryHeader } from './CategoryHeader'
import { Icon3D } from '@/shared/ui/clay'
import { KIND_3D, KIND_ACCENT } from '@/features/me/logic/knowledgeNodeVisuals'
import type { GraphNodeKind, KnowledgeGraphNode } from '@/data/types'

export function KindNodeList({ kind, label, nodes, onOpenNode }: {
  kind: GraphNodeKind
  label: string
  nodes: KnowledgeGraphNode[]
  onOpenNode: (node: KnowledgeGraphNode) => void
}) {
  // Üveg (U9 · mezo-me75u.9): the category header + ONE flat `tf-tlist` of compact rows.
  return (
    <div className="tud9-kindlist" style={{ '--c': KIND_ACCENT[kind] } as React.CSSProperties}>
      <div className="rise" style={{ '--d': '40ms' } as React.CSSProperties}>
        <CategoryHeader label={label} color={KIND_ACCENT[kind]} count={nodes.length} />
      </div>
      <div className="tf-tlist rise" style={{ '--d': '60ms' } as React.CSSProperties}>
        {nodes.map((n) => (
          <button
            key={n.id}
            type="button"
            data-kind-node-row
            className="tf-trow tud9-noderow"
            onClick={() => onOpenNode(n)}
          >
            <Icon3D name={KIND_3D[kind]} size={24} />
            <span className="tf-ttx">
              <span className="tf-ttitle">{n.title}</span>
              {n.topEdges.length > 0 && <span className="tf-tsub">{n.topEdges.length} kapcsolat</span>}
            </span>
            <span className="tud9-chev" aria-hidden="true">›</span>
          </button>
        ))}
      </div>
    </div>
  )
}
