import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '@/shared/ui/Icon'
import { cn } from '@/shared/lib/cn'
import { GhostState } from '@/shared/ui/GhostState'
import { MozaikPage, PageHead, PageHero, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup, useCountUp } from '@/shared/ui/mozaik/motion'
import { useKnowledge, useKnowledgeActions, useLifeEventCandidates, useLifeEventActions } from '@/data/hooks'
import { FACT_CATEGORIES, PROMPT_TOP_N } from '@/data/insights/knowledge'
import { LifecycleSection } from '@/features/insights/components/LifecycleSection'
import { KnowledgeExplainer } from '@/features/insights/components/KnowledgeExplainer'
import { FactCandidateCard } from '@/features/insights/components/FactCandidateCard'
import { LifeEventCandidateCard } from '@/features/insights/components/LifeEventCandidateCard'
import { LifeEventAcceptedCard } from '@/features/insights/components/LifeEventAcceptedCard'
import { KnowledgeFactRow } from '@/features/insights/components/KnowledgeFactRow'
import { bucketFacts, matchesQuery, type FactBucket } from '@/features/insights/logic/factCopy'
import { CANDIDATE_COPY } from '@/data/insights/graph'
import type { FactCategory, KnowledgeFact, LifeEventCandidate } from '@/data/types'

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
  const { facts, candidates, degraded, isPending, isError, refetch } = useKnowledge()
  const { toggle, decide } = useKnowledgeActions()
  const { candidates: lifeEvents } = useLifeEventCandidates()
  const { decide: decideLifeEvent } = useLifeEventActions()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<FactCategory | 'all'>('all')
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
  const visible = (list: KnowledgeFact[]) =>
    list.filter((f) => (category === 'all' || f.category === category) && matchesQuery(f, query))

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

  const inPrompt = visible(buckets.inPrompt)
  const waiting = visible(buckets.waiting)
  const off = visible(buckets.off)
  const nothingMatches = facts.length > 0 && inPrompt.length + waiting.length + off.length === 0
  const filterActive = query.trim() !== '' || category !== 'all'
  const hasNoFacts = facts.length === 0

  const rows = (list: KnowledgeFact[], bucket: FactBucket) =>
    list.map((f) => (
      <KnowledgeFactRow key={f.id} fact={f} bucket={bucket} onToggle={() => toggle(f.id, !f.active)} />
    ))

  const clearFilters = () => {
    setQuery('')
    setCategory('all')
  }

  /* Mozaik re-face (mezo-d20.5.5): prototype #page-tudas hero — clay i-tudas + the big
     fact count + "tény rólad · N megy a chatbe". Same honest numbers as the old header
     (full-list buckets, never the filtered view). */
  return (
    <TudasFrame big={heroCount} sub={`tény rólad · ${buckets.inPrompt.length} megy a chatbe`}>
    <EntranceGroup className="col gap-md">
      <KnowledgeExplainer />

      <p className="text-tertiary" style={{ fontSize: 11, lineHeight: 1.5, padding: '0 4px', margin: 0 }}>
        A kapcsolatok és életesemények a{' '}
        <Link to="/me/knowledge" style={{ color: 'var(--lav-deep)', fontWeight: 600, textDecoration: 'none' }}>
          Tudásgráfon
        </Link>{' '}
        élnek — élő mindmap →
      </p>

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
        <>
          <div className="rise" style={{ '--d': '60ms' } as React.CSSProperties}>
            <div className="searchfield" style={{ marginBottom: 8 }}>
              <Icon name="search" size={16} color="var(--text-tertiary)" />
              <input
                aria-label="Keresés a tények között"
                placeholder="Keresés · pl. alvás, kávé, váll"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="row gap-xs" style={{ overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
              <button
                type="button"
                className={cn('chip tapchip', category === 'all' && 'brand')}
                onClick={() => setCategory('all')}
              >
                Mind
              </button>
              {FACT_CATEGORIES.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={cn('chip tapchip', category === id && 'brand')}
                  onClick={() => setCategory(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {nothingMatches ? (
            <div className="card col gap-sm" style={{ padding: 14, alignItems: 'flex-start' }}>
              <span className="text-secondary" style={{ fontSize: 12 }}>Nincs találat a keresésre.</span>
              <button type="button" className="chip tapchip" onClick={clearFilters}>
                Szűrők törlése
              </button>
            </div>
          ) : (
            <div className="col gap-sm">
              {inPrompt.length > 0 && (
                <div className="col gap-sm rise" style={{ '--d': '110ms' } as React.CSSProperties}>
                  <span className="mz-eyebrow" style={{ color: 'var(--mz-cell-sage-ink)' }}>
                    Most ezeket kapja meg a társ · {inPrompt.length}
                  </span>
                  {rows(inPrompt, 'in-prompt')}
                  <p className="text-tertiary" style={{ fontSize: 11, lineHeight: 1.5, padding: '0 4px' }}>
                    Minden beszélgetés elején ezek a mondatok mennek elé: a {PROMPT_TOP_N} legerősebb
                    bekapcsolt tény, plusz a frissen megerősített minták.
                  </p>
                </div>
              )}

              <LifecycleSection
                title="Bekapcsolva, de most kimarad"
                accent="var(--text-secondary)"
                count={waiting.length}
                defaultOpen
                forceOpen={filterActive}
                footNote="Ha megerősödnek, vagy egy erősebb tény kiesik, bekerülnek a chatbe."
              >
                {rows(waiting, 'waiting')}
              </LifecycleSection>

              <LifecycleSection
                title="Kikapcsolva"
                accent="var(--text-tertiary)"
                count={off.length}
                forceOpen={filterActive}
                footNote="Megőrzöm őket, de a társ nem használja."
              >
                {rows(off, 'off')}
              </LifecycleSection>
            </div>
          )}
        </>
      )}

    </EntranceGroup>
    </TudasFrame>
  )
}
