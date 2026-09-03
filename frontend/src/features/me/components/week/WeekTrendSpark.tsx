// ============================================================
// Heti pontszám-trend (mezo-d20.6.10)
// Source: en-body.html `.wktrend`, ×1.18. Eight weeks of score, the viewed
// week ringed. Renders NOTHING when there is no series — the honest-absence
// rule, and exactly what happens before the F6.6 trend endpoint exists.
// ============================================================
import type { CSSProperties } from 'react'
import { scoreBandClass } from '@/features/me/logic/scoreBand'

export interface WeekTrendPoint {
  /** ISO Monday of the week — also the React key. */
  weekStart: string
  score: number | null
}

export function WeekTrendSpark({
  points,
  currentWeekStart,
  className,
}: {
  points: WeekTrendPoint[]
  currentWeekStart?: string
  className?: string
}) {
  if (points.length === 0) return null

  return (
    <div className={className ? `wk-trend ${className}` : 'wk-trend'} aria-hidden="true">
      {points.map((point, i) => {
        const height = point.score == null ? 4 : Math.max(4, Math.round((point.score / 100) * 33))
        const isCurrent = currentWeekStart != null && point.weekStart === currentWeekStart
        return (
          <i
            key={point.weekStart}
            className={`${scoreBandClass(point.score)}${isCurrent ? ' is-current' : ''}`}
            style={{ height: `${height}px`, '--d': `${120 + i * 50}ms` } as CSSProperties}
          />
        )
      })}
    </div>
  )
}
