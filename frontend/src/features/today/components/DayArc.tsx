import { buildArcPoints, arcProgress, pointXY } from '@/features/today/logic/dayArc'
import type { ArcPoint } from '@/features/today/logic/dayArc'
import type { CheckinSlot } from '@/data/types'

const ARC = 'M 22 100 Q 182 -28 342 100'
const ARC_LEN = 400 // ≥ real path length; progress uses fraction of this

const DOT_CLASS: Record<ArcPoint['kind'], string> = {
  'checkin-done': 'arc-dot arc-checkin-done',
  'checkin-now': 'arc-dot arc-checkin-now',
  'checkin-pending': 'arc-dot arc-checkin-pending',
  workout: 'arc-dot arc-workout',
  sleep: 'arc-dot arc-sleep',
}

export function DayArc({ checkins, workoutTime, now = new Date() }: {
  checkins: CheckinSlot[]
  workoutTime: string | null
  now?: Date
}) {
  const points = buildArcPoints({ checkins, workoutTime })
  const progress = arcProgress(now)
  const sun = pointXY(progress)
  return (
    <div className="dayarc" role="img" aria-label="A napod íve">
      <svg viewBox="0 0 364 112" width="100%">
        <defs>
          <linearGradient id="arc-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="var(--amber)" />
            <stop offset=".55" stopColor="var(--coral)" />
            <stop offset="1" stopColor="var(--lav)" />
          </linearGradient>
        </defs>
        <path d={ARC} fill="none" className="arc-base" />
        <path
          d={ARC} fill="none" className="arc-progress" stroke="url(#arc-grad)"
          strokeDasharray={`${Math.round(progress * ARC_LEN)} ${ARC_LEN}`}
        />
        {points.map(p => {
          const { x, y } = pointXY(p.t)
          return <circle key={`${p.kind}-${p.label}`} className={DOT_CLASS[p.kind]} cx={x} cy={y} r="6" />
        })}
        <circle className="arc-sun" cx={sun.x} cy={sun.y} r="7.5" />
      </svg>
      <div className="arclbl">
        {points.map(p => (
          <span key={`l-${p.kind}-${p.label}`}>{p.t >= progress && p.kind === 'checkin-now' ? <b>{p.label}</b> : p.label}</span>
        ))}
      </div>
    </div>
  )
}
