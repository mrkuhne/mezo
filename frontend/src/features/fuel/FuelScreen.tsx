import { Outlet } from 'react-router-dom'
import { FuelSubNav } from '@/features/fuel/FuelSubNav'

export function FuelScreen() {
  return (
    <>
      <FuelSubNav />
      <Outlet />
    </>
  )
}
