// ============================================================
// Mezo · KnowledgePage — Tudás re-face (mezo-d20.6.7)
// Source of truth: docs/design_2.0/prototypes/src/en-body.html #page-tudas
// (values ×1.18). Still a MeSection tab child (F5.1 hub hasn't landed — the
// old .pghead-np header stays, matching every other /me/* sibling); the
// re-face is scoped to the BODY: the summary tile wears --mz-wash-lav, the
// unboxed .lsec group headers, and the grouped node/profile tiles reuse the
// Tudástár .mz-facttile/.mz-fic/.mz-decbtn recipe (mezo-d20.5.5) with a
// per-kind clay icon + wash (knowledgeNodeVisuals). Archiving a node still
// drives every counter here live (graphNodes.length + each group's count) —
// the same useKnowledgeGraphNodes() cache the mutation already updates; the
// fact-derived summary counts are a SEPARATE honest source and never move.
// ============================================================
import { Link } from 'react-router-dom'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { useKnowledge, useKnowledgeGraphActions, useKnowledgeGraphNodes } from '@/data/hooks'
import { GRAPH_KIND_GROUPS, PROFILE_SOURCE_KIND } from '@/data/insights/graph'
import { KIND_INK } from '@/features/me/logic/knowledgeNodeVisuals'
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

      <EntranceGroup>
        {/* Summary band */}
        <div style={{ padding: '0 24px 16px' }}>
          <div className="tud-summary">
            <span className="eyebrow" style={{ color: 'var(--mz-cell-lav-ink)' }}>Élő mindmap · növekvő</span>
            <div style={{ fontFamily: 'var(--ff-display)', fontSize: 22, fontWeight: 600, marginTop: 6, lineHeight: 1.1 }}>
              {`${facts.length} tudás · ${edges.length} kapcsolat`}
            </div>
            <span className="text-secondary" style={{ fontSize: 11, marginTop: 6, lineHeight: 1.45, display: 'block' }}>
              {`${activeCount} aktív a prompt kontextusban · ${facts.length - activeCount} stabilizált vagy archiv`}
            </span>
            <Link to="/mezo/knowledge" className="tud-summary-link">
              Tények kezelése → Tudástár
            </Link>
          </div>
        </div>

        {/* Pragmatic profile (W4.3, mezo-b3pp.17) — the card itself carries the "Rólad tanultam"
            title, so the section eyebrow uses a distinct label to avoid rendering it twice. */}
        {profileNode && (
          <div style={{ padding: '0 24px 24px' }}>
            <div className="tud-lsec"><Eyebrow>Profil</Eyebrow></div>
            <ProfileNodeCard node={profileNode} onArchive={() => archive(profileNode.id)} />
          </div>
        )}

        {/* Graph connections (W2.6, mezo-b3pp.11) */}
        {graphNodes.length > 0 && (
          <div style={{ padding: '0 24px 24px' }}>
            <div className="tud-lsec">
              <Eyebrow>Kapcsolatok</Eyebrow>
              <span className="tud-cnt">{graphNodes.length}</span>
            </div>
            <div className="col gap-md">
              {GRAPH_KIND_GROUPS.map(([kind, label]) => {
                const items = graphNodes.filter(n => n.kind === kind)
                if (items.length === 0) return null
                return (
                  <div key={kind}>
                    <CategoryHeader label={label} color={KIND_INK[kind]} count={items.length} />
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
      </EntranceGroup>
    </>
  )
}
