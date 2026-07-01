import { Outlet, useLocation } from 'react-router-dom'
import { PhoneFrame } from '@/app/PhoneFrame'
import { ScreenContent } from '@/app/ScreenContent'
import { TabBar } from '@/app/TabBar'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { useTodayScenario } from '@/data/hooks'

export function AppLayout() {
  const scenario = useTodayScenario()
  const location = useLocation()
  const anchor = scenario.anchorMode && location.pathname.startsWith('/today')
  return (
    <PhoneFrame anchor={anchor}>
      <LevelUpProvider>
        <ScreenContent>
          <Outlet />
        </ScreenContent>
        <TabBar />
      </LevelUpProvider>
    </PhoneFrame>
  )
}
