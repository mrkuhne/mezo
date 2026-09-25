import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { GhostState } from '@/shared/ui/GhostState'
import { EntranceGroup, useCountUp } from '@/shared/ui/mozaik/motion'
import {
  useKnowledge, useKnowledgeActions, useLifeEventCandidates, useLifeEventActions,
  useKnowledgeGraphNodes, useGraphEdgeCount,
} from '@/data/hooks'
import { PROMPT_TOP_N } from '@/data/insights/knowledge'
import { GRAPH_KIND_GROUPS, PROFILE_SOURCE_KIND } from '@/data/insights/graph'
import { FactsView } from '@/features/insights/components/FactsView'
import { KnowledgeBaseView } from '@/features/insights/components/KnowledgeBaseView'
import { KategoriakView } from '@/features/insights/components/KategoriakView'
import { HowItWorksView } from '@/features/insights/components/HowItWorksView'
import { bucketFacts } from '@/features/insights/logic/factCopy'
import type { GraphNodeKind, LifeEventCandidate } from '@/data/types'
import { Icon3D } from '@/shared/ui/clay'
import '@/features/insights/boop-world.css'

/** mezo-ms9a: the unified Tudástár's URL-driven view switch — `?view=` (+ `kind`/`fact`
 *  later, T10). An invalid/absent `view` always reads as the base (section-mosaic) view. */
type KnowledgeView = 'base' | 'tenyek' | 'kategoriak' | 'profil' | 'hogyan'
const VIEWS = new Set(['tenyek', 'kategoriak', 'profil', 'hogyan'])
const KIND_LABELS = new Map(GRAPH_KIND_GROUPS)

function withWeek(next: Record<string, string>, current: URLSearchParams) {
  const start = current.get('start')
  return start ? { ...next, start } : next
}

/** Üveg (U9 · mezo-me75u.9): the csapatfal `tf-dhead` frame — eyebrow + title per view
 *  (prototype `uveg-mezo-teljes-u9.js` tudastar/tenyek/kategoriak/hogyan). */
const VIEW_EYEBROW: Record<KnowledgeView, string> = {
  base: 'Rólad', tenyek: 'Tudástár', kategoriak: 'Tudástár · ugyanennek a tudásnak a térképe',
  profil: 'Tudástár', hogyan: 'Tudástár',
}
const VIEW_TITLE: Record<KnowledgeView, string> = {
  base: 'Tudástár', tenyek: 'Tények', kategoriak: 'Kategóriák', profil: 'Így beszélj velem', hogyan: 'Hogyan működik?',
}

/** The page frame every branch renders inside — the way back must exist on all of them
 *  (ADR 0032 / fidelity audit mezo-d20.11: the Tudástár mounted no PageHead at all).
 *  Nézet-függő lett (mezo-ms9a): cím/vissza-cél a `view` szerint vált, de a
 *  betöltés/hiba/degraded ágak minden nézeten ugyanazt a keretet kapják — base címmel,
 *  „Mezo" vissza-céllal, mert ezek az ágak a `view` felbontása ELŐTT térnek vissza.
 *  Üveg (U9): a kerek üveg vissza-gomb a célt az akadálymentes nevében mondja ki
 *  („Vissza: Mezo / Tudástár / Kategóriák"), a nagy szám + alcím a fejléc alatt áll. */
function TudasFrame({
  view = 'base', kind = null, big, sub, help, children,
}: {
  view?: KnowledgeView
  /** Only meaningful for `view === 'kategoriak'` — a non-null kind means the back control
   *  returns to `Kategóriák` and clears just `kind` (mezo-ni86: one back-affordance per view, so
   *  the kind-drill's return trip lives on the SAME control as every other view's, not a second
   *  one in the body). */
  kind?: GraphNodeKind | null
  big?: ReactNode
  sub?: string
  help?: boolean
  children: ReactNode
}) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const isBase = view === 'base'
  const inKindDrill = view === 'kategoriak' && kind !== null
  const onBack = isBase
    ? () => navigate('/mezo')
    : inKindDrill
      ? () => setParams(withWeek({ view: 'kategoriak' }, params), { replace: true })
      : () => setParams(withWeek({}, params), { replace: true })
  const backTo = isBase ? 'Mezo' : inKindDrill ? 'Kategóriák' : 'Tudástár'
  return (
    <div className="tud9 tf-page" data-view={view}>
      <div className="tf-dhead">
        <button type="button" className="glass tf-back" aria-label={`Vissza: ${backTo}`} onClick={onBack}>‹</button>
        <span className="tf-dtitle"><small>{VIEW_EYEBROW[view]}</small><strong>{VIEW_TITLE[view]}</strong></span>
        {help && (
          <button
            type="button"
            className="glass is-round tud9-help"
            aria-label="Hogyan működik?"
            onClick={() => setParams(withWeek({ view: 'hogyan' }, params))}
          >
            ?
          </button>
        )}
      </div>
      {big !== undefined && (
        <div className="tud9-big">
          <b className="tud9-bignum">{big}</b>
          {sub && <small className="tud9-sub">{sub}</small>}
        </div>
      )}
      <div className="tud9-body">{children}</div>
    </div>
  )
}

export function KnowledgeListPage() {
  const navigate = useNavigate()
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
  // Mount-only capture: egy in-app, ugyanerre a route-ra mutató `?fact=` navigáció (pl. egy
  // második WeekDiscoveries-kattintás mount nélkül) NEM váltaná újra a kiemelést — jelenleg
  // nincs ilyen producer, de ha lesz, ennek a state-nek a mountot is újra kell futtatnia.
  const [highlightFactId] = useState<string | null>(() => params.get('fact'))

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

  // `?view=profil` requires a profile-node to show anything (ProfileView has no "nincs profil"
  // state) — without one it reads as an unresolved/invalid view, same as a bad `?view=` value.
  // T10: `?fact=` OVERRIDES the requested view entirely, but ONLY while the param is still in the
  // URL (i.e. the very first render after a deep-link arrival) — the effect below rewrites the URL
  // to `?view=tenyek` in the same tick, so on every render after that the normal `requestedView`
  // read already says `tenyek` and the back chip (which clears `view`, not `fact`) works again.
  // Reading `params.get('fact')` here (not the `highlightFactId` state) is what makes the override
  // self-expiring instead of pinning `view` for the whole mount lifetime (review finding, mezo-ms9a).
  const view: KnowledgeView = params.get('fact')
    ? 'tenyek'
    : requestedView === 'profil' && !profileNode ? 'base' : requestedView

  // T10: clears `?fact=` from the URL once, right after the deep link has been consumed above —
  // `replace: true` so it doesn't leave a back-button entry — and in the SAME rewrite bakes the
  // forced view into `?view=tenyek` so it survives the param's removal (other params, e.g. a
  // future `?kind=`, must still survive too). Runs once per mount by design: the highlight itself
  // persists via `highlightFactId` state, not via the param's presence.
  useEffect(() => {
    if (params.get('fact')) {
      const next = new URLSearchParams(params)
      next.delete('fact')
      next.set('view', 'tenyek')
      setParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot: must fire exactly once on mount
  }, [])

  const latestGraphNode = graphNodes[0] ?? null // useKnowledgeGraphNodes() már DESC updatedAt szerint rendezve (T3)
  const kategLine = latestGraphNode
    ? `${latestGraphNode.title}${edgeCount !== null ? ` · ${edgeCount} él` : ''}`
    : 'Még nincs kategorizált kapcsolat'
  const profileLine = profileNode?.summary
    ? `${profileNode.summary.slice(0, 40)}${profileNode.summary.length > 40 ? '…' : ''} · heti frissítés`
    : 'Még nincs profil-összegzés · heti frissítés'

  // Real-mode-only cold-load window (mock mode's isPending is always false): facts=[]/degraded=false
  // read as "genuinely empty" below WITHOUT this guard — a fabricated „0 tény / 0 megy a chatbe"
  // header would reach a live user during the unresolved window (the mezo-yew/mezo-0xl bug class,
  // PatternsPage.tsx örököse).
  if (requestedView === 'profil') return <Navigate to="/settings/mezo/communication" replace />

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
        <EntranceGroup className="tud9-flow" replayKey={`${view}:${kind ?? ''}`}>
          {degraded ? (
            <div className="tf-dash tud9-dash rise" style={{ '--d': '0ms' } as React.CSSProperties}>
              <Icon3D name="t-info" size={28} />
              <span>A társ jelenleg nincs bekapcsolva — a tudástár most nem elérhető.</span>
            </div>
          ) : hasNoFacts ? (
            <div className="tf-dash tud9-dash rise" style={{ '--d': '0ms' } as React.CSSProperties}>
              <Icon3D name="t-note" size={28} />
              <span>Még egy tényt sem tanultam rólad — ahogy beszélgettek, itt fognak megjelenni.</span>
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
        <TudasFrame view="kategoriak" kind={kind}>
          <EntranceGroup className="tud9-flow" replayKey={`${view}:${kind ?? ''}`}>
            <KategoriakView
              nodes={graphNodes}
              kind={kind}
              onOpenKind={(k) => setParams(withWeek({ view: 'kategoriak', kind: k }, params))}
              onOpenNode={(n) => navigate(`/mezo/knowledge/node/${n.id}?${params}`)}
            />
          </EntranceGroup>
        </TudasFrame>
    )
  }


  if (view === 'hogyan') {
    return (
      <TudasFrame view="hogyan">
        <EntranceGroup className="tud9-flow" replayKey={`${view}:${kind ?? ''}`}>
          <HowItWorksView />
        </EntranceGroup>
      </TudasFrame>
    )
  }

  /* Üveg (U9 · mezo-me75u.9): the big light fact count + "tény rólad · N megy a chatbe" under
     the tf-dhead frame. Same honest numbers as the old header (full-list buckets, never the
     filtered view). */
  return (
    <TudasFrame view="base" big={heroBig} sub={heroSub} help>
      <EntranceGroup className="tud9-flow" replayKey={`${view}:${kind ?? ''}`}>
        {params.get('start') && /^\d{4}-\d{2}-\d{2}$/.test(params.get('start')!) && (
          <div className="glass tf-strip tf-c-rose tud9-week rise" data-week-banner>
            <Icon3D name="t-calendar" size={24} />
            <span className="tf-strip-text">Heti áttekintés · {params.get('start')}. A postaláda minden nyitott javaslatot mutat.</span>
            <Link to={`/me/week?start=${params.get('start')}`} className="tud9-weeklink">Vissza ehhez a héthez →</Link>
          </div>
        )}
        <KnowledgeBaseView
          degraded={degraded}
          candidates={candidates}
          onDecideCandidate={(id, decision, refinedText) => decide(id, decision, refinedText)}
          onToggleConflict={toggle}
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
          onNavigate={(v) => setParams(withWeek({ view: v }, params))}
        />
      </EntranceGroup>
    </TudasFrame>
  )
}
