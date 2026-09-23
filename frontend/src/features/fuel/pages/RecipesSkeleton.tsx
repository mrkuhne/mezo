// Layout-aware loading skeleton for FuelRecipesPage (mezo-f2z). Mirrors the real
// Receptek shape so the swap to real content does not reflow. Üveg U2 (mezo-me75u.2): the
// sub-head (round back + eyebrow/title + Új), the six counted filter chips, and a few
// one-recipe-per-row placeholders (lit well + two lines + the kcal, then the macro strip),
// dressed as the page's own `.fkx-*` rows. Built from the Skeleton primitives.
import { Skeleton } from '@/shared/ui/Skeleton'

export default function RecipesSkeleton() {
  return (
    <div role="status" aria-label="Betöltés…" className="fmx-page fkx-library fkx-recipes">
      <div className="fmx-subhead">
        <Skeleton width={44} height={44} radius="50%" />
        <span className="col gap-sm">
          <Skeleton width={70} height={9} /><Skeleton width={130} height={20} />
        </span>
        <Skeleton width={64} height={34} radius={999} />
      </div>
      {/* Filter chips — Mind / Reggeli / Ebéd / Vacsi / Snack / Csillagos */}
      <div className="fkx-filters" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} width={i === 0 ? 64 : 88} height={36} radius={999} />
        ))}
      </div>
      {/* Recipe row placeholders — one recipe per row */}
      <div className="fkx-recipe-list" aria-hidden="true">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="fkx-recipe-row is-skeleton uv-flat">
            <span className="fkx-rrow-top">
              <Skeleton width={52} height={52} radius="50%" />
              <span className="fkx-rrow-copy col gap-sm">
                <Skeleton width="72%" height={14} /><Skeleton width="48%" height={9} />
              </span>
              <Skeleton width={42} height={24} radius={8} />
            </span>
            <span className="fkx-rrow-foot">
              <Skeleton width="100%" height={22} radius={8} />
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
