// Layout-aware loading skeleton for the plan library (`MesoKonyvtarPage`, and the closed-run
// page that split off it). Train Titanium T10 Task 2 (mezo-88iwa.11) REWRITES it to the new
// geometry: the old page-header → eyebrow → 2 meso-card shape belonged to the deleted
// DS-era `MesocycleLibraryPage` face and reflowed hard against the Titanium landing.
// Now it mirrors what the page actually renders — the full-bleed `.pl-lhero` poster, a
// section heading, the running/queued `.pl-lib-card` rows, the loud `.pl-lib-new` CTA and
// the two `.pl-dest` doorways — so the swap to real content does not jump.
// Geometry derived from the rules in src/styles/prototype.css (the same derivation idiom
// MesoTervSkeleton.tsx uses for `.pl-poster`/`.pl-day`/`.pl-dest`).
import { Skeleton } from '@/shared/ui/Skeleton'

export default function MesocycleSkeleton() {
  return (
    <div role="status" aria-label="Betöltés…">
      {/* The hero (`.pl-dhero.pl-lhero`) —
            padding-top 58 (the docked back pill) + padding-bottom 24
          + eyebrow (~12 @ 1.2 ≈ 14)                                     14
          + h2 (margin 10/0/6, 27px @ ~1.2 ≈ 32)                   10+32+6 = 48
          + the one sentence (12.5px @ 1.6 ≈ 20, two lines on a phone)    40
          + the facts row (`.pl-poster-foot`, margin-top 12, ~24 pills)   36
          ────────────────────────────────────────────────────────────────────
                                                                total ≈ 220px */}
      <Skeleton width="100%" height={220} radius={0} />
      {/* „Most fut" heading (`.pl-h3`, margin 26/0/10) + the running card
          (`.pl-lib-card.is-now`: padding 13/14, head ≈ 20, gap 10, note ≈ 14) ≈ 70px */}
      <div style={{ padding: '26px var(--screen-gutter) 0' }}>
        <Skeleton width={90} height={13} />
      </div>
      <div style={{ display: 'grid', gap: 8, padding: '10px var(--screen-gutter) 0' }}>
        <Skeleton width="100%" height={70} radius={20} />
      </div>
      {/* „Következnek" heading + two queued cards (head ≈ 20 + gap 10 + `.pl-day-facts`
          box ≈ 56 + padding 26 ≈ 112px) */}
      <div style={{ padding: '26px var(--screen-gutter) 0' }}>
        <Skeleton width={120} height={13} />
      </div>
      <div style={{ display: 'grid', gap: 8, padding: '10px var(--screen-gutter) 0' }}>
        {Array.from({ length: 2 }, (_, i) => (
          <Skeleton key={i} width="100%" height={112} radius={20} />
        ))}
      </div>
      {/* The loud „Új terv" CTA (`.pl-lib-new`: padding 14/16 + 42px art) ≈ 70px */}
      <div style={{ padding: '18px var(--screen-gutter) 0' }}>
        <Skeleton width="100%" height={70} radius={22} />
      </div>
      {/* The two doorways (`.pl-dest`, the same 115px MesoTervSkeleton derives) */}
      <div
        style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
          padding: '22px var(--screen-gutter) 4px',
        }}
      >
        <Skeleton width="100%" height={115} radius={22} />
        <Skeleton width="100%" height={115} radius={22} />
      </div>
    </div>
  )
}
