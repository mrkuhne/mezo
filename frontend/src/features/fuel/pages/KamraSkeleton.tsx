// Layout-aware loading skeleton for FuelKamraPage (mezo-f2z). Mirrors the real Kamra shape so
// the swap to real content does not reflow. Üveg (mezo-me75u.2): the shape is the re-dressed
// page's — sub-head (round back + eyebrow/title + the three header chips) → search → type chips →
// the two-column tile grid. The placeholders are FLAT cells (`uv-flat`): a loading state is not a
// shelf object yet, so it never wears the glass. Built from the Skeleton primitives.
import { Skeleton } from '@/shared/ui/Skeleton'

export default function KamraSkeleton() {
  return (
    <div role="status" aria-label="Betöltés…" className="fmx-page fkx-kamra fkk-skel">
      <div className="fmx-subhead">
        <Skeleton variant="circle" width={44} height={44} />
        <span className="fkk-skel-title"><Skeleton width={54} height={9} /><Skeleton width={96} height={18} /></span>
      </div>
      <div className="fkk-skel-bar uv-flat"><Skeleton width="46%" height={11} /></div>
      <div className="fkk-skel-chips">
        {Array.from({ length: 4 }, (_, i) => <span key={i} className="uv-flat" />)}
      </div>
      <div className="fkx-tile-grid">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="fkk-skel-tile uv-flat">
            <Skeleton variant="circle" width={42} height={42} />
            <Skeleton width="78%" height={12} />
            <Skeleton width="52%" height={10} />
            <Skeleton width="36%" height={9} />
          </div>
        ))}
      </div>
    </div>
  )
}
