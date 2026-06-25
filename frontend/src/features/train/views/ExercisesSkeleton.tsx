// Layout-aware loading skeleton for ExercisesView (mezo-f2z). Mirrors the real shape —
// page-header → search bar → muscle-filter chip row → a section eyebrow → a column of
// RecordRow placeholders (rank circle + name line + small e1RM chip) — so the swap to
// real content does not reflow. Built from the Skeleton primitives.
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton'

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
            <SkeletonCard key={i} style={{ padding: 12 }}>
              <div className="row gap-md" style={{ alignItems: 'center' }}>
                <Skeleton variant="circle" width={22} height={22} />
                <div className="col gap-sm flex-1">
                  <Skeleton width="55%" height={13} /><Skeleton width="35%" height={9} />
                </div>
                <Skeleton width={52} height={20} radius={6} />
              </div>
            </SkeletonCard>
          ))}
        </div>
      </div>
    </div>
  )
}
