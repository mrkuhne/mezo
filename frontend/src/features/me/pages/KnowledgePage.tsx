// ============================================================
// Mezo · KnowledgePage — Tudás re-face (mezo-d20.6.7, Mozaik scaffold + motion
// mezo-d20.11). Source of truth: docs/design_2.0/prototypes/src/en-body.html
// #page-tudas (values ×1.18).
//
// ADR 0032: the dissolved Me shell means this page owns its own header — the
// prototype's `‹ Én` back chip — and the prototype's page-hero (i-tudas + the
// fact count + „tudás · N kapcsolat · élő mindmap") replaces the old
// .pghead-np band, which left the page with no way back AND repeated the
// hero's own number inside the summary tile. The summary tile is now the
// prototype's prose line only (active vs. stabilised split + the Tudástár
// pointer), so the count is stated exactly once.
//
// Every direct child of the EntranceGroup now carries `.rise` + its own `--d`
// stagger — the group was armed but had nothing to animate (audit group B).
//
// The Tudástár boundary (mezo-0ap9) is untouched: facts live on Mezo →
// Tudástár, this page owns only how they CONNECT.
// ============================================================
import { Link, useNavigate } from 'react-router-dom'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { MozaikPage, PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { useKnowledge, useKnowledgeGraphActions, useKnowledgeGraphNodes } from '@/data/hooks'
import { GRAPH_KIND_GROUPS, PROFILE_SOURCE_KIND } from '@/data/insights/graph'
import { KIND_INK } from '@/features/me/logic/knowledgeNodeVisuals'
import { CategoryHeader } from '@/features/me/components/CategoryHeader'
import { KnowledgeGraphNodeCard } from '@/features/me/components/KnowledgeGraphNodeCard'
import { ProfileNodeCard } from '@/features/me/components/ProfileNodeCard'

export function KnowledgePage() {
  const navigate = useNavigate()
  const { facts, edges, activeCount } = useKnowledge()
  const { nodes } = useKnowledgeGraphNodes()
  const { archive } = useKnowledgeGraphActions()
  const profileNode = nodes.find(n => n.sourceKind === PROFILE_SOURCE_KIND) ?? null
  const graphNodes = nodes.filter(n => n.sourceKind !== PROFILE_SOURCE_KIND)

  return (
    <MozaikPage tone="lav">
      <PageHead onBack={() => navigate(-1)} label="‹ Én" />

      <PageHero
        icon="i-tudas"
        name="Tudásgráf"
        big={facts.length}
        sub={`tudás · ${edges.length} kapcsolat · élő mindmap`}
      />

      <PageBody>
        <EntranceGroup>
          {/* The prototype's summary tile: the active/stabilised split as prose plus the
              Tudástár pointer. The fact and edge counts themselves belong to the hero above —
              stating them twice on one screen is what the old .pghead-np face did. */}
          <div className="tud-summary rise" style={{ '--d': '0ms' } as React.CSSProperties}>
            <span className="text-secondary" style={{ fontSize: 12, lineHeight: 1.5, display: 'block' }}>
              <b>{activeCount} aktív</b> a prompt kontextusban · {facts.length - activeCount} stabilizált vagy archiv.
            </span>
            <Link to="/mezo/knowledge" className="tud-summary-link">
              A tények kezelése a Mezo → Tudástár oldalon él →
            </Link>
          </div>

          {/* Pragmatic profile (W4.3, mezo-b3pp.17) — the card itself carries the "Rólad tanultam"
              title, so the section eyebrow uses a distinct label to avoid rendering it twice. */}
          {profileNode && (
            <>
              <div className="tud-lsec rise" style={{ '--d': '40ms' } as React.CSSProperties}>
                <Eyebrow>Profil</Eyebrow>
              </div>
              <div className="rise" style={{ '--d': '60ms' } as React.CSSProperties}>
                <ProfileNodeCard node={profileNode} onArchive={() => archive(profileNode.id)} />
              </div>
            </>
          )}

          {/* Graph connections (W2.6, mezo-b3pp.11) */}
          {graphNodes.length > 0 && (
            <>
              <div className="tud-lsec rise" style={{ '--d': '90ms' } as React.CSSProperties}>
                <Eyebrow>Kapcsolatok</Eyebrow>
                <span className="tud-cnt">{graphNodes.length}</span>
              </div>
              <div className="col gap-md">
                {GRAPH_KIND_GROUPS.map(([kind, label], gi) => {
                  const items = graphNodes.filter(n => n.kind === kind)
                  if (items.length === 0) return null
                  return (
                    <div key={kind} className="rise" style={{ '--d': `${110 + gi * 30}ms` } as React.CSSProperties}>
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
            </>
          )}

          <p className="ntf-foot rise" style={{ '--d': '210ms' } as React.CSSProperties}>
            Archiválás után a következő heti összegzésig nem kerül a beszélgetésbe.
          </p>
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}
