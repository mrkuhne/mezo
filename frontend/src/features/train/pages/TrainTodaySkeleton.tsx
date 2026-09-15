// Layout-aware loading skeleton for TrainTodayPage (mezo-f2z). Mirrors the real
// Mai shape — DayStrip (7 chips) → the `.tr-day` poster (over-line / big title /
// sub-line / constellation / chip row / in-poster CTA) → the energy card →
// the muscle-impact card → the „Vagy inkább" pair — so the swap to real content
// does not reflow. The weekly timeline it used to mirror moved to Heti
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
          {/* the in-poster CTA (`.tr-start`) — padding 15px 18px + strong (16px/1.5 =
              24px) + small (12px/1.5 = 18px, +2px margin-top) = 30 + 24 + 2 + 18 = 74px. */}
          <Skeleton className="mt-md" width="100%" height={74} radius={20} />
        </SkeletonCard>
      </div>
      {/* The energy card (`.tr-energy`) — final render order (Task 5, mezo-88iwa.6) is
          poster → energy card → muscle-impact card → the „Vagy inkább" pair, not pair-
          directly-under-poster any more, so the skeleton must reserve the SAME two cards'
          worth of space in between or the real content swap reflows.
          Height derived from `.tr-energy`'s own CSS (prototype.css, browser default
          line-height ≈ 1.2× font-size for these single-line labels):
            padding 16 + 16                                         = 32
          + `.tr-eyebrow` (10px)                    ≈ 10*1.2         = 12
          + `h3` (margin 4/0/12, 15px)               4 + 15*1.2 + 12 = 34
          + `.tr-energy-main` (36px display strong, the tallest baseline sibling)
                                                          36*1.2      = 43
          + `.tr-energy-split` (margin-top 10, 2× 12px lines, 4px gap)
                                                     10 + 12*1.2*2 + 4 = 43
          + `.tr-energy-note` (margin-top 12, 11px)  12 + 11*1.2     = 25
          ────────────────────────────────────────────────────────────
                                                                 total ≈ 189px */}
      <div style={{ padding: '0 6px 14px' }}>
        <Skeleton width="100%" height={189} radius={22} />
      </div>
      {/* The muscle-impact card (`.tr-mus`) — same derivation approach. `dayImpact`
          always surfaces the four BIG_FAMILIES rows at minimum (`muscleColors.ts`), so
          4 rows is the typical/reserved count (matches the poster's own 4-chip
          constellation placeholder above).
            padding 16 + 16                                          = 32
          + `.tr-eyebrow` (10px)                     ≈ 10*1.2         = 12
          + `h3` (margin 4/0/14, 15px)                4 + 15*1.2 + 14 = 36
          + 4× `.tr-mus-row` (30px `.tr-mus-art`, the tallest cell; margin-top 10 on
            every row but the first)                  30 + 3*(10+30) = 150
          + `.tr-mus-note` (margin-top 12, 11px)      12 + 11*1.2     = 25
          ────────────────────────────────────────────────────────────
                                                                 total ≈ 255px */}
      <div style={{ padding: '0 6px 14px' }}>
        <Skeleton width="100%" height={255} radius={22} />
      </div>
      {/* the „Vagy inkább" pair (`.tr-alt`) — min-height 44px + margin-bottom 16px. */}
      <div style={{ padding: '0 6px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
          <Skeleton width="100%" height={44} radius={16} />
          <Skeleton width="100%" height={44} radius={16} />
        </div>
      </div>
    </div>
  )
}
