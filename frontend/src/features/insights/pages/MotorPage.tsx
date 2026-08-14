import { useState } from 'react'
import { usePatternMonitor } from '@/data/hooks'
import { GateVerdictRow } from '@/features/insights/components/GateVerdictRow'
import { MetricCoverageRow } from '@/features/insights/components/MetricCoverageRow'
import { MotorHero } from '@/features/insights/components/MotorHero'
import { VerdictFilterChips } from '@/features/insights/components/VerdictFilterChips'
import { comparePairs } from '@/features/insights/logic/domains'
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
  const visible = activeVerdicts.size === 0
    ? monitor.pairs
    : monitor.pairs.filter((p) => activeVerdicts.has(p.verdict))

  const pairs = [...visible].sort(comparePairs)
  const metrics = [...monitor.metrics].sort((a, b) => a.coveredDays - b.coveredDays)
  const coverageByKey = new Map(monitor.metrics.map((m) => [m.key, m.coveredDays]))

  return (
    <div className="col gap-md">
      <MotorHero monitor={monitor} />
      <VerdictFilterChips counts={counts} active={activeVerdicts} onToggle={toggleVerdict} />

      <span className="eyebrow">Párok · {pairs.length}</span>
      {pairs.map((pair) => (
        <GateVerdictRow
          key={pair.key}
          pair={pair}
          bottleneckCoveredDays={pair.bottleneckMetricKey ? (coverageByKey.get(pair.bottleneckMetricKey) ?? null) : null}
        />
      ))}

      <span className="eyebrow mt-md">Metrika-lefedettség</span>
      <div className="card col gap-md" style={{ padding: 14 }}>
        {metrics.map((metric) => (
          <MetricCoverageRow key={metric.key} metric={metric} />
        ))}
      </div>
    </div>
  )
}
