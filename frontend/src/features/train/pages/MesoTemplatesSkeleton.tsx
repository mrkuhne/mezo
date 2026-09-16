// Layout-aware loading skeleton for MesoTemplatesPage. Rewritten for the Titanium list
// (T10 Task 3, mezo-88iwa.11): slim poster hero → ~2 `.pl-lib-card` placeholders (head,
// the three fact boxes, the muscle mini-row, the story line) → the loud create button —
// the same geometry the real page draws, so the swap does not reflow.
import { Skeleton, SkeletonCard } from '@/shared/ui/Skeleton'

export default function MesoTemplatesSkeleton() {
  return (
    <div role="status" aria-label="Betöltés…">
      <Skeleton height={190} radius={0} />
      <div className="col gap-sm" style={{ padding: '14px 17px 19px' }}>
        {Array.from({ length: 2 }, (_, i) => (
          <SkeletonCard key={i} style={{ padding: '13px 14px', borderRadius: 20 }}>
            <div className="col gap-sm">
              <Skeleton width="62%" height={16} />
              <div className="row gap-sm">
                <Skeleton width="31%" height={44} radius={14} />
                <Skeleton width="31%" height={44} radius={14} />
                <Skeleton width="31%" height={44} radius={14} />
              </div>
              <div className="row gap-xs">
                {Array.from({ length: 4 }, (_, k) => <Skeleton key={k} width={30} height={30} radius={10} />)}
              </div>
              <Skeleton width="45%" height={11} />
            </div>
          </SkeletonCard>
        ))}
        <Skeleton height={72} radius={22} />
      </div>
    </div>
  )
}
