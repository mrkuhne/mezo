import type { KnowledgeGraphNode } from '@/data/types'

/** One active knowledge-graph node in the Tudástár "Kapcsolatok" section (W2.6, mezo-b3pp.11) —
 *  the `KnowledgeFactCard` Napiv row-card idiom (flat surface, no left accent bar), plus the
 *  backend-rendered `topEdges` lines and an L2 archive action. */
export function KnowledgeGraphNodeCard({ node, onArchive }: {
  node: KnowledgeGraphNode
  onArchive: () => void
}) {
  return (
    <div
      data-graph-node-card
      style={{ background: 'var(--surface)', borderRadius: 16, boxShadow: 'var(--np-shadow-row)', padding: 10 }}
    >
      <div className="row" style={{ alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.4, flex: 1 }}>{node.title}</span>
        <button
          type="button"
          className="chip"
          onClick={onArchive}
          style={{ fontSize: 10, color: 'var(--text-tertiary)', flexShrink: 0 }}
        >
          Archivál
        </button>
      </div>
      {node.summary && (
        <p className="text-secondary" style={{ fontSize: 11, lineHeight: 1.5, margin: '6px 0 0' }}>
          {node.summary}
        </p>
      )}
      {node.topEdges.length > 0 && (
        <ul style={{ margin: '6px 0 0', padding: 0, listStyle: 'none' }}>
          {node.topEdges.map((line) => (
            <li key={line} className="text-tertiary" style={{ fontSize: 11, lineHeight: 1.6 }}>
              {line}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
