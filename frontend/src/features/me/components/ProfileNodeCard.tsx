import type { KnowledgeGraphNode } from '@/data/types'

/** W4.3 (mezo-b3pp.17): the pragmatic profile — what the companion has learned about HOW to talk
 *  to Daniel, shown read-only. Archiving is the explicit "felejtsd el, amit rólam gondolsz" lever:
 *  the `[Rólad tanultam]` prompt block empties until the next weekly run rebuilds it. */
export function ProfileNodeCard({ node, onArchive }: {
  node: KnowledgeGraphNode
  onArchive: () => void
}) {
  return (
    <div
      data-profile-node-card
      style={{
        background: 'var(--surface)',
        borderRadius: 16,
        boxShadow: 'var(--np-shadow-row)',
        padding: 14,
      }}
    >
      <div className="row" style={{ alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
          {node.title}
        </span>
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
        <p className="text-secondary" style={{ fontSize: 12, lineHeight: 1.6, margin: '8px 0 0' }}>
          {node.summary}
        </p>
      )}
      <p className="text-tertiary" style={{ fontSize: 10, lineHeight: 1.5, margin: '8px 0 0' }}>
        Archiválás után a következő heti összegzésig nem kerül a beszélgetésbe.
      </p>
    </div>
  )
}
