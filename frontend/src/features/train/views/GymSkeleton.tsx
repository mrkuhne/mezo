// Layout-aware loading skeleton for GymView (mezo-f2z). Mirrors the real Gym shape —
// page-header → meso meta card (4 stats + a divider strip) → day-by-day list — so the
// swap to real content does not reflow. Built from the Skeleton primitives.
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton'

export default function GymSkeleton() {
  return (
    <div role="status" aria-label="Betöltés…">
      <div className="page-header">
        <div className="col gap-xs"><Skeleton width={80} height={11} /><Skeleton width={130} height={20} /></div>
        <Skeleton width={56} height={9} />
      </div>
      {/* Meso meta card — 4 stats + a divider strip */}
      <div style={{ padding: '0 24px 12px' }}>
        <SkeletonCard style={{ padding: 16 }}>
          <div className="row gap-md" style={{ justifyContent: 'space-between' }}>
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="col gap-sm" style={{ flex: 1 }}>
                <Skeleton width="60%" height={9} /><Skeleton width="50%" height={16} /><Skeleton width="70%" height={8} />
              </div>
            ))}
          </div>
          <div
            className="row gap-md mt-md"
            style={{ paddingTop: 12, borderTop: '1px solid var(--border-subtle)', alignItems: 'center' }}
          >
            <Skeleton width="60%" height={9} style={{ flex: 1 }} />
            <Skeleton width={48} height={10} />
          </div>
        </SkeletonCard>
      </div>
      {/* Day-by-day */}
      <div style={{ padding: '0 24px 24px' }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <Skeleton width={80} height={10} /><Skeleton width={90} height={9} />
        </div>
        <div className="col gap-sm">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} width="100%" height={56} radius={11} />
          ))}
        </div>
      </div>
    </div>
  )
}
