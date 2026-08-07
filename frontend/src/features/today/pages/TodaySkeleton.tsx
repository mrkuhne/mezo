// ============================================================
// Mezo · TodaySkeleton — the real-mode loading mirror of the
// three-islands layout (mezo-euze). Renders while `useSleepGoal`
// resolves (the face anchor): one big-island placeholder + two
// capsule bars in the same sky flex, so the resolve swap does not
// shift the page. Inert by design — no buttons, no tablist; a
// `role="status"` live region announces loading.
// AppHero is NOT here: TodayPage renders the same `appHero` element
// above both branches (node-identity contract, TodayPage.skeleton.test).
// ============================================================
import { Skeleton } from '@/shared/ui/Skeleton'

export default function TodaySkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Betöltés" className="sky-islands">
      <div className="isl isl-big" style={{ animation: 'none' }}>
        <div className="isl-bigview" style={{ opacity: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginTop: 26 }}>
            <Skeleton width={140} height={52} radius={12} />
            <Skeleton width={200} height={12} radius={6} />
            <Skeleton width={260} height={64} radius={14} />
          </div>
          <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'center', gap: 10, paddingTop: 14 }}>
            <Skeleton width={150} height={40} radius={999} />
            <Skeleton width={80} height={36} radius={999} />
          </div>
        </div>
      </div>
      <div className="isl" style={{ animation: 'none', display: 'flex', alignItems: 'center', padding: '0 16px' }}>
        <Skeleton width="70%" height={14} radius={7} />
      </div>
      <div className="isl" style={{ animation: 'none', display: 'flex', alignItems: 'center', padding: '0 16px' }}>
        <Skeleton width="60%" height={14} radius={7} />
      </div>
    </div>
  )
}
