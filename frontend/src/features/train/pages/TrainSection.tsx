import { Outlet } from 'react-router-dom'
import { AppHero } from '@/features/progression/components/AppHero'
import { TrainSubNav } from '@/features/train/pages/TrainSubNav'

// Thin shell (Fuel pattern): AppHero (the unified identity header, spec §3) sits
// above the sub-nav, which is pinned at the top; each sub-view renders its own
// `.page-header` (eyebrow + title) below it — Train's views need rich,
// data-driven headers (GYM title = active meso, Mai day-label, Sport + Log
// chip), so that header lives in the view, not the shell.
export function TrainSection() {
  return (
    <>
      <AppHero />
      <TrainSubNav />
      <Outlet />
    </>
  )
}
