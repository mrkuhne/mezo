import { useMemo, useState } from 'react'
import { Icon } from '@/shared/ui/Icon'
import { cn } from '@/shared/lib/cn'
import { useKnowledge, useKnowledgeActions } from '@/data/hooks'
import { FACT_CATEGORIES, PROMPT_TOP_N } from '@/data/insights/knowledge'
import { LifecycleSection } from '@/features/insights/components/LifecycleSection'
import { KnowledgeExplainer } from '@/features/insights/components/KnowledgeExplainer'
import { FactCandidateCard } from '@/features/insights/components/FactCandidateCard'
import { KnowledgeFactRow } from '@/features/insights/components/KnowledgeFactRow'
import { bucketFacts, matchesQuery, type FactBucket } from '@/features/insights/logic/factCopy'
import type { FactCategory, KnowledgeFact } from '@/data/types'

export function KnowledgeListPage() {
  const { facts, candidates, degraded } = useKnowledge()
  const { toggle, decide } = useKnowledgeActions()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<FactCategory | 'all'>('all')

  // A vödrözés a TELJES listán fut (a „10 megy a chatbe" a valóságot mondja), a szűrés csak
  // a megjelenítést szűkíti — különben egy aktív szűrő átírná a prompt-státuszokat.
  const buckets = useMemo(() => bucketFacts(facts, PROMPT_TOP_N), [facts])
  const visible = (list: KnowledgeFact[]) =>
    list.filter((f) => (category === 'all' || f.category === category) && matchesQuery(f, query))

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

  const rows = (list: KnowledgeFact[], bucket: FactBucket) =>
    list.map((f) => (
      <KnowledgeFactRow key={f.id} fact={f} bucket={bucket} onToggle={() => toggle(f.id, !f.active)} />
    ))

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
            onClick={() => { setCategory('all'); setQuery('') }}
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
        <div className="card" style={{ padding: 14 }}>
          <span className="text-secondary" style={{ fontSize: 12 }}>Nincs találat a keresésre.</span>
        </div>
      ) : (
        <div className="col gap-sm">
          {inPrompt.length > 0 && (
            <div className="col gap-sm">
              <span className="eyebrow" style={{ color: 'var(--sage)' }}>
                Most ezeket kapja meg a társ · {buckets.inPrompt.length}/{PROMPT_TOP_N}
              </span>
              {rows(inPrompt, 'in-prompt')}
              <p className="text-tertiary" style={{ fontSize: 11, lineHeight: 1.5, padding: '0 4px' }}>
                Minden beszélgetés elején ezek a mondatok mennek elé.
              </p>
            </div>
          )}

          <LifecycleSection
            title="Bekapcsolva, de most kimarad"
            accent="var(--text-secondary)"
            count={waiting.length}
            defaultOpen
            footNote="Ha megerősödnek, vagy egy erősebb tény kiesik, bekerülnek a chatbe."
          >
            {rows(waiting, 'waiting')}
          </LifecycleSection>

          <LifecycleSection
            title="Kikapcsolva"
            accent="var(--text-tertiary)"
            count={off.length}
            footNote="Megőrzöm őket, de a társ nem használja."
          >
            {rows(off, 'off')}
          </LifecycleSection>
        </div>
      )}

      <p className="text-tertiary mt-md" style={{ fontSize: 11, textAlign: 'center', lineHeight: 1.5, padding: '0 20px' }}>
        A graph nézethez · Me → Knowledge.
      </p>
    </div>
  )
}
