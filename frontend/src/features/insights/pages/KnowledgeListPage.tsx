import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { GhostState } from '@/shared/ui/GhostState'
import { MozaikPage, PageHead, PageHero, PageBody, type PageTone } from '@/shared/ui/mozaik'
import { EntranceGroup, useCountUp } from '@/shared/ui/mozaik/motion'
import {
  useKnowledge, useKnowledgeActions, useLifeEventCandidates, useLifeEventActions,
  useKnowledgeGraphNodes, useGraphEdgeCount,
} from '@/data/hooks'
import { PROMPT_TOP_N } from '@/data/insights/knowledge'
import { GRAPH_KIND_GROUPS, PROFILE_SOURCE_KIND } from '@/data/insights/graph'
import { FactsView } from '@/features/insights/components/FactsView'
import { KnowledgeBaseView } from '@/features/insights/components/KnowledgeBaseView'
import { bucketFacts } from '@/features/insights/logic/factCopy'
import type { LifeEventCandidate } from '@/data/types'

/** mezo-ms9a: the unified Tudástár's URL-driven view switch — `?view=` (+ `kind`/`fact`
 *  later, T10). An invalid/absent `view` always reads as the base (section-mosaic) view. */
type KnowledgeView = 'base' | 'tenyek' | 'kategoriak' | 'profil' | 'hogyan'
const VIEWS = new Set(['tenyek', 'kategoriak', 'profil', 'hogyan'])

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
  view = 'base', big, sub, help, children,
}: { view?: KnowledgeView; big?: ReactNode; sub?: string; help?: boolean; children: ReactNode }) {
  const navigate = useNavigate()
  const [, setParams] = useSearchParams()
  const isBase = view === 'base'
  return (
    <MozaikPage tone={VIEW_TONE[view]}>
      <PageHead
        onBack={isBase ? () => navigate('/mezo') : () => setParams({}, { replace: true })}
        label={isBase ? '‹ Mezo' : '‹ Tudástár'}
      />
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
  const view: KnowledgeView = rawView && VIEWS.has(rawView) ? (rawView as KnowledgeView) : 'base'

  const { facts, candidates, degraded, isPending, isError, refetch } = useKnowledge()
  const { toggle, decide } = useKnowledgeActions()
  const { candidates: lifeEvents } = useLifeEventCandidates()
  const { decide: decideLifeEvent } = useLifeEventActions()
  const { nodes } = useKnowledgeGraphNodes()
  const { count: edgeCount } = useGraphEdgeCount()

  // Az elfogadott életesemény a szerver-listáról azonnal lekerül (query-invalidálás), ezért a
  // megerősítést page-szintű state tartja életben az oldal elhagyásáig (mezo-0ap9), MOST MÁR
  // a view-váltásokon át is — ezért ez a shell-ben, nem a KnowledgeBaseView-ban lakik.
  const [acceptedEvents, setAcceptedEvents] = useState<
    { id: string; kind: LifeEventCandidate['kind']; title: string; edgeCount: number }[]
  >([])

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

  if (degraded) {
    return (
      <TudasFrame>
        <div className="card" style={{ padding: 14 }}>
          <span className="text-secondary" style={{ fontSize: 12, lineHeight: 1.5 }}>
            A társ jelenleg nincs bekapcsolva — a tudástár most nem elérhető.
          </span>
        </div>
      </TudasFrame>
    )
  }

  const hasNoFacts = facts.length === 0
  const heroSub = `tény rólad · ${buckets.inPrompt.length} megy a chatbe${edgeCount !== null ? ` · ${edgeCount} kapcsolat` : ''}`

  if (view === 'tenyek') {
    return (
      <TudasFrame view="tenyek" big={heroCount} sub={heroSub}>
        <EntranceGroup className="col gap-md" replayKey={view}>
          {hasNoFacts ? (
            <div className="card rise" style={{ '--d': '0ms', padding: 14 } as React.CSSProperties}>
              <span className="text-secondary" style={{ fontSize: 12, lineHeight: 1.5 }}>
                Még egy tényt sem tanultam rólad — ahogy beszélgettek, itt fognak megjelenni.
              </span>
            </div>
          ) : (
            <FactsView facts={facts} buckets={buckets} onToggle={toggle} />
          )}
        </EntranceGroup>
      </TudasFrame>
    )
  }

  if (view === 'kategoriak' || view === 'profil' || view === 'hogyan') {
    // Task 7: kategoriak/profil/hogyan nézet-tartalom. Addig üres keret a helyes tone-nal
    // és a „‹ Tudástár" back-chippel, hogy a (d) teszt zölden fusson.
    return (
      <TudasFrame view={view}>
        {/* Task 7 */}
        <></>
      </TudasFrame>
    )
  }

  /* Mozaik re-face (mezo-d20.5.5): prototype #page-tudas hero — clay i-tudas + the big
     fact count + "tény rólad · N megy a chatbe". Same honest numbers as the old header
     (full-list buckets, never the filtered view). */
  return (
    <TudasFrame view="base" big={heroCount} sub={heroSub} help>
      <EntranceGroup className="col gap-md" replayKey={view}>
        <KnowledgeBaseView
          candidates={candidates}
          onDecideCandidate={(id, decision, refinedText) => decide(id, decision, refinedText)}
          pendingLifeEvents={pendingLifeEvents}
          acceptedEvents={acceptedEvents}
          onAcceptLifeEvent={(c) =>
            setAcceptedEvents((prev) => [
              ...prev,
              { id: c.id, kind: c.kind, title: c.title, edgeCount: c.proposedEdgeCount },
            ])
          }
          onDecideLifeEvent={(id, decision) => decideLifeEvent(id, decision)}
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
