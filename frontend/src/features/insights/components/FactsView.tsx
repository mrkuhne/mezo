import { useState } from 'react'
import { Icon } from '@/shared/ui/Icon'
import { cn } from '@/shared/lib/cn'
import { FACT_CATEGORIES, PROMPT_TOP_N } from '@/data/insights/knowledge'
import { LifecycleSection } from '@/features/insights/components/LifecycleSection'
import { KnowledgeFactRow } from '@/features/insights/components/KnowledgeFactRow'
import { matchesQuery, type FactBucket } from '@/features/insights/logic/factCopy'
import type { FactCategory, KnowledgeFact } from '@/data/types'

export function FactsView(props: {
  facts: KnowledgeFact[]
  buckets: { inPrompt: KnowledgeFact[]; waiting: KnowledgeFact[]; off: KnowledgeFact[] }
  onToggle: (id: string, active: boolean) => void
  highlightFactId?: string | null // Task 10 tölti; addig undefined
}) {
  const { facts, buckets, onToggle } = props
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<FactCategory | 'all'>('all')

  const visible = (list: KnowledgeFact[]) =>
    list.filter((f) => (category === 'all' || f.category === category) && matchesQuery(f, query))

  const inPrompt = visible(buckets.inPrompt)
  const waiting = visible(buckets.waiting)
  const off = visible(buckets.off)
  const nothingMatches = facts.length > 0 && inPrompt.length + waiting.length + off.length === 0
  const filterActive = query.trim() !== '' || category !== 'all'

  const rows = (list: KnowledgeFact[], bucket: FactBucket) =>
    list.map((f) => (
      <KnowledgeFactRow key={f.id} fact={f} bucket={bucket} onToggle={() => onToggle(f.id, !f.active)} />
    ))

  const clearFilters = () => {
    setQuery('')
    setCategory('all')
  }

  return (
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
  )
}
