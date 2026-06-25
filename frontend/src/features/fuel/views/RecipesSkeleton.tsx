// Layout-aware loading skeleton for FuelRecipesView (mezo-f2z). Mirrors the real
// Receptek shape — page-header → 5-segment typebar → a few editorial RecipeCards —
// so the swap to real content does not reflow. Built from the Skeleton primitives.
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton'

export default function RecipesSkeleton() {
  return (
    <div role="status" aria-label="Betöltés…">
      <div className="page-header">
        <div className="col gap-sm">
          <Skeleton width={120} height={16} /><Skeleton width={90} height={9} />
        </div>
        <Skeleton width={48} height={28} radius={9} />
      </div>
      {/* Segmented typebar — 5 chips (Mind / Reggeli / Ebéd / Vacsi / ★) */}
      <div style={{ padding: '0 24px 16px' }}>
        <div
          className="row gap-sm"
          style={{ padding: 5, background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: 13 }}
        >
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="flex-1" height={32} radius={8} />
          ))}
        </div>
      </div>
      {/* Recipe card placeholders — title line + meta line each */}
      <div style={{ padding: '0 24px 32px' }}>
        {Array.from({ length: 3 }, (_, i) => (
          <SkeletonCard key={i} style={{ marginBottom: 13 }}>
            <div className="col gap-sm">
              <Skeleton width="62%" height={14} /><Skeleton width="40%" height={9} />
            </div>
          </SkeletonCard>
        ))}
      </div>
    </div>
  )
}
