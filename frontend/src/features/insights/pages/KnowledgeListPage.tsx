import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClayIcon } from '@/shared/ui/clay'
import { GhostState } from '@/shared/ui/GhostState'
import { SECTION_LABEL } from '@/shared/ui/sectionLabel'
import { MozaikPage, PageHead, PageHero, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup, useCountUp } from '@/shared/ui/mozaik/motion'
import { useKnowledge, useKnowledgeActions, useLifeEventCandidates, useLifeEventActions } from '@/data/hooks'
import { PROMPT_TOP_N } from '@/data/insights/knowledge'
import { KnowledgeExplainer } from '@/features/insights/components/KnowledgeExplainer'
import { FactCandidateCard } from '@/features/insights/components/FactCandidateCard'
import { LifeEventCandidateCard } from '@/features/insights/components/LifeEventCandidateCard'
import { LifeEventAcceptedCard } from '@/features/insights/components/LifeEventAcceptedCard'
import { FactsView } from '@/features/insights/components/FactsView'
import { bucketFacts } from '@/features/insights/logic/factCopy'
import { CANDIDATE_COPY } from '@/data/insights/graph'
import type { LifeEventCandidate } from '@/data/types'

/** The page frame every branch renders inside — the way back must exist on all of them
 *  (ADR 0032 / fidelity audit mezo-d20.11: the Tudástár mounted no PageHead at all). */
function TudasFrame({ big, sub, children }: { big?: ReactNode; sub?: string; children: ReactNode }) {
  const navigate = useNavigate()
  return (
    <MozaikPage tone="sage">
      <PageHead onBack={() => navigate('/mezo')} label="‹ Mezo" />
      <PageHero icon="i-tudas" big={big} name="Tudástár" sub={sub} />
      <PageBody>{children}</PageBody>
    </MozaikPage>
  )
}

export function KnowledgeListPage() {
  const navigate = useNavigate()
  const { facts, candidates, degraded, isPending, isError, refetch } = useKnowledge()
  const { toggle, decide } = useKnowledgeActions()
  const { candidates: lifeEvents } = useLifeEventCandidates()
  const { decide: decideLifeEvent } = useLifeEventActions()
  // Az elfogadott életesemény a szerver-listáról azonnal lekerül (query-invalidálás), ezért a
  // megerősítést page-szintű state tartja életben az oldal elhagyásáig (mezo-0ap9). Mock és real
  // módban azonos, hogy a mock-módú ellenőrzés a valós élményt mutassa.
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

  /* Mozaik re-face (mezo-d20.5.5): prototype #page-tudas hero — clay i-tudas + the big
     fact count + "tény rólad · N megy a chatbe". Same honest numbers as the old header
     (full-list buckets, never the filtered view). */
  return (
    <TudasFrame big={heroCount} sub={`tény rólad · ${buckets.inPrompt.length} megy a chatbe`}>
    <EntranceGroup className="col gap-md">
      <KnowledgeExplainer />

      <button type="button" className="card row" aria-label="Tudásgráf" onClick={() => navigate('/me/knowledge')}
        style={{ justifyContent: 'space-between', padding: 14, gap: 12, textAlign: 'left' }}>
        <div className="row gap-md" style={{ alignItems: 'center' }}>
          <ClayIcon name="i-tudas" size={28} />
          <div className="col">
            <span>Tudásgráf</span>
            <span style={SECTION_LABEL}>kapcsolatok és életesemények · élő mindmap</span>
          </div>
        </div>
        <span aria-hidden="true" style={{ color: 'var(--text-tertiary)' }}>›</span>
      </button>

      {candidates.length > 0 && (
        <div className="col gap-sm rise" style={{ '--d': '0ms' } as React.CSSProperties}>
          {/* prototype .candc: the approval inbox speaks gold, not lavender */}
          <span className="mz-eyebrow" style={{ color: 'var(--mz-cell-amber-ink)' }}>
            Jóváhagyásra vár · {candidates.length}
          </span>
          {candidates.map((c) => (
            <FactCandidateCard
              key={c.id}
              candidate={c}
              onDecide={(decision, refinedText) => decide(c.id, decision, refinedText)}
            />
          ))}
        </div>
      )}

      {(['LIFE_EVENT', 'SEASON'] as const).map((kind) => {
        const pending = pendingLifeEvents.filter((c) => c.kind === kind)
        const settled = acceptedEvents.filter((a) => a.kind === kind)
        if (pending.length === 0 && settled.length === 0) return null
        return (
          <div key={kind} className="col gap-sm">
            <span className="eyebrow" style={{ color: 'var(--amber-deep)' }}>
              {/* A darabszám a MÉG DÖNTÉSRE VÁRÓ jelölteké. Enélkül a csoport utolsó elfogadása
                  után „…jelöltek · 0" állna a megerősítő kártya fölött. */}
              {pending.length > 0
                ? `${CANDIDATE_COPY[kind].eyebrow} · ${pending.length}`
                : CANDIDATE_COPY[kind].settled}
            </span>
            {settled.map((a) => (
              <LifeEventAcceptedCard key={a.id} title={a.title} edgeCount={a.edgeCount} />
            ))}
            {pending.map((c) => (
              <LifeEventCandidateCard
                key={c.id}
                candidate={c}
                onDecide={(decision) => {
                  if (decision === 'accept') {
                    setAcceptedEvents((prev) => [
                      ...prev,
                      { id: c.id, kind: c.kind, title: c.title, edgeCount: c.proposedEdgeCount },
                    ])
                  }
                  decideLifeEvent(c.id, decision)
                }}
              />
            ))}
          </div>
        )
      })}

      {hasNoFacts ? (
        <div className="card" style={{ padding: 14 }}>
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
