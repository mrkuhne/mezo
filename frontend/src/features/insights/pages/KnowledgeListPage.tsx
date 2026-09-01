import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { GhostState } from '@/shared/ui/GhostState'
import { MozaikPage, PageHead, PageHero, PageBody, type PageTone } from '@/shared/ui/mozaik'
import { EntranceGroup, useCountUp } from '@/shared/ui/mozaik/motion'
import {
  useKnowledge, useKnowledgeActions, useLifeEventCandidates, useLifeEventActions,
  useKnowledgeGraphNodes, useGraphEdgeCount, useKnowledgeGraphActions,
} from '@/data/hooks'
import { PROMPT_TOP_N } from '@/data/insights/knowledge'
import { GRAPH_KIND_GROUPS, PROFILE_SOURCE_KIND } from '@/data/insights/graph'
import { FactsView } from '@/features/insights/components/FactsView'
import { KnowledgeBaseView } from '@/features/insights/components/KnowledgeBaseView'
import { KategoriakView } from '@/features/insights/components/KategoriakView'
import { ProfileView } from '@/features/insights/components/ProfileView'
import { HowItWorksView } from '@/features/insights/components/HowItWorksView'
import { NodeDetailSheet } from '@/features/insights/sheets/NodeDetailSheet'
import { bucketFacts } from '@/features/insights/logic/factCopy'
import type { GraphNodeKind, LifeEventCandidate } from '@/data/types'

/** mezo-ms9a: the unified Tudástár's URL-driven view switch — `?view=` (+ `kind`/`fact`
 *  later, T10). An invalid/absent `view` always reads as the base (section-mosaic) view. */
type KnowledgeView = 'base' | 'tenyek' | 'kategoriak' | 'profil' | 'hogyan'
const VIEWS = new Set(['tenyek', 'kategoriak', 'profil', 'hogyan'])
const KIND_LABELS = new Map(GRAPH_KIND_GROUPS)

const VIEW_TONE: Record<KnowledgeView, PageTone> = {
  base: 'sage', tenyek: 'sage', kategoriak: 'lav', profil: 'rose', hogyan: 'gold',
}
const VIEW_HERO_NAME: Record<KnowledgeView, string> = {
  base: 'Tudástár', tenyek: 'Tudástár', kategoriak: 'Kategóriák', profil: 'Így beszélj velem', hogyan: 'Hogyan működik?',
}

/** The page frame every branch renders inside — the way back must exist on all of them
 *  (ADR 0032 / fidelity audit mezo-d20.11: the Tudástár mounted no PageHead at all).
 *  Nézet-függő lett (mezo-ms9a): tone/back-chip/hero-name a `view` szerint vált, de a
 *  betöltés/hiba/degraded ágak minden nézeten ugyanazt a keretet kapják — base tone-nal,
 *  „‹ Mezo" chippel, mert ezek az ágak a `view` felbontása ELŐTT térnek vissza. */
function TudasFrame({
  view = 'base', kind = null, big, sub, help, children,
}: {
  view?: KnowledgeView
  /** Only meaningful for `view === 'kategoriak'` — a non-null kind means the page-head chip
   *  reads `‹ Kategóriák` and clears just `kind` (mezo-ni86: one back-affordance per view, so
   *  the kind-drill's return trip lives on the SAME chip as every other view's, not a second
   *  one in the body). */
  kind?: GraphNodeKind | null
  big?: ReactNode
  sub?: string
  help?: boolean
  children: ReactNode
}) {
  const navigate = useNavigate()
  const [, setParams] = useSearchParams()
  const isBase = view === 'base'
  const inKindDrill = view === 'kategoriak' && kind !== null
  const onBack = isBase
    ? () => navigate('/mezo')
    : inKindDrill
      ? () => setParams({ view: 'kategoriak' }, { replace: true })
      : () => setParams({}, { replace: true })
  const label = isBase ? '‹ Mezo' : inKindDrill ? '‹ Kategóriák' : '‹ Tudástár'
  return (
    <MozaikPage tone={VIEW_TONE[view]}>
      <PageHead onBack={onBack} label={label} />
      <PageHero icon="i-tudas" big={big} name={VIEW_HERO_NAME[view]} sub={sub}>
        {help && (
          <button
            type="button"
            className="tud-help"
            aria-label="Hogyan működik?"
            onClick={() => setParams({ view: 'hogyan' })}
          >
            ?
          </button>
        )}
      </PageHero>
      <PageBody>{children}</PageBody>
    </MozaikPage>
  )
}

export function KnowledgeListPage() {
  const [params, setParams] = useSearchParams()
  const rawView = params.get('view')
  const requestedView: KnowledgeView = rawView && VIEWS.has(rawView) ? (rawView as KnowledgeView) : 'base'
  const rawKind = params.get('kind')
  const kind: GraphNodeKind | null =
    rawKind && KIND_LABELS.has(rawKind as GraphNodeKind) ? (rawKind as GraphNodeKind) : null

  // T10 (mezo-ms9a): `?fact=<id>` deep link — a WeekDiscoveries innen már küld linkeket. Az id-t
  // EGYSZER, mountkor rögzítjük `useState`-ben: a param maga egy alábbi `useEffect`-ben eltűnik
  // az URL-ből (one-shot highlight), de a kiemelésnek a param eltűnése UTÁN is élnie kell —
  // ezért nem a `params`-ból olvassuk újra minden rendernél, hanem ebből az állapotból.
  const [highlightFactId] = useState<string | null>(() => params.get('fact'))

  const { facts, candidates, degraded, isPending, isError, refetch } = useKnowledge()
  const { toggle, decide } = useKnowledgeActions()
  const { candidates: lifeEvents } = useLifeEventCandidates()
  const { decide: decideLifeEvent } = useLifeEventActions()
  const { nodes } = useKnowledgeGraphNodes()
  const { count: edgeCount } = useGraphEdgeCount()
  const { archive } = useKnowledgeGraphActions()

  // Az elfogadott életesemény a szerver-listáról azonnal lekerül (query-invalidálás), ezért a
  // megerősítést page-szintű state tartja életben az oldal elhagyásáig (mezo-0ap9), MOST MÁR
  // a view-váltásokon át is — ezért ez a shell-ben, nem a KnowledgeBaseView-ban lakik.
  const [acceptedEvents, setAcceptedEvents] = useState<
    { id: string; kind: LifeEventCandidate['kind']; title: string; edgeCount: number }[]
  >([])

  // A kategóriák-nézet kind-láncának sheet-je (a mai `KnowledgePage` idiómája, mezo-2243/ni86):
  // pusztán derivált state a kiválasztott node felett, nincs külön "nyitva van-e" flag — az
  // archiválás után a node eltűnik a listából, `selected` `null`-ra esik, a sheet magától záródik.
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // A már elfogadott jelölt real módban a refetch megérkezéséig még a szerver-listában van —
  // enélkül egy pillanatra a jelölt-kártya ÉS a megerősítés is látszana.
  const pendingLifeEvents = lifeEvents.filter((c) => !acceptedEvents.some((a) => a.id === c.id))

  // A vödrözés a TELJES listán fut (a „10 megy a chatbe" a valóságot mondja), a szűrés csak
  // a megjelenítést szűkíti — különben egy aktív szűrő átírná a prompt-státuszokat.
  const buckets = useMemo(() => bucketFacts(facts, PROMPT_TOP_N), [facts])
  // Prototype hero big number (#tudasBig) spins up. The hook stays ABOVE every early return.
  const heroCount = useCountUp(facts.length)

  const profileNode = nodes.find((n) => n.sourceKind === PROFILE_SOURCE_KIND) ?? null
  const graphNodes = nodes.filter((n) => n.sourceKind !== PROFILE_SOURCE_KIND)
  const selectedNode = selectedId ? graphNodes.find((n) => n.id === selectedId) ?? null : null

  // `?view=profil` requires a profile-node to show anything (ProfileView has no "nincs profil"
  // state) — without one it reads as an unresolved/invalid view, same as a bad `?view=` value.
  // T10: `?fact=` (captured above, `highlightFactId`) OVERRIDES the requested view entirely — a
  // deep link into a specific fact always lands on Tények, even for an unknown id (no crash,
  // just no row lights up) and even once the param itself is gone from the URL.
  const view: KnowledgeView = highlightFactId
    ? 'tenyek'
    : requestedView === 'profil' && !profileNode ? 'base' : requestedView

  // T10: clears `?fact=` from the URL once, right after the deep link has been consumed above —
  // `replace: true` so it doesn't leave a back-button entry, and only THIS param is dropped
  // (other params, e.g. a future `?view=`, must survive). Runs once per mount by design: the
  // highlight itself persists via `highlightFactId` state, not via the param's presence.
  useEffect(() => {
    if (params.get('fact')) {
      const next = new URLSearchParams(params)
      next.delete('fact')
      setParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot: must fire exactly once on mount
  }, [])

  const latestGraphNode = graphNodes[0] ?? null // useKnowledgeGraphNodes() már DESC updatedAt szerint rendezve (T3)
  const kategLine = latestGraphNode
    ? `${latestGraphNode.title}${edgeCount !== null ? ` · ${edgeCount} él` : ''}`
    : 'Még nincs kategorizált kapcsolat'
  const profileLine = profileNode?.summary
    ? `${profileNode.summary.slice(0, 40)}… · heti frissítés`
    : 'Még nincs profil-összegzés · heti frissítés'

  // Real-mode-only cold-load window (mock mode's isPending is always false): facts=[]/degraded=false
  // read as "genuinely empty" below WITHOUT this guard — a fabricated „0 tény / 0 megy a chatbe"
  // header would reach a live user during the unresolved window (the mezo-yew/mezo-0xl bug class,
  // PatternsPage.tsx örököse).
  if (isPending) {
    return <TudasFrame><GhostState message="A tudástár betöltése…" /></TudasFrame>
  }

  // Genuinely failed fetch (500, network) — külön a 404-degraded ÉS a betöltés-alatti ablaktól.
  // Enélkül egy 500 a `realEmpty`-t adná vissza, ami itt „0 megy a chatbe"-ként olvasna
  // ÁLLANDÓAN, miközben a társ éppen fut és tényeket injektál.
  if (isError) {
    return (
      <TudasFrame>
        <GhostState message="Nem sikerült betölteni a tudástárat." ctaLabel="Újra" onCta={refetch} />
      </TudasFrame>
    )
  }

  // `degraded` (real-mode 404, companion switch off) EGYEDÜL a tény-felületet fedi le — a
  // gráf-hookok (useLifeEventCandidates/useKnowledgeGraphNodes/useGraphEdgeCount) 404-szemantikája
  // FÜGGETLEN a társ-kapcsolótól (l. graphHooks.ts), ezért egy régi teljes-oldalas early return
  // itt egy MÁSIK réteg működő adatát is elnyomná. A degraded kártya csak a tény-részt fedi:
  // a base nézeten az inbox candidate-blokkot és a Tények csempét helyettesíti (a LIFE_EVENT/
  // SEASON csoportok és a Kategóriák/Így beszélj velem csempék változatlanul rendereinek, ha a
  // gráf-hook adott adatot), a ?view=tenyek nézeten pedig egyedül ő látszik. A hero soha nem
  // fabrikál „0 tény"-t degraded alatt — nagy szám/alcím nélkül marad.
  const hasNoFacts = facts.length === 0
  const heroBig = degraded ? undefined : heroCount
  const heroSub = degraded
    ? undefined
    : `tény rólad · ${buckets.inPrompt.length} megy a chatbe${edgeCount !== null ? ` · ${edgeCount} kapcsolat` : ''}`

  if (view === 'tenyek') {
    return (
      <TudasFrame view="tenyek" big={heroBig} sub={heroSub}>
        <EntranceGroup className="col gap-md" replayKey={`${view}:${kind ?? ''}`}>
          {degraded ? (
            <div className="card rise" style={{ '--d': '0ms', padding: 14 } as React.CSSProperties}>
              <span className="text-secondary" style={{ fontSize: 12, lineHeight: 1.5 }}>
                A társ jelenleg nincs bekapcsolva — a tudástár most nem elérhető.
              </span>
            </div>
          ) : hasNoFacts ? (
            <div className="card rise" style={{ '--d': '0ms', padding: 14 } as React.CSSProperties}>
              <span className="text-secondary" style={{ fontSize: 12, lineHeight: 1.5 }}>
                Még egy tényt sem tanultam rólad — ahogy beszélgettek, itt fognak megjelenni.
              </span>
            </div>
          ) : (
            <FactsView facts={facts} buckets={buckets} onToggle={toggle} highlightFactId={highlightFactId} />
          )}
        </EntranceGroup>
      </TudasFrame>
    )
  }

  if (view === 'kategoriak') {
    return (
      <>
        <TudasFrame view="kategoriak" kind={kind}>
          <EntranceGroup className="col gap-md" replayKey={`${view}:${kind ?? ''}`}>
            <KategoriakView
              nodes={graphNodes}
              kind={kind}
              onOpenKind={(k) => setParams({ view: 'kategoriak', kind: k })}
              onClearKind={() => setParams({ view: 'kategoriak' }, { replace: true })}
              onOpenNode={(n) => setSelectedId(n.id)}
            />
          </EntranceGroup>
        </TudasFrame>
        {selectedNode && (
          <NodeDetailSheet
            node={selectedNode}
            onArchive={() => archive(selectedNode.id)}
            onClose={() => setSelectedId(null)}
          />
        )}
      </>
    )
  }

  if (view === 'profil') {
    // `profileNode` is guaranteed non-null here — the fallback-to-base computed above already
    // handled the missing-node case.
    return (
      <TudasFrame view="profil">
        <EntranceGroup className="col gap-md" replayKey={`${view}:${kind ?? ''}`}>
          <ProfileView node={profileNode!} onArchive={() => archive(profileNode!.id)} />
        </EntranceGroup>
      </TudasFrame>
    )
  }

  if (view === 'hogyan') {
    return (
      <TudasFrame view="hogyan">
        <EntranceGroup className="col gap-md" replayKey={`${view}:${kind ?? ''}`}>
          <HowItWorksView />
        </EntranceGroup>
      </TudasFrame>
    )
  }

  /* Mozaik re-face (mezo-d20.5.5): prototype #page-tudas hero — clay i-tudas + the big
     fact count + "tény rólad · N megy a chatbe". Same honest numbers as the old header
     (full-list buckets, never the filtered view). */
  return (
    <TudasFrame view="base" big={heroBig} sub={heroSub} help>
      <EntranceGroup className="col gap-md" replayKey={`${view}:${kind ?? ''}`}>
        <KnowledgeBaseView
          degraded={degraded}
          candidates={candidates}
          onDecideCandidate={(id, decision, refinedText) => decide(id, decision, refinedText)}
          pendingLifeEvents={pendingLifeEvents}
          acceptedEvents={acceptedEvents}
          onAcceptLifeEvent={(c, refined) =>
            setAcceptedEvents((prev) => [
              ...prev,
              { id: c.id, kind: c.kind, title: refined?.title ?? c.title, edgeCount: c.proposedEdgeCount },
            ])
          }
          onDecideLifeEvent={(id, decision, refined) => decideLifeEvent(id, decision, refined)}
          facts={facts}
          buckets={buckets}
          kindCount={GRAPH_KIND_GROUPS.length}
          kategLine={kategLine}
          profileNode={profileNode}
          profileLine={profileLine}
          onNavigate={(v) => setParams({ view: v })}
        />
      </EntranceGroup>
    </TudasFrame>
  )
}
