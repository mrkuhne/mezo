import { useState } from 'react'
import { usePatternMonitor } from '@/data/hooks'
import { DomainSection } from '@/features/insights/components/DomainSection'
import { MetricCoverageRing } from '@/features/insights/components/MetricCoverageRing'
import { MotorHero } from '@/features/insights/components/MotorHero'
import { PairRow } from '@/features/insights/components/PairRow'
import { VerdictFilterChips } from '@/features/insights/components/VerdictFilterChips'
import { DOMAIN_META, groupPairsByDomain } from '@/features/insights/logic/domains'
import { GhostState } from '@/shared/ui/GhostState'
import type { PatternGateVerdict } from '@/data/types'

export function MotorPage() {
  const { monitor, degraded, isPending, isError, refetch } = usePatternMonitor()
  // Verdikt-szűrő (mezo-18bx): üres set = nincs szűrés; a chipek toggle-ként dolgoznak.
  const [activeVerdicts, setActiveVerdicts] = useState<Set<PatternGateVerdict>>(new Set())

  const toggleVerdict = (verdict: PatternGateVerdict) =>
    setActiveVerdicts((prev) => {
      const next = new Set(prev)
      if (next.has(verdict)) next.delete(verdict)
      else next.add(verdict)
      return next
    })

  // isPending: real-mode-only (mock seeds synchronously, mezo-viqs fix wave, useDualQuery.ts:9-11)
  // — without this the loading window rendered a blank body (`!monitor` below was also true then).
  if (isPending) {
    return <GhostState message="A motor állapotának betöltése…" />
  }
  // isError: a genuinely FAILED fetch (500, network) — distinct from `degraded` (404, switched
  // off) and from the unresolved-yet window above. Both `degraded` and a failed fetch otherwise
  // read as `monitor === null`, which used to render nothing at all (mezo-viqs review fix).
  if (isError) {
    return <GhostState message="Nem sikerült betölteni a motor állapotát." ctaLabel="Újra" onCta={refetch} />
  }
  if (degraded) {
    return (
      <div className="card" style={{ padding: 16, textAlign: 'center' }}>
        <p className="text-tertiary" style={{ fontSize: 12 }}>A minta-motor most nem elérhető.</p>
      </div>
    )
  }
  if (!monitor) return null

  const counts = { live: 0, few_days: 0, no_data: 0, degenerate: 0, frozen: 0 } as Record<PatternGateVerdict, number>
  for (const pair of monitor.pairs) counts[pair.verdict]++
  const filterActive = activeVerdicts.size > 0

  const grouped = groupPairsByDomain(monitor.pairs)
  const metrics = [...monitor.metrics].sort((a, b) => a.coveredDays - b.coveredDays)
  const coverageByKey = new Map(monitor.metrics.map((m) => [m.key, m]))

  return (
    <div className="col gap-md">
      <MotorHero monitor={monitor} />
      <VerdictFilterChips counts={counts} active={activeVerdicts} onToggle={toggleVerdict} />

      {[...grouped.entries()].map(([domain, domainPairs]) => {
        const visible = filterActive ? domainPairs.filter((p) => activeVerdicts.has(p.verdict)) : domainPairs
        return (
          <DomainSection
            key={domain}
            domain={domain}
            pairCount={domainPairs.length}
            liveCount={domainPairs.filter((p) => p.verdict === 'live').length}
            filteredEmpty={visible.length === 0}
          >
            {visible.map((pair) => (
              <PairRow
                key={pair.key}
                pair={pair}
                bottleneckCoveredDays={
                  pair.bottleneckMetricKey ? (coverageByKey.get(pair.bottleneckMetricKey)?.coveredDays ?? null) : null
                }
                sourceA={coverageByKey.get(pair.metricAKey)?.sourceHu ?? ''}
                sourceB={coverageByKey.get(pair.metricBKey)?.sourceHu ?? ''}
                railColor={DOMAIN_META[domain].rail}
              />
            ))}
          </DomainSection>
        )
      })}

      <span className="eyebrow mt-md">Metrika-lefedettség</span>
      <div className="card col gap-md" style={{ padding: 14 }}>
        {metrics.map((metric) => {
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
    </div>
  )
}
