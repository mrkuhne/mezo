// Layout-aware loading skeleton for TrainWeekPage. Mirrors the Titanium
// „Terhelés" order (mezo-88iwa.13, T12 Task 3) so the swap does not reflow:
// the full-bleed hero (eyebrow + big percent + sub-line + bar + one sentence +
// a chip row, with the round art block on the right) → the map doorway card →
// four group cards → the Mozgás doorway. The retired face's three load tiles +
// seven day cards are GONE from here too; a skeleton that promises a day list
// the page no longer draws is the reflow this file exists to prevent.
import { Skeleton, SkeletonCard } from '@/shared/ui/Skeleton'

export default function TrainWeekSkeleton() {
  return (
    <div role="status" aria-label="Betöltés…">
      {/* the hero, full-bleed: art circle on the right, the drawn percent on the left */}
      <div style={{ position: 'relative', padding: '18px 24px 20px' }}>
        <div style={{ position: 'absolute', top: 20, right: 18 }}>
          <Skeleton width={104} height={104} radius={52} />
        </div>
        <div className="col gap-xs">
          <Skeleton width={150} height={11} />
          <div style={{ marginTop: 8 }}><Skeleton width={120} height={50} /></div>
          <Skeleton width={175} height={12} />
        </div>
        <div style={{ marginTop: 12 }}><Skeleton width="72%" height={12} radius={999} /></div>
        <div style={{ marginTop: 13 }}><Skeleton width="86%" height={12} /></div>
        <div style={{ display: 'flex', gap: 7, marginTop: 14 }}>
          <Skeleton width={92} height={30} radius={999} />
          <Skeleton width={74} height={30} radius={999} />
        </div>
      </div>

      <div style={{ padding: '6px 24px 19px' }}>
        {/* the map doorway */}
        <Skeleton width={120} height={13} />
        <div style={{ marginTop: 10 }}><Skeleton width="100%" height={104} radius={20} /></div>

        {/* the group cards */}
        <div style={{ marginTop: 22 }}><Skeleton width={190} height={13} /></div>
        <div className="col gap-sm" style={{ marginTop: 10 }}>
          {Array.from({ length: 4 }, (_, i) => (
            <SkeletonCard key={i} style={{ height: 82, borderRadius: 18 }}>
              <Skeleton width="46%" height={14} />
              <div style={{ marginTop: 9 }}><Skeleton width="100%" height={10} radius={999} /></div>
              <div style={{ marginTop: 9 }}><Skeleton width="40%" height={10} /></div>
            </SkeletonCard>
          ))}
        </div>

        {/* the Mozgás doorway */}
        <div style={{ marginTop: 16 }}><Skeleton width="100%" height={70} radius={20} /></div>
      </div>
    </div>
  )
}
