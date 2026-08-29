// Layout-aware loading skeleton for ExercisesPage (mezo-f2z). Mirrors the real shape —
// page-header → search field → muscle-filter chip row → a section eyebrow → a column of
// `.excat` card placeholders (muscle rail + rank plaque + name + trailing action column ·
// Tag row · stat strip) — so the swap to real content does not reflow.
// Sizes track the DS re-skin (mezo-setx.6.7): 36px h1, 48px search field, 44px chips.
import { Skeleton, SkeletonCard } from '@/shared/ui/Skeleton'

export default function ExercisesSkeleton() {
  return (
    <div role="status" aria-label="Betöltés…">
      <div className="page-header">
        <div className="col gap-xs"><Skeleton width={120} height={12} /><Skeleton width={190} height={36} /></div>
        <Skeleton width={124} height={44} radius={999} />
      </div>
      {/* Compact hero (icon + count) + stat strip placeholder */}
      <div style={{ padding: '0 24px 4px' }}>
        <div className="row" style={{ justifyContent: 'center', alignItems: 'center', gap: 14, margin: '2px 0 12px' }}>
          <Skeleton variant="circle" width={57} height={57} />
          <Skeleton width={56} height={34} />
        </div>
        <div className="row gap-sm">
          <Skeleton width="33%" height={54} radius={16} />
          <Skeleton width="33%" height={54} radius={16} />
          <Skeleton width="33%" height={54} radius={16} />
        </div>
      </div>
      <div style={{ padding: '0 24px 8px' }}>
        {/* Search field */}
        <Skeleton width="100%" height={48} radius={14} />
        {/* Muscle-filter chip row */}
        <div className="row gap-xs" style={{ margin: '10px 0 4px', paddingBottom: 4 }}>
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} width={62} height={44} radius={999} />
          ))}
        </div>
      </div>
      {/* Section eyebrow + ~4 catalog-card placeholders */}
      <div style={{ padding: '0 24px 32px' }}>
        <div className="row" style={{ justifyContent: 'space-between', margin: '10px 0' }}>
          <Skeleton width={150} height={12} /><Skeleton width={44} height={11} />
        </div>
        <div className="col gap-sm">
          {Array.from({ length: 4 }, (_, i) => (
            <SkeletonCard key={i} style={{ padding: 0, overflow: 'hidden' }}>
              <div className="row" style={{ alignItems: 'stretch' }}>
                <Skeleton width={5} height={132} radius={0} />
                <div className="col gap-sm flex-1" style={{ padding: 16 }}>
                  <div className="row gap-sm" style={{ alignItems: 'center' }}>
                    <Skeleton width={28} height={28} radius={6} />
                    <Skeleton width="55%" height={18} />
                  </div>
                  <div className="row gap-xs">
                    <Skeleton width={58} height={16} radius={6} />
                    <Skeleton width={76} height={16} radius={6} />
                    <Skeleton width={68} height={16} radius={6} />
                  </div>
                  <div className="row gap-md">
                    <Skeleton width="26%" height={30} />
                    <Skeleton width="26%" height={30} />
                    <Skeleton width="26%" height={30} />
                  </div>
                </div>
                <div className="col" style={{ padding: 4 }}>
                  <Skeleton variant="circle" width={32} height={32} />
                </div>
              </div>
            </SkeletonCard>
          ))}
        </div>
      </div>
    </div>
  )
}
