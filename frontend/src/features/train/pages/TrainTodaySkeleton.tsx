// Layout-aware loading skeleton for TrainTodayPage (mezo-f2z). Mirrors the real
// Mai shape — DayStrip (7 chips) → the `.tr-day` poster (over-line / big title /
// sub-line / constellation / chip row / in-poster CTA) — so the swap to real
// content does not reflow. The weekly timeline it used to mirror moved to Heti
// (mezo-9bbc), and TrainWeekSkeleton mirrors it there; the legacy `.page-header`
// placeholder went with the header itself (Titanium face, mezo-88iwa.6).
// Built from the Skeleton primitives; sizes track the `.tr-day`/`.tr-start` geometry.
import { Skeleton, SkeletonCard } from '@/shared/ui/Skeleton'

export default function TrainTodaySkeleton() {
  return (
    <div role="status" aria-label="Betöltés…">
      {/* DayStrip — 7 chips at the real `.daychip` geometry (62×66, radius 20) and
          the real `.daystrip` padding/gap, so the navigator does not pop in. */}
      <div style={{ display: 'flex', gap: 9, padding: '2px 24px 6px', overflow: 'hidden' }}>
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} width={62} height={66} radius={20} style={{ flex: 'none' }} />
        ))}
      </div>
      {/* Today's poster */}
      <div style={{ padding: '0 6px 14px' }}>
        <SkeletonCard style={{ padding: 18 }}>
          <Skeleton width="40%" height={12} />
          <div style={{ marginTop: 10 }}><Skeleton width="62%" height={27} /></div>
          <div style={{ marginTop: 8 }}><Skeleton width="50%" height={13} /></div>
          {/* the muscle constellation — four 28px chips */}
          <div className="row gap-sm" style={{ marginTop: 14 }}>
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} width={28} height={28} radius={8} />
            ))}
          </div>
          <div className="row gap-sm mt-md">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} width={78} height={24} radius={999} />
            ))}
          </div>
          {/* the in-poster CTA (`.tr-start`) */}
          <Skeleton className="mt-md" width="100%" height={56} radius={20} />
        </SkeletonCard>
      </div>
    </div>
  )
}
