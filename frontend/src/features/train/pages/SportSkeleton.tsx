// Layout-aware loading skeleton for SportPage (mezo-f2z). Mirrors the real Sport shape —
// page-header → hero card (eyebrow/title/4 stats/explainer strip) → 3-button view switcher —
// so the swap to real content does not reflow. Built from the Skeleton primitives.
// Sizes track the DS re-skin (mezo-setx.6.5): 36px h1, 44px header action and
// segmented tabs, StatStrip-shaped hero stats.
import { Skeleton, SkeletonCard } from '@/shared/ui/Skeleton'

export default function SportSkeleton() {
  return (
    <div role="status" aria-label="Betöltés…">
      <div className="page-header">
        <div className="col gap-xs"><Skeleton width={110} height={12} /><Skeleton width={150} height={36} /></div>
        <Skeleton width={72} height={44} radius={999} />
      </div>
      {/* Hero card — eyebrow + venue title + 4 week stats + explainer strip */}
      <div style={{ padding: '0 24px 16px' }}>
        <SkeletonCard style={{ padding: 16 }}>
          <Skeleton width="40%" height={12} />
          <div style={{ marginTop: 8 }}><Skeleton width="58%" height={24} /></div>
          <div className="row gap-md mt-lg">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="col gap-sm" style={{ flex: 1 }}>
                <Skeleton width="55%" height={20} /><Skeleton width="70%" height={9} /><Skeleton width="60%" height={11} />
              </div>
            ))}
          </div>
          <Skeleton className="mt-md" width="100%" height={44} radius={14} />
        </SkeletonCard>
      </div>
      {/* View switcher — 3 equal segments at the DS 44px tap height */}
      <div className="row gap-sm" style={{ padding: '0 24px 12px' }}>
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} height={44} radius={14} style={{ flex: 1 }} />
        ))}
      </div>
    </div>
  )
}
