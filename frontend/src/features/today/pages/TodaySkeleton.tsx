// Layout-aware loading skeleton for TodayPage (mezo-1khu). `useSleepGoal` decides
// which daypart face renders (dayFace.ts), and in real mode it resolves after the
// first paint — rendering a face derived from the placeholder anchor would flash
// the wrong one. This mirrors the real shape — greeting → the three face pills
// (`.dfs`) → the hero card (`.todaycard`) → the todo card (`.tdc`) — so the swap
// to the resolved face does not reflow. TrainTodaySkeleton precedent (mezo-f2z).
// The three pills are plain divs, NOT the real `.dfs` tablist/`role="tab"` buttons:
// a skeleton must not offer a screen-reader user tabs that do not exist yet.
import { Skeleton, SkeletonCard } from '@/shared/ui/Skeleton'

export default function TodaySkeleton() {
  return (
    <div aria-busy="true" aria-label="Betöltés">
      <div className="greet">
        <Skeleton width={140} height={11} />
        <div style={{ marginTop: 6 }}><Skeleton width="70%" height={22} /></div>
      </div>
      {/* Face pills — real `.dfs-pill` geometry, but a plain `.dfs` div (not a
          tablist) with no buttons: the faces are not selectable yet. */}
      <div className="dfs">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="dfs-pill" height={60} radius={16} />
        ))}
      </div>
      {/* Hero card — the day's session/ritual card shape. `.todaycard` carries its OWN
          `margin: 0 24px 12px` (ItemCard precedent), so no wrapping padding div here —
          one would double the horizontal inset against the viewport edge. */}
      <SkeletonCard className="todaycard" style={{ padding: 18 }}>
        <Skeleton width="40%" height={10} />
        <div style={{ marginTop: 10 }}><Skeleton width="62%" height={22} /></div>
        <Skeleton className="mt-md" width="100%" height={44} radius={4} />
      </SkeletonCard>
      {/* Todo card — header ratio + bar + three row-height bars. `.tdc` likewise carries
          its own margin, so `SkeletonCard`'s default padding is enough. */}
      <SkeletonCard className="tdc">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <Skeleton width={90} height={11} />
          <Skeleton width={50} height={11} />
        </div>
        <Skeleton className="mt-md" width="100%" height={5} radius={999} />
        <div className="col gap-sm mt-md">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} width="100%" height={40} radius={11} />
          ))}
        </div>
      </SkeletonCard>
    </div>
  )
}
