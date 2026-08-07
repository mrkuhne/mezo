// Layout-aware loading skeleton for TrainWeekPage (mezo-9bbc): page head →
// three load tiles → seven day-card placeholders, so the swap does not reflow.
// Sizes track the DS re-skin (mezo-setx.6.3): 36px h1, r-lg load tiles, and day
// cards tall enough for a 48dp session block.
import { Skeleton, SkeletonCard } from '@/shared/ui/Skeleton'

export default function TrainWeekSkeleton() {
  return (
    <div role="status" aria-label="Betöltés…">
      <div className="page-header">
        <div className="col gap-xs"><Skeleton width={90} height={12} /><Skeleton width={165} height={36} /></div>
      </div>
      <div style={{ display: 'flex', gap: 9, margin: '14px 24px 0' }}>
        {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} width="100%" height={56} radius={14} />)}
      </div>
      <div style={{ padding: '16px 24px' }}>
        <div className="col gap-sm">
          {Array.from({ length: 7 }, (_, i) => (
            <SkeletonCard key={i} style={{ height: 108 }}>
              <Skeleton width="30%" height={12} />
              <div style={{ marginTop: 12 }}><Skeleton width="100%" height={48} radius={14} /></div>
            </SkeletonCard>
          ))}
        </div>
      </div>
    </div>
  )
}
