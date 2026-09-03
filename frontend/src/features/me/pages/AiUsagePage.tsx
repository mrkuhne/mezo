import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLlmCalls, useLlmUsageBreakdown } from '@/data/hooks'
import { AiCallFilters } from '@/features/me/components/AiCallFilters'
import { AiCallRow } from '@/features/me/components/AiCallRow'
import { AiFeatureBreakdown } from '@/features/me/components/AiFeatureBreakdown'
import { AiModelBreakdown } from '@/features/me/components/AiModelBreakdown'
import { AiUsageHero } from '@/features/me/components/AiUsageHero'
import { AiUserFilter } from '@/features/me/components/AiUserFilter'
import { GhostState } from '@/shared/ui/GhostState'
import { MozaikPage, PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import type { LlmCallFilters as Filters, LlmUsagePeriodKey } from '@/data/me/llmUsageApi'

// The AI-napló (mezo-uakh): the browsable face of llm_log_history. ONE period selection drives
// both the header rollup and the list, so the two can never disagree — every filter is applied
// server-side for the same reason (the header covers the whole period, the list only a window).
//
// Mozaik re-face (mezo-d20.6.8): full-screen sibling, own MozaikPage scaffold (source of truth
// en-body.html #page-ai, tone "gold" = .p-gold). The prototype's page-hero bignum shows the
// period's cost under the coin icon — but AiUsageHero already owns that exact number (its own
// component test pins call count + cost + status split), so the page hero stays icon+title
// only: showing the cost twice on one screen would violate "the same fact once" (handoff §10).
//
// Per-user chips (mezo-qw37.3): `byUser` from the same breakdown read; the chosen `userId` is a
// server-side list filter like the others — the whole page is OWNER-only since S3.

const PERIODS = [
  { key: 'DAY', label: 'Ma' },
  { key: 'WEEK', label: 'Ez a hét' },
  { key: 'MONTH', label: 'Ez a hónap' },
] as const satisfies readonly { key: LlmUsagePeriodKey; label: string }[]

const PAGE = 50
const MAX_WINDOW = 500

export function AiUsagePage() {
  const navigate = useNavigate()
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
    <MozaikPage tone="gold">
      <PageHead onBack={() => navigate(-1)} label="‹ Én" />
      <EntranceGroup>
        {/* Minimal hero — just the icon + title. Count, cost and the status split live
            ONE place, in AiUsageHero below (guardrail: the same fact shown once per
            screen); the prototype's page-hero bignum would otherwise repeat it. */}
        <PageHero icon="i-erme" name="AI-napló" />

        <PageBody>
          <div className="aiu-segtabs rise" style={{ '--d': '0ms' } as React.CSSProperties}>
            {PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                aria-pressed={period === p.key}
                onClick={() => changePeriod(p.key)}
                className={period === p.key ? 'on' : undefined}
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
              <AiUserFilter
                groups={breakdown.data.byUser}
                selected={filters.userId ?? null}
                onSelect={(userId) => changeFilters(userId ? { ...filters, userId } : omitUserId(filters))}
              />
            </>
          )}

          {/* The chips stay usable when only the breakdown failed (the filters run on the LIST
              endpoint), but their counts come from the rollup — so a failed rollup omits them
              rather than reading "Siker 0 · Hiba 0" over a list full of real rows. */}
          <AiCallFilters
            totals={breakdown.isError ? null : breakdown.data.totals}
            filters={filters}
            onChange={changeFilters}
          />

          {calls.isError ? (
            <GhostState message="Nem sikerült betölteni a hívásokat." ctaLabel="Újra" onCta={calls.refetch} />
          ) : calls.data.items.length === 0 ? (
            <GhostState message="Ebben az időszakban nincs naplózott hívás." />
          ) : (
            <div>
              {calls.data.items.map((call, i) => (
                <div key={call.id} className="rise" style={{ '--d': `${60 + i * 40}ms` } as React.CSSProperties}>
                  <AiCallRow call={call} />
                </div>
              ))}

              {calls.data.hasMore && limit < MAX_WINDOW && (
                <div style={{ textAlign: 'center', marginTop: 11 }}>
                  <button
                    type="button"
                    onClick={() => setLimit((n) => Math.min(n + PAGE, MAX_WINDOW))}
                    style={{ minHeight: 44, borderRadius: 999, padding: '9px 20px', fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px solid var(--border-subtle)', background: 'var(--surface-1)' }}
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

          <p className="aiu-foot">~ becslés — a modellárak tájékoztató jellegűek · Befagyasztott ártábla hívásonként.</p>
        </PageBody>
      </EntranceGroup>
    </MozaikPage>
  )
}

function omitFeature(filters: Filters): Filters {
  const { feature, ...rest } = filters
  return rest
}

function omitUserId(filters: Filters): Filters {
  const { userId, ...rest } = filters
  return rest
}
