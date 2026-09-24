// Layout-aware loading skeleton for ExercisesPage. Rewritten for the Titanium catalogue
// (parity P2 Task 4, mezo-lf3cv): the poster hero → the search field → the region chip row
// → a column of `.gy-card` placeholders (34px anatomy art + name/muscle + the trailing best
// block) — the same geometry the real page draws, so the swap does not reflow.
// Üveg (mezo-me75u.4): the hero is now a frameless halo row (84px art + copy), the cards
// 20px-radius glass rows with a 40px round anatomy well.
import { Skeleton, SkeletonCard } from '@/shared/ui/Skeleton'

export default function ExercisesSkeleton() {
  return (
    <div role="status" aria-label="Betöltés…">
      <div className="row gap-md" style={{ alignItems: 'center', padding: '16px 18px 10px' }}>
        <Skeleton variant="circle" width={84} height={84} />
        <div className="col gap-xs flex-1">
          <Skeleton width={90} height={10} />
          <Skeleton width="70%" height={26} />
          <Skeleton width="90%" height={12} />
          <Skeleton width="60%" height={11} />
        </div>
      </div>
      <div className="col gap-sm" style={{ padding: '6px 17px 19px' }}>
        <Skeleton width="100%" height={46} radius={16} />
        <div className="row gap-xs" style={{ paddingBottom: 4 }}>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} width={62} height={36} radius={999} />
          ))}
        </div>
        {Array.from({ length: 6 }, (_, i) => (
          <SkeletonCard key={i} style={{ padding: '11px 12px', borderRadius: 20 }}>
            <div className="row gap-sm" style={{ alignItems: 'center' }}>
              <Skeleton variant="circle" width={40} height={40} />
              <div className="col gap-xs flex-1">
                <Skeleton width="55%" height={14} />
                <Skeleton width="30%" height={10} />
              </div>
              <Skeleton width={54} height={26} />
            </div>
          </SkeletonCard>
        ))}
      </div>
    </div>
  )
}
