import { useMemo, useState } from 'react'
import { Icon } from '@/shared/ui/Icon'
import { cn } from '@/shared/lib/cn'
import { GhostState } from '@/shared/ui/GhostState'
import { useKnowledge, useKnowledgeActions } from '@/data/hooks'
import { FACT_CATEGORIES, PROMPT_TOP_N } from '@/data/insights/knowledge'
import { LifecycleSection } from '@/features/insights/components/LifecycleSection'
import { KnowledgeExplainer } from '@/features/insights/components/KnowledgeExplainer'
import { FactCandidateCard } from '@/features/insights/components/FactCandidateCard'
import { KnowledgeFactRow } from '@/features/insights/components/KnowledgeFactRow'
import { bucketFacts, matchesQuery, type FactBucket } from '@/features/insights/logic/factCopy'
import type { FactCategory, KnowledgeFact } from '@/data/types'

export function KnowledgeListPage() {
  const { facts, candidates, degraded, isPending, isError, refetch } = useKnowledge()
  const { toggle, decide } = useKnowledgeActions()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<FactCategory | 'all'>('all')

  // A vödrözés a TELJES listán fut (a „10 megy a chatbe" a valóságot mondja), a szűrés csak
  // a megjelenítést szűkíti — különben egy aktív szűrő átírná a prompt-státuszokat.
  const buckets = useMemo(() => bucketFacts(facts, PROMPT_TOP_N), [facts])
  const visible = (list: KnowledgeFact[]) =>
    list.filter((f) => (category === 'all' || f.category === category) && matchesQuery(f, query))

  // Real-mode-only cold-load window (mock mode's isPending is always false): facts=[]/degraded=false
  // read as "genuinely empty" below WITHOUT this guard — a fabricated „0 tény / 0 megy a chatbe"
  // header would reach a live user during the unresolved window (the mezo-yew/mezo-0xl bug class,
  // PatternsPage.tsx örököse).
  if (isPending) {
    return <GhostState message="A tudástár betöltése…" />
  }

  // Genuinely failed fetch (500, network) — külön a 404-degraded ÉS a betöltés-alatti ablaktól.
  // Enélkül egy 500 a `realEmpty`-t adná vissza, ami itt „0 megy a chatbe"-ként olvasna
  // ÁLLANDÓAN, miközben a társ éppen fut és tényeket injektál.
  if (isError) {
    return (
      <GhostState message="Nem sikerült betölteni a tudástárat." ctaLabel="Újra" onCta={refetch} />
    )
  }

  if (degraded) {
    return (
      <div className="col gap-md">
        <div className="card" style={{ padding: 14 }}>
          <span className="text-secondary" style={{ fontSize: 12, lineHeight: 1.5 }}>
            A társ jelenleg nincs bekapcsolva — a tudástár most nem elérhető.
          </span>
        </div>
      </div>
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

  return (
    <div className="col gap-md">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="eyebrow">Tudástár · {facts.length} tény</span>
        <span className="eyebrow" style={{ color: 'var(--lav-deep)' }}>{buckets.inPrompt.length} megy a chatbe</span>
      </div>

      <KnowledgeExplainer />

      {candidates.length > 0 && (
        <div className="col gap-sm">
          <span className="eyebrow" style={{ color: 'var(--lav-deep)' }}>
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

      {hasNoFacts ? (
        <div className="card" style={{ padding: 14 }}>
          <span className="text-secondary" style={{ fontSize: 12, lineHeight: 1.5 }}>
            Még egy tényt sem tanultam rólad — ahogy beszélgettek, itt fognak megjelenni.
          </span>
        </div>
      ) : (
        <>
          <div>
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
                <div className="col gap-sm">
                  <span className="eyebrow" style={{ color: 'var(--sage)' }}>
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

      <p className="text-tertiary mt-md" style={{ fontSize: 11, textAlign: 'center', lineHeight: 1.5, padding: '0 20px' }}>
        A graph nézethez · Me → Knowledge.
      </p>
    </div>
  )
}
