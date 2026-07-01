import { Skeleton, SkeletonCard, SkeletonText } from '@/components/ui/Skeleton'

// Generic full-screen loading skeleton (mezo-f2z) for views with no
// distinctive loadable layout to mirror — the two "blank-flash" routes that
// used to `return null` during the real-mode loading window (GoalPlanner,
// ActiveWorkoutScreen). A header line + a couple of card placeholders, under a
// single role="status" landmark so tests/AT can detect the loading state.
// Inert in mock mode: the views only mount it while their query is pending,
// and mock seeds resolve synchronously (no skeleton flash → Playwright parity).
export function ScreenSkeleton() {
  return (
    <div role="status" aria-label="Betöltés…">
      <div className="page-header"><Skeleton width={120} height={16} /></div>
      <div style={{ padding: '0 24px 12px' }}>
        <SkeletonCard style={{ marginBottom: 10 }}><SkeletonText lines={3} /></SkeletonCard>
        <SkeletonCard><SkeletonText lines={2} /></SkeletonCard>
      </div>
    </div>
  )
}
