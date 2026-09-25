import { useState } from 'react'
import { Icon3D } from '@/shared/ui/clay'
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
  /** T10 (mezo-ms9a): a `?fact=<id>` deep link célzott tény-id-je — a shell (KnowledgeListPage)
   *  tölti, egy `useState`-ben tartva a param eltűnése után is, hogy a kiemelés egyszeri legyen. */
  highlightFactId?: string | null
}) {
  const { facts, buckets, onToggle, highlightFactId } = props
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<FactCategory | 'all'>('all')

  const visible = (list: KnowledgeFact[]) =>
    list.filter((f) => (category === 'all' || f.category === category) && matchesQuery(f, query))

  const inPrompt = visible(buckets.inPrompt)
  const waiting = visible(buckets.waiting)
  const off = visible(buckets.off)
  const nothingMatches = facts.length > 0 && inPrompt.length + waiting.length + off.length === 0
  const filterActive = query.trim() !== '' || category !== 'all'

  // T10 (mezo-ms9a): a highlightolt tény lehet a NEM-alapból-nyitott „Bekapcsolva, de most
  // kimarad" / „Kikapcsolva" vödörben — a `?fact=` linknek akkor is meg kell mutatnia, nem
  // csak akkor, ha véletlenül top-N-ben van. A membershipet a TELJES (szűretlen) vödrökön
  // nézzük, mert a kiemelés a szűrőktől független — ha épp fut egy szűrő, a `filterActive`
  // ág úgyis nyitva tartja mindkét szekciót.
  const highlightInWaiting = highlightFactId != null && buckets.waiting.some((f) => f.id === highlightFactId)
  const highlightInOff = highlightFactId != null && buckets.off.some((f) => f.id === highlightFactId)

  const rows = (list: KnowledgeFact[], bucket: FactBucket) =>
    list.map((f) => (
      <KnowledgeFactRow
        key={f.id}
        fact={f}
        bucket={bucket}
        onToggle={() => onToggle(f.id, !f.active)}
        highlight={f.id === highlightFactId}
      />
    ))

  const clearFilters = () => {
    setQuery('')
    setCategory('all')
  }

  return (
    <>
      <div className="tud9-find rise" style={{ '--d': '60ms' } as React.CSSProperties}>
        <label className="tud9-search">
          <Icon3D name="t-lens" size={20} />
          <input
            aria-label="Keresés a tények között"
            placeholder="Keresés · pl. alvás, kávé, váll"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="tud9-filt">
          <button
            type="button"
            className={cn(category === 'all' && 'is-on')}
            aria-pressed={category === 'all'}
            onClick={() => setCategory('all')}
          >
            Mind
          </button>
          {FACT_CATEGORIES.map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={cn(category === id && 'is-on')}
              aria-pressed={category === id}
              onClick={() => setCategory(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {nothingMatches ? (
        <div className="tf-dash tud9-dash tud9-nomatch">
          <Icon3D name="t-lens" size={28} />
          <span className="tud9-nomatch-tx">
            <span>Nincs találat a keresésre.</span>
            <button type="button" className="tud9-btn" onClick={clearFilters}>
              Szűrők törlése
            </button>
          </span>
        </div>
      ) : (
        <div className="tud9-buckets">
          {inPrompt.length > 0 && (
            <section className="tud9-group rise" style={{ '--d': '110ms' } as React.CSSProperties}>
              <h2 className="tud9-sech">Most ezeket kapja meg a társ · {inPrompt.length}</h2>
              <div className="tf-tlist tud9-facts">{rows(inPrompt, 'in-prompt')}</div>
              <p className="tud9-fn">
                Minden beszélgetés elején ezek a mondatok mennek elé: a {PROMPT_TOP_N} legerősebb
                bekapcsolt tény, plusz a frissen megerősített minták.
              </p>
            </section>
          )}

          <LifecycleSection
            title="Bekapcsolva, de most kimarad"
            accent="var(--text-secondary)"
            count={waiting.length}
            defaultOpen
            forceOpen={filterActive || highlightInWaiting}
            footNote="Ha megerősödnek, vagy egy erősebb tény kiesik, bekerülnek a chatbe."
          >
            {rows(waiting, 'waiting')}
          </LifecycleSection>

          <LifecycleSection
            title="Kikapcsolva"
            accent="var(--text-tertiary)"
            count={off.length}
            forceOpen={filterActive || highlightInOff}
            footNote="Megőrzöm őket, de a társ nem használja."
          >
            {rows(off, 'off')}
          </LifecycleSection>
        </div>
      )}
    </>
  )
}
