import { useState } from 'react'
import { addDays, huMonthDay, localDateString } from '@/shared/lib/dates'
import type { PatternMetricCoverage } from '@/data/types'

/** „utoljára: ma / tegnap / Máj 20" — a lefedettség-sor emberi dátuma (mezo-fj1g). */
export function lastSeenLabel(iso: string | null): string | null {
  if (!iso) return null
  const today = localDateString()
  if (iso === today) return 'ma'
  if (iso === addDays(today, -1)) return 'tegnap'
  return huMonthDay(iso)
}

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
        <span className="col" style={{ gap: 1, flex: 1, minWidth: 0 }}>
          <span data-testid="coverage-label" style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>
            {metric.label}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {metric.coveredDays}/{metric.windowDays} nap
            {lastSeenLabel(metric.lastDayWithData) ? ` · utoljára: ${lastSeenLabel(metric.lastDayWithData)}` : ''}
          </span>
        </span>
        <span
          className="chip"
          style={{
            fontSize: 9.5,
            fontWeight: 800,
            padding: '4px 9px',
            border: 'none',
            flexShrink: 0,
            color: waiting ? 'var(--warning-deep)' : 'var(--success-deep)',
            background: waiting ? 'var(--warning-bg)' : 'var(--success-bg)',
          }}
        >
          {waiting ? `${metric.pairCount} pár vár rá` : `${metric.pairCount} párban él`}
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
