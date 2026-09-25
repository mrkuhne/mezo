// ============================================================
// Mezo · KindTileGrid (mezo-2243) — the Tudásgráf overview: one Mozaik tile per
// graph-node kind (GRAPH_KIND_GROUPS order) with the node count and the first
// node's title as a sample line. Empty kinds stay IN the grid, dimmed and inert
// — the mosaic never reflows when a new kind gains its first node. The wire
// model carries no timestamps, so the sample is "first in hook order", not
// "latest" (spec §1). Scroll problem this solves: the old flat card lists grew
// linearly with node count; this grid is constant-height.
// ============================================================
import type { CSSProperties } from 'react'
import { Icon3D } from '@/shared/ui/clay'
import { GRAPH_KIND_GROUPS } from '@/data/insights/graph'
import { KIND_3D, KIND_ACCENT } from '@/features/me/logic/knowledgeNodeVisuals'
import type { GraphNodeKind, KnowledgeGraphNode } from '@/data/types'

/** Üveg (U9 · mezo-me75u.9): a 2-col grid of glass tiles, one accent per kind, the count
 *  numeral top-right; an empty kind stays in place as a dashed, inert tile (bible §3 rank 4). */
export function KindTileGrid({ nodes, onOpenKind, baseDelayMs = 90 }: {
  nodes: KnowledgeGraphNode[]
  onOpenKind: (kind: GraphNodeKind) => void
  baseDelayMs?: number
}) {
  return (
    <div className="tud9-kinds">
      {GRAPH_KIND_GROUPS.map(([kind, label], i) => {
        const items = nodes.filter(n => n.kind === kind)
        const style = { '--c': KIND_ACCENT[kind], '--d': `${baseDelayMs + i * 30}ms` } as CSSProperties
        if (items.length === 0) {
          // Dimmed, inert placeholder — the grid never reflows when a kind
          // gains its first node.
          return (
            <div key={kind} className="tud9-kind tud9-kind-empty rise" style={style} data-kind={kind}>
              <span className="tud9-kn">0</span>
              <Icon3D name={KIND_3D[kind]} size={48} />
              <b>{label}</b>
              <small>—</small>
            </div>
          )
        }
        return (
          <button
            key={kind} type="button" className="glass tud9-kind rise" style={style} data-kind={kind}
            aria-label={label} onClick={() => onOpenKind(kind)}
          >
            <span className="tud9-kn">{items.length}</span>
            <Icon3D name={KIND_3D[kind]} size={48} />
            <b>{label}</b>
            <small>{items[0].title}</small>
          </button>
        )
      })}
    </div>
  )
}
