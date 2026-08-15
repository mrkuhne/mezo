import { useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { Icon } from '@/shared/ui/Icon'
import { GhostState } from '@/shared/ui/GhostState'
import { usePatterns, usePatternMonitor, usePatternActions } from '@/data/hooks'
import { MotorStateHero } from '@/features/insights/components/MotorStateHero'
import { PatternDecisionCard } from '@/features/insights/components/PatternDecisionCard'
import { LifecycleSection, LifecycleMiniRow } from '@/features/insights/components/LifecycleSection'
import { MetricCoverageRing } from '@/features/insights/components/MetricCoverageRing'
import { bucketize, BUCKET_ORDER, type LifecycleBucket, type LifecycleEntry } from '@/features/insights/logic/lifecycle'
import { verdictSentence } from '@/features/insights/logic/verdicts'
import { findingSentence } from '@/features/insights/logic/findings'
import type { MetricDomain, PatternMonitorPair, PatternStatus } from '@/data/types'

/** A mini-row címe: a pár (élő) kérdés-mondata, vagy — pár híján — a minta saját címe. */
function rowTitle(entry: LifecycleEntry): string {
  return entry.pair?.questionHu ?? entry.pattern?.title ?? ''
}

/** A „megfigyelés alatt"/„nincs összefüggés" sorok egysoros leletmondata — nyers r/p SOHA. */
function findingOneLiner(pair: PatternMonitorPair | null): string | null {
  if (!pair || pair.r == null) return null
  const finding = findingSentence(pair)
  if (!finding) return null
  return `${finding.prefix} ${finding.before}${finding.strength}${finding.after}.`
}

/**
 * A Minták dashboard (spec 2026-08-14 · mezo-tk88.4) — a régi inbox-lista + a retirált Motor tab
 * diagnosztikájának összevonása egyetlen életciklus-nézetbe. Minden számolás kliens-oldali, nincs
 * új endpoint: a `bucketize` (logic/lifecycle.ts) osztja szét a mintákat + monitor-párokat a hat
 * kosárba, a hero + a döntés-kártyák + az öt összecsukható szekció + az „Adat-egészség" ebből épül.
 */
export function PatternsPage() {
  const { patterns, degraded: patternsDegraded, isPending: patternsPending } = usePatterns()
  const {
    monitor,
    degraded: monitorDegraded,
    isPending: monitorPending,
    isError: monitorIsError,
    refetch: monitorRefetch,
  } = usePatternMonitor()
  const { decide } = usePatternActions()
  const [params] = useSearchParams()
  // Domén-szűrő (spec): üres set = nincs szűrés. A „Mind" chip egy kattintásra az ÖSSZES aktív
  // domént eltávolítja — `onToggleDomain`-t hívja egyszer/domén UGYANABBAN a batch-ben, ezért a
  // toggle csak funkcionális setState-tel biztonságos (külön kattintásonkénti stale closure
  // eldobná a korábbi hívásokat).
  const [activeDomains, setActiveDomains] = useState<Set<MetricDomain>>(new Set())
  const [dataHealthOpen, setDataHealthOpen] = useState(false)

  // A Motor „Minta megnyitása →" / a régi inbox `?pair=` horgonya (mezo-18bx örököse): a
  // részletoldalra irányít — a lista maga már nem highlightol semmit, a részlet a cél.
  const targetPairKey = params.get('pair')
  if (targetPairKey) return <Navigate to={`/insights/patterns/${targetPairKey}`} replace />

  const isPending = patternsPending || monitorPending

  // Genuinely failed fetch (500, network) — külön a 404-degraded ÉS a betöltés-alatti ablaktól
  // (mindkettő `monitor === null`-ként olvasna, review fix wave mezo-viqs precedens).
  if (monitorIsError) {
    return (
      <GhostState message="Nem sikerült betölteni a motor állapotát." ctaLabel="Újra" onCta={monitorRefetch} />
    )
  }

  if (patternsDegraded && monitorDegraded) {
    return (
      <div className="card" style={{ padding: 16, textAlign: 'center' }}>
        <p className="text-tertiary" style={{ fontSize: 12 }}>
          A minta-motor most nem elérhető — a felismert minták itt jelennek majd meg.
        </p>
      </div>
    )
  }

  if (patterns.length === 0 && (monitor?.pairs.length ?? 0) === 0 && !isPending) {
    return (
      <div className="card" style={{ padding: 16, textAlign: 'center' }}>
        <p className="text-tertiary" style={{ fontSize: 12 }}>
          Még nincs felismert minta — az éjszakai elemzés magától tölti, ahogy gyűlnek a napok.
        </p>
      </div>
    )
  }

  const toggleDomain = (d: MetricDomain) =>
    setActiveDomains((prev) => {
      const next = new Set(prev)
      if (next.has(d)) next.delete(d)
      else next.add(d)
      return next
    })

  const buckets = bucketize(patterns, monitor)
  const counts = Object.fromEntries(BUCKET_ORDER.map((b) => [b, buckets.get(b)!.length])) as Record<
    LifecycleBucket,
    number
  >
  const byDomain = (e: LifecycleEntry) =>
    activeDomains.size === 0 || (e.pair != null && activeDomains.has(e.pair.metricBDomain))
  const visibleFor = (bucket: LifecycleBucket) => buckets.get(bucket)!.filter(byDomain)

  const coverageByKey = new Map((monitor?.metrics ?? []).map((m) => [m.key, m]))
  const bottleneckCoveredDays = (pair: PatternMonitorPair) =>
    pair.bottleneckMetricKey ? (coverageByKey.get(pair.bottleneckMetricKey)?.coveredDays ?? null) : null
  // Adat-egészség: a régi MotorPage metrika-lefedettség szekciójának portja verbatim — legvékonyabb elöl.
  const sortedMetrics = monitor ? [...monitor.metrics].sort((a, b) => a.coveredDays - b.coveredDays) : []

  const decideVisible = visibleFor('decide')
  const confirmedVisible = visibleFor('confirmed')
  const monitoringVisible = visibleFor('monitoring')
  const gatheringVisible = visibleFor('gathering')
  const noRelationshipVisible = visibleFor('noRelationship')
  const rejectedVisible = visibleFor('rejected')

  return (
    <div className="col gap-md">
      <MotorStateHero monitor={monitor} counts={counts} activeDomains={activeDomains} onToggleDomain={toggleDomain} />

      {decideVisible.length > 0 && (
        <>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="eyebrow" style={{ color: 'var(--warning-base)' }}>
              🔔 Döntésre vár · {decideVisible.length}
            </span>
            <span className="label-mono">csak erős jel</span>
          </div>
          {decideVisible.map((entry, i) => (
            <PatternDecisionCard
              key={entry.key}
              pattern={entry.pattern!}
              pair={entry.pair}
              onDecide={(d: PatternStatus) => decide(entry.pattern!.id, d)}
              showExplainer={i === 0}
            />
          ))}
        </>
      )}

      <LifecycleSection
        title="✓ Megerősítve — él a tudásban"
        accent="var(--success-deep)"
        count={confirmedVisible.length}
        defaultOpen
        footNote={`Ez a ${confirmedVisible.length} összefüggés benne van a társ fejében minden beszélgetésnél, és ebből épülnek az előrejelzések.`}
      >
        {confirmedVisible.map((entry) => (
          <LifecycleMiniRow key={entry.key} title={rowTitle(entry)} sub="megerősítve" to={`/insights/patterns/${entry.key}`} />
        ))}
      </LifecycleSection>

      <LifecycleSection title="👁 Megfigyelés alatt" accent="var(--accent-base)" count={monitoringVisible.length}>
        {monitoringVisible.map((entry) => (
          <LifecycleMiniRow
            key={entry.key}
            title={rowTitle(entry)}
            sub={findingOneLiner(entry.pair) ?? entry.pattern?.mechanism ?? ''}
            to={`/insights/patterns/${entry.key}`}
          />
        ))}
      </LifecycleSection>

      <LifecycleSection
        title="⏳ Még gyűlik az adat"
        accent="var(--text-secondary)"
        count={gatheringVisible.length}
        footNote="Ezek nem hibák — csak nincs elég közös nap. Amit logolsz, az hozza őket életre."
      >
        {gatheringVisible.map((entry) => (
          <LifecycleMiniRow
            key={entry.key}
            title={rowTitle(entry)}
            sub={entry.pair ? verdictSentence(entry.pair, bottleneckCoveredDays(entry.pair)) : ''}
            to={`/insights/patterns/${entry.key}`}
          />
        ))}
      </LifecycleSection>

      <LifecycleSection
        title="○ Megnéztük — nincs összefüggés"
        accent="var(--text-tertiary)"
        count={noRelationshipVisible.length}
        footNote="Ez is eredmény: megnéztük, és nincs kapcsolat. Nem kér döntést — ha később megerősödne, feljebb lép."
      >
        {noRelationshipVisible.map((entry) => (
          <LifecycleMiniRow
            key={entry.key}
            title={rowTitle(entry)}
            sub={findingOneLiner(entry.pair) ?? entry.pattern?.mechanism ?? ''}
            to={`/insights/patterns/${entry.key}`}
          />
        ))}
      </LifecycleSection>

      <LifecycleSection title="✕ Elvetve" accent="var(--text-tertiary)" count={rejectedVisible.length}>
        {rejectedVisible.map((entry) => (
          <LifecycleMiniRow
            key={entry.key}
            title={rowTitle(entry)}
            sub={entry.pair ? verdictSentence(entry.pair, bottleneckCoveredDays(entry.pair)) : 'elvetve'}
            to={`/insights/patterns/${entry.key}`}
          />
        ))}
      </LifecycleSection>

      {monitor && (
        <div className="card">
          <button
            type="button"
            onClick={() => setDataHealthOpen((v) => !v)}
            className="row"
            style={{ justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '13px 16px' }}
          >
            <span className="eyebrow">Adat-egészség</span>
            <Icon name={dataHealthOpen ? 'chevron-up' : 'chevron-down'} size={11} color="var(--text-tertiary)" />
          </button>
          {dataHealthOpen && (
            <div className="col gap-md" style={{ padding: '0 12px 12px' }}>
              {sortedMetrics.map((metric) => {
                const referencing = monitor.pairs.filter(
                  (p) => p.metricAKey === metric.key || p.metricBKey === metric.key,
                )
                return (
                  <MetricCoverageRing
                    key={metric.key}
                    metric={metric}
                    referencingTitles={referencing.map((p) => p.questionHu)}
                    waiting={referencing.length > 0 && referencing.every((p) => p.verdict !== 'live')}
                  />
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
