import { Outlet } from 'react-router-dom'
import { FuelSubNav } from './FuelSubNav'

export function FuelScreen() {
  return (
    <>
      <FuelSubNav />
      <Outlet />
    </>
  )
}
