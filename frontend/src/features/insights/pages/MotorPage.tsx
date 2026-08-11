import { usePatternMonitor } from '@/data/hooks'
import { GateVerdictRow } from '@/features/insights/components/GateVerdictRow'
import { MetricCoverageRow } from '@/features/insights/components/MetricCoverageRow'
import type { PatternGateVerdict, PatternMonitorPair } from '@/data/types'

/** „Mi van legközelebb az áttöréshez" — ettől cselekvésre váltható az oldal, nem számfal. */
const VERDICT_ORDER: Record<PatternGateVerdict, number> = {
  live: 0,
  few_days: 1,
  degenerate: 2,
  no_data: 3,
  frozen: 4,
}

function comparePairs(a: PatternMonitorPair, b: PatternMonitorPair): number {
  const byVerdict = VERDICT_ORDER[a.verdict] - VERDICT_ORDER[b.verdict]
  if (byVerdict !== 0) return byVerdict
  // few_days-en belül: kevesebb hiányzó nap előre; máshol a több illesztett nap előre
  if (a.verdict === 'few_days') return (a.missingDays ?? 0) - (b.missingDays ?? 0)
  return b.alignedDays - a.alignedDays
}

export function MotorPage() {
  const { monitor, degraded } = usePatternMonitor()

  if (degraded) {
    return (
      <div className="card" style={{ padding: 16, textAlign: 'center' }}>
        <p className="text-tertiary" style={{ fontSize: 12 }}>A minta-motor most nem elérhető.</p>
      </div>
    )
  }
  if (!monitor) return null

  const pairs = [...monitor.pairs].sort(comparePairs)
  const metrics = [...monitor.metrics].sort((a, b) => a.coveredDays - b.coveredDays)

  return (
    <div className="col gap-md">
      <div className="card" style={{ padding: 14, background: 'var(--wash-lav)' }}>
        <div className="eyebrow" style={{ color: 'var(--lav-deep)' }}>A motor állapota</div>
        <div className="col gap-xs" style={{ marginTop: 10 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="eyebrow text-tertiary">Ablak</span>
            <span className="eyebrow" style={{ color: 'var(--text-primary)' }}>
              {monitor.windowFrom} – {monitor.windowTo}
            </span>
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="eyebrow text-tertiary">Hossz</span>
            <span className="eyebrow" style={{ color: 'var(--text-primary)' }}>{monitor.lookbackDays} nap</span>
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="eyebrow text-tertiary">Kapu</span>
            <span className="eyebrow" style={{ color: 'var(--text-primary)' }}>min. {monitor.minN} illeszkedő nap</span>
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="eyebrow text-tertiary">Ütemezés</span>
            <span className="eyebrow" style={{ fontFamily: 'var(--ff-mono)', color: 'var(--text-primary)' }}>{monitor.cron}</span>
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="eyebrow text-tertiary">Utolsó futás</span>
            <span className="eyebrow" style={{ color: 'var(--text-primary)' }}>
              {monitor.lastRunAt ? monitor.lastRunAt.slice(0, 10) : 'még nem futott'}
            </span>
          </div>
        </div>
      </div>

      <span className="eyebrow">Párok · {pairs.length}</span>
      {pairs.map((pair) => (
        <GateVerdictRow key={pair.key} pair={pair} />
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
