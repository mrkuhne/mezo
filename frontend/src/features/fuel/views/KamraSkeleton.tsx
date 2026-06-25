// Layout-aware loading skeleton for FuelKamraView (mezo-f2z). Mirrors the real
// Kamra shape — page-header → 4-segment stats strip card → a few item cards —
// so the swap to real content does not reflow. Built from the Skeleton primitives.
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton'

export default function KamraSkeleton() {
  return (
    <div role="status" aria-label="Betöltés…">
      <div className="page-header"><Skeleton width={120} height={16} /><Skeleton width={54} height={11} /></div>
      <div style={{ padding: '0 24px 12px' }}>
        <SkeletonCard>
          <div className="row gap-md" style={{ justifyContent: 'space-between' }}>
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="col gap-sm" style={{ flex: 1 }}>
                <Skeleton width="60%" height={9} /><Skeleton width="40%" height={14} />
              </div>
            ))}
          </div>
        </SkeletonCard>
      </div>
      <div style={{ padding: '0 24px 12px' }}>
        {Array.from({ length: 3 }, (_, i) => (
          <SkeletonCard key={i} style={{ marginBottom: 10 }}>
            <div className="row gap-md">
              <Skeleton variant="circle" width={34} height={34} />
              <div className="col gap-sm" style={{ flex: 1 }}>
                <Skeleton width="66%" height={11} /><Skeleton width="38%" height={9} />
              </div>
            </div>
          </SkeletonCard>
        ))}
      </div>
    </div>
  )
}
