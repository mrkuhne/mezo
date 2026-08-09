// Layout-aware loading skeleton for MesocycleLibraryPage (mezo-f2z). Mirrors the real
// shape — page-header → a section eyebrow line → ~2 meso-card placeholders — so the swap
// to real content does not reflow. Built from the Skeleton primitives.
// Sizes track the DS re-skin (mezo-setx.6.8): 36px h1, 44px header action,
// StatStrip-shaped meta row on the card.
import { Skeleton, SkeletonCard } from '@/shared/ui/Skeleton'

export default function MesocycleSkeleton() {
  return (
    <div role="status" aria-label="Betöltés…">
      <div className="page-header">
        <div className="col gap-xs"><Skeleton width={150} height={12} /><Skeleton width={190} height={36} /></div>
        <Skeleton width={64} height={44} radius={999} />
      </div>
      {/* Section eyebrow + ~2 meso-card placeholders */}
      <div style={{ padding: '8px 24px 24px' }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <Skeleton width={80} height={12} /><Skeleton width={64} height={12} />
        </div>
        <div className="col gap-sm">
          {Array.from({ length: 2 }, (_, i) => (
            <SkeletonCard key={i} style={{ padding: 16 }}>
              <div className="col gap-sm">
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <Skeleton width="50%" height={18} /><Skeleton width={56} height={12} />
                </div>
                <Skeleton width="100%" height={8} radius={4} />
                <div className="row gap-md mt-sm" style={{ alignItems: 'center' }}>
                  <Skeleton width="30%" height={16} /><Skeleton width="25%" height={16} />
                </div>
              </div>
            </SkeletonCard>
          ))}
        </div>
      </div>
    </div>
  )
}
