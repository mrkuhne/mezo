// Layout-aware loading skeleton for TrainTodayPage (mezo-f2z). Mirrors the real
// Mai shape — page-header → DayStrip (7 chips) → gym hero card (eyebrow/title/
// 3-chip row/CTA block) — so the swap to real content does not reflow. The weekly
// timeline it used to mirror moved to Heti (mezo-9bbc), and TrainWeekSkeleton
// mirrors it there.
// Built from the Skeleton primitives. Sizes track the DS re-skin (mezo-setx.6.2):
// 36px h1, 24px hero title, pill-shaped fact chips and a 48px CTA.
import { Skeleton, SkeletonCard } from '@/shared/ui/Skeleton'

export default function TrainTodaySkeleton() {
  return (
    <div role="status" aria-label="Betöltés…">
      <div className="page-header">
        <div className="col gap-xs"><Skeleton width={140} height={12} /><Skeleton width={150} height={36} /></div>
        <Skeleton width={64} height={44} radius={999} />
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
        <SkeletonCard style={{ padding: 16 }}>
          <Skeleton width="40%" height={12} />
          <div style={{ marginTop: 10 }}><Skeleton width="62%" height={24} /></div>
          <div className="row gap-sm mt-md">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} width={78} height={24} radius={999} />
            ))}
          </div>
          <Skeleton className="mt-md" width="100%" height={48} radius={999} />
        </SkeletonCard>
      </div>
    </div>
  )
}
