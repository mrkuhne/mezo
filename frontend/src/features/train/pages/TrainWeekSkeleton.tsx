// Layout-aware loading skeleton for TrainWeekPage. Mirrors the üveg „Terhelés" order
// (mezo-me75u.4, prototype uveg-edzes.html#gym) so the swap does not reflow: the halo
// hero (the body figure on the LEFT, then eyebrow + big percent + sub-line + bar + one
// sentence + a chip row on the right) → the map doorway card → the 2-column grid of group
// tiles → the Mozgás doorway. The retired face's three load tiles + seven day cards are
// GONE from here too; a skeleton that promises a day list the page no longer draws is the
// reflow this file exists to prevent.
import { Skeleton, SkeletonCard } from '@/shared/ui/Skeleton'

export default function TrainWeekSkeleton() {
  return (
    <div role="status" aria-label="Betöltés…">
      {/* the hero: the body figure left, the drawn percent right */}
      <div style={{ display: 'grid', gridTemplateColumns: '112px 1fr', gap: 12, alignItems: 'center', padding: '8px 18px 6px' }}>
        <Skeleton width={104} height={200} radius={52} />
        <div className="col gap-xs">
          <Skeleton width={150} height={11} />
          <div style={{ marginTop: 8 }}><Skeleton width={120} height={56} /></div>
          <Skeleton width="90%" height={12} />
          <div style={{ marginTop: 10 }}><Skeleton width="100%" height={6} radius={999} /></div>
          <div style={{ marginTop: 8 }}><Skeleton width="86%" height={12} /></div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            <Skeleton width={64} height={30} radius={999} />
            <Skeleton width={96} height={30} radius={999} />
          </div>
        </div>
      </div>

      <div style={{ padding: '10px 16px 19px' }}>
        {/* the map doorway */}
        <Skeleton width="100%" height={120} radius={22} />

        {/* the group tiles, two per row */}
        <div style={{ marginTop: 22 }}><Skeleton width={190} height={13} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
          {Array.from({ length: 4 }, (_, i) => (
            <SkeletonCard key={i} style={{ height: 118, borderRadius: 20 }}>
              <Skeleton width="60%" height={14} />
              <div style={{ marginTop: 10 }}><Skeleton width="50%" height={20} /></div>
              <div style={{ marginTop: 9 }}><Skeleton width="100%" height={6} radius={999} /></div>
              <div style={{ marginTop: 9 }}><Skeleton width="70%" height={10} /></div>
            </SkeletonCard>
          ))}
        </div>

        {/* the Mozgás doorway */}
        <div style={{ marginTop: 16 }}><Skeleton width="100%" height={76} radius={22} /></div>
      </div>
    </div>
  )
}
