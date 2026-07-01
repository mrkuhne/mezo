// Layout-aware loading skeleton for SportPage (mezo-f2z). Mirrors the real Sport shape —
// page-header → hero card (eyebrow/title/4 stats/explainer strip) → 3-button view switcher —
// so the swap to real content does not reflow. Built from the Skeleton primitives.
import { Skeleton, SkeletonCard } from '@/shared/ui/Skeleton'

export default function SportSkeleton() {
  return (
    <div role="status" aria-label="Betöltés…">
      <div className="page-header">
        <div className="col gap-xs"><Skeleton width={80} height={11} /><Skeleton width={110} height={20} /></div>
        <Skeleton width={56} height={28} radius={4} />
      </div>
      {/* Hero card — eyebrow + venue title + 4 week stats + explainer strip */}
      <div style={{ padding: '0 24px 16px' }}>
        <SkeletonCard style={{ padding: 18 }}>
          <Skeleton width="40%" height={10} />
          <div style={{ marginTop: 8 }}><Skeleton width="58%" height={22} /></div>
          <div
            className="row gap-md mt-lg"
            style={{ paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}
          >
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="col gap-sm" style={{ flex: 1 }}>
                <Skeleton width="60%" height={9} /><Skeleton width="50%" height={16} /><Skeleton width="70%" height={8} />
              </div>
            ))}
          </div>
          <Skeleton className="mt-md" width="100%" height={36} radius={4} />
        </SkeletonCard>
      </div>
      {/* View switcher — 3 equal chips */}
      <div className="row gap-xs" style={{ padding: '0 24px 12px' }}>
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} height={38} radius={4} style={{ flex: 1 }} />
        ))}
      </div>
    </div>
  )
}
