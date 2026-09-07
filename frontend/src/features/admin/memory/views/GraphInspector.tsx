import type { AdminMemoryGraphEdge, AdminMemoryGraphNode, AdminMemoryGraphResponse } from '@/data/admin/adminMemoryApi'
import { InspectorRow, InspectorSection, sourceLink } from '@/features/admin/memory/MemoryInspector'
import { JsonCell } from '@/features/admin/components/JsonCell'
import { Link } from 'react-router-dom'

// Gráf (mezo-4qyt.4, Step 4.3) — node/edge inspector bodies. Reuses InspectorRow/InspectorSection
// and the sourceLink helper from part 1's shared MemoryInspector so the "unmapped kind renders
// plain text, never a broken link" rule stays in one place.

function shortId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

function daysBetween(from: string, to: number = Date.now()): number {
  return Math.max(0, Math.round((to - new Date(from).getTime()) / MS_PER_DAY))
}

/**
 * created → last reinforced span, plus — from decayFactor/pruneBelow/weight, all server-supplied
 * — an ESTIMATED "~N nap múlva kiesik, ha nem erősödik meg"
 * (log(pruneBelow / weight) / log(decayFactor)), clamped and labelled becsült.
 *
 * mezo edges have no invalidation semantics (unlike Graphiti/Zep's valid/invalid interval), so
 * this is a DECAY story, not a validity one: the nightly job multiplies every weight by
 * decayFactor and prunes below pruneBelow, so an edge that has not been reinforced lately is
 * fading, not wrong.
 */
export function ValidityBar({
  createdAt,
  lastReinforcedAt,
  decayFactor,
  pruneBelow,
  weight,
}: {
  createdAt: string
  lastReinforcedAt?: string | null
  decayFactor: number
  pruneBelow: number
  weight: number
}) {
  const createdDays = daysBetween(createdAt)
  const daysUntilPrune = weight > pruneBelow && decayFactor > 0 && decayFactor < 1
    ? Math.max(0, Math.round(Math.log(pruneBelow / weight) / Math.log(decayFactor)))
    : 0
  // The fill bar reads how far the edge's live weight already is towards the prune floor —
  // 0% at weight 1, 100% at weight === pruneBelow (or below).
  const fillPct = Math.max(0, Math.min(100, Math.round((1 - (weight - pruneBelow) / Math.max(0.0001, 1 - pruneBelow)) * 100)))

  return (
    <div className="am-validity">
      <div className="track"><div className="fill" style={{ width: `${fillPct}%` }} /></div>
      <div className="lbls">
        <span>létrehozva · {createdDays} napja</span>
        <span>
          {weight <= pruneBelow
            ? 'a küszöb alatt — a következő futáskor törlődik'
            : <>~{daysUntilPrune} nap múlva kiesik <em>(becsült)</em></>}
        </span>
      </div>
      {lastReinforcedAt && (
        <div className="ad-mut" style={{ fontSize: 10, marginTop: 4 }}>
          utoljára megerősítve · {daysBetween(lastReinforcedAt)} napja
        </div>
      )}
    </div>
  )
}

export function GraphNodeInspectorBody({
  node,
  graph,
  onSelectEdge,
}: {
  node: AdminMemoryGraphNode
  graph: AdminMemoryGraphResponse
  onSelectEdge: (edgeId: string) => void
}) {
  const inEdges = graph.edges.filter((e) => e.to === node.id && !e.deleted)
  const outEdges = graph.edges.filter((e) => e.from === node.id && !e.deleted)
  const link = sourceLink(node.sourceKind, node.sourceId)

  return (
    <>
      <InspectorRow label="kind" value={node.kind} />
      <InspectorRow label="status" value={node.status} />
      {node.occurredOn && <InspectorRow label="occurredOn" value={node.occurredOn} />}
      <InspectorRow label="fok (degree)" value={node.degree ?? 0} />
      {node.deleted && <InspectorRow label="törölve" value="igen" />}
      {node.summary && <InspectorSection label="Összegzés">{node.summary}</InspectorSection>}
      <InspectorSection label="meta">
        <JsonCell value={node.meta} />
      </InspectorSection>
      <InspectorSection label="Forrás">
        {link ? (
          <Link className="ad-fk" to={link}>Megnyitás az adatböngészőben →</Link>
        ) : (
          <span className="ad-mut">{node.sourceKind ?? '—'} · {node.sourceId ? shortId(node.sourceId) : '—'}</span>
        )}
      </InspectorSection>
      <InspectorSection label={`Be-élek (${inEdges.length})`}>
        {inEdges.length === 0 ? <span className="ad-mut">nincs</span> : (
          <div style={{ display: 'grid', gap: 4 }}>
            {inEdges.map((e) => (
              <button key={e.id} type="button" className="ad-fk" style={{ textAlign: 'left' }} onClick={() => onSelectEdge(e.id)}>
                {e.kind} ← {shortId(e.from)}
              </button>
            ))}
          </div>
        )}
      </InspectorSection>
      <InspectorSection label={`Ki-élek (${outEdges.length})`}>
        {outEdges.length === 0 ? <span className="ad-mut">nincs</span> : (
          <div style={{ display: 'grid', gap: 4 }}>
            {outEdges.map((e) => (
              <button key={e.id} type="button" className="ad-fk" style={{ textAlign: 'left' }} onClick={() => onSelectEdge(e.id)}>
                {e.kind} → {shortId(e.to)}
              </button>
            ))}
          </div>
        )}
      </InspectorSection>
    </>
  )
}

export function GraphEdgeInspectorBody({
  edge,
  graph,
  fromRun,
}: {
  edge: AdminMemoryGraphEdge
  graph: AdminMemoryGraphResponse
  fromRun: boolean
}) {
  return (
    <>
      <InspectorRow label="kind" value={edge.kind} />
      <InspectorRow label="weight" value={edge.weight.toFixed(3)} />
      {edge.lastReinforcedAt && <InspectorRow label="lastReinforcedAt" value={edge.lastReinforcedAt} />}
      {edge.deleted && <InspectorRow label="törölve" value="igen" />}
      <ValidityBar
        createdAt={edge.createdAt}
        lastReinforcedAt={edge.lastReinforcedAt}
        decayFactor={graph.decayFactor}
        pruneBelow={graph.pruneBelow}
        weight={edge.weight}
      />
      <InspectorSection label="Evidencia">
        {!edge.evidence || edge.evidence.length === 0 ? (
          <span className="ad-mut">nincs evidencia</span>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {edge.evidence.map((ev, i) => {
              const link = sourceLink(ev.sourceKind, ev.sourceId)
              return (
                <div key={`${ev.sourceKind}-${ev.sourceId}-${i}`}>
                  • {ev.at ? `${ev.at.slice(0, 10)} ` : ''}
                  {ev.note ?? `${ev.sourceKind} · ${shortId(ev.sourceId)}`}
                  {' '}
                  {link ? <Link className="ad-fk" to={link}>forrás →</Link> : <span className="ad-mut">({ev.sourceKind})</span>}
                </div>
              )
            })}
          </div>
        )}
      </InspectorSection>
      <div className="ad-note9" style={{ fontSize: 9.5, color: '#A2958A', marginTop: 8 }}>
        A mezo-élekben nincs érvényességi intervallum — ez egy bomlási sáv: az éjszakai job súlya{' '}
        <code style={{ fontFamily: 'ui-monospace,monospace' }}>×{graph.decayFactor}</code>,{' '}
        {graph.pruneBelow} alatt törlődik.
      </div>
      {fromRun && (
        <div className="am-caveat" style={{ marginTop: 8 }}>
          A futásban tárolt él-súly a futás pillanatáé; itt a mai, éjszakai gyengülés utáni súly látszik.
        </div>
      )}
    </>
  )
}
