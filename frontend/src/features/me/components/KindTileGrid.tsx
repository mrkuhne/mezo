// ============================================================
// Mezo · KindTileGrid (mezo-2243) — the Tudásgráf overview: one Mozaik tile per
// graph-node kind (GRAPH_KIND_GROUPS order) with the node count and the first
// node's title as a sample line. Empty kinds stay IN the grid, dimmed and inert
// — the mosaic never reflows when a new kind gains its first node. The wire
// model carries no timestamps, so the sample is "first in hook order", not
// "latest" (spec §1). Scroll problem this solves: the old flat card lists grew
// linearly with node count; this grid is constant-height.
// ============================================================
import { Mosaic, Tile } from '@/shared/ui/mozaik'
import { GRAPH_KIND_GROUPS } from '@/data/insights/graph'
import { KIND_ICON, KIND_WASH } from '@/features/me/logic/knowledgeNodeVisuals'
import type { GraphNodeKind, KnowledgeGraphNode } from '@/data/types'

export function KindTileGrid({ nodes, onOpenKind, baseDelayMs = 90 }: {
  nodes: KnowledgeGraphNode[]
  onOpenKind: (kind: GraphNodeKind) => void
  baseDelayMs?: number
}) {
  return (
    <Mosaic>
      {GRAPH_KIND_GROUPS.map(([kind, label], i) => {
        const items = nodes.filter(n => n.kind === kind)
        const delay = baseDelayMs + i * 30
        if (items.length === 0) {
          // Dimmed, inert placeholder — the grid never reflows when a kind
          // gains its first node. Tile has no style prop, hence the wrapper.
          return (
            <div key={kind} className="tud-kind-empty" style={{ opacity: 0.45 }}>
              <Tile wash={KIND_WASH[kind]} icon={KIND_ICON[kind]} iconSize={38}
                eyebrow={label} line="—" delayMs={delay} />
            </div>
          )
        }
        return (
          <Tile key={kind} wash={KIND_WASH[kind]} icon={KIND_ICON[kind]} iconSize={38}
            eyebrow={label} badge={items.length} line={items[0].title}
            delayMs={delay} onClick={() => onOpenKind(kind)} />
        )
      })}
    </Mosaic>
  )
}
