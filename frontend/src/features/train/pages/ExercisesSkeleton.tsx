// Layout-aware loading skeleton for ExercisesPage (mezo-f2z). Mirrors the real shape —
// page-header → search bar → muscle-filter chip row → a section eyebrow → a column of
// variant-A card placeholders (muscle rail + rank plaque + name + play roundel · pill
// row · stat strip, mezo-kaui) — so the swap to real content does not reflow.
import { Skeleton, SkeletonCard } from '@/shared/ui/Skeleton'

export default function ExercisesSkeleton() {
  return (
    <div role="status" aria-label="Betöltés…">
      <div className="page-header">
        <div className="col gap-xs"><Skeleton width={110} height={11} /><Skeleton width={150} height={20} /></div>
      </div>
      <div style={{ padding: '0 24px 8px' }}>
        {/* Search bar */}
        <SkeletonCard style={{ padding: 10, marginBottom: 10 }}>
          <div className="row gap-sm" style={{ alignItems: 'center' }}>
            <Skeleton variant="circle" width={14} height={14} />
            <Skeleton width="70%" height={13} />
          </div>
        </SkeletonCard>
        {/* Muscle-filter chip row */}
        <div className="row gap-xs" style={{ marginBottom: 4, paddingBottom: 4 }}>
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} width={56} height={24} radius={6} />
          ))}
        </div>
      </div>
      {/* Section eyebrow + ~4 RecordRow placeholders */}
      <div style={{ padding: '0 24px 32px' }}>
        <div className="row" style={{ justifyContent: 'space-between', margin: '10px 0' }}>
          <Skeleton width={140} height={10} /><Skeleton width={40} height={9} />
        </div>
        <div className="col gap-sm">
          {Array.from({ length: 4 }, (_, i) => (
            <SkeletonCard key={i} style={{ padding: 0, overflow: 'hidden' }}>
              <div className="row" style={{ alignItems: 'stretch' }}>
                <Skeleton width={5} height={104} radius={0} />
                <div className="col gap-sm flex-1" style={{ padding: '14px 14px 12px' }}>
                  <div className="row gap-sm" style={{ alignItems: 'center' }}>
                    <Skeleton width={26} height={26} radius={8} />
                    <Skeleton width="55%" height={15} />
                    <div className="flex-1" />
                    <Skeleton variant="circle" width={30} height={30} />
                  </div>
                  <div className="row gap-xs">
                    <Skeleton width={54} height={18} radius={999} />
                    <Skeleton width={72} height={18} radius={999} />
                    <Skeleton width={64} height={18} radius={999} />
                  </div>
                  <div className="row gap-md">
                    <Skeleton width="24%" height={22} />
                    <Skeleton width="24%" height={22} />
                    <Skeleton width="24%" height={22} />
                  </div>
                </div>
              </div>
            </SkeletonCard>
          ))}
        </div>
      </div>
    </div>
  )
}
