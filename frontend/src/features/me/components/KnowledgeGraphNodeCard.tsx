import { ClayIcon } from '@/shared/ui/clay'
import { KIND_ICON, KIND_WASH } from '@/features/me/logic/knowledgeNodeVisuals'
import type { KnowledgeGraphNode } from '@/data/types'

/** One active knowledge-graph node in the Tudástár "Kapcsolatok" section (W2.6, mezo-b3pp.11) —
 *  Mozaik re-face (mezo-d20.6.7): a per-kind washed .mz-facttile with a clay icon disc, the
 *  backend-rendered `topEdges` lines, and the L2 archive action (.mz-decbtn, mezo-d20.5.5). */
export function KnowledgeGraphNodeCard({ node, onArchive }: {
  node: KnowledgeGraphNode
  onArchive: () => void
}) {
  return (
    <div data-graph-node-card className={`mz-facttile mz-w-${KIND_WASH[node.kind]}`}>
      <div className="mz-fic"><ClayIcon name={KIND_ICON[node.kind]} size={20} /></div>
      <div className="mz-fact-grow">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <span className="mz-fact-tx">{node.title}</span>
          <button type="button" className="mz-decbtn" onClick={onArchive}>Archivál</button>
        </div>
        {node.summary && <p className="mz-fact-origin" style={{ marginTop: 4 }}>{node.summary}</p>}
        {node.topEdges.length > 0 && (
          <ul style={{ margin: '6px 0 0', padding: 0, listStyle: 'none' }}>
            {node.topEdges.map((line) => (
              <li key={line} className="mz-fact-sb">{line}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
