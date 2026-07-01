// Layout-aware loading skeleton for GoalsView (mezo-f2z). Mirrors the real Goals
// shape — page-header → goal hero card (eyebrow + title + window + a wide weight
// track + 2 stats) → a timeline-row placeholder — so the swap to real content does
// not reflow. Built from the Skeleton primitives.
import { Skeleton, SkeletonCard } from '@/shared/ui/Skeleton'

export default function GoalsSkeleton() {
  return (
    <div role="status" aria-label="Betöltés…">
      <div className="page-header">
        <div className="col gap-xs"><Skeleton width={70} height={11} /><Skeleton width={120} height={20} /></div>
        <Skeleton width={64} height={24} radius={8} />
      </div>
      {/* Goal hero — eyebrow + title + window, a wide weight-track block, 2 stats */}
      <div style={{ padding: '0 24px 16px' }}>
        <SkeletonCard style={{ padding: 20 }}>
          <div className="col gap-sm">
            <Skeleton width={110} height={9} />
            <Skeleton width="65%" height={22} />
            <Skeleton width={130} height={11} />
          </div>
          {/* Weight track */}
          <div className="mt-lg col gap-sm">
            <div className="row gap-md" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <Skeleton width={70} height={34} />
              <Skeleton width={50} height={22} />
            </div>
            <Skeleton width="100%" height={6} radius={3} />
            <div className="row gap-md" style={{ justifyContent: 'space-between' }}>
              <Skeleton width={80} height={9} /><Skeleton width={70} height={9} />
            </div>
          </div>
          {/* Stats — 2 backend-derived figures */}
          <div className="row gap-md mt-lg" style={{ paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
            {Array.from({ length: 2 }, (_, i) => (
              <div key={i} className="col gap-sm" style={{ flex: 1 }}>
                <Skeleton width="50%" height={9} /><Skeleton width="60%" height={16} />
              </div>
            ))}
          </div>
        </SkeletonCard>
      </div>
      {/* Timeline row placeholder */}
      <div style={{ padding: '0 24px 24px' }}>
        <Skeleton width={150} height={10} style={{ marginBottom: 12 }} />
        <Skeleton width="100%" height={72} radius={11} />
      </div>
    </div>
  )
}
