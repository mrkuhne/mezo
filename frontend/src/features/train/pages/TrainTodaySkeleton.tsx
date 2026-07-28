// Layout-aware loading skeleton for TrainTodayPage (mezo-f2z). Mirrors the real
// Mai shape — page-header → DayStrip (7 chips) → gym hero card (eyebrow/title/
// 3-chip row/CTA block) — so the swap to real content does not reflow. The weekly
// timeline it used to mirror moved to Heti (mezo-9bbc), and TrainWeekSkeleton
// mirrors it there.
// Built from the Skeleton primitives.
import { Skeleton, SkeletonCard } from '@/shared/ui/Skeleton'

export default function TrainTodaySkeleton() {
  return (
    <div role="status" aria-label="Betöltés…">
      <div className="page-header">
        <div className="col gap-xs"><Skeleton width={80} height={11} /><Skeleton width={120} height={20} /></div>
        <Skeleton width={64} height={9} />
      </div>
      {/* DayStrip — 7 chips at the real `.daychip` geometry (62×66, radius 20) and
          the real `.daystrip` padding/gap, so the navigator does not pop in. */}
      <div style={{ display: 'flex', gap: 9, padding: '2px 24px 6px', overflow: 'hidden' }}>
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} width={62} height={66} radius={20} style={{ flex: 'none' }} />
        ))}
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
    </div>
  )
}
