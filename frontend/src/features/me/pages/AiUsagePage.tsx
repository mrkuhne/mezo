import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLlmCalls, useLlmUsageBreakdown } from '@/data/hooks'
import { AiCallFilters } from '@/features/me/components/AiCallFilters'
import { AiCallRow } from '@/features/me/components/AiCallRow'
import { AiFeatureBreakdown } from '@/features/me/components/AiFeatureBreakdown'
import { AiModelBreakdown } from '@/features/me/components/AiModelBreakdown'
import { AiUsageHero } from '@/features/me/components/AiUsageHero'
import { GhostState } from '@/shared/ui/GhostState'
import type { LlmCallFilters as Filters, LlmUsagePeriodKey } from '@/data/me/llmUsageApi'

// The AI-napló (mezo-uakh): the browsable face of llm_log_history. ONE period selection drives
// both the header rollup and the list, so the two can never disagree — every filter is applied
// server-side for the same reason (the header covers the whole period, the list only a window).

const PERIODS = [
  { key: 'DAY', label: 'Ma' },
  { key: 'WEEK', label: 'Ez a hét' },
  { key: 'MONTH', label: 'Ez a hónap' },
] as const satisfies readonly { key: LlmUsagePeriodKey; label: string }[]

const PAGE = 50
const MAX_WINDOW = 500

export function AiUsagePage() {
  const [period, setPeriod] = useState<LlmUsagePeriodKey>('WEEK')
  const [filters, setFilters] = useState<Filters>({})
  const [limit, setLimit] = useState(PAGE)

  const breakdown = useLlmUsageBreakdown(period)
  const calls = useLlmCalls(period, filters, limit)

  // A new period or a new filter starts a fresh window — keeping a grown limit would make the
  // first render of the narrowed list needlessly heavy.
  const changePeriod = (next: LlmUsagePeriodKey) => {
    setPeriod(next)
    setLimit(PAGE)
  }
  const changeFilters = (next: Filters) => {
    setFilters(next)
    setLimit(PAGE)
  }

  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? ''

  return (
    <div className="col gap-md" style={{ padding: '14px 12px 24px' }}>
      <div className="row" style={{ alignItems: 'center', gap: 10 }}>
        <Link to="/me" aria-label="Vissza" style={{ fontSize: 19, color: 'var(--text-tertiary)' }}>‹</Link>
        <h1 style={{ fontSize: 16.5, fontWeight: 800, flex: 1, margin: 0 }}>AI-napló</h1>
      </div>

      <div className="row" style={{ background: 'var(--surface-2)', borderRadius: 12, padding: 3 }}>
        {PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            aria-pressed={period === p.key}
            onClick={() => changePeriod(p.key)}
            style={{
              flex: 1, textAlign: 'center', fontSize: 12, fontWeight: 700, padding: '7px 0',
              borderRadius: 9, border: 0, cursor: 'pointer',
              background: period === p.key ? 'var(--surface-1)' : 'transparent',
              color: period === p.key ? 'var(--text-primary)' : 'var(--text-tertiary)',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {breakdown.isError ? (
        <GhostState message="Nem sikerült betölteni az AI-használatot." ctaLabel="Újra" onCta={breakdown.refetch} />
      ) : (
        <>
          <AiUsageHero totals={breakdown.data.totals} periodLabel={periodLabel} />
          <AiFeatureBreakdown
            groups={breakdown.data.features}
            selected={filters.feature ?? null}
            onSelect={(feature) => changeFilters(feature ? { ...filters, feature } : omitFeature(filters))}
          />
          <AiModelBreakdown groups={breakdown.data.models} />
        </>
      )}

      <AiCallFilters totals={breakdown.data.totals} filters={filters} onChange={changeFilters} />

      {calls.isError ? (
        <GhostState message="Nem sikerült betölteni a hívásokat." ctaLabel="Újra" onCta={calls.refetch} />
      ) : calls.data.items.length === 0 ? (
        <GhostState message="Ebben az időszakban nincs naplózott hívás." />
      ) : (
        <div>
          {calls.data.items.map((call) => <AiCallRow key={call.id} call={call} />)}

          {calls.data.hasMore && limit < MAX_WINDOW && (
            <div style={{ textAlign: 'center', marginTop: 11 }}>
              <button
                type="button"
                onClick={() => setLimit((n) => Math.min(n + PAGE, MAX_WINDOW))}
                style={{ borderRadius: 999, padding: '9px 20px', fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px solid var(--border-subtle)', background: 'var(--surface-1)' }}
              >
                További hívások ({PAGE})
              </button>
            </div>
          )}
          {calls.data.hasMore && limit >= MAX_WINDOW && (
            <p className="text-tertiary" style={{ textAlign: 'center', fontSize: 10.5, marginTop: 11 }}>
              Az ablak betelt ({MAX_WINDOW} hívás) — szűkíts szűrővel a régebbiekhez.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function omitFeature(filters: Filters): Filters {
  const { feature, ...rest } = filters
  return rest
}
