import { Outlet } from 'react-router-dom'
import { TrainSubNav } from './TrainSubNav'

// Thin shell (Fuel pattern): the sub-nav is pinned at the top and each sub-view
// renders its own `.page-header` (eyebrow + title) below it — Train's views need
// rich, data-driven headers (GYM title = active meso, Mai day-label, Sport + Log
// chip), so the header lives in the view, not the shell.
export function TrainScreen() {
  return (
    <>
      <TrainSubNav />
      <Outlet />
    </>
  )
}
