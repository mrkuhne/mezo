import { Link } from 'react-router-dom'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { useKnowledge, useKnowledgeGraphActions, useKnowledgeGraphNodes } from '@/data/hooks'
import { GRAPH_KIND_GROUPS, PROFILE_SOURCE_KIND } from '@/data/insights/graph'
import { CategoryHeader } from '@/features/me/components/CategoryHeader'
import { KnowledgeGraphNodeCard } from '@/features/me/components/KnowledgeGraphNodeCard'
import { ProfileNodeCard } from '@/features/me/components/ProfileNodeCard'

export function KnowledgePage() {
  const { facts, edges, activeCount } = useKnowledge()
  const { nodes } = useKnowledgeGraphNodes()
  const { archive } = useKnowledgeGraphActions()
  const profileNode = nodes.find(n => n.sourceKind === PROFILE_SOURCE_KIND) ?? null
  const graphNodes = nodes.filter(n => n.sourceKind !== PROFILE_SOURCE_KIND)

  return (
    <>
      {/* Header */}
      <div className="pghead-np lav">
        <div>
          <div className="over">Me · Tudás</div>
          <h1>Tudásgráf</h1>
        </div>
      </div>

      {/* Summary band */}
      <div style={{ padding: '0 24px 16px' }}>
        <div
          className="card"
          style={{
            padding: 16,
            position: 'relative',
            overflow: 'hidden',
            background: 'linear-gradient(180deg, var(--wash-lav) 0%, var(--surface-1) 65%)',
          }}
        >
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="col">
              <span className="eyebrow" style={{ color: 'var(--lav-deep)' }}>Élő mindmap · növekvő</span>
              <div style={{ fontFamily: 'var(--ff-display)', fontSize: 22, fontWeight: 600, marginTop: 6, lineHeight: 1.1 }}>
                {`${facts.length} tudás · ${edges.length} kapcsolat`}
              </div>
              <span className="text-secondary" style={{ fontSize: 11, marginTop: 6, lineHeight: 1.45, display: 'block' }}>
                {`${activeCount} aktív a prompt kontextusban · ${facts.length - activeCount} stabilizált vagy archiv`}
              </span>
            </div>
          </div>
          <Link
            to="/insights/knowledge"
            className="eyebrow"
            style={{ color: 'var(--lav-deep)', display: 'block', marginTop: 12, textDecoration: 'none' }}
          >
            Tények kezelése → Tudástár
          </Link>
        </div>
      </div>

      {/* Pragmatic profile (W4.3, mezo-b3pp.17) — the card itself carries the "Rólad tanultam"
          title, so the section eyebrow uses a distinct label to avoid rendering it twice. */}
      {profileNode && (
        <div style={{ padding: '0 24px 32px' }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
            <Eyebrow>Profil</Eyebrow>
          </div>
          <ProfileNodeCard node={profileNode} onArchive={() => archive(profileNode.id)} />
        </div>
      )}

      {/* Graph connections (W2.6, mezo-b3pp.11) */}
      {graphNodes.length > 0 && (
        <div style={{ padding: '0 24px 32px' }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
            <Eyebrow>Kapcsolatok</Eyebrow>
            <span className="eyebrow" style={{ color: 'var(--lav-deep)' }}>{graphNodes.length}</span>
          </div>
          <div className="col gap-md">
            {GRAPH_KIND_GROUPS.map(([kind, label]) => {
              const items = graphNodes.filter(n => n.kind === kind)
              if (items.length === 0) return null
              return (
                <div key={kind}>
                  <CategoryHeader label={label} color="var(--lav-deep)" count={items.length} />
                  <div className="col gap-xs">
                    {items.map(n => (
                      <KnowledgeGraphNodeCard key={n.id} node={n} onArchive={() => archive(n.id)} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
