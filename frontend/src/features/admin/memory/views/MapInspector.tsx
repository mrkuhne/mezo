import { Link } from 'react-router-dom'
import type { AdminMemoryNeighbor, AdminMemoryVectorItem } from '@/data/admin/adminMemoryApi'
import { InspectorRow, InspectorSection, sourceLink } from '@/features/admin/memory/MemoryInspector'

// Térkép — point inspector body (mezo-4qyt.5, Step 5.5). Reuses InspectorRow/InspectorSection
// and the sourceLink helper from the shared MemoryInspector, same as the Gráf view's inspector.
//
// The neighbour list is labelled "valódi vektor-közelség (pgvector)" and carries its own caveat:
// screen distance on the 2D UMAP fold is NOT the same thing as the real 768-dim cosine distance
// pgvector computed it from — the two are allowed to disagree, and the surface must say so
// rather than imply the map IS the similarity.

function shortId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id
}

export function MapPointInspectorBody({
  item,
  neighbors,
  neighborsPending,
}: {
  item: AdminMemoryVectorItem
  neighbors: AdminMemoryNeighbor[]
  neighborsPending: boolean
}) {
  const link = sourceLink(item.sourceKind, item.sourceId)
  return (
    <>
      <InspectorRow label="sourceKind" value={item.sourceKind} />
      <InspectorRow label="occurredOn" value={item.occurredOn} />
      <InspectorRow label="salience" value={item.salience.toFixed(2)} />
      <InspectorRow label="state" value={item.state} />
      <InspectorSection label="Tartalom">{item.snippet}</InspectorSection>
      <InspectorSection label="Forrás">
        {link ? (
          <Link className="ad-fk" to={link}>Megnyitás az adatböngészőben →</Link>
        ) : (
          <span className="ad-mut">{item.sourceKind} · {shortId(item.itemId)}</span>
        )}
      </InspectorSection>
      <InspectorSection label={`${neighbors.length} valódi szomszéd (pgvector, valódi vektor-közelség)`}>
        {neighborsPending ? (
          <span className="ad-mut">Betöltés…</span>
        ) : neighbors.length === 0 ? (
          <span className="ad-mut">nincs szomszéd</span>
        ) : (
          <div style={{ display: 'grid', gap: 2 }}>
            {neighbors.map((n) => (
              <div key={n.itemId} className="row">
                <span className="k">{n.snippet}</span>
                <span className="v">{n.similarity.toFixed(3)}</span>
              </div>
            ))}
          </div>
        )}
      </InspectorSection>
      <div className="ad-note9" style={{ fontSize: 9.5, color: '#A2958A', marginTop: 8 }}>
        A térképen látott távolság a 2D-re hajtogatott vetület; ezek a szomszédok a teljes
        768 dimenzióban a legközelebbiek — a kettő szándékosan nem feltétlenül ugyanaz.
      </div>
    </>
  )
}
