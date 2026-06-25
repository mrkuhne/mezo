// Layout-aware loading skeleton for TrainTodayView (mezo-f2z). Mirrors the real
// Mai shape — page-header → gym hero card (eyebrow/title/3-chip row/CTA block) →
// weekly timeline of day rows — so the swap to real content does not reflow.
// Built from the Skeleton primitives.
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton'

export default function TrainTodaySkeleton() {
  return (
    <div role="status" aria-label="Betöltés…">
      <div className="page-header">
        <div className="col gap-xs"><Skeleton width={80} height={11} /><Skeleton width={120} height={20} /></div>
        <Skeleton width={64} height={9} />
      </div>
      {/* Today's gym hero card */}
      <div style={{ padding: '0 24px 12px' }}>
        <SkeletonCard style={{ padding: 18 }}>
          <Skeleton width="40%" height={10} />
          <div style={{ marginTop: 10 }}><Skeleton width="62%" height={22} /></div>
          <div className="row gap-sm mt-md">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} width={72} height={22} radius={4} />
            ))}
          </div>
          <Skeleton className="mt-md" width="100%" height={44} radius={4} />
        </SkeletonCard>
      </div>
      {/* Weekly timeline */}
      <div style={{ padding: '0 24px 16px' }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <Skeleton width={180} height={10} /><Skeleton width={54} height={9} />
        </div>
        <div className="col gap-sm">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} width="100%" height={44} radius={8} />
          ))}
        </div>
      </div>
    </div>
  )
}
