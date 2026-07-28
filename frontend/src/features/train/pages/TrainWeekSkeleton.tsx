// Layout-aware loading skeleton for TrainWeekPage (mezo-9bbc): page head →
// three load tiles → seven day-card placeholders, so the swap does not reflow.
import { Skeleton, SkeletonCard } from '@/shared/ui/Skeleton'

export default function TrainWeekSkeleton() {
  return (
    <div role="status" aria-label="Betöltés…">
      <div className="pghead-np">
        <div className="col gap-xs"><Skeleton width={80} height={11} /><Skeleton width={120} height={22} /></div>
      </div>
      <div style={{ display: 'flex', gap: 9, margin: '14px 24px 0' }}>
        {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} width="100%" height={52} radius={18} />)}
      </div>
      <div style={{ padding: '16px 24px' }}>
        <div className="col gap-sm">
          {Array.from({ length: 7 }, (_, i) => (
            <SkeletonCard key={i} style={{ height: 96 }}>
              <Skeleton width="30%" height={10} />
              <div style={{ marginTop: 10 }}><Skeleton width="100%" height={40} radius={8} /></div>
            </SkeletonCard>
          ))}
        </div>
      </div>
    </div>
  )
}
