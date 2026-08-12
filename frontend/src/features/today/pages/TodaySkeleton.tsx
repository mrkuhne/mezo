// ============================================================
// Mezo · TodaySkeleton — the real-mode loading mirror of the daypart-tabs
// iOS-list layout (mezo-e26w). Renders while `useSleepGoal` resolves (the
// daypart anchor): a segmented-tab placeholder, the MezoChip placeholder,
// and one daypart's hero + stats + list boxes, so the resolve swap does
// not shift the page. Inert by design — no buttons; a `role="status"`
// live region announces loading. Uses the `.td-skel*` layout classes
// (Task 1) instead of inline style — the page's CSS lives in one place.
// AppHero is NOT here: TodayPage renders the same `appHero` element above
// both branches (node-identity contract, TodayPage.skeleton.test).
// ============================================================
import { Skeleton } from '@/shared/ui/Skeleton'

export default function TodaySkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Betöltés">
      <div className="daytabs td-segwrap"><Skeleton height={44} /></div>
      <div className="td-skel td-skel-chip"><Skeleton height={44} /></div>
      <div className="td-skel td-skel-hero"><Skeleton height={44} width="60%" /></div>
      <div className="td-skel td-skel-stats"><Skeleton height={78} /></div>
      <div className="td-skel td-skel-list"><Skeleton height={168} /></div>
    </div>
  )
}
