import { useState } from 'react'
import { Icon } from '@/shared/ui/Icon'
import { Sheet } from '@/shared/ui/Sheet'
import { PatternDomainMark } from '@/features/insights/components/PatternDomainMark'
import type { PatternCatalogSort } from '@/features/insights/logic/patternCatalog'
import type { MetricDomain } from '@/data/types'

export function PatternFilterSheet({
  domain,
  sort,
  availableDomains,
  onApply,
  onClose,
}: {
  domain: MetricDomain | null
  sort: PatternCatalogSort
  availableDomains: MetricDomain[]
  onApply: (next: { domain: MetricDomain | null; sort: PatternCatalogSort }) => void
  onClose: () => void
}) {
  const [draftDomain, setDraftDomain] = useState<MetricDomain | null>(domain)
  const [draftSort, setDraftSort] = useState<PatternCatalogSort>(sort)

  return (
    <Sheet onClose={onClose} labelledBy="pattern-filter-title" className="mnt-filter-sheet">
      {(close) => (
        <>
          <div className="mnt-filter-head">
            <div><span className="eyebrow">Katalógus</span><h2 id="pattern-filter-title">Szűrés</h2></div>
            <button type="button" className="icon-btn" aria-label="Szűrő bezárása" onClick={close}>
              <Icon name="x" size={18} />
            </button>
          </div>

          <span className="mnt-filter-label">Téma</span>
          <div className="mnt-filter-grid" role="group" aria-label="Téma">
            <button type="button" className="mnt-filter-option" aria-pressed={draftDomain == null}
              onClick={() => setDraftDomain(null)}>
              <Icon name="insights" size={20} /><span>Mind</span>
            </button>
            {availableDomains.map((item) => (
              <button type="button" className="mnt-filter-option" key={item}
                aria-pressed={draftDomain === item} onClick={() => setDraftDomain(item)}>
                <PatternDomainMark domain={item} size={22} />
              </button>
            ))}
          </div>

          <label className="mnt-filter-label" htmlFor="pattern-sort">Sorrend</label>
          <select id="pattern-sort" aria-label="Sorrend" value={draftSort}
            onChange={(event) => setDraftSort(event.target.value as PatternCatalogSort)}>
            <option value="progress">Áttöréshez legközelebb</option>
            <option value="domain">Téma szerint</option>
          </select>

          <button type="button" className="mzh-cta mnt-filter-apply" onClick={() => {
            onApply({ domain: draftDomain, sort: draftSort })
            close()
          }}>
            Alkalmazom
          </button>
        </>
      )}
    </Sheet>
  )
}
