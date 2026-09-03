import type { LifeGoalDimension } from '@/data/lifegoal/lifegoalApi'
import { DIMENSIONS, DIMENSION_ORDER } from '@/features/me/logic/lifegoalLabels'

// Six-arc PERMAH ring (prototype celok-body #ring6): one arc per dimension, live where an
// active goal exists, faint where none — the centre is the active-goal count.
export function PermahRing({ counts, total }: { counts: Record<LifeGoalDimension, number>; total: number }) {
  return (
    <div className="lg-ring" role="img" aria-label={`${total} aktív cél`}>
      <svg viewBox="0 0 80 80" width="94" height="94" aria-hidden="true">
        {DIMENSION_ORDER.map((d, i) => (
          <circle key={d} className={`arc ${DIMENSIONS[d].cls} ${counts[d] > 0 ? 'live' : ''}`}
            cx="40" cy="40" r="30" style={{ '--i': i, strokeDashoffset: -(i * 31.4) } as React.CSSProperties} />
        ))}
      </svg>
      <div className="c"><b>{total}</b><small>aktív cél</small></div>
    </div>
  )
}
