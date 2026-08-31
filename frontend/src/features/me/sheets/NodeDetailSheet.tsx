// ============================================================
// Mezo · NodeDetailSheet (mezo-2243) — the Tudásgráf node detail: the compact
// category rows carry only icon+title, so the summary, the backend-rendered HU
// edge lines and the L2 archive action live here. Riding the shared Sheet keeps
// dismissal identical to every other bottom sheet. The opener owns the data
// layer (`archive`) and wires it into `onArchive` — no `@/data/*` action import.
// Design: docs/superpowers/specs/2026-08-31-tudasgraf-page-redesign-design.md §3.
// ============================================================
import { Sheet } from '@/shared/ui/Sheet'
import { ClayIcon } from '@/shared/ui/clay'
import { KIND_ICON } from '@/features/me/logic/knowledgeNodeVisuals'
import type { KnowledgeGraphNode } from '@/data/types'

export function NodeDetailSheet({ node, onArchive, onClose }: {
  node: KnowledgeGraphNode
  onArchive: () => void
  onClose: () => void
}) {
  return (
    <Sheet onClose={onClose} labelledBy="node-detail-title">
      {(close) => (
        <div className="col" style={{ padding: '4px 4px 8px' }}>
          <div className="row" style={{ gap: 10, alignItems: 'center' }}>
            <div className="mz-fic"><ClayIcon name={KIND_ICON[node.kind]} size={20} /></div>
            <h2 id="node-detail-title" className="h-display size-md">{node.title}</h2>
          </div>
          {node.summary && (
            <p className="mz-fact-tx" style={{ marginTop: 10 }}>{node.summary}</p>
          )}
          {node.topEdges.length > 0 && (
            <ul style={{ margin: '10px 0 0', padding: 0, listStyle: 'none' }}>
              {node.topEdges.map((line) => (
                <li key={line} className="mz-fact-sb">{line}</li>
              ))}
            </ul>
          )}
          <button
            type="button"
            className="mz-decbtn"
            style={{ marginTop: 16, alignSelf: 'flex-start' }}
            onClick={() => { onArchive(); close() }}
          >
            Archivál
          </button>
          <p className="mz-fact-origin" style={{ marginTop: 8 }}>
            Archiválás után a következő heti összegzésig nem kerül a beszélgetésbe.
          </p>
        </div>
      )}
    </Sheet>
  )
}
