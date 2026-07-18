import { Outlet } from 'react-router-dom'
import { AppHero } from '@/features/progression/components/AppHero'
import { FuelSubNav } from '@/features/fuel/pages/FuelSubNav'

export function FuelSection() {
  return (
    <>
      <AppHero />
      <FuelSubNav />
      <Outlet />
    </>
  )
}
