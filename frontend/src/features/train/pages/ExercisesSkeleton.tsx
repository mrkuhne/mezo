// Layout-aware loading skeleton for ExercisesPage. Rewritten for the Titanium catalogue
// (parity P2 Task 4, mezo-lf3cv): the poster hero → the search field → the region chip row
// → a column of `.gy-card` placeholders (34px anatomy art + name/muscle + the trailing best
// block) — the same geometry the real page draws, so the swap does not reflow.
import { Skeleton, SkeletonCard } from '@/shared/ui/Skeleton'

export default function ExercisesSkeleton() {
  return (
    <div role="status" aria-label="Betöltés…">
      <Skeleton height={205} radius={0} />
      <div className="col gap-sm" style={{ padding: '14px 17px 19px' }}>
        <Skeleton width="100%" height={48} radius={14} />
        <div className="row gap-xs" style={{ paddingBottom: 4 }}>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} width={62} height={44} radius={999} />
          ))}
        </div>
        {Array.from({ length: 6 }, (_, i) => (
          <SkeletonCard key={i} style={{ padding: '11px 13px', borderRadius: 18 }}>
            <div className="row gap-sm" style={{ alignItems: 'center' }}>
              <Skeleton width={34} height={34} radius={10} />
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
