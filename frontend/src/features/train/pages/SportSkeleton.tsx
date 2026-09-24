// Layout-aware loading skeleton for SportPage (mezo-f2z). Mirrors the üveg Sport shape
// (mezo-me75u.4) — the glass back pill + `＋ Log` pill → the halo hero (88px art, name,
// big numeral) → three flat stat cells → the segmented control — so the swap to real
// content does not reflow. Built from the Skeleton primitives.
import { Skeleton } from '@/shared/ui/Skeleton'

export default function SportSkeleton() {
  return (
    <div role="status" aria-label="Betöltés…" className="uvs-skel">
      <div className="uvs-skel-head">
        <Skeleton width={96} height={38} radius={999} />
        <Skeleton width={78} height={38} radius={999} />
      </div>
      {/* Halo hero — art, page name, big numeral */}
      <div className="uvs-skel-hero">
        <Skeleton width={88} height={88} radius={999} />
        <Skeleton width={80} height={22} />
        <Skeleton width={96} height={52} radius={14} />
      </div>
      {/* Three flat stat cells */}
      <div className="uvs-skel-row">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} height={58} radius={14} style={{ flex: 1 }} />
        ))}
      </div>
      {/* The segmented control */}
      <div className="uvs-skel-seg">
        <Skeleton width={270} height={44} radius={999} />
      </div>
    </div>
  )
}
