import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useKnowledgeGraphActions, useKnowledgeGraphNodes } from '@/data/hooks'
import { GRAPH_KIND_GROUPS } from '@/data/insights/graph'
import { KIND_ICON } from '@/features/me/logic/knowledgeNodeVisuals'
import { MozaikPage, PageHead, PageHero, PageBody } from '@/shared/ui/mozaik'
import { GhostState } from '@/shared/ui/GhostState'

export function KnowledgeNodePage() {
  const { id } = useParams<{ id: string }>()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { nodes, isPending, isError, refetch } = useKnowledgeGraphNodes()
  const { archive, pending } = useKnowledgeGraphActions()
  const node = nodes.find((item) => item.id === id)
  const back = `/mezo/knowledge${params.size ? `?${params}` : '?view=kategoriak'}`
  return <MozaikPage tone="lav">
    <PageHead label="‹ Tudástár" onBack={() => navigate(back)} />
    <PageHero icon={node ? KIND_ICON[node.kind] : 'i-tudas'} name={node?.title ?? 'Tudástár · részlet'} sub={node ? new Map(GRAPH_KIND_GROUPS).get(node.kind) : undefined} />
    <PageBody>
      {isPending ? <GhostState message="A kapcsolat betöltése…" />
        : isError ? <GhostState message="Nem sikerült betölteni a kapcsolatot." ctaLabel="Újra" onCta={refetch} />
        : !node ? <GhostState message="Ez a kapcsolat már nem szerepel az aktív tudástárban." />
        : <article className="mz-qcard col gap-md">
          {node.summary && node.summary.trim() !== node.title.trim() && <p className="mz-fact-tx">{node.summary}</p>}
          {node.topEdges.length > 0 && <><h2 className="mz-eyebrow">Kapcsolatok</h2><ul>{node.topEdges.map((line) => <li key={line} className="mz-fact-sb">{line}</li>)}</ul></>}
          <button type="button" className="mz-decbtn" disabled={pending} onClick={() => archive(node.id)}>Archivál</button>
          <p className="mz-fact-origin">Archiválás után nem kerül a beszélgetésbe. A forrásadataid megmaradnak.</p>
        </article>}
      <Link to={back}>Tudástár · vissza a listához →</Link>
    </PageBody>
  </MozaikPage>
}
