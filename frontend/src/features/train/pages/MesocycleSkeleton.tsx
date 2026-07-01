// Layout-aware loading skeleton for MesocycleLibraryPage (mezo-f2z). Mirrors the real
// shape — page-header → a section eyebrow line → ~2 meso-card placeholders — so the swap
// to real content does not reflow. Built from the Skeleton primitives.
import { Skeleton, SkeletonCard } from '@/shared/ui/Skeleton'

export default function MesocycleSkeleton() {
  return (
    <div role="status" aria-label="Betöltés…">
      <div className="page-header">
        <div className="col gap-xs"><Skeleton width={120} height={11} /><Skeleton width={150} height={20} /></div>
        <Skeleton width={44} height={28} radius={6} />
      </div>
      {/* Section eyebrow + ~2 meso-card placeholders */}
      <div style={{ padding: '8px 24px 24px' }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <Skeleton width={70} height={10} /><Skeleton width={56} height={9} />
        </div>
        <div className="col gap-sm">
          {Array.from({ length: 2 }, (_, i) => (
            <SkeletonCard key={i} style={{ padding: 16 }}>
              <div className="col gap-sm">
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <Skeleton width="50%" height={15} /><Skeleton width={48} height={10} />
                </div>
                <Skeleton width="100%" height={8} radius={4} />
                <div className="row gap-md mt-sm" style={{ alignItems: 'center' }}>
                  <Skeleton width="30%" height={9} /><Skeleton width="25%" height={9} />
                </div>
              </div>
            </SkeletonCard>
          ))}
        </div>
      </div>
    </div>
  )
}
