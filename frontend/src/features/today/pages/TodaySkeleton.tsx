// ============================================================
// Mezo · TodaySkeleton — the real-mode loading mirror of the daypart-tabs
// layout (mezo-puci). Renders while `useSleepGoal` resolves (the daypart
// anchor): a tab-row placeholder, the message band, and one day view, so
// the resolve swap does not shift the page. Inert by design — no buttons;
// a `role="status"` live region announces loading.
// AppHero is NOT here: TodayPage renders the same `appHero` element above
// both branches (node-identity contract, TodayPage.skeleton.test).
// ============================================================
import { Skeleton } from '@/shared/ui/Skeleton'

export default function TodaySkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Betöltés">
      <div className="daytabs">
        <div className="segtabs">
          <Skeleton width="100%" height={40} radius={12} />
          <Skeleton width="100%" height={40} radius={12} />
          <Skeleton width="100%" height={40} radius={12} />
        </div>
      </div>
      <div className="coach-bubble cb-band">
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Skeleton width={160} height={11} radius={6} />
          <Skeleton width="100%" height={54} radius={10} />
          <Skeleton width="85%" height={40} radius={10} />
        </div>
      </div>
      <div className="dayview" data-tone="nap" style={{ animation: 'none' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
          <Skeleton width={180} height={32} radius={10} />
          <Skeleton width={220} height={12} radius={6} />
          <Skeleton width="100%" height={72} radius={14} />
          <Skeleton width="100%" height={56} radius={14} />
          <Skeleton width="100%" height={56} radius={14} />
        </div>
      </div>
    </div>
  )
}
