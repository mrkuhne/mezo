import type { CSSProperties } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useKnowledgeGraphActions, useKnowledgeGraphNodes } from '@/data/hooks'
import { GRAPH_KIND_GROUPS } from '@/data/insights/graph'
import { KIND_3D, KIND_ACCENT } from '@/features/me/logic/knowledgeNodeVisuals'
import { GhostState } from '@/shared/ui/GhostState'
import { Icon3D } from '@/shared/ui/clay'
import '@/features/insights/boop-world.css'

const KIND_LABELS = new Map(GRAPH_KIND_GROUPS)

/** „A → kiváltja → B · erős" → the relation and its strength, drawn as a row (prototype `evrow`).
 *  A line without a strength suffix stays whole. */
function splitEdge(line: string): [string, string | null] {
  const at = line.lastIndexOf(' · ')
  return at > 0 ? [line.slice(0, at), line.slice(at + 3)] : [line, null]
}

/** Üveg (U9 · mezo-me75u.9): tf-dhead (‹ Tudástár), the kind's 3D icon as a halo hero, ONE glass
 *  case (summary, Kapcsolatok, Archivál), then the way back to the list. */
export function KnowledgeNodePage() {
  const { id } = useParams<{ id: string }>()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { nodes, isPending, isError, refetch } = useKnowledgeGraphNodes()
  const { archive, pending } = useKnowledgeGraphActions()
  const node = nodes.find((item) => item.id === id)
  const back = `/mezo/knowledge${params.size ? `?${params}` : '?view=kategoriak'}`
  const kindLabel = node ? KIND_LABELS.get(node.kind) : undefined
  const accent = node ? KIND_ACCENT[node.kind] : 'var(--dv-lav)'
  return <div className="tud9 tud9-node tf-page" style={{ '--c': accent } as CSSProperties}>
    <div className="tf-dhead">
      <button type="button" className="glass tf-back" aria-label="Vissza: Tudástár" onClick={() => navigate(back)}>‹</button>
      <span className="tf-dtitle">
        <small>{kindLabel ? `${kindLabel} · kapcsolat` : 'Tudástár'}</small>
        <strong>{node?.title ?? 'Tudástár · részlet'}</strong>
      </span>
    </div>
    {node && (
      <div className="tud9-nhero" aria-hidden="true">
        <Icon3D name={KIND_3D[node.kind]} size={76} />
      </div>
    )}
    <div className="tud9-body">
      {isPending ? <GhostState message="A kapcsolat betöltése…" />
        : isError ? <GhostState message="Nem sikerült betölteni a kapcsolatot." ctaLabel="Újra" onCta={refetch} />
        : !node ? <GhostState message="Ez a kapcsolat már nem szerepel az aktív tudástárban." />
        : <div className="tf-rows">
          <article className="glass tf-case tud9-case" style={{ '--c': accent, '--s': accent } as CSSProperties}>
            {kindLabel && <span className="tf-crow"><span className="tf-st">{kindLabel}</span></span>}
            {node.summary && node.summary.trim() !== node.title.trim() && <p className="tud9-summary">{node.summary}</p>}
            {node.topEdges.length > 0 && <>
              <h2 className="tud9-eyebrow">Kapcsolatok</h2>
              <ul className="tud9-edges">{node.topEdges.map((line) => {
                const [rel, strength] = splitEdge(line)
                return <li key={line} data-edge={line}><b>{rel}</b>{strength && <em>{strength}</em>}</li>
              })}</ul>
            </>}
            <div className="tud9-acts is-left">
              <button type="button" className="tud9-btn" disabled={pending} onClick={() => archive(node.id)}>
                <Icon3D name="t-album" size={20} />Archivál
              </button>
            </div>
            <p className="tud9-foot">Archiválás után nem kerül a beszélgetésbe. A forrásadataid megmaradnak.</p>
          </article>
        </div>}
      <Link to={back} className="tud9-flink">Tudástár · vissza a listához →</Link>
    </div>
  </div>
}
