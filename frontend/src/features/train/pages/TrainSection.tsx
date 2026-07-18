import { Outlet } from 'react-router-dom'
import { AppHero } from '@/features/progression/components/AppHero'
import { TRAIN_TABS } from '@/features/train/pages/tabs'
import { SubNavDropdown } from '@/shared/ui/SubNavDropdown'

// Thin shell: the sticky AppHero row carries the sub-nav as a dropdown (compact-header
// spec §5); each sub-view renders its own `.pghead-np` (eyebrow + title) below it —
// Train's views need rich, data-driven headers (GYM title = active meso, Mai day-label,
// Sport + Log chip), so that header lives in the view, not the shell.
export function TrainSection() {
  return (
    <>
      <AppHero
        utilities={
          <SubNavDropdown label="Train alnavigáció" items={TRAIN_TABS} accent="var(--coral-deep)" />
        }
      />
      <Outlet />
    </>
  )
}
