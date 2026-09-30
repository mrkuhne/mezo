import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import {
  useKnowledge, useLifeEventCandidates,
  useKnowledgeGraphNodes, useKnowledgeObservations, useEffectSubjects,
} from '@/data/hooks'
import { usePeople } from '@/data/me/peopleHooks'
import { GRAPH_KIND_GROUPS, PROFILE_SOURCE_KIND } from '@/data/insights/graph'
import { KnowledgeBaseView, type HubNavTarget } from '@/features/insights/components/KnowledgeBaseView'
import { ForgetUndoBar } from '@/features/insights/components/hub/ForgetUndoBar'
import { TenyekSection } from '@/features/insights/components/hub/TenyekSection'
import { EmberekSection } from '@/features/insights/components/hub/EmberekSection'
import { EszrevetelekSection } from '@/features/insights/components/hub/EszrevetelekSection'
import { HatasokSection } from '@/features/insights/components/hub/HatasokSection'
import { useForgetUndo } from '@/features/insights/hooks/useForgetUndo'
import { hubCounts } from '@/features/insights/logic/hubCounts'
import { KategoriakView } from '@/features/insights/components/KategoriakView'
import { HowItWorksView } from '@/features/insights/components/HowItWorksView'
import type { GraphNodeKind } from '@/data/types'
import '@/features/insights/boop-world.css'

/** mezo-ms9a: the unified Tudástár's URL-driven view switch — `?view=` (+ `kind`/`fact`, T10;
 *  `person` under `emberek`, S6). An invalid/absent `view` always reads as the base (hub) view. */
export type KnowledgeView = 'base' | 'tenyek' | 'emberek' | 'eszrevetelek' | 'hatasok' | 'kategoriak' | 'profil' | 'hogyan'
const VIEWS = new Set(['tenyek', 'emberek', 'eszrevetelek', 'hatasok', 'kategoriak', 'profil', 'hogyan'])
const KIND_LABELS = new Map(GRAPH_KIND_GROUPS)

function withWeek(next: Record<string, string>, current: URLSearchParams) {
  const start = current.get('start')
  return start ? { ...next, start } : next
}

/** Üveg (U9 · mezo-me75u.9): the csapatfal `tf-dhead` frame — eyebrow + title per view
 *  (prototype `uveg-mezo-teljes-u9.js` tudastar/tenyek/kategoriak/hogyan). */
const VIEW_EYEBROW: Record<KnowledgeView, string> = {
  base: 'Rólad', tenyek: 'Tudástár · Rólad', emberek: 'Tudástár · Emberek',
  eszrevetelek: 'Tudástár · Észrevételek', hatasok: 'Tudástár · Hatások',
  kategoriak: 'Tudástár · ugyanennek a tudásnak a térképe', profil: 'Tudástár', hogyan: 'Tudástár',
}
const VIEW_TITLE: Record<KnowledgeView, string> = {
  base: 'Tudástár', tenyek: 'Tények rólad', emberek: 'Emberek az életedben', eszrevetelek: 'Észrevételek',
  hatasok: 'Hatások', kategoriak: 'Kategóriák', profil: 'Így beszélj velem', hogyan: 'Hogyan működik?',
}

/** The page frame every branch renders inside — the way back must exist on all of them
 *  (ADR 0032 / fidelity audit mezo-d20.11: the Tudástár mounted no PageHead at all).
 *  Nézet-függő (mezo-ms9a): cím/vissza-cél a `view` szerint vált; S6 óta nincs oldal-szintű
 *  betöltés/hiba ág — minden szakasz a saját állapotát mutatja a saját keretében.
 *  Üveg (U9): a kerek üveg vissza-gomb a célt az akadálymentes nevében mondja ki
 *  („Vissza: Mezo / Tudástár / Kategóriák"), a nagy szám + alcím a fejléc alatt áll. */
function TudasFrame({
  view = 'base', kind = null, big, sub, backTo, title, children,
}: {
  view?: KnowledgeView
  /** Only meaningful for `view === 'kategoriak'` — a non-null kind means the back control
   *  returns to `Kategóriák` and clears just `kind` (mezo-ni86: one back-affordance per view, so
   *  the kind-drill's return trip lives on the SAME control as every other view's, not a second
   *  one in the body). */
  kind?: GraphNodeKind | null
  big?: ReactNode
  sub?: string
  /** S6: a sub-view's own way back (the person sub-view returns to `?view=emberek`, not the hub). */
  backTo?: { label: string; params: Record<string, string> }
  /** S6: overrides the view title (the person sub-view shows the person's name). */
  title?: string
  children: ReactNode
}) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const isBase = view === 'base'
  const inKindDrill = view === 'kategoriak' && kind !== null
  const onBack = backTo
    ? () => setParams(withWeek(backTo.params, params), { replace: true })
    : isBase
      ? () => navigate('/mezo')
      : inKindDrill
        ? () => setParams(withWeek({ view: 'kategoriak' }, params), { replace: true })
        : () => setParams(withWeek({}, params), { replace: true })
  const backLabel = backTo ? backTo.label : isBase ? 'Mezo' : inKindDrill ? 'Kategóriák' : 'Tudástár'
  return (
    <div className="tud9 tf-page" data-view={view}>
      <div className="tf-dhead">
        <button type="button" className="glass tf-back" aria-label={`Vissza: ${backLabel}`} onClick={onBack}>‹</button>
        <span className="tf-dtitle"><small>{VIEW_EYEBROW[view]}</small><strong>{title ?? VIEW_TITLE[view]}</strong></span>
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
  const personId = params.get('person')

  // T10 (mezo-ms9a): `?fact=<id>` deep link — a WeekDiscoveries innen már küld linkeket. Az id-t
  // EGYSZER, mountkor rögzítjük `useState`-ben: a param maga egy alábbi `useEffect`-ben eltűnik
  // az URL-ből (one-shot highlight), de a kiemelésnek a param eltűnése UTÁN is élnie kell —
  // ezért nem a `params`-ból olvassuk újra minden rendernél, hanem ebből az állapotból.
  // Mount-only capture: egy in-app, ugyanerre a route-ra mutató `?fact=` navigáció (pl. egy
  // második WeekDiscoveries-kattintás mount nélkül) NEM váltaná újra a kiemelést — jelenleg
  // nincs ilyen producer, de ha lesz, ennek a state-nek a mountot is újra kell futtatnia.
  const [highlightFactId] = useState<string | null>(() => params.get('fact'))
  // S6: an Emberek fact-text search carried into the person it matched (prototype `data-pq`) —
  // held here because the person sub-view remounts under a new replayKey.
  const [personQuery, setPersonQuery] = useState('')

  // S6 (mezo-d6ivw.6): the hub loads all four sources up front — each owns its own
  // pending/error/degraded state, so there is no page-wide early return any more. Every hook
  // stays ABOVE the only early return (the legacy `profil` redirect).
  const { facts, candidates, degraded, isPending, isError, refetch } = useKnowledge()
  const { candidates: lifeEvents } = useLifeEventCandidates()
  const { nodes } = useKnowledgeGraphNodes()
  const peopleQ = usePeople()
  const obsQ = useKnowledgeObservations()
  const effectsQ = useEffectSubjects()
  const undo = useForgetUndo()

  // Task 11 (mezo-zpxv7): a döntés a Rólad oldalon él — a Tudástár csak a darabszámot mutatja
  // (a pointer linken). Degraded alatt a fact-candidate felét fedi (a lifeEvents/SEASON
  // jelöltek gráf-eredetűek, függetlenek a társ-kapcsolótól).
  const pendingCount = (degraded ? 0 : candidates.length) + lifeEvents.length

  const counts = hubCounts(
    { items: facts, degraded, isPending, isError, refetch },
    { items: peopleQ.people, degraded: false, isPending: peopleQ.isPending, isError: peopleQ.isError, refetch: peopleQ.refetch },
    { items: obsQ.observations, degraded: obsQ.degraded, isPending: obsQ.isPending, isError: obsQ.isError, refetch: obsQ.refetch },
    { items: effectsQ.subjects, degraded: effectsQ.degraded, isPending: effectsQ.isPending, isError: effectsQ.isError, refetch: effectsQ.refetch },
  )

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

  if (requestedView === 'profil') return <Navigate to="/settings/mezo/communication" replace />

  const go = (v: HubNavTarget) => setParams(withWeek({ view: v }, params))
  const replayKey = `${view}:${kind ?? ''}:${personId ?? ''}`
  // The forget-undo bar lives once per page, on every view (a forget started in a section keeps
  // its window when the user steps back to the hub).
  const undoBar = <ForgetUndoBar pending={undo.pending} onUndo={undo.undo} />

  if (view === 'tenyek') {
    // S6 (mezo-d6ivw.6): the Rólad section — topics, search, Elhallgattatott, the dossier door.
    // It owns its own loading/error/degraded/empty states; the `?fact=` target opens its fold.
    return (
      <TudasFrame view="tenyek">
        <EntranceGroup className="tud9-flow" replayKey={replayKey}>
          <TenyekSection
            facts={facts} degraded={degraded} isPending={isPending} isError={isError} refetch={refetch}
            highlightFactId={highlightFactId} forget={undo.start} isHidden={undo.isHidden}
            pendingMergeCount={degraded ? 0 : candidates.filter((c) => c.source === 'merge').length}
          />
        </EntranceGroup>
        {undoBar}
      </TudasFrame>
    )
  }

  if (view === 'emberek') {
    // `?person=<id>` opens that person's sub-view; its way back is the Emberek list, not the hub.
    // An id that the loaded list does not know reads as the plain list.
    const person = personId ? peopleQ.people.find((p) => p.id === personId) ?? null : null
    const inPerson = !!personId && (peopleQ.isPending || person !== null)
    return (
      <TudasFrame
        view="emberek"
        title={inPerson ? person?.name : undefined}
        backTo={inPerson ? { label: 'Emberek', params: { view: 'emberek' } } : undefined}
      >
        <EntranceGroup className="tud9-flow" replayKey={replayKey}>
          <EmberekSection
            personId={personId}
            initialPersonQuery={personQuery}
            onOpenPerson={(id, carry) => {
              setPersonQuery(carry)
              setParams(withWeek({ view: 'emberek', person: id }, params))
            }}
            forget={undo.start} isHidden={undo.isHidden}
          />
        </EntranceGroup>
        {undoBar}
      </TudasFrame>
    )
  }

  if (view === 'eszrevetelek') {
    // `&obs=<patternId>` (the Rólad "észrevételből" tag): its topic opens, its row is highlighted,
    // the filter starts at Mind. Read on every render (an in-app link does not remount the page);
    // keyed on it so a new target re-runs the section's opening state.
    const obs = params.get('obs')
    return (
      <TudasFrame view="eszrevetelek">
        <EntranceGroup className="tud9-flow" replayKey={replayKey}>
          <EszrevetelekSection key={obs ?? ''} highlightPatternId={obs}
            forget={undo.start} isHidden={undo.isHidden} />
        </EntranceGroup>
        {undoBar}
      </TudasFrame>
    )
  }

  if (view === 'hatasok') {
    return (
      <TudasFrame view="hatasok">
        <EntranceGroup className="tud9-flow" replayKey={replayKey}>
          <HatasokSection forget={undo.start} isHidden={undo.isHidden} />
        </EntranceGroup>
        {undoBar}
      </TudasFrame>
    )
  }

  if (view === 'kategoriak') {
    return (
      <TudasFrame view="kategoriak" kind={kind}>
        <EntranceGroup className="tud9-flow" replayKey={replayKey}>
          <KategoriakView
            nodes={graphNodes}
            kind={kind}
            onOpenKind={(k) => setParams(withWeek({ view: 'kategoriak', kind: k }, params))}
            onOpenNode={(n) => navigate(`/mezo/knowledge/node/${n.id}?${params}`)}
          />
        </EntranceGroup>
        {undoBar}
      </TudasFrame>
    )
  }

  if (view === 'hogyan') {
    return (
      <TudasFrame view="hogyan">
        <EntranceGroup className="tud9-flow" replayKey={replayKey}>
          <HowItWorksView />
        </EntranceGroup>
        {undoBar}
      </TudasFrame>
    )
  }

  /* S6 (mezo-d6ivw.6): the hub — hero numeral + four section tiles + quiet links. Each section
     reports its own loading/error/switched-off state; nothing is invented. */
  return (
    <TudasFrame view="base">
      <EntranceGroup className="tud9-flow" replayKey={replayKey}>
        <KnowledgeBaseView pendingCount={pendingCount} counts={counts} onNavigate={go} />
      </EntranceGroup>
      {undoBar}
    </TudasFrame>
  )
}
