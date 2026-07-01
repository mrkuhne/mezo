import { Outlet } from 'react-router-dom'
import { FuelSubNav } from '@/features/fuel/pages/FuelSubNav'

export function FuelSection() {
  return (
    <>
      <FuelSubNav />
      <Outlet />
    </>
  )
}
