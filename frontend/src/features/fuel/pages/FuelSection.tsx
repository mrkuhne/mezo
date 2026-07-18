import { Outlet } from 'react-router-dom'
import { AppHero } from '@/features/progression/components/AppHero'
import { FUEL_TABS } from '@/features/fuel/pages/tabs'
import { SubNavDropdown } from '@/shared/ui/SubNavDropdown'

export function FuelSection() {
  return (
    <>
      <AppHero
        utilities={
          <SubNavDropdown label="Fuel alnavigáció" items={FUEL_TABS} accent="var(--sage-deep)" />
        }
      />
      <Outlet />
    </>
  )
}
