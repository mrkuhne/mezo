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
//
// mezo-2243: overview-first switch. The old page listed every graph node in
// one flat, per-kind-grouped card list, which grew linearly with node count
// and scrolled forever. This page now shows a constant-height KindTileGrid
// (one tile per kind, spec §1) as its base view; tapping a tile drills into a
// KindNodeList (compact rows, spec §2) driven by `?kind=`, and tapping a row
// opens a NodeDetailSheet (summary + edges + archive, spec §3) for that node.
// The view switch is pure derived state off the URL/selection — no local
// list mutation to keep in sync.
//
// mezo-ni86: one back affordance per view. The category view's return chip
// now IS the page-head chip („‹ Kategóriák" replaces „‹ Én") instead of a
// second floating chip below the summary — two stacked back buttons read as
// two different destinations when they were one. Clearing the param uses
// replace:true so the grid entry overwrites the ?kind history slot and
// „‹ Én" (navigate(-1)) truly leaves the page.
// ============================================================
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { MozaikPage, PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { useKnowledge, useKnowledgeGraphActions, useKnowledgeGraphNodes } from '@/data/hooks'
import { GRAPH_KIND_GROUPS, PROFILE_SOURCE_KIND } from '@/data/insights/graph'
import { ProfileNodeCard } from '@/features/me/components/ProfileNodeCard'
import { KindTileGrid } from '@/features/me/components/KindTileGrid'
import { KindNodeList } from '@/features/me/components/KindNodeList'
import { NodeDetailSheet } from '@/features/me/sheets/NodeDetailSheet'
import type { GraphNodeKind } from '@/data/types'

const KIND_LABELS = new Map(GRAPH_KIND_GROUPS)

export function KnowledgePage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { facts, edges, activeCount } = useKnowledge()
  const { nodes } = useKnowledgeGraphNodes()
  const { archive } = useKnowledgeGraphActions()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const profileNode = nodes.find(n => n.sourceKind === PROFILE_SOURCE_KIND) ?? null
  const graphNodes = nodes.filter(n => n.sourceKind !== PROFILE_SOURCE_KIND)

  const rawKind = params.get('kind')
  const kind = rawKind && KIND_LABELS.has(rawKind as GraphNodeKind) ? (rawKind as GraphNodeKind) : null
  const selected = selectedId ? graphNodes.find(n => n.id === selectedId) ?? null : null

  return (
    <MozaikPage tone="lav">
      <PageHead
        onBack={kind ? () => setParams({}, { replace: true }) : () => navigate(-1)}
        label={kind ? '‹ Kategóriák' : '‹ Én'}
      />

      <PageHero
        icon="i-tudas"
        name="Tudásgráf"
        big={facts.length}
        sub={`tudás · ${edges.length} kapcsolat · élő mindmap`}
      />

      <PageBody>
        <EntranceGroup replayKey={kind ?? 'grid'}>
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

          {kind === null ? (
            <>
              {/* Pragmatic profile (W4.3, mezo-b3pp.17) — the card itself carries the "Rólad
                  tanultam" title, so the section eyebrow uses a distinct label to avoid
                  rendering it twice. */}
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

              <KindTileGrid nodes={graphNodes} onOpenKind={k => setParams({ kind: k })} />
            </>
          ) : (
            <div>
              <KindNodeList
                kind={kind}
                label={KIND_LABELS.get(kind)!}
                nodes={graphNodes.filter(n => n.kind === kind)}
                onOpenNode={n => setSelectedId(n.id)}
              />
            </div>
          )}

          <p className="ntf-foot rise" style={{ '--d': '210ms' } as React.CSSProperties}>
            Archiválás után a következő heti összegzésig nem kerül a beszélgetésbe.
          </p>
        </EntranceGroup>
      </PageBody>

      {selected && (
        <NodeDetailSheet
          node={selected}
          onArchive={() => archive(selected.id)}
          onClose={() => setSelectedId(null)}
        />
      )}
    </MozaikPage>
  )
}
