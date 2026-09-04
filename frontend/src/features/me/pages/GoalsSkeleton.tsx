import { Skeleton, SkeletonCard } from '@/shared/ui/Skeleton'
import { MozaikPage, PageBody } from '@/shared/ui/mozaik'

export default function GoalsSkeleton() {
  return (
    <MozaikPage tone="coral" className="goal-hub-page">
      <div role="status" aria-label="Betöltés…">
        <div className="goal-skeleton-head"><Skeleton width={58} height={28} radius={999} /></div>
        <PageBody className="goal-hub-body">
          <div className="goal-hub-title"><Skeleton width={120} height={10} /><Skeleton width={150} height={28} /></div>
          <SkeletonCard className="goal-skeleton-hero">
            <div className="goal-skeleton-top"><span><Skeleton width={88} height={10} /><Skeleton width={190} height={28} /></span><Skeleton width={64} height={64} radius={999} /></div>
            <Skeleton width="100%" height={45} radius={16} />
            <Skeleton width="100%" height={54} radius={16} />
          </SkeletonCard>
          <div className="goal-hub-mosaic mz-mosaic">
            {Array.from({ length: 6 }, (_, index) => (
              <SkeletonCard key={index} className="goal-skeleton-tile">
                <Skeleton width="70%" height={10} /><Skeleton width={47} height={47} radius={18} /><Skeleton width="85%" height={14} />
              </SkeletonCard>
            ))}
          </div>
        </PageBody>
      </div>
    </MozaikPage>
  )
}
