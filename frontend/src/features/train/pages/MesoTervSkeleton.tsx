// Layout-aware loading skeleton for MesoTervPage (mezo-88iwa.10 Task 3, T9 fix round 1).
// Mirrors the CURRENT poster-anatomy landing — `.pl-poster` → `.pl-days` rows → `.pl-dests`
// tiles — so the swap to real content does not reflow. This is NOT the deleted
// MesocycleLibraryPage's page-header/card-list shape, which `MesocycleSkeleton` still
// carries — that skeleton stays exactly as it was, now for `MesoKonyvtarPage` (the page
// that actually IS that shape). Built from the Skeleton primitives; sizes track the
// `.pl-poster`/`.pl-day`/`.pl-dest` geometry (src/styles/prototype.css), browser default
// line-height ≈ 1.2× font-size for lines without an explicit line-height (the same
// derivation idiom TrainTodaySkeleton.tsx uses for `.tr-day`/`.tr-energy`/`.tr-mus`).
import { Skeleton } from '@/shared/ui/Skeleton'

export default function MesoTervSkeleton() {
  return (
    <div role="status" aria-label="Betöltés…">
      {/* The poster (`.pl-poster`, prototype.css:13890) —
            padding-top 20
          + top row (week numeral + phase pill + ring; align-items:center, tallest
            child the 68×68 `.pl-ring`)                                        68
          + h2 (margin 14/0/6, 29px @ ~1.2 default line-height ≈ 35)     14+35+6 = 55
          + the one sentence (`.pl-poster p`, margin-bottom 16, 12.5px
            @ explicit line-height 1.6 ≈ 20)                                20+16 = 36
          + the week arc (`.pl-arc`, height 60 + margin-bottom 18)          60+18 = 78
          + padding-bottom                                                          24
          ────────────────────────────────────────────────────────────────────────────
                                                                        total ≈ 281px */}
      <div style={{ padding: '0 6px 14px' }}>
        <Skeleton width="100%" height={281} radius={0} />
      </div>
      {/* „A HETED" eyebrow + one row per training day (`.pl-day`, prototype.css:13977) —
            padding-top 14
          + `.pl-day-head` (28px tag, tallest cell)                                 28
          + gap                                                                     12
          + `.pl-day-facts` (padding 8/10, 22px icon the tallest cell ≈ 38)          38
          + gap                                                                     12
          + `.pl-day-bars` (mini bars, ~8px tall)                                    8
          + padding-bottom                                                          14
          ────────────────────────────────────────────────────────────────────────────
                                                                        total ≈ 126px.
          5 rows — the typical training-day count (meso-hyp-04: Hét/Kedd/Sze/Csü/Pén),
          matching the poster's own reserved-space approach (TrainTodaySkeleton's 4-chip
          constellation placeholder). */}
      <div style={{ padding: '2px var(--screen-gutter) 8px' }}>
        <Skeleton width={80} height={10} />
      </div>
      <div style={{ display: 'grid', gap: 8, padding: '0 var(--screen-gutter)' }}>
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} width="100%" height={126} radius={18} />
        ))}
      </div>
      {/* The two dest tiles (`.pl-dests`/`.pl-dest`, prototype.css:14018) —
            padding-top 16 + padding-bottom 14                                      30
          + `.pl-dest-art` (40px icon + margin-bottom 7)                            47
          + `strong` (14px @ 1.25 ≈ 17.5)                                         17.5
          + `small` (10.5px @ 1.35 ≈ 14)                                            14
          + two 3px item gaps                                                        6
          ────────────────────────────────────────────────────────────────────────────
                                                                    total ≈ 114.5 → 115px */}
      <div
        style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
          padding: '18px var(--screen-gutter) 4px',
        }}
      >
        <Skeleton width="100%" height={115} radius={22} />
        <Skeleton width="100%" height={115} radius={22} />
      </div>
    </div>
  )
}
