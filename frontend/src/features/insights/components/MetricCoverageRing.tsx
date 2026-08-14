import { useState } from 'react'
import type { PatternMetricCoverage } from '@/data/types'

/**
 * Metrika-lefedettség sor progress-gyűrűvel (mezo-18bx, a MetricCoverageRow utódja).
 * `waiting`: a metrika egyetlen hivatkozó párja sem élő — a felirat cselekvésre hív
 * („N pár vár rá"); kibontva a forrás + a hivatkozó párok címei.
 */
export function MetricCoverageRing({
  metric,
  referencingTitles,
  waiting,
}: {
  metric: PatternMetricCoverage
  referencingTitles: string[]
  waiting: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const ratio = metric.windowDays === 0 ? 0 : metric.coveredDays / metric.windowDays
  const ringColor = ratio >= 0.5 ? 'var(--success-base)' : ratio > 0 ? 'var(--warning-base)' : 'var(--text-disabled)'

  return (
    <div
      data-testid="coverage-ring-row"
      className="col"
      style={{ gap: 6, cursor: 'pointer' }}
      aria-expanded={expanded}
      onClick={() => setExpanded((v) => !v)}
    >
      <div className="row gap-sm" style={{ alignItems: 'center' }}>
        <span
          className="row"
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            flexShrink: 0,
            alignItems: 'center',
            justifyContent: 'center',
            background: `conic-gradient(${ringColor} ${ratio * 100}%, var(--surface-recess) 0)`,
          }}
        >
          <span
            className="row"
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: 'var(--surface-card)',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 9,
              fontWeight: 800,
              color: 'var(--text-primary)',
            }}
          >
            {metric.coveredDays}
          </span>
        </span>
        <span data-testid="coverage-label" className="eyebrow" style={{ color: 'var(--text-primary)' }}>
          {metric.label}
        </span>
        <span className="eyebrow text-tertiary" style={{ marginLeft: 'auto', textAlign: 'right' }}>
          {metric.coveredDays}/{metric.windowDays} nap ·{' '}
          {waiting ? `${metric.pairCount} pár vár rá` : `${metric.pairCount} párban`}
        </span>
      </div>

      {expanded && (
        <div className="col" style={{ gap: 3, paddingLeft: 42 }}>
          <span className="eyebrow text-tertiary">
            <span>📥 </span>
            <span>{metric.sourceHu}</span>
          </span>
          {referencingTitles.map((title) => (
            <span key={title} className="text-tertiary" style={{ fontSize: 11 }}>
              {title}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
