import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { PhoneFrame } from './PhoneFrame'
import { ScreenContent } from './ScreenContent'
import { TabBar } from './TabBar'
import { Fab } from './Fab'
import { QuickInputSheet } from '@/features/quickinput/QuickInputSheet'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { useTodayScenario } from '@/data/hooks'

export function AppLayout() {
  const [quickOpen, setQuickOpen] = useState(false)
  const scenario = useTodayScenario()
  const location = useLocation()
  const anchor = scenario.anchorMode && location.pathname.startsWith('/today')
  return (
    <PhoneFrame anchor={anchor}>
      <LevelUpProvider>
        <ScreenContent>
          <Outlet />
        </ScreenContent>
        <Fab onClick={() => setQuickOpen(true)} />
        {quickOpen && <QuickInputSheet onClose={() => setQuickOpen(false)} />}
        <TabBar />
      </LevelUpProvider>
    </PhoneFrame>
  )
}
