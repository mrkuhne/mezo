import type { PatternMetricCoverage } from '@/data/types'

export function MetricCoverageRow({ metric }: { metric: PatternMetricCoverage }) {
  const ratio = metric.windowDays === 0 ? 0 : metric.coveredDays / metric.windowDays
  const color = ratio >= 0.5 ? 'var(--success)' : ratio > 0 ? 'var(--warning)' : 'var(--text-tertiary)'

  return (
    <div className="col gap-xs">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span data-testid="coverage-label" className="eyebrow" style={{ color: 'var(--text-primary)' }}>
          {metric.label}
        </span>
        <span className="eyebrow text-tertiary">{metric.coveredDays}/{metric.windowDays} nap</span>
      </div>
      <div className="bar">
        <div className="bar-fill" style={{ width: `${ratio * 100}%`, background: color }} />
      </div>
      <span className="eyebrow text-tertiary">
        {metric.lastDayWithData ?? '—'} · {metric.pairCount} párban
      </span>
    </div>
  )
}
