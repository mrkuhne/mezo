import { ClayIcon } from '@/shared/ui/clay'
import type { KnowledgeGraphNode } from '@/data/types'

/** W4.3 (mezo-b3pp.17): the pragmatic profile — what the companion has learned about HOW to talk
 *  to Daniel, shown read-only. Archiving is the explicit "felejtsd el, amit rólam gondolsz" lever:
 *  the `[Rólad tanultam]` prompt block empties until the next weekly run rebuilds it.
 *  Mozaik re-face (mezo-d20.6.7) — prototype en-body #page-tudas' uncolored predtile;
 *  reuses .mz-facttile/.mz-fic/.mz-decbtn verbatim (mezo-d20.5.5). */
export function ProfileNodeCard({ node, onArchive }: {
  node: KnowledgeGraphNode
  onArchive: () => void
}) {
  return (
    <div data-profile-node-card className="mz-facttile">
      <div className="mz-fic"><ClayIcon name="i-checkin" size={20} /></div>
      <div className="mz-fact-grow">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <b style={{ fontSize: 13, fontWeight: 700 }}>{node.title}</b>
          <button type="button" className="mz-decbtn" onClick={onArchive}>Archivál</button>
        </div>
        {node.summary && <p className="mz-fact-tx" style={{ marginTop: 6 }}>{node.summary}</p>}
        <p className="mz-fact-origin">Archiválás után a következő heti összegzésig nem kerül a beszélgetésbe.</p>
      </div>
    </div>
  )
}
